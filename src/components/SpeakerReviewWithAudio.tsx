import { useRef } from "react";
import { SpeakerReviewPanel } from "@/components/SpeakerReviewPanel";
import { AttemptAudioPlayer, type AttemptAudioPlayerHandle } from "@/components/AttemptAudioPlayer";
import type { ScribeWord } from "@/lib/transcribe";
import type { SpeakerMap, SpeakerRole } from "@/lib/applySpeakerMap";

interface Props {
  audioPath: string | null;
  words: ScribeWord[];
  initialMap?: SpeakerMap | null;
  suggestedMap?: SpeakerMap | null;
  confirming?: boolean;
  initialSplitPoints?: number[] | null;
  initialOverrides?: Record<number, SpeakerRole> | null;
  onConfirm: (
    map: SpeakerMap,
    transcript: string,
    edits: { splitPoints: number[]; overrides: Record<number, SpeakerRole> }
  ) => void | Promise<void>;
}

/** Speaker review panel wired to a seekable player for the same recording. */
export function SpeakerReviewWithAudio({
  audioPath, words, initialMap, suggestedMap, confirming, onConfirm,
  initialSplitPoints, initialOverrides,
}: Props) {
  const playerRef = useRef<AttemptAudioPlayerHandle | null>(null);

  return (
    <div className="space-y-2">
      <AttemptAudioPlayer ref={playerRef} audioPath={audioPath} />
      <SpeakerReviewPanel
        words={words}
        initialMap={initialMap}
        suggestedMap={suggestedMap}
        initialSplitPoints={initialSplitPoints}
        initialOverrides={initialOverrides}
        confirming={confirming}
        onConfirm={onConfirm}
        onSeek={(start) => playerRef.current?.seek(start)}
      />
    </div>
  );
}
