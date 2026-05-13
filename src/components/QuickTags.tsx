import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tag, X, Plus } from "lucide-react";

export interface QuickTag {
  /** Free-text label (e.g. "hesitation", "good range"). */
  label: string;
  /** Seconds since the start of the recording. */
  atSec: number;
  /** Which candidate the tag refers to: "A" | "B" | "C" | "all". */
  candidate: string;
}

interface Props {
  /** Live elapsed seconds from the recorder. */
  elapsedSeconds: number;
  /** Whether recording is in progress (controls button availability). */
  active: boolean;
  /** Letters of the candidates currently in the exam (e.g. ["A","B"]). */
  candidateLetters: string[];
  /** Notifies the parent whenever the tag list changes. */
  onChange: (tags: QuickTag[]) => void;
}

const PRESETS = [
  "hesitation",
  "good range",
  "L1 interference",
  "off-topic",
  "self-correction",
  "strong example",
  "asks for help",
  "long pause",
];

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

/**
 * Per-candidate quick-tag chips during a live exam. Each tap stamps a
 * note with the current timestamp and target candidate; the resulting
 * list is sent to the AI as additional examiner evidence.
 */
export function QuickTags({ elapsedSeconds, active, candidateLetters, onChange }: Props) {
  const [tags, setTags] = useState<QuickTag[]>([]);
  const [target, setTarget] = useState<string>(candidateLetters[0] ?? "A");
  const [custom, setCustom] = useState("");

  const push = useCallback((label: string) => {
    if (!label.trim()) return;
    const next = [...tags, { label: label.trim(), atSec: Math.floor(elapsedSeconds), candidate: target }];
    setTags(next);
    onChange(next);
  }, [tags, elapsedSeconds, target, onChange]);

  const remove = useCallback((idx: number) => {
    const next = tags.filter((_, i) => i !== idx);
    setTags(next);
    onChange(next);
  }, [tags, onChange]);

  return (
    <div className="w-full max-w-md rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-display font-semibold flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-primary" /> Quick tags
          <span className="text-[10px] font-normal text-muted-foreground">
            (sent to the AI as evidence)
          </span>
        </h4>
        <div className="flex items-center gap-1">
          {candidateLetters.map((l) => (
            <Button
              key={l}
              type="button"
              size="sm"
              variant={target === l ? "default" : "outline"}
              className="h-6 px-2 text-[11px]"
              onClick={() => setTarget(l)}
            >
              {l}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={target === "all" ? "default" : "outline"}
            className="h-6 px-2 text-[11px]"
            onClick={() => setTarget("all")}
          >
            All
          </Button>
        </div>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant="secondary"
            disabled={!active}
            className="h-7 px-2 text-[11px] gap-1"
            onClick={() => push(p)}
          >
            <Plus className="h-3 w-3" /> {p}
          </Button>
        ))}
      </div>

      {/* Custom tag */}
      <div className="flex gap-1">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); push(custom); setCustom(""); }
          }}
          placeholder="Custom tag…"
          disabled={!active}
          className="flex-1 h-7 rounded-md border bg-background px-2 text-xs disabled:opacity-50"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px]"
          disabled={!active || !custom.trim()}
          onClick={() => { push(custom); setCustom(""); }}
        >
          Add
        </Button>
      </div>

      {/* Tag list */}
      {tags.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
          {tags.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-2 py-1">
              <div className="flex items-center gap-2 text-[11px] min-w-0">
                <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
                  {fmt(t.atSec)}
                </Badge>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {t.candidate === "all" ? "All" : t.candidate}
                </Badge>
                <span className="truncate">{t.label}</span>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => remove(i)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
