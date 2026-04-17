

## Cambridge-Aligned Batch Recording Mode

I've reviewed both Cambridge PDFs. They confirm the 5 official Speaking criteria and the 0–5 band scale (whole bands at the cell level, half-bands awarded between for shared features). I'll embed the official descriptors directly into the app so the AI always has them — even if the teacher doesn't upload anything.

### What I'll build

**1. Cambridge rubric library** — new `src/lib/cambridgeRubrics.ts`
Ships the official 0–5 descriptors per CEFR level (A2, B1, B2, C1, C2) for the 5 areas: **Grammar & Vocabulary, Discourse Management, Pronunciation, Interactive Communication, Global Achievement**. Half-bands (0.5 steps) are explained in the prompt as "shares features of the bands above and below".

**2. Updated AI prompt** — `supabase/functions/analyze-exam/index.ts`
- Switch criteria from CEFR-generic to the 5 Cambridge areas above.
- Use 0–5 scale, 0.5 increments.
- Inject the matching level's descriptors from `cambridgeRubrics.ts` automatically; if the teacher uploaded a handbook/sample, append it as additional reference.
- Overall mark = average of the 5 band scores, mapped to a Cambridge grade band when relevant.

**3. Batch recording flow** — new `src/pages/BatchSession.tsx` + `src/hooks/useBatchQueue.ts`
- Set shared context once (level, language, institution, group, booklet, handbook).
- For each exam: enter candidate names (2 or 3) → record → "Save & next exam" (audio kept in memory).
- Queue panel shows each item with status: `Recorded`, `Queued`, `Analyzing`, `Done`, `Failed`.
- "Analyze all" button runs `analyze-exam` sequentially in the background; teacher can keep recording while earlier ones process.
- Click a finished item to open the existing `DraftReport` for review/sign.

**4. Sidebar + routing**
- New "Batch Session" entry under "Examine" in `AppSidebar`.
- Route added in `App.tsx`.
- Existing single-exam flow stays as-is.

**5. Exam levels in setup**
Level dropdown in `NewExam.tsx` and the new batch page will list Cambridge exams (A2 Key, B1 Preliminary, B2 First, C1 Advanced, C2 Proficiency) with the underlying CEFR code stored.

### What does NOT change
- DB schema — `exams.criteria` JSON already stores arbitrary criterion arrays, so the new 5 areas drop in cleanly. One row per candidate (already supported).
- Reports & Progress pages — automatically pick up the new criterion names; the radar chart will display the 5 Cambridge areas for new exams.
- DraftReport — already handles arbitrary criteria and multi-candidate; no structural changes.
- PDF generation — already iterates over criteria array; no changes.

### Files
- new `src/lib/cambridgeRubrics.ts`
- new `src/pages/BatchSession.tsx`
- new `src/hooks/useBatchQueue.ts`
- edit `supabase/functions/analyze-exam/index.ts` (Cambridge prompt + descriptors)
- edit `src/pages/NewExam.tsx` (Cambridge level labels)
- edit `src/components/AppSidebar.tsx` (new entry)
- edit `src/App.tsx` (new route)

### About your uploads
Both PDFs are useful — I'll encode the **B2 First** descriptors verbatim and adapt the same template for A2/B1/C1/C2 from the overall scales table on page 7. If you later assess other levels, drop the matching handbook into the Context tab during a session and it'll be sent to the AI alongside the built-in descriptors.

