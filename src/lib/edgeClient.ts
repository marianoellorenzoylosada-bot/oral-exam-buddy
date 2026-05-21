import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface CallOptions {
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Thin replacement for supabase.functions.invoke() that:
 *  - guarantees a fresh user JWT (refreshes if within 60s of expiry),
 *  - sends Authorization + apikey headers explicitly,
 *  - surfaces the real HTTP status + response body on failure,
 *  - distinguishes network errors from HTTP errors.
 */
export async function callEdgeFunction<T = unknown>(
  name: string,
  { body, signal, timeoutMs }: CallOptions = {},
): Promise<T> {
  // Ensure we have a session and refresh if it's about to expire.
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData?.session;
  if (!session) {
    throw new Error("Unauthorized — please sign in again.");
  }
  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  if (expiresAt - nowSec < 60) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      throw new Error("Unauthorized — please sign in again.");
    }
    session = refreshed.session;
  }

  // Compose abort signal that combines caller's signal with optional timeout.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort);
  }
  const timeoutId = timeoutMs
    ? setTimeout(() => controller.abort(new DOMException("Timeout", "AbortError")), timeoutMs)
    : null;

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(timeoutMs ? `${name} timed out — tap Retry.` : `${name} cancelled.`);
    }
    throw new Error(`Network error reaching ${name}: ${err?.message ?? "unknown"}`);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", onAbort);
  }

  const text = await response.text();
  let parsed: any = undefined;
  if (text) {
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized — please sign in again.");
    }
    const msg = parsed?.error || parsed?.message || text || `HTTP ${response.status}`;
    throw new Error(`${name} failed (${response.status}): ${msg}`);
  }

  if (parsed?.error) throw new Error(parsed.error);
  return parsed as T;
}
