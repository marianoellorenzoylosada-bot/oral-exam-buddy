## Diagnosis: why recovery failed when the screen turned off

I re-read `BatchSession.tsx`, `useAudioRecorder.ts`, and `batchQueueDb.ts`. The previous hardening covered unmount/remount, reload, and tab-switch — but **screen-off on mobile is a different lifecycle event**, and three things go wrong together.

### Root cause hypothesis

1. **Mobile browsers suspend MediaRecorder when the screen locks.** On iOS Safari and most Android Chrome builds, locking the screen pauses JS timers and freezes (or kills) the audio capture pipeline. The page is **not** unmounted, so React state is preserved — but `MediaRecorder.ondataavailable` stops firing, so no further snapshots reach IndexedDB. Whatever was already saved (last 1.5 s throttle window) is the most you have.

2. **The `visibilitychange` recovery re-check is gated by `recorder.state === "idle"`.** When the screen wakes, `recorder.state` in React is still `"recording"` (no error event fired in time), so `checkRecovery()` is skipped. The banner therefore never appears even when there *is* a usable snapshot in IndexedDB.

3. **No screen-wake lock.** Nothing keeps the display on during recording, so the OS is free to lock the screen mid-exam — exactly the failure path the pilot hit.

4. **Stale-recorder not detected on resume.** When the page becomes visible again, we never inspect the underlying `MediaRecorder.state` or audio-track `readyState`. If the track died during the lock, the UI still shows "recording 03:12" but no audio is being captured anymore.

5. **Snapshot may be discarded as "trivial".** `checkRecovery` requires `durationSeconds >= 5`. If the screen locked within the first ~5 s of a pair, the only persisted snapshot has `durationSeconds < 5` and is silently cleared. Threshold is fine for typing-test noise but too aggressive for real exam starts.

(Feedback-by-area, transcript continuity, mic-test, and live-part indicator are out of scope for this diagnosis as you requested — they will be addressed separately.)

### Files involved

- `src/pages/BatchSession.tsx` — visibility handler, recovery gate, wake-lock lifecycle.
- `src/hooks/useAudioRecorder.ts` — expose underlying `MediaRecorder` health + a `healthCheck()` helper that finalizes a snapshot if the track has died.
- `src/lib/batchQueueDb.ts` — no schema change; only the load-threshold consumer changes.

No backend, scoring, transcript, PDF, RLS, or auth changes.

### Smallest safe fix

**A. Acquire a Screen Wake Lock while recording (`BatchSession.tsx`)**
- On `recorder.state === "recording" | "paused"`: `navigator.wakeLock?.request("screen")`.
- Release on stop/reset/unmount and on `visibilitychange === "hidden"`; re-acquire on `"visible"` if still recording.
- Feature-detect; silent no-op on unsupported browsers (older iOS). This alone prevents the most common failure path.

**B. Detect a stale recorder on resume (`useAudioRecorder.ts` + `BatchSession.tsx`)**
- Add a `healthCheck()` function on the hook: inspects `mediaRecorderRef.current.state` and each audio track's `readyState`. If the recorder is `"inactive"` *or* every track is `"ended"` while React state is still `"recording"`/`"paused"`, finalize the current chunks (call `onChunk` with the latest blob), set state to `"stopped"`, and fire `onError("Recording stopped while screen was off.")`.
- Call `healthCheck()` from the existing `visibilitychange` listener whenever the tab becomes visible.

**C. Always re-check recovery on visibility (`BatchSession.tsx`)**
- Remove the `recorder.state === "idle"` gate. After `healthCheck()` runs, the recorder state will reflect reality, and `checkRecovery()` should run unconditionally so the banner can surface a snapshot saved before the lock.

**D. Lower the recovery threshold from 5 s → 2 s (`BatchSession.tsx`)**
- A real exam intro is already worth recovering. The throwaway-noise case is still filtered by `audioBlob.size > 0`.

**E. Keep persistence cadence honest while screen is off**
- We can't run timers when locked, but we can guarantee one extra `saveActiveRecording` call from inside the `onerror` / `track.onended` paths (already in place) and from the new `healthCheck()` finalize path. No new background workers.

### Risks

Low. Wake Lock API is best-effort and feature-detected. `healthCheck()` only runs on visibility transitions and never mutates the recorder when it is genuinely active. Threshold change is a UX preference, not a data change.

### Mobile test procedure (screen-off scenario)

1. Open Batch Session on a phone, lock context (level + group + names).
2. **Pair 1**: record 60 s, Stop → Save & next. Confirm queue shows it.
3. **Pair 2**: type names, Start Recording. After ~20 s, **press the power button to lock the screen** for ~30 s, then unlock.
   - Expected: screen stayed on during recording (Wake Lock). If it did lock anyway:
     - On unlock, an "Recording stopped while screen was off" toast appears.
     - The amber **"Unfinished recording recovered"** banner appears within 1 s, showing ≥20 s and the Pair 2 names.
     - **Save to queue** adds Pair 2 to the queue with its partial audio.
4. Repeat the screen-lock test on Pair 3 (record 5 s before locking) — banner must still appear (threshold lowered to 2 s).
5. Repeat Pair 4 with a phone-call interruption — same expected behavior.
6. Pair 5 normal record → Stop → Save. Confirm 5 items in the queue and that all five can be analyzed and exported.
7. Remote-inspect the device console: confirm `[batchQueueDb] save … size>0` lines stop when the screen is off and resume after unlock, plus exactly one `[batchQueueDb] load … size>0` post-unlock and one `[batchQueueDb] clear` after Save to queue.
