

# Multi-Candidate Oral Exam Support

## What changes

Currently each exam session assesses a single candidate. The app needs to support **2–3 candidates per exam**, with the AI identifying speakers as Examiner, Candidate A, Candidate B, and optionally Candidate C.

## Plan

### 1. Update the Setup form to collect multiple candidate names

Replace the single "Candidate Name" input with a dynamic list where the teacher enters names for Candidate A, Candidate B, and optionally adds Candidate C. A toggle or "Add candidate" button controls whether it's a 2- or 3-person exam. The `candidateName` field in `useExamStore` will be replaced by `candidateNames: string[]` (default 2 slots).

**Files**: `src/hooks/useExamStore.ts`, `src/pages/NewExam.tsx`

### 2. Update the AI prompt to identify speakers per-candidate

Modify the `analyze-exam` edge function's system prompt to instruct the AI to:
- Identify speakers: Examiner, Candidate A (name), Candidate B (name), [Candidate C (name)]
- Produce **per-candidate scores** for all 5 CEFR criteria
- Return a JSON array of candidate assessments instead of a single assessment

New response format:
```text
{
  "candidates": [
    {
      "candidateName": "María García",
      "overallBand": "B1",
      "overallScore": 3.2,
      "criteria": [...],
      "strengths": [...],
      "areasForImprovement": [...]
    },
    { ... }
  ],
  "transcript": "...",
  "examinerNotes": "..."
}
```

**Files**: `supabase/functions/analyze-exam/index.ts`

### 3. Update DraftReport to show per-candidate results

Add a tabbed or accordion view inside DraftReport so the teacher can review and override scores for each candidate independently. The transcript and examiner notes remain shared. Each candidate gets their own "Confirm & Sign" flow.

**Files**: `src/components/DraftReport.tsx`

### 4. Save one exam record per candidate

When the teacher confirms, insert one row in the `exams` table per candidate (each with their own scores, same audio reference). The `candidate_name` column already exists. The `candidates` column (integer) stays as the total count.

**Files**: `src/components/DraftReport.tsx` (save logic)

### 5. Update reports and progress pages

No structural changes needed — these already filter by `candidate_name` and display individual records. The multi-candidate save from step 4 naturally populates them correctly.

### 6. Update PDF generation

The report PDF already works per-candidate since each saved exam is one candidate. No changes needed unless we want a combined multi-candidate PDF (can be added later).

---

### Technical details

- **Database**: No schema changes required. The existing `exams` table and `candidate_name` column support this model (one row per candidate).
- **Edge function**: The AI prompt change is the most significant modification — it switches from single-assessment to multi-assessment output.
- **Backward compatibility**: Old single-candidate exams will continue to display correctly since they already have `candidate_name` set.

