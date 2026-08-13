import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Play, Users, CheckCircle2, Loader2 } from "lucide-react";
import {
  applyUtteranceRoles, buildUtterances, roleForUtterance, speakerStats,
  type SpeakerMap, type SpeakerRole,
} from "@/lib/applySpeakerMap";
import type { ScribeWord } from "@/lib/transcribe";
import { cn } from "@/lib/utils";

const ROLES: SpeakerRole[] = [
  "Examiner", "Candidate A", "Candidate B", "Candidate C", "Speaker unclear",
];

/** Highlighter-style backgrounds so the examiner can scan attribution fast. */
const ROLE_STYLES: Record<SpeakerRole, { row: string; tag: string }> = {
  Examiner: { row: "bg-muted/60", tag: "bg-muted text-muted-foreground" },
  "Candidate A": { row: "bg-primary/10", tag: "bg-primary/20 text-primary" },
  "Candidate B": { row: "bg-emerald-500/10", tag: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" },
  "Candidate C": { row: "bg-amber-500/10", tag: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  "Speaker unclear": { row: "bg-destructive/10", tag: "bg-destructive/20 text-destructive" },
};

function fmtTs(s: number) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

interface Props {
  words: ScribeWord[];
  initialMap?: SpeakerMap | null;
  suggestedMap?: SpeakerMap | null;
  /** Plays the audio from a given second. */
  onSeek?: (start: number, end: number) => void;
  /** Confirms the review: receives the final map and the rebuilt transcript. */
  onConfirm: (map: SpeakerMap, transcript: string) => void | Promise<void>;
  confirming?: boolean;
  /** Read-only mode: colored transcript only, no editing. */
  readOnly?: boolean;
}

export function SpeakerReviewPanel({
  words, initialMap, suggestedMap, onSeek, onConfirm, confirming, readOnly,
}: Props) {
  const stats = useMemo(() => speakerStats(words), [words]);
  const utterances = useMemo(() => buildUtterances(words), [words]);

  const [map, setMap] = useState<SpeakerMap>(() => {
    const m: SpeakerMap = {};
    for (const s of stats) {
      m[s.id] = initialMap?.[s.id] ?? suggestedMap?.[s.id] ?? "Speaker unclear";
    }
    return m;
  });
  const [overrides, setOverrides] = useState<Record<number, SpeakerRole>>({});

  if (stats.length === 0 || utterances.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        No diarized speakers available for this recording — speaker review is unavailable.
      </div>
    );
  }

  const overrideCount = Object.keys(overrides).length;

  const handleConfirm = () => {
    onConfirm(map, applyUtteranceRoles(utterances, map, overrides));
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold text-sm flex items-center gap-1.5">
          <Users className="h-4 w-4 text-primary" /> Speaker review
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {stats.length} voice{stats.length === 1 ? "" : "s"} · {utterances.length} turns
        </span>
      </div>

      {!readOnly && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Assign each detected voice to a role, then scroll the full script to check the
            attribution. Any single line that is wrong can be reassigned on its own.
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
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Full colored script */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Full script
          </p>
          {overrideCount > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {overrideCount} line{overrideCount === 1 ? "" : "s"} corrected
            </span>
          )}
        </div>
        <ScrollArea className="h-[22rem] rounded-md border">
          <ol className="divide-y divide-border">
            {utterances.map((u) => {
              const role = roleForUtterance(u, map, overrides);
              const style = ROLE_STYLES[role];
              return (
                <li key={u.index} className={cn("px-3 py-2", style.row)}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", style.tag)}>
                        {role}
                      </span>
                      <button
                        type="button"
                        disabled={!onSeek}
                        onClick={() => onSeek?.(u.start, u.end)}
                        className="font-mono text-[11px] tabular-nums text-muted-foreground hover:text-primary disabled:hover:text-muted-foreground"
                      >
                        {onSeek ? "▶ " : ""}{fmtTs(u.start)}
                      </button>
                    </div>
                    {!readOnly && (
                      <Select
                        value={role}
                        onValueChange={(v) =>
                          setOverrides((o) => ({ ...o, [u.index]: v as SpeakerRole }))
                        }
                      >
                        <SelectTrigger className="h-7 w-[150px] text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{u.text}</p>
                </li>
              );
            })}
          </ol>
        </ScrollArea>
      </div>

      {!readOnly && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleConfirm} disabled={confirming} className="gap-1.5">
            {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Confirm speakers &amp; analyze
          </Button>
        </div>
      )}
    </div>
  );
}
