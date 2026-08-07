import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Image, FileText, Camera, Loader2, Trash2, Wand2, Save } from "lucide-react";
import { useAddMaterial, useUpdateMaterial, useDeleteMaterial, useDescribeMaterial, type SessionMaterial } from "@/hooks/useSpeakingSession";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const MATERIAL_KINDS = [
  { value: "photo", label: "Visual material (photo for Part 2/3)" },
  { value: "diagram", label: "Diagram / collaborative task (Part 3)" },
  { value: "script", label: "Examiner script / prompt" },
];

interface SessionMaterialPanelProps {
  sessionId: string;
  materials: SessionMaterial[];
}

export function SessionMaterialPanel({ sessionId, materials }: SessionMaterialPanelProps) {
  const { toast } = useToast();
  const [kind, setKind] = useState("photo");
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [describing, setDescribing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const addMaterial = useAddMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const describeMaterial = useDescribeMaterial();

  const handleFile = (f: File) => {
    setFile(f);
    setAiDescription("");
  };

  const handleDescribe = async () => {
    if (!file) return;
    setDescribing(true);
    try {
      // Upload first so the edge function can read from storage.
      const ext = file.name.split(".").pop() ?? "jpg";
      const imagePath = `${crypto.randomUUID()}-tmp.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("exam-context")
        .upload(imagePath, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const description = await describeMaterial(imagePath, kind);
      setAiDescription(description);
      await supabase.storage.from("exam-context").remove([imagePath]).catch(() => undefined);
    } catch (e: any) {
      toast({ title: "Could not describe image", description: e.message, variant: "destructive" });
    } finally {
      setDescribing(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !kind) {
      toast({ title: "Missing file", description: "Select a file and a material type.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await addMaterial.mutateAsync({
        sessionId,
        file,
        kind,
        description,
        aiDescription,
      });
      setFile(null);
      setDescription("");
      setAiDescription("");
      setKind("photo");
      toast({ title: "Material added" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEdit = async (material: SessionMaterial) => {
    try {
      await updateMaterial.mutateAsync({ id: material.id, description: editDescription });
      setEditingId(null);
      toast({ title: "Description updated" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const photos = materials.filter((m) => m.kind === "photo" || m.kind === "diagram");
  const scripts = materials.filter((m) => m.kind === "script");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Materials</CardTitle>
        <CardDescription>
          Upload photos and the examiner script. Photos can be described by AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Material type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>File</Label>
            <div className="flex gap-2">
              <input ref={inputRef} type="file" accept="image/*,application/pdf,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Button variant="outline" className="flex-1" onClick={() => inputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> {file ? file.name : "Choose file"}
              </Button>
              {kind !== "script" && (
                <Button variant="outline" onClick={() => cameraRef.current?.click()} className="sm:hidden">
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {file && kind !== "script" && (
          <div className="space-y-2">
            <Label>AI description</Label>
            <div className="flex gap-2">
              <Textarea
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="Describe what the candidates see in the image"
                className="flex-1"
              />
              <Button variant="secondary" onClick={handleDescribe} disabled={describing} className="shrink-0">
                {describing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Tap the wand to auto-generate a description, then edit it.</p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Your description / script</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the examiner will say or any notes about the material" />
        </div>

        <Button onClick={handleUpload} disabled={uploading || !file} className="gap-2">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload material
        </Button>

        <Separator />

        {photos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2"><Image className="h-4 w-4" /> Visual materials</h4>
            <ul className="space-y-2">
              {photos.map((m) => (
                <li key={m.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs capitalize">{m.kind}</Badge>
                    <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => deleteMaterial.mutate(m)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {editingId === m.id ? (
                    <div className="flex gap-2">
                      <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="flex-1" />
                      <Button size="sm" variant="outline" onClick={() => handleSaveEdit(m)}><Save className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {m.description || m.ai_description || "No description"}
                      <Button size="sm" variant="ghost" className="ml-2 h-6 px-2" onClick={() => { setEditingId(m.id); setEditDescription(m.description); }}>Edit</Button>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {scripts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Scripts</h4>
            <ul className="space-y-2">
              {scripts.map((m) => (
                <li key={m.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">Script</Badge>
                    <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => deleteMaterial.mutate(m)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {editingId === m.id ? (
                    <div className="flex gap-2">
                      <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="flex-1" />
                      <Button size="sm" variant="outline" onClick={() => handleSaveEdit(m)}><Save className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {m.description || "No script text"}
                      <Button size="sm" variant="ghost" className="ml-2 h-6 px-2" onClick={() => { setEditingId(m.id); setEditDescription(m.description); }}>Edit</Button>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Separator() {
  return <div className="h-px bg-border" />;
}
