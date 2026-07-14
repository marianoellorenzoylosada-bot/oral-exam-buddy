import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AppRole = "admin" | "educator" | "senior";

export function useRoles() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRoles([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load roles", error);
          setRoles([]);
        } else {
          setRoles((data ?? []).map((r: any) => r.role as AppRole));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const isAdmin = roles.includes("admin");
  const isSenior = roles.includes("senior") || isAdmin;
  return {
    roles,
    loading: authLoading || loading,
    isAdmin,
    isSenior,
    isEducator: roles.includes("educator"),
  };
}
