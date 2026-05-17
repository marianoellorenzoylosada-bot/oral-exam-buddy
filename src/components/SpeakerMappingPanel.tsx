import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Play, Users, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  applySpeakerMap, speakerStats, type SpeakerMap, type SpeakerRole,
} from "@/lib/applySpeakerMap";
import type { ScribeWord } from "@/lib/transcribe";

const ROLES: SpeakerRole[] = [
  "Examiner", "Candidate A", "Candidate B", "Candidate C", "Speaker unclear",
];

interface Props {
  examId: string;
  words: ScribeWord[];
  initialMap?: SpeakerMap | null;
  /** Suggested map (heuristic) used if no saved map exists. */
  suggestedMap?: SpeakerMap;
  /** Plays the audio at the given second; disabled if not provided. */
  onSeek?: (start: number, end: number) => void;
  onSaved?: (newTranscript: string, map: SpeakerMap) => void;
}

function fmtTs(s: number) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function SpeakerMappingPanel({
  examId, words, initialMap, suggestedMap, onSeek, onSaved,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const stats = useMemo(() => speakerStats(words), [words]);

  const [map, setMap] = useState<SpeakerMap>(() => {
    const m: SpeakerMap = {};
    for (const s of stats) {
      m[s.id] = initialMap?.[s.id] ?? suggestedMap?.[s.id] ?? "Speaker unclear";
    }
    return m;
  });
  const [saving, setSaving] = useState(false);

  if (stats.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        No diarized speakers available for this recording — speaker mapping is unavailable.
      </div>
    );
  }

  const handleApply = async () => {
    const newTranscript = applySpeakerMap(words, map);
    if (!newTranscript.trim()) {
      toast({ title: "Nothing to apply", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("exams")
        .update({ speaker_map: map, transcript: newTranscript } as any)
        .eq("id", examId);
      if (error) throw error;
      toast({
        title: "Speaker mapping saved",
        description: "Transcript rebuilt. Use Re-analyze to re-score with the corrected speakers.",
      });
      qc.invalidateQueries({ queryKey: ["exams-reports"] });
      onSaved?.(newTranscript, map);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold text-sm flex items-center gap-1.5">
          <Users className="h-4 w-4 text-primary" /> Speaker mapping
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {stats.length} speaker{stats.length === 1 ? "" : "s"} detected
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Verify who is who. Play a sample, then assign each diarized voice to a role.
        Saving rebuilds the transcript from the corrected mapping; re-run analysis to update scoring.
      </p>

      <ul className="space-y-2">
        {stats.map((s) => (
          <li key={s.id} className="rounded-md border bg-muted/20 p-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="font-mono text-[10px]">{s.id}</Badge>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {fmtTs(s.totalSeconds)} · {(s.share * 100).toFixed(0)}%
                </span>
                {onSeek && (
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-6 px-2 gap-1 text-[11px]"
                    onClick={() => onSeek(s.firstStart, s.firstStart + 6)}
                  >
                    <Play className="h-3 w-3" /> {fmtTs(s.firstStart)}
                  </Button>
                )}
              </div>
              <Select
                value={map[s.id]}
                onValueChange={(v) => setMap((m) => ({ ...m, [s.id]: v as SpeakerRole }))}
              >
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {s.sampleText && (
              <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground italic">
                "{s.sampleText}…"
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleApply} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Apply & save mapping
        </Button>
      </div>
    </div>
  );
}
