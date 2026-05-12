## Problem

In **Settings → Defaults**, the "Default Language" selector saves to `localStorage` (`oralassess-lang`), but nothing reads it back. As a result:

- **New Exam** always starts in English (`useExamStore.ts` hardcodes `language: "en"`).
- **Batch Session** always starts in English (`useState("en")` in `BatchSession.tsx`).

So changing the default language in Settings has no visible effect anywhere — which matches what you saw.

(Note: the app does not have a UI translation layer; the "language" setting only controls the exam/assessment language, not the interface language. If you also wanted the UI itself translated, that's a separate, larger feature — let me know.)

## Fix

1. **`src/hooks/useExamStore.ts`** — initialize `language` from `localStorage.getItem("oralassess-lang")`, falling back to `"en"`.
2. **`src/pages/BatchSession.tsx`** — same: `useState(() => localStorage.getItem("oralassess-lang") ?? "en")`.
3. **`src/pages/Settings.tsx`** — keep current save behavior, but also dispatch a small confirmation toast wording tweak so the user knows it applies to *new* exams started after saving (existing in-progress exams keep their current language).

No backend / schema changes. No new dependencies.

## Out of scope

- Translating the app's interface (menus, buttons, labels). Tell me if you want that and I'll plan it separately (likely `react-i18next` + dictionaries for EN/ES/PT/DE/FR/IT).
- Changing how `Profile → Institution` / `Examiner Name` flow into new exams (also currently not auto-prefilled). Happy to include if you want.
