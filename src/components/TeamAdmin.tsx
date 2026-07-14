import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Loader2, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRoles, type AppRole } from "@/hooks/useRoles";

interface Member {
  user_id: string;
  full_name: string;
  roles: AppRole[];
}

export function TeamAdmin() {
  const { isAdmin, loading: rolesLoading } = useRoles();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [newUserId, setNewUserId] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const byId = new Map<string, Member>();
    (profiles ?? []).forEach((p: any) =>
      byId.set(p.id, { user_id: p.id, full_name: p.full_name || "(no name)", roles: [] })
    );
    (roles ?? []).forEach((r: any) => {
      const m = byId.get(r.user_id) ?? { user_id: r.user_id, full_name: "(unknown)", roles: [] };
      m.roles.push(r.role as AppRole);
      byId.set(r.user_id, m);
    });
    setMembers(Array.from(byId.values()).sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (rolesLoading) return null;
  if (!isAdmin) return null;

  const toggle = async (userId: string, role: AppRole, has: boolean) => {
    setBusy(`${userId}:${role}`);
    try {
      if (has) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
      await load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const grantById = async () => {
    const id = newUserId.trim();
    if (!id) return;
    setBusy("grant");
    try {
      const { error } = await supabase.from("user_roles").insert({ user_id: id, role: "educator" as AppRole });
      if (error) throw error;
      setNewUserId("");
      await load();
      toast({ title: "Educator role granted" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-display text-lg">Team & Roles</CardTitle>
            <CardDescription>Manage which signed-in users can run exams or administer the workspace.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading team…</div>
        ) : (
          <div className="space-y-2">
            {members.map(m => {
              const hasEdu = m.roles.includes("educator");
              const hasAdm = m.roles.includes("admin");
              return (
                <div key={m.user_id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.full_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.user_id}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {(["educator", "senior", "admin"] as AppRole[]).map(r => {
                      const has = m.roles.includes(r);
                      return (
                        <Button
                          key={r}
                          size="sm"
                          variant={has ? "default" : "outline"}
                          disabled={busy === `${m.user_id}:${r}`}
                          onClick={() => toggle(m.user_id, r, has)}
                        >
                          {busy === `${m.user_id}:${r}` ? <Loader2 className="h-3 w-3 animate-spin" /> : (has ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />)}
                          <span className="ml-1 capitalize">{r}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-lg border border-dashed border-border p-3">
          <Label htmlFor="grantId" className="text-xs">Grant educator role by user ID</Label>
          <div className="mt-2 flex gap-2">
            <Input id="grantId" placeholder="UUID of the signed-up user" value={newUserId} onChange={e => setNewUserId(e.target.value)} />
            <Button onClick={grantById} disabled={busy === "grant" || !newUserId.trim()}>
              {busy === "grant" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">New users get the educator role automatically. Use this only if you need to re-grant access.</p>
        </div>
      </CardContent>
    </Card>
  );
}
