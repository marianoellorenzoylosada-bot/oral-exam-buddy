## Goals

Fix the two bugs from the previous message, add clickable audio quotes in reports, set audio retention to 15 days, add a phase-timer to the New Exam screen, and propose enhancement ideas for your review.

---

## 1. Live transcript + reliable AI feedback (bug fixes)

- `LiveTranscript.tsx`: auto-connect to ElevenLabs Scribe the moment recording starts (no hidden "Enable Transcription" button), show a "Listening…" placeholder, and surface clear errors with a one-click retry.
- New edge function `transcribe-audio`: ElevenLabs Scribe batch (`scribe_v2`, `diarize=true`, word timestamps) for the recorded blob. Returns `{ transcript, words, speakers }`.
- `analyze-exam`: drop the broken `input_audio` block (Gemini cannot read webm/opus — that is why it was inventing feedback). Send the **transcript** as text instead. Hard guard: if transcript is empty or under ~30 words, return a clear error rather than fabricating a report.
- Submit flow (`NewExam.tsx`, `useBatchQueue.ts`): prefer the live transcript; if missing, run `transcribe-audio` on the blob first; then call `analyze-exam` with the transcript. Disable Submit until a transcript exists.

## 2. Clickable audio quotes in reports

- Persist Scribe `words[]` (with start/end seconds) on the exam row (new `words_json jsonb` column, nullable).
- Prompt `analyze-exam` to **quote candidates verbatim** in `strengths` and `areasForImprovement`.
- New `<QuotedAudio>` component in `ReportDetail.tsx`: fuzzy-matches each quote against the word timeline, wraps it in a play button that seeks a hidden `<audio>` element to the matching range. Falls back to plain text if no match.
- Audio is fetched via signed URL on demand (already private bucket, RLS unchanged).

## 3. Audio retention — 15 days, hard cap

- New `audio_expires_at timestamptz` column on `exams`, set to `now() + 15 days` on insert.
- Daily Supabase cron edge function `purge-expired-audio`: deletes blobs from `exam-audio` whose row has `audio_expires_at < now()`, then nulls the storage path. Reports stay forever — only the audio is removed.
- Per-exam **Delete audio now** button in the report (keeps the report, drops the file).
- Settings page: read-only note "Recordings are kept for 15 days, then deleted automatically."

## 4. Phase timer on the New Exam screen

A floating timer card on the Record tab with:
- Total elapsed time (large).
- A horizontal progress bar split into the official Cambridge Speaking parts for the selected level, with a draggable marker the teacher slides as they move between parts. Each segment shows its target minutes and turns amber when the teacher is over the suggested time.
- Default segments per level (editable inline before the exam starts):
  - **A2 Key**: Part 1 — 3–4 min · Part 2 — 5–6 min
  - **B1 Preliminary**: P1 2–3 · P2 2–3 · P3 4 · P4 3
  - **B2 First**: P1 2 · P2 4 · P3 4 · P4 4
  - **C1 Advanced / C2 Proficiency**: P1 2 · P2 4 · P3 4 · P4 5
- Quiet chime + visual pulse when a segment's target is reached. Pause/resume tied to the recorder. Marker positions are saved with the exam so the report can show "Part 2 ran 90s long".

## 5. Suggested enhancements (for your review — not built yet)

1. **Pre-exam checklist**: 10-second mic test with a live volume meter and a short dummy transcription, so failures are caught before the candidates start.
2. **Examiner script / prompts panel**: collapsible side panel on the Record tab showing the questions for the selected part, pulled from your Question Bank.
3. **Per-candidate quick tags during the exam**: one-tap chips ("hesitation", "good range", "L1 interference") timestamped to the audio — fed into the AI as evidence.
4. **Confidence-aware overrides**: when the AI's confidence on a criterion is < 70, highlight it in the review tab and prompt the teacher to confirm or override before sign-off.
5. **Student-facing mini-report**: a stripped-down PDF (no examiner notes, friendlier tone, with the clickable quotes as embedded audio links) you can hand to the student.
6. **Group analytics**: class-level radar comparing average band per criterion, plus "students to watch" based on the last 3 exams' trend.
7. **Re-grade with new evidence**: if a teacher edits the transcript (typo fix, missed turn), one click re-runs `analyze-exam` on the corrected text.
8. **Calibration mode**: two examiners score the same recording independently; the app shows agreement per criterion — useful for school-wide standardisation.
9. **Offline-first finish**: queue the whole submit pipeline in IndexedDB so a flaky network during exam day never loses work (partly there already; finish it).
10. **Accessibility pass**: keyboard shortcuts for record/pause/next-part, larger-font exam mode, high-contrast theme.

---

## Technical notes

- Schema migration: `ALTER TABLE exams ADD COLUMN words_json jsonb, ADD COLUMN audio_expires_at timestamptz, ADD COLUMN phase_marks jsonb;`
- New edge functions: `transcribe-audio`, `purge-expired-audio` (scheduled).
- Files touched: `LiveTranscript.tsx`, `NewExam.tsx`, `BatchSession.tsx`, `useBatchQueue.ts`, `ReportDetail.tsx`, new `PhaseTimer.tsx`, new `QuotedAudio.tsx`, `analyze-exam/index.ts`, `Settings.tsx`.
- Cost impact: word timestamps from Scribe are free; LLM calls get cheaper (text-only); ~1 MB/min storage capped at 15 days.

## What stays the same

Cambridge rubrics, scoring schema, report layout, PDF export, RLS, auth, sidebar, design tokens, English-only setup.

Tell me which of the section-5 enhancements you want included now and I'll fold them into the build.