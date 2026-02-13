

# OralAssess AI — Implementation Plan

## Phase 1: Foundation & Dashboard Shell
Build the core application structure with a professional sidebar-based layout.

- **Sidebar navigation** with sections: Dashboard, New Exam, Question Bank, Reports, Progress, Settings
- **Dashboard home page** showing recent exams, quick stats, and a "Start New Exam" action
- **Responsive design** optimized for tablet and desktop use (exam room scenarios)
- **Dark/light theme** toggle for different environments

## Phase 2: Exam Setup & Context Upload
Allow educators to configure an exam session before recording.

- **New Exam wizard** — set exam title, institution, group, student IDs (A, B, C), language, and date
- **Booklet upload** — upload PDF/image exam booklets; parse content using AI to extract target vocabulary, expected structures, and visual prompt descriptions
- **Rubric upload** — upload custom rubric PDFs; AI extracts scoring criteria and descriptors into structured data
- **Rubric builder** — option to manually create/edit rubrics with criteria, bands, and descriptors
- **Language selection** — support for English, Spanish, Portuguese, German, French, and Italian

## Phase 3: Live Examination Interface
Build the recording and monitoring dashboard for live exams.

- **Audio recorder** — browser-based recording with local caching (saves to IndexedDB to prevent data loss)
- **Recording controls** — start, pause, resume, stop with elapsed time display
- **Speaker labeling warm-up** — initial phase where teacher labels each candidate's voice sample
- **Live transcription feed** — real-time speech-to-text using ElevenLabs streaming API, displayed as a scrolling transcript
- **Active speaker indicator** — visual highlight showing which candidate is currently speaking
- **TTT vs STT gauge** — live ratio meter showing Teacher Talking Time vs Student Talking Time
- **Candidate cards** — individual panels for each candidate showing their speaking time and turn count

## Phase 4: AI Assessment Engine
Post-exam AI analysis using the uploaded rubric and booklet context.

- **Transcript processing** — send full diarized transcript to AI with rubric criteria and booklet context
- **Evidence extraction** — AI identifies exact quotes demonstrating achievement or errors for each rubric criterion
- **Color-coded annotations** — green for correct usage, red for errors with AI-suggested corrections
- **Rubric scoring** — AI suggests marks per criterion per candidate with justification
- **Audio-synced quotes** — each extracted quote is clickable in-app, jumping to the exact timestamp in the recording

## Phase 5: Human-in-the-Loop Verification
Ensure teacher oversight before finalizing scores.

- **Verification screen** — review each candidate's AI-suggested scores side by side with evidence
- **Override controls** — teacher can adjust any score with a required comment explaining the change
- **Accept/reject individual evidence** — toggle whether each AI-flagged quote is valid
- **Finalize & lock** — once approved, scores are locked and the exam session is marked complete

## Phase 6: Report Generation & Export
Generate professional assessment reports.

- **Interactive in-app report** — full report view with color-coded quotes, scores, and audio playback links
- **PDF export** — professional PDF report with institution branding, candidate scores, evidence quotes (color-coded), and rubric breakdown
- **Per-candidate reports** — individual report cards for each student

## Phase 7: Data Management & Organization
Structure data storage with ethical considerations.

- **Folder hierarchy** — organize exams by Institution → Group → Student ID
- **Anonymization toggle** — scrub student names and PII from transcripts and audio metadata for ethical sharing
- **Search & filter** — find past exams by date, institution, student, or language
- **Cloud storage** — audio files and documents stored securely in Supabase Storage

## Phase 8: Progress Tracking & Analytics
Longitudinal student performance visualization.

- **Student profile view** — aggregated view of all exams for a given student
- **Radar charts** — visualize rubric criteria scores across multiple exam sessions to show growth
- **Trend lines** — track individual criteria improvement over time
- **Exportable progress reports** — PDF export of longitudinal data with charts

## Technical Architecture

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Lovable Cloud (Supabase) for database, auth, storage, and edge functions
- **AI**: Lovable AI (Gemini) for booklet/rubric analysis, transcript assessment, and evidence extraction
- **Speech-to-Text**: ElevenLabs connector for real-time transcription and batch diarization
- **Audio**: Browser MediaRecorder API with IndexedDB for offline resilience
- **PDF Generation**: Client-side PDF library for report exports
- **Charts**: Recharts for radar charts and analytics visualizations

