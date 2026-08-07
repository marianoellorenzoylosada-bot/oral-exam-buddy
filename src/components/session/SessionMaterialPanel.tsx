import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Image, FileText, Camera, Loader2, Trash2, Wand2, Save, X, FlipHorizontal } from "lucide-react";
import { useAddMaterial, useUpdateMaterial, useDeleteMaterial, useDescribeMaterial, useMaterialSignedUrls, type SessionMaterial } from "@/hooks/useSpeakingSession";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const MATERIAL_KINDS = [
  { value: "photo", label: "Visual material (photo for Part 2/3)" },
  { value: "diagram", label: "Diagram / collaborative task (Part 3)" },
  { value: "script", label: "Examiner script / prompt" },
];

const AI_KIND_MAP: Record<string, string> = {
  photo: "part2_pictures",
  diagram: "part3_diagram",
  script: "examiner_script",
};

interface SessionMaterialPanelProps {
  sessionId: string;
  materials: SessionMaterial[];
}

export function SessionMaterialPanel({ sessionId, materials }: SessionMaterialPanelProps) {
  const { toast } = useToast();
  const [kind, setKind] = useState("photo");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [describingIds, setDescribingIds] = useState<Set<string>>(new Set());
  const [describeErrors, setDescribeErrors] = useState<Record<string, string>>({});

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMaterial = useAddMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const describeMaterial = useDescribeMaterial();

  const imagePaths = materials.map((m) => m.image_path).filter(Boolean);
  const { data: signedUrls } = useMaterialSignedUrls(imagePaths);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Your browser does not support in-page camera. Try opening this app in a normal browser tab or use the file picker.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e: any) {
      const msg = e?.message || "Could not access the camera.";
      setCameraError(msg);
      toast({ title: "Camera error", description: msg, variant: "destructive" });
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (cameraOpen) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [cameraOpen, cameraFacing]);

  const capturePhoto = async () => {
    if (!videoRef.current || !streamRef.current) return;
    setCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize canvas");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Empty image"))), "image/jpeg", 0.92);
      });
      await uploadFile(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      setCameraOpen(false);
    } catch (e: any) {
      toast({ title: "Capture failed", description: e.message, variant: "destructive" });
    } finally {
      setCapturing(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const material = await addMaterial.mutateAsync({
        sessionId,
        file,
        kind,
        description: "",
        aiDescription: "",
      });
      if (material.kind !== "script" && material.image_path) {
        runAiDescription(material);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setUploadError(msg);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    uploadFile(f);
  };

  const runAiDescription = async (material: SessionMaterial) => {
    if (describingIds.has(material.id)) return;
    setDescribingIds((prev) => new Set(prev).add(material.id));
    setDescribeErrors((prev) => ({ ...prev, [material.id]: "" }));
    try {
      const aiDescription = await describeMaterial(material.image_path, AI_KIND_MAP[material.kind] || material.kind);
      await updateMaterial.mutateAsync({ id: material.id, ai_description: aiDescription });
      toast({ title: "AI description added" });
    } catch (e: any) {
      const msg = e?.message || String(e);
      setDescribeErrors((prev) => ({ ...prev, [material.id]: msg }));
      toast({ title: "Could not describe image", description: msg, variant: "destructive" });
    } finally {
      setDescribingIds((prev) => {
        const next = new Set(prev);
        next.delete(material.id);
        return next;
      });
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

  const handleDelete = async (material: SessionMaterial) => {
    if (!confirm("Delete this material?")) return;
    try {
      await deleteMaterial.mutateAsync(material);
      toast({ title: "Material deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const photos = materials.filter((m) => m.kind === "photo" || m.kind === "diagram");
  const scripts = materials.filter((m) => m.kind === "script");

  const isImage = (m: SessionMaterial) => m.kind === "photo" || m.kind === "diagram";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">Materials</CardTitle>
        <CardDescription>
          Upload photos and the examiner script. Photos are described automatically when possible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cameraOpen ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Take a photo</Label>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCameraFacing((f) => (f === "environment" ? "user" : "environment"))}>
                  <FlipHorizontal className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCameraOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {cameraError ? (
              <p className="text-sm text-destructive">{cameraError}</p>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-md bg-black object-cover" />
                <Button onClick={capturePhoto} disabled={capturing} className="w-full gap-2">
                  {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  Capture and upload
                </Button>
              </>
            )}
          </div>
        ) : (
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
              <Label>Add</Label>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept={kind === "script" ? "application/pdf,text/plain" : "image/*"} className="hidden" onChange={handleFileInput} />
                <Button variant="outline" className="flex-1 justify-start overflow-hidden" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4 shrink-0" />}
                  <span className="truncate">{uploading ? "Uploading…" : "Choose file"}</span>
                </Button>
                {kind !== "script" && (
                  <Button variant="outline" onClick={() => setCameraOpen(true)} disabled={uploading} title="Take a photo">
                    <Camera className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {uploadError && (
                <p className="text-xs text-destructive">{uploadError}. Try again or use the camera.</p>
              )}
            </div>
          </div>
        )}

        <Separator />

        {photos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2"><Image className="h-4 w-4" /> Visual materials</h4>
            <ul className="space-y-3">
              {photos.map((m) => (
                <li key={m.id} className="rounded-md border p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="outline" className="text-xs capitalize">{m.kind}</Badge>
                    <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => handleDelete(m)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  {signedUrls?.[m.image_path] ? (
                    <img src={signedUrls[m.image_path]} alt={m.description || m.ai_description || "Material"} className="h-40 w-full rounded-md object-contain bg-muted" />
                  ) : (
                    <div className="h-40 w-full rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      {signedUrls === undefined ? "Loading preview…" : "Preview unavailable"}
                    </div>
                  )}
                  {editingId === m.id ? (
                    <div className="flex gap-2">
                      <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="flex-1" />
                      <Button size="sm" variant="outline" onClick={() => handleSaveEdit(m)}><Save className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {m.description || m.ai_description || "No description yet"}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingId(m.id); setEditDescription(m.description); }}>
                          <Save className="mr-1 h-3 w-3" /> Edit
                        </Button>
                        {describingIds.has(m.id) ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Describing…
                          </span>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => runAiDescription(m)}>
                            <Wand2 className="mr-1 h-3 w-3" /> Describe
                          </Button>
                        )}
                      </div>
                      {describeErrors[m.id] && (
                        <p className="text-xs text-destructive">
                          AI description failed: {describeErrors[m.id]}. You can edit the description manually.
                        </p>
                      )}
                    </div>
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
                    <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => handleDelete(m)}><Trash2 className="h-4 w-4" /></Button>
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

        {materials.length === 0 && !uploading && !cameraOpen && (
          <p className="text-sm text-muted-foreground">No material uploaded yet. Choose a file or take a photo to begin.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Separator() {
  return <div className="h-px bg-border" />;
}
