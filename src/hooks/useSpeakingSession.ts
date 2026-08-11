import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import type { ScribeWord } from "@/lib/transcribe";
import type { SpeakerMap } from "@/lib/applySpeakerMap";

export type TranscriptionMode = Database["public"]["Enums"]["transcription_mode"];
export type SessionStatus = "open" | "closed";
export type AttemptStatus =
  | "recorded"
  | "transcribing"
  | "reviewing_speakers"
  | "analyzing"
  | "reviewing_report"
  | "done"
  | "failed";


export interface SpeakingSession {
  id: string;
  title: string;
  level_code: string;
  language: string;
  notes: string;
  status: SessionStatus;
  transcription_mode: TranscriptionMode;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SessionMaterial {
  id: string;
  session_id: string;
  kind: string;
  image_path: string;
  description: string;
  ai_description: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SessionAttempt {
  id: string;
  session_id: string;
  candidate_names: string[];
  candidate_ids: (string | null)[];
  audio_path: string;
  duration_seconds: number | null;
  transcription_mode: TranscriptionMode;
  status: AttemptStatus;
  transcript: string;
  live_transcript: string;
  live_words: ScribeWord[] | null;
  speaker_map: SpeakerMap | null;
  /** AI analysis awaiting examiner review (not a confirmed report yet). */
  analysis_result: any | null;
  recorded_at: string;

  created_at: string;
  updated_at: string;
}

export interface SessionWithDetails extends SpeakingSession {
  materials: SessionMaterial[];
  attempts: SessionAttempt[];
}

export function useSessions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["speaking_sessions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speaking_sessions")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SpeakingSession[];
    },
  });
}

export function useSession(sessionId?: string | null) {
  return useQuery({
    queryKey: ["speaking_session", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speaking_sessions")
        .select("*, materials:session_materials(*), attempts:session_attempts(*)")
        .eq("id", sessionId!)
        .single();
      if (error) throw error;
      const session = data as unknown as SessionWithDetails;
      session.materials = session.materials ?? [];
      session.attempts = session.attempts ?? [];
      return session;
    },
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      level_code: string;
      language: string;
      notes?: string;
      transcription_mode?: TranscriptionMode;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("speaking_sessions")
        .insert({
          user_id: user.id,
          title: input.title,
          level_code: input.level_code,
          language: input.language ?? "en",
          notes: input.notes ?? "",
          transcription_mode: input.transcription_mode ?? "manual",
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      return data as SpeakingSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_sessions"] }),
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SpeakingSession> & { id: string }) => {
      const { data, error } = await supabase
        .from("speaking_sessions")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SpeakingSession;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["speaking_sessions"] });
      qc.invalidateQueries({ queryKey: ["speaking_session", variables.id] });
    },
  });
}

export function useCloseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("speaking_sessions")
        .update({ status: "closed" })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SpeakingSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_sessions"] }),
  });
}

/**
 * Delete a session with its materials, attempts and stored files.
 * Signed reports already saved in Reports are NOT affected.
 */
export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const [{ data: materials }, { data: attempts }] = await Promise.all([
        supabase.from("session_materials").select("image_path").eq("session_id", sessionId),
        supabase.from("session_attempts").select("audio_path").eq("session_id", sessionId),
      ]);
      const imagePaths = (materials ?? []).map((m) => m.image_path).filter(Boolean) as string[];
      const audioPaths = (attempts ?? []).map((a) => a.audio_path).filter(Boolean) as string[];
      if (imagePaths.length > 0) {
        const { error } = await supabase.storage.from("exam-context").remove(imagePaths);
        if (error) console.warn("[useDeleteSession] images:", error.message);
      }
      if (audioPaths.length > 0) {
        const { error } = await supabase.storage.from("exam-audio").remove(audioPaths);
        if (error) console.warn("[useDeleteSession] audio:", error.message);
      }
      // Detach signed reports so they survive the session deletion.
      await supabase.from("exams").update({ session_id: null, attempt_id: null }).eq("session_id", sessionId);
      await supabase.from("session_materials").delete().eq("session_id", sessionId);
      await supabase.from("session_attempts").delete().eq("session_id", sessionId);
      const { error } = await supabase.from("speaking_sessions").delete().eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["speaking_sessions"] });
      qc.invalidateQueries({ queryKey: ["speaking_session"] });
    },
  });
}

export function useUploadSessionAudio() {
  const { user } = useAuth();
  return useCallback(
    async (blob: Blob, sessionId: string, attemptId: string) => {
      if (!user) throw new Error("Not authenticated");
      const ext = (blob.type || "audio/webm").includes("mp4") ? "mp4" : "webm";
      const path = `${user.id}/${sessionId}/${attemptId}.${ext}`;
      const { error } = await supabase.storage
        .from("exam-audio")
        .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });
      if (error) throw error;
      return path;
    },
    [user]
  );
}

export function useCreateAttempt() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uploadAudio = useUploadSessionAudio();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      candidateNames: string[];
      candidateIds: (string | null)[];
      audioBlob: Blob;
      durationSeconds: number;
      transcriptionMode: TranscriptionMode;
      liveTranscript?: string;
      liveWords?: ScribeWord[];
    }) => {
      if (!user) throw new Error("Not authenticated");
      const id = crypto.randomUUID();
      const audioPath = await uploadAudio(input.audioBlob, input.sessionId, id);
      const { data, error } = await supabase
        .from("session_attempts")
        .insert({
          id,
          user_id: user.id,
          session_id: input.sessionId,
          candidate_names: input.candidateNames as any,
          candidate_ids: input.candidateIds as any,
          audio_path: audioPath,
          duration_seconds: input.durationSeconds,
          transcription_mode: input.transcriptionMode,
          status: "recorded",
          transcript: "",
          live_transcript: input.liveTranscript ?? "",
          live_words: (input.liveWords ?? null) as any,
          recorded_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SessionAttempt;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_session"] }),
  });
}

export function useUpdateAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<SessionAttempt> & { id: string }) => {
      const { id, ...rest } = patch;
      const updatePayload: any = { ...rest };
      if (rest.candidate_names) updatePayload.candidate_names = rest.candidate_names as any;
      if (rest.candidate_ids) updatePayload.candidate_ids = rest.candidate_ids as any;
      if (rest.live_words) updatePayload.live_words = rest.live_words as any;
      if (rest.speaker_map) updatePayload.speaker_map = rest.speaker_map as any;
      const { data, error } = await supabase
        .from("session_attempts")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SessionAttempt;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["speaking_session"] });
      qc.invalidateQueries({ queryKey: ["session_attempt", variables.id] });
    },
  });
}

export function useDeleteAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attempt: SessionAttempt) => {
      const { error: storageError } = await supabase.storage
        .from("exam-audio")
        .remove([attempt.audio_path]);
      if (storageError) console.warn("[useDeleteAttempt] failed to remove audio:", storageError.message);
      const { error } = await supabase.from("session_attempts").delete().eq("id", attempt.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_session"] }),
  });
}

export function useAddMaterial() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      file: File;
      kind: string;
      description?: string;
      aiDescription?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const ext = input.file.name.split(".").pop() ?? "jpg";
      const imagePath = `${user.id}/${input.sessionId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("exam-context")
        .upload(imagePath, input.file, { contentType: input.file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data, error } = await supabase
        .from("session_materials")
        .insert({
          user_id: user.id,
          session_id: input.sessionId,
          kind: input.kind,
          image_path: imagePath,
          description: input.description ?? "",
          ai_description: input.aiDescription ?? "",
        })
        .select()
        .single();
      if (error) throw error;
      return data as SessionMaterial;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_session"] }),
  });
}

export function useUpdateMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SessionMaterial> & { id: string }) => {
      const { data, error } = await supabase
        .from("session_materials")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as SessionMaterial;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_session"] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (material: SessionMaterial) => {
      const { error: storageError } = await supabase.storage.from("exam-context").remove([material.image_path]);
      if (storageError) console.warn("[useDeleteMaterial] failed to remove image:", storageError.message);
      const { error } = await supabase.from("session_materials").delete().eq("id", material.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_session"] }),
  });
}

export function useDescribeMaterial() {
  return useCallback(async (imagePath: string, kind: string) => {
    const { data, error } = await supabase.functions.invoke<{ description: string }>("describe-material", {
      body: { storagePath: imagePath, kind },
    });
    if (error) throw error;
    if (!data?.description) throw new Error("No description returned");
    return data.description;
  }, []);
}

export function useMaterialSignedUrls(imagePaths: string[]) {
  const paths = imagePaths.filter(Boolean);
  return useQuery({
    queryKey: ["session_materials_urls", paths],
    enabled: paths.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("exam-context")
        .createSignedUrls(paths, 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((item) => {
        if (item.signedUrl) map[item.path] = item.signedUrl;
      });
      return map;
    },
    staleTime: 1000 * 60 * 30,
  });
}


export function useStudentGroups(studentIds: (string | null)[]) {
  const ids = studentIds.filter(Boolean) as string[];
  return useQuery({
    queryKey: ["student-groups", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, group_id, groups(institution, name)")
        .in("id", ids);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        group_id: string;
        groups: { institution: string; name: string };
      }>;
    },
  });
}
