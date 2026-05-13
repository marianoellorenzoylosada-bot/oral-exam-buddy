## English-Only Simplification

Strip the multi-language UI without touching the underlying data model, AI flow, or design system. All call sites keep passing a `language` string — it just always equals `"en"`.

### Changes

**1. `src/lib/examLevels.ts`**
- Trim `EXAM_NAMES` to only the `en` entry.
- Trim `SUPPORTED_LANGUAGES` to `[{ value: "en", label: "English" }]`.
- Keep `getExamLevels()` and `getExamLabel()` exports unchanged so call sites still compile. Fallback already returns English names for any legacy language code in old records.

**2. `src/pages/NewExam.tsx`**
- Remove the Language `<Select>` field and its label.
- Ensure the exam is created with `language: "en"` (rely on store default).

**3. `src/pages/BatchSession.tsx`**
- Remove the Language `<Select>`.
- Replace the language `useState` with a constant `const language = "en"`.

**4. `src/pages/Settings.tsx`**
- Remove the entire "Defaults / Default Language" card.
- Stop reading/writing the `oralassess-lang` localStorage key.
- Keep Profile and AI Engine cards as-is.

**5. `src/hooks/useExamStore.ts`**
- Drop the `localStorage.getItem("oralassess-lang")` lookup; always default `language: "en"`.
- Keep the `oralassess-institution` lookup.

### Untouched
- Supabase schema, RLS, Auth, Storage.
- `analyze-exam` edge function and AI prompts (still receive `language`).
- Reports, Progress, PDF generation, Cambridge rubrics, Question Bank, Roster.
- Sidebar, layout, theme, typography — no visual redesign.

### Trade-offs
- DELE / DELF / Goethe / CILS / CAPLE labels are no longer selectable.
- Historical exams stored with non-English language codes still load and display using English exam names (graceful fallback).
- Reversible later by restoring the trimmed entries in `examLevels.ts` and re-adding the selectors.

### Memory follow-up
- Update `mem://index.md` Core line to reflect "Languages: EN only" after implementation.
