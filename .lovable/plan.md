# Build #6, #7, #8, #9

Four self-contained features. Each ships independently and reuses existing patterns (Recharts, IndexedDB, edge functions, semantic tokens).

---

## #6 — Group Analytics

Add a class-level view to the Progress page so teachers can see how a whole group (or institution) is doing, not just one candidate.

**UI changes — `src/pages/Progress.tsx`**
- New "Group" filter dropdown next to the existing Candidate filter (populated from distinct `exams.group` values + `groups` table).
- When a group is selected:
  - Filter all existing charts to only that group's exams.
  - Add two new cards above the radar:
    - **"Students in this group"** — bar chart of average overall score per candidate, sorted descending. Click a bar to drill down to that candidate.
    - **"Weakest & strongest skills"** — horizontal bar of the 5 Cambridge criteria averaged across the group, with the lowest highlighted in `--destructive` and the highest in `--success`.
  - Update summary cards to show: total students, exams per student avg, group average, group best.
- "Export PDF" includes the group view when a group is selected.

**No schema changes** — `exams.group` already stores the group name.

**PDF — `src/lib/generateProgressPdf.ts`**
- Accept optional `groupName` and `studentBreakdown: { name, avg, exams }[]`.
- Render an extra "Group breakdown" table when present.

---

## #7 — Re-grade with new evidence

Let an examiner re-run the AI analysis after editing the transcript, adding examiner notes, or dropping new quick tags — without losing the original scores.

**Schema — migration**
```sql
ALTER TABLE public.exams
  ADD COLUMN previous_analyses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN regrade_count int NOT NULL DEFAULT 0;
```

**UI — `src/components/ReportDetail.tsx`**
- New "Re-analyze" button (next to PDF/Print) opens a dialog with:
  - Editable transcript textarea (pre-filled).
  - Editable examiner notes textarea.
  - Free-text "Additional observations" field passed as a single examiner tag.
- On submit:
  1. Snapshot current `{criteria, strengths, areas_for_improvement, overall_band, overall_score, examiner_notes, transcript, regraded_at}` into `previous_analyses`.
  2. Call the existing `analyze-exam` function with the edited transcript + tags.
  3. Update the exam row with the new analysis and increment `regrade_count`.
- New "Version history" accordion below the score card, showing each previous analysis (date + overall band) with a "View this version" toggle that swaps the visible criteria/strengths in-place (read-only).

**No edge-function changes** — `analyze-exam` already accepts `transcript` + `examinerTags`.

---

## #8 — Calibration Mode

A self-contained practice mode where examiners score a sample exam and compare against gold-standard reference scores. Helps with inter-rater consistency.

**New page — `src/pages/Calibration.tsx`** (route `/calibration`, sidebar entry under "Examine")
- 5–6 bundled sample cases (one per CEFR level), each with:
  - A short situational description (Cambridge format).
  - A pre-recorded transcript (text-only — no audio needed).
  - Gold-standard scores for the 5 Cambridge criteria + reference rationale.
- Flow per case:
  1. Show the case + transcript.
  2. Examiner enters their score (slider 0–5, 0.5 steps) and a 1-line justification per criterion.
  3. On "Reveal gold standard": show side-by-side table (your score / gold / Δ), color-coded; show the reference rationale per criterion.
  4. Compute an "agreement score" = 100 − (sum of |Δ| × 10), shown as a badge.
- Persist completed sessions to `localStorage` (no DB) under `oralassess-calibration:results` so users see their own trend across sessions.

**New file — `src/lib/calibrationCases.ts`**
- Hard-coded array `CALIBRATION_CASES` containing the 5–6 sample cases (level, description, transcript, gold scores, rationale). Authored to be representative; users will be told these are "training samples, not official Cambridge materials."

**No schema changes, no edge functions.**

---

## #9 — Offline-first New Exam

Make the New Exam page survive a tab refresh, network drop, or temporary outage. Already done for Batch Session — extend the same IndexedDB pattern to single-exam recording.

**Network status — new `src/hooks/useOnlineStatus.ts`**
- Wraps `navigator.onLine` + `online/offline` events. Used by a small banner.

**New banner — `src/components/OfflineBanner.tsx`**
- Mounted in `AppLayout`. When offline: amber bar across the top reading "You're offline — recordings are saved locally and will sync when you're back online."

**Draft persistence — new `src/lib/examDraftDb.ts`**
- IndexedDB store `exam-drafts` with one record holding: form state (level, language, candidate names, group, etc.), recorded blob, transcript, quick tags, phase marks, recordedAt.
- API: `saveDraft()`, `loadDraft()`, `clearDraft()`.

**`src/pages/NewExam.tsx`**
- On any state change to the form or after a recording stops, debounce-save to IndexedDB.
- On mount, if a draft exists, show a "Restore previous draft?" toast with Restore/Discard.
- "Run AI Analysis" while offline:
  - Mark the draft as `pending-analysis` and show: "You're offline. Analysis will run automatically when you reconnect."
  - Add a tiny `useEffect` watcher: when `useOnlineStatus()` flips to `online` AND a `pending-analysis` draft exists, auto-invoke the existing analyze pipeline.
- Successful analysis clears the draft.

**Analyze-exam edge function** — no changes.

---

## Technical details

**Sidebar — `src/components/AppSidebar.tsx`**
- Add `{ title: "Calibration", url: "/calibration", icon: Scale }` to the `mainNav` array.

**Routing — `src/App.tsx`**
- Add `/calibration` inside the `RoleGate role="educator"` block (consistent with New Exam).

**Files to create**
- `src/pages/Calibration.tsx`
- `src/lib/calibrationCases.ts`
- `src/hooks/useOnlineStatus.ts`
- `src/components/OfflineBanner.tsx`
- `src/lib/examDraftDb.ts`
- `supabase/migrations/<timestamp>_add_regrade_columns.sql`

**Files to edit**
- `src/pages/Progress.tsx` (group filter + group charts)
- `src/lib/generateProgressPdf.ts` (group breakdown section)
- `src/components/ReportDetail.tsx` (Re-analyze dialog + version history)
- `src/pages/NewExam.tsx` (draft persistence + offline-aware submit)
- `src/components/AppLayout.tsx` (mount OfflineBanner)
- `src/components/AppSidebar.tsx` (Calibration entry)
- `src/App.tsx` (route)

**What stays the same**
Auth, RLS, audio retention, phase timer, mic check, quick tags, student PDFs, Cambridge rubrics, semantic tokens.

**Out of scope (intentionally)**
Full PWA service worker (a real install-to-home-screen flow needs a separate manifest pass + worker; the IndexedDB draft + online-flip auto-retry covers 95% of "I lost connection" scenarios).
