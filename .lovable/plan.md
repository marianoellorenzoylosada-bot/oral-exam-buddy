
# Pre-AI Speaker Review (Item #1)

## Goal
Stop sending an unverified transcript to the AI in the live single-exam flow. After Scribe transcribes the recording, the examiner must confirm who is who; the AI then scores the corrected transcript on the first pass — eliminating the "AI scored the wrong candidate" risk and the credit cost of re-grading.

## Scope (what changes)
- `src/pages/NewExam.tsx` (live mock wizard) only.
- No changes to: BatchSession, ReportDetail, edge functions, scoring logic, rubrics, RLS, storage, exams schema, PDF, Progress, or any other view.
- The existing `SpeakerMappingPanel` component is reused as-is (read-only of its behavior); we only call it earlier in the flow.

## New flow in `NewExam.tsx`
```text
Record audio
   │
   ▼
Submit  ──► transcribe (Scribe, with word-level diarization)
   │
   ▼
NEW STEP: "Confirm speakers" review panel
   • Shows SpeakerMappingPanel populated from out.words
   • Pre-filled with the heuristic suggested map
   • Examiner verifies / corrects roles
   • Two buttons:
       – "Confirm & score"  (primary)
       – "Skip review" (secondary, with a small warning tooltip)
   │
   ▼
analyze-exam  ──► report rendered (unchanged)
```

## Implementation details
1. **State additions** (local to `NewExam.tsx`):
   - `reviewStage: "idle" | "awaiting" | "confirmed"`.
   - `pendingTranscript: string | null`, `pendingWords: ScribeWord[]`.
   - `speakerMap: SpeakerMap | null`.

2. **Split `handleSubmitForAnalysis`** into two functions:
   - `runTranscription()` — runs the existing pre-flight guards + Scribe transcription, then sets `pendingTranscript/pendingWords` and `reviewStage = "awaiting"`. Does **not** call `analyze-exam`.
   - `runScoring(finalTranscript: string, map: SpeakerMap | null)` — the existing `analyze-exam` invoke + draft cleanup + report set. Called from the review step.

3. **Review UI** rendered between the Record tab and the Report:
   - Reuse `SpeakerMappingPanel` in an embedded mode: instead of writing to Supabase, pass an `onConfirm(transcript, map)` callback. Since the panel currently writes to `exams`, we add a thin local wrapper inside `NewExam.tsx` that:
     - Calls `applySpeakerMap(words, map)` directly to build the corrected transcript.
     - Calls `runScoring(correctedTranscript, map)`.
   - "Skip review" → `runScoring(pendingTranscript, null)` with original behavior preserved.

4. **Persistence of the chosen map**: after `analyze-exam` succeeds and the exam row is inserted, write `speaker_map` to the new exam row using the existing column (already supported by `SpeakerMappingPanel`'s update path). No schema change.

5. **Offline / failure paths**:
   - If user is offline at submit time → unchanged (draft saved, no transcription).
   - If transcription fails → unchanged toast, no review shown.
   - If scoring fails after review → existing draft-saving path runs; on retry we go straight from the saved transcript back through the review step.

## What stays the same
- BatchSession queue: unchanged — batch mode is unattended by design.
- ReportDetail's post-hoc `SpeakerMappingPanel` + Re-analyze: still works for older reports and corrections.
- analyze-exam edge function: untouched.
- All scoring, weights, rubrics, storage, RLS, PDFs.

## Risks & mitigations
- **Examiner friction**: one extra confirm click per mock. Mitigated by good pre-filled defaults and a "Skip review" escape hatch.
- **Regression in offline retry**: covered by routing the resumed draft through the same `runTranscription → review → runScoring` pipeline.

## Out of scope (kept for later phases)
- Pre-AI review for BatchSession.
- Forcing review (removing "Skip review").
- Storing the pre-review transcript for audit.
