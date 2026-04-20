import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Group {
  id: string;
  user_id: string;
  institution: string;
  name: string;
  level_code: string;
  language: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  group_id: string;
  full_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export function useGroups() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("institution", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Group[];
    },
  });
}

export function useStudents(groupId?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["students", user?.id, groupId ?? "all"],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("students").select("*").order("full_name", { ascending: true });
      if (groupId) q = q.eq("group_id", groupId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<Group> & { name: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("groups")
        .insert({
          user_id: user.id,
          institution: input.institution ?? "",
          name: input.name,
          level_code: input.level_code ?? "",
          language: input.language ?? "en",
          notes: input.notes ?? "",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Group;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Group> & { id: string }) => {
      const { data, error } = await supabase
        .from("groups")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Group;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { group_id: string; full_name: string; notes?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("students")
        .insert({
          user_id: user.id,
          group_id: input.group_id,
          full_name: input.full_name,
          notes: input.notes ?? "",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Student;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useBulkCreateStudents() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ group_id, names }: { group_id: string; names: string[] }) => {
      if (!user) throw new Error("Not authenticated");
      const rows = names
        .map((n) => n.trim())
        .filter(Boolean)
        .map((full_name) => ({ user_id: user.id, group_id, full_name, notes: "" }));
      if (rows.length === 0) return [];
      const { data, error } = await supabase.from("students").insert(rows).select();
      if (error) throw error;
      return data as Student[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Student> & { id: string }) => {
      const { data, error } = await supabase
        .from("students")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Student;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}
