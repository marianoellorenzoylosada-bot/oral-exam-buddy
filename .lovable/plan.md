
The user is asking for improvement ideas, not requesting implementation. This is a research/advisory question, so I'll give a focused list rather than a full build plan. Let me think about what's been built and where the real gaps are.

**Current state recap**
- Multi-candidate exams (2–3) with Cambridge criteria + 0–5 scale
- Batch session mode with in-memory queue
- Per-candidate draft review, overrides with justification, sign & save
- Reports (search/filter/group), Progress (radar/trends), PDF exports
- ElevenLabs Scribe transcription, IndexedDB caching, anonymisation toggle
- Auth + RLS, question bank, practice link recommendations

**Real gaps I'd prioritise**

# How the app can be improved

Grouped by impact. Pick whichever resonates and I'll plan it in detail.

## 1. Reliability & data safety (highest value before coworker validation)
- **Persist the batch queue to IndexedDB** — right now a page reload during a long session loses all unanalysed recordings. Critical for real exam days.
- **Auto-save draft reports** — overrides and accepted strengths are lost if the browser crashes before "Confirm & Sign".
- **Resumable uploads for long audio** — a 30-min exam at poor connectivity can fail the single edge-function call. Chunked upload + background analysis would fix this.
- **Edge-function timeout guard** — large audio + long handbook PDFs can exceed limits. Add explicit duration/size pre-checks with friendly errors.

## 2. Examiner workflow
- **Class roster manager** — pre-load student lists per institution/group and pick names from a dropdown instead of re-typing every session. Also prevents typos that fragment the Progress view.
- **Live note-taking during recording** — a side panel where the examiner jots timestamps/observations that get attached to the transcript and shown to the AI.
- **Pause / resume between Parts 1–4** — Cambridge Speaking has 4 parts; let the examiner mark part boundaries so the AI can score each part's Interactive Communication separately.
- **Re-analyze with adjusted context** — if the AI misidentifies a speaker or misses context, allow re-running analysis with a corrected prompt without re-recording.

## 3. Assessment quality
- **Speaker-labelled transcript view** — show the diarised transcript with colour-coded speakers (Examiner / Cand A / Cand B / Cand C) so teachers can verify the AI mapped voices correctly before trusting scores.
- **Confidence indicators per criterion** — have the AI return a confidence value; flag low-confidence scores for mandatory teacher review.
- **Inter-rater calibration mode** — two examiners score the same recording independently; the app shows the gap and a reconciliation view. Great for departmental moderation.
- **Combined multi-candidate PDF** — one document per session with all candidates side-by-side, plus a session summary header. Currently each candidate exports separately.

## 4. Reporting & analytics
- **Group/cohort dashboards** — average band per criterion across a group, distribution charts, identify weakest skills for whole-class teaching focus.
- **Email report to candidate/parent** — one click to send the PDF (with anonymisation rules respected) via Resend.
- **Exportable CSV of all scores** — for institutional reporting and spreadsheets.
- **Trend alerts** — flag candidates whose scores drop ≥1 band between sessions.

## 5. Collaboration & governance
- **Shared institution workspace** — multiple examiners in one institution see the same roster and reports (with role-based permissions: examiner / head of department / admin).
- **Audit log** — who changed which score, when, with the justification. Required in many exam centres.
- **Approval workflow** — drafts go from "examiner signed" → "moderator approved" before being marked official.

## 6. UX polish
- **Keyboard shortcuts** during recording (space = pause, N = next exam in batch).
- **Audio waveform + scrubber** on the recording panel and report detail, with click-to-jump synced to the transcript.
- **Mobile/tablet recording layout** — examiners often use iPads; the current layout works but could be optimised.
- **Onboarding tour** — first-time users get a 4-step walkthrough of New Exam → Batch → Reports → Progress.

## 7. Internationalisation
- App UI is currently English-only despite supporting 6 exam languages. Adding i18n (ES/PT/DE/FR/IT) would let non-English-speaking examiners use the tool comfortably.

---

**My top 3 recommendations to do next**, in order:
1. Persist batch queue + auto-save drafts (reliability).
2. Class roster manager (huge daily time saver, fixes Progress fragmentation).
3. Speaker-labelled transcript + confidence indicators (trust in AI scores — essential before coworker validation).

Tell me which area(s) you want and I'll come back with a concrete build plan.
