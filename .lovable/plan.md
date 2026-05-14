
## Root cause analysis

Re-reading `useAudioRecorder`, `BatchSession`, and `batchQueueDb`, the recovery pipeline has several independent weaknesses that together explain "recording disappeared, no banner":

1. **3 s snapshot throttle is too aggressive at the start.**
   `if (now - lastSnapshotAtRef.current < 3000 && durationSeconds > 0) return;`
   In practice the FIRST chunk does persist (because `last = 0`), but the next ~3 chunks are skipped. If the recorder dies in the first few seconds (mic revoked, autoplay/visibility kill on mobile), we only have a 1 s blob — under the `>= 5 s` recovery threshold — so `loadActiveRecording` discards it and clears IndexedDB silently.

2. **`Record again` and `handleSaveExam` immediately call `clearActiveRecording()` while the next pair is being prepared.** The very first snapshot of Pair 3 races with that delete. If the delete transaction commits *after* the first 1 s snapshot, Pair 3's initial state is wiped. The next snapshot only lands ~3 s later — wide enough window for the failure to occur in between.

3. **Unmount → remount race.** When BatchSession unmounts mid-recording, `useAudioRecorder`'s cleanup calls `recorder.stop()`. The final `ondataavailable` + `onstop` fire asynchronously and *then* call `saveActiveRecording`. The new BatchSession mount runs `loadActiveRecording` immediately — often *before* the final write commits. We only check once, so if the read loses the race, the banner never appears even though earlier 3‑s snapshots should still be in the store.

4. **`contextLocked` is not in the snapshot.** Even when recovery does find the blob, the remounted page lands on the unlocked context form (the recording card is gated by `contextLocked`), confusing the user. Recovery should restore the locked context.

5. **iOS Safari Blob‑in‑IndexedDB is unreliable.** Some Safari builds drop the binary content of a stored `Blob` after a tab reload (the record persists but `blob.size` is 0). That explains why the banner can stay hidden even when the store technically has a row: the `audioBlob.size > 0` guard fails.

6. **No breadcrumbs.** There are zero logs around save/load/clear or MediaRecorder lifecycle, so we cannot tell from a real device which of (1)–(5) hit.

## Smallest safe fix

Frontend only. No backend, scoring, transcription, auth, RLS, or schema changes.

### A. `src/lib/batchQueueDb.ts` — make persistence iOS‑safe and observable

- Change `ActiveRecordingSnapshot.audioBlob: Blob` to be stored as an `ArrayBuffer` + `mimeType` internally; expose a reconstructed `Blob` on load. (Bump to `DB_VERSION = 3`, add an upgrade path that wipes the old `active` row — safe, it was crash recovery only.)
- Add `contextLocked: boolean` to the snapshot shape.
- Add `console.debug` lines on every save/load/clear (size, duration, updatedAt) so we can verify on a real phone.

### B. `src/hooks/useAudioRecorder.ts` — guarantee an early, reliable first snapshot

- Add a `force` parameter path so the first `ondataavailable` after `start()` always notifies the listener with `durationSeconds = 0` (so callers can bypass throttles).
- Call `onChunkRef.current` from `onstop` *before* `releaseStream()` (already done), and additionally from `recorder.onerror` and `track.onended` so we never lose the last buffer.
- Keep the unmount cleanup as is, but log lifecycle events (`[recorder] start/stop/error/track-ended/unmount`).

### C. `src/pages/BatchSession.tsx` — fix throttle race, persist context lock, retry recovery read

- Reduce snapshot throttle from 3000 ms to **1500 ms**, and remove the `durationSeconds > 0` guard so the very first chunk *always* writes (currently it does, but make it explicit and add the `force` path from B).
- In `handleSaveExam` and the "Record again" button, do **not** call `clearActiveRecording()` until the queue write has resolved (it's already sync in state, but await the IDB write in `useBatchQueue.persistItem` first; simplest: `await db.saveItem(newItem)` before clearing).  → Achieved by exposing an async `addItem` from `useBatchQueue` (only the local hook signature changes — no callers outside Batch flow).
- Persist `contextLocked` in every snapshot and restore it (along with candidate names) in `handleRecoverSave` *and* in a new auto‑restore path: if a snapshot is loaded and the current recorder is idle, restore context state immediately so the user lands back on the recorder view, not the context form.
- After the initial `loadActiveRecording`, schedule one **retry 800 ms later** to defeat the unmount→remount race. If the second read returns a valid snapshot and `recovered` is still null, set it.
- Add a `visibilitychange` listener: when the tab becomes visible again and the recorder is `idle`, re-run `loadActiveRecording`. This catches mobile background→foreground transitions that don't unmount but do silently stop the recorder.
- Add `console.debug` for: snapshot save (size, dur), snapshot load result, clear calls, and recorder state transitions.

### D. Out of scope (explicit)

- No changes to `analyze-exam`, `transcribe-audio`, `useBatchQueue.analyzeOne`, `DraftReport`, PDFs, scoring, calibration, auth, RLS, storage.
- No DB version bump on the `queue` store, only on the IndexedDB schema (a separate IndexedDB).

## Files to change

1. `src/lib/batchQueueDb.ts` — ArrayBuffer storage, `contextLocked`, version bump, debug logs.
2. `src/hooks/useAudioRecorder.ts` — first‑chunk force notify, onerror/onended final snapshot, lifecycle logs.
3. `src/pages/BatchSession.tsx` — throttle reduction, await IDB before clear, persist + restore `contextLocked`, retry read at 800 ms, `visibilitychange` re‑check, debug logs.

No other files touched.

## How to verify (mobile, third‑pair interruption)

1. Open Batch Session on phone, lock context.
2. **Pair 1:** record ~60 s, Stop, Save & next. Verify queue shows Pair 1.
3. **Pair 2:** type names, record ~60 s, Stop, Save & next. Verify queue shows Pair 2.
4. **Pair 3:** type names, Start Recording. After ~10 s, force an interruption that mimics the real bug: switch to another app for 30 s, then return. Repeat with: hard reload, browser back‑swipe, then forward.
5. Expected after each interruption:
   - Recording card disappears (page returned to root) **but** the amber "Unfinished recording recovered" banner appears within 1 s.
   - Banner shows duration ≥ 10 s and the Pair 3 candidate names.
   - Clicking **Save to queue** adds Pair 3 (with its partial audio) to the queue alongside Pairs 1 and 2.
   - Console (remote inspect) shows `[batchQueueDb] save … size>0` lines every ~1.5 s during the recording, a `[batchQueueDb] load … size>0` line on remount, and exactly one `[batchQueueDb] clear` after Save to queue.
6. Repeat one run where you tap **Discard**: banner disappears, queue still has Pairs 1 & 2, IndexedDB `active` row is empty.
7. Edge: record Pair 3 for only 3 s, then reload. Banner should NOT appear (below 5 s threshold) and store should be cleared.

## Risk

Low. All changes are local to the Batch Session recovery surface. The DB version bump on `oralassess-batch` only resets the throwaway `active` row; the `queue` store keeps its data. Retrying `loadActiveRecording` once is idempotent. The `visibilitychange` handler only fires when the recorder is idle. ArrayBuffer storage is universally supported in IndexedDB.
