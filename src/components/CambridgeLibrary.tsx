import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Trash2, Plus, Loader2, FileText, ShieldCheck, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CAMBRIDGE_EXAMS, type CambridgeLevel } from "@/lib/cambridgeRubrics";
import { extractTextFromFile } from "@/lib/extractText";
import { useRoles } from "@/hooks/useRoles";


type Kind = "sample_transcript" | "examiner_comments" | "handbook_extract";

interface RefItem {
  id: string;
  level_code: CambridgeLevel;
  kind: Kind;
  title: string;
  content: string;
  source_url: string;
  created_at: string;
}

const KIND_LABEL: Record<Kind, string> = {
  sample_transcript: "Sample transcript",
  examiner_comments: "Examiner comments",
  handbook_extract: "Handbook extract",
};

const KIND_HINT: Record<Kind, string> = {
  sample_transcript: "Paste the transcript of a Cambridge sample speaking video (e.g. YouTube subtitles).",
  examiner_comments: "Paste the official examiner comments PDF accompanying a sample (band-by-band justification).",
  handbook_extract: "Paste extended descriptors or sample performances from the official Cambridge handbook.",
};

const MAX_CONTENT_CHARS = 30_000;

export function CambridgeLibrary() {
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useRoles();
  const [items, setItems] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [editing, setEditing] = useState<RefItem | null>(null);
  const [updating, setUpdating] = useState(false);


  const [level, setLevel] = useState<CambridgeLevel>("B2");
  const [kind, setKind] = useState<Kind>("sample_transcript");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cambridge_reference_material")
      .select("*")
      .order("level_code", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load library", description: error.message, variant: "destructive" });
    } else {
      setItems((data ?? []) as RefItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin]);


  const handleFile = async (file: File) => {
    setExtracting(true);
    try {
      const text = await extractTextFromFile(file);
      setContent((prev) => (prev ? prev + "\n\n" : "") + text);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast({ title: "Text extracted", description: `${text.length.toLocaleString()} characters added.` });
    } catch (e: any) {
      toast({ title: "Extraction failed", description: e?.message ?? "Try pasting the text instead.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Missing fields", description: "Title and content are required.", variant: "destructive" });
      return;
    }
    if (content.length > MAX_CONTENT_CHARS) {
      toast({
        title: "Content too long",
        description: `Trim to under ${MAX_CONTENT_CHARS.toLocaleString()} characters (currently ${content.length.toLocaleString()}).`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      toast({ title: "Not signed in", variant: "destructive" });
      setSaving(false);
      return;
    }
    // Admin-managed Core Library entry — user_id is NULL so it's global.
    const { error } = await supabase.from("cambridge_reference_material").insert({
      user_id: null,
      created_by: userId,
      level_code: level,
      kind,
      title: title.trim(),
      content: content.trim(),
      source_url: sourceUrl.trim(),
    });

    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reference saved", description: `Added to ${level} library.` });
    setTitle("");
    setContent("");
    setSourceUrl("");
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("cambridge_reference_material").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (roleLoading) return null;
  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              Cambridge Core Library
              <Badge variant="outline" className="gap-1 text-[10px]"><ShieldCheck className="h-3 w-3" /> Admin only</Badge>
            </CardTitle>
            <CardDescription>
              Curated Cambridge knowledge base. Entries you add here are injected into every analysis for all educators on this workspace (handbook extracts, official examiner comments, sample transcripts).
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add new */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as CambridgeLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMBRIDGE_EXAMS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type of material</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{KIND_HINT[kind]}</p>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FCE — Florine & Maria (Sample Test)" />
          </div>

          <div className="space-y-2">
            <Label>Source URL (optional)</Label>
            <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://www.youtube.com/..." />
          </div>

          <div className="space-y-2">
            <Label>Content ({content.length.toLocaleString()} / {MAX_CONTENT_CHARS.toLocaleString()})</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the transcript / examiner comments / handbook extract here…"
              rows={8}
            />
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
                disabled={extracting}
                className="text-xs"
              />
              {extracting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add to library
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Saved references</h4>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reference material yet. Add your first one above.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{it.level_code}</Badge>
                        <Badge variant="outline" className="text-xs">{KIND_LABEL[it.kind]}</Badge>
                        <span className="text-sm font-medium truncate">{it.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{it.content.slice(0, 240)}</p>
                      {it.source_url && (
                        <a href={it.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">
                          Source ↗
                        </a>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(it.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
