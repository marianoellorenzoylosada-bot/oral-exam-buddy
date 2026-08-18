# Auditoría de Speaking Session — diagnóstico del comportamiento real

Sin cambios de código. Todo lo que sigue está verificado leyendo `src/pages/SpeakingSession.tsx`, `src/hooks/useSpeakingSession.ts`, `src/components/DraftReport.tsx`, `src/components/ReportDetail.tsx`, `src/components/SpeakerReviewWithAudio.tsx`, `src/lib/applySpeakerMap.ts`, `src/lib/transcribe.ts`, `src/pages/Reports.tsx` y el esquema de base de datos.

## Parte 1 — Flujo real de extremo a extremo

El examen no tiene un único estado: hay dos máquinas de estado encadenadas.
1. `session_attempts.status` (la grabación en proceso).
2. `exams.confirmed_at` (el informe firmado).

| Paso | Estado interno | Qué está guardado | Objetos existentes | Acciones permitidas / botones |
|---|---|---|---|---|
| Crear sesión | `speaking_sessions.status = 'open'` | título, nivel, idioma, notas, modo | Session | Prepare: subir material/foto, describir con IA, elegir candidatos, borrar sesión, "Finish for today" |
| Grabando | ningún estado en BD (solo memoria + IndexedDB) | copia de audio cada 5 s en IndexedDB | Session | Start / Stop recording, MicCheck, PhaseTimer, Wake Lock |
| Grabación detenida, sin guardar | ninguno en BD | blob en memoria + snapshot IndexedDB | Session | Play back, Download audio, Discard, **Save attempt**; banner de recuperación si hubo crash |
| En cola | `attempt.status = 'recorded'` | audio subido a `exam-audio`, nombres/ids de candidatos, duración | Session + Attempt | Transcribe, escuchar, borrar attempt |
| Transcribiendo | `transcribing` | igual | Session + Attempt | ninguna (bloqueado) |
| Revisión de speakers | `reviewing_speakers` | `transcript` crudo, `live_words` (timeline diarizado), `speaker_map` sugerido | + Transcript + Speaker map | panel de revisión con audio, Split/Merge, Confirm; "Analyze without confirming speakers" |
| Analizando | `analyzing` | transcript reconstruido, `split_points`, `speaker_overrides` | igual | ninguna (y aquí aparecen "Analyze" / "Back to speaker review" si queda trabado) |
| Análisis listo | `reviewing_report` | `analysis_result` (JSON, todos los candidatos) | + Analysis | **Review & sign report**, **Redo from speaker review**, "Complete per-part breakdown" si falta |
| Auditoría (Draft) | sigue `reviewing_report` | nada nuevo en BD; ediciones en `localStorage` (`oralassess-draft:session-attempt-<id>`) | Analysis + borrador local | escuchar audio, ver script, editar notas/scores, justificar overrides, firmar por candidato |
| Informe firmado | fila nueva en `exams` con `confirmed_at` | informe completo por candidato | + Report firmado (uno por candidato) | vuelve a la cola; el attempt **queda en `reviewing_report`** |
| Reports | `exams.confirmed_at` no nulo | informe definitivo | Report | PDF docente, PDF alumno, Print, Share, Corrected version, Correct attribution, Delete |
| Fallo en cualquier punto | `failed` | lo último guardado | según el punto | Analyze, Back to speaker review |

Hallazgos de estado:
- `attempt.status = 'done'` **solo** se escribe cuando en el Draft se toca "New Exam" (`onReset`). Al firmar todos los informes el attempt no cambia de estado: sigue en `reviewing_report` mostrando "Review & sign report" y "Redo from speaker review", aunque ya existan informes firmados. Ésta es la causa de la ambigüedad que viste en el caso de Fausto.
- Si la transcripción detecta menos de dos voces, se salta la revisión de speakers y pasa directo a `analyzing`.

## Parte 2 — Entidades reales

| Entidad | Existe como | Se crea | Se modifica | Deja de usarse | Depende de |
|---|---|---|---|---|---|
| Speaking Session | tabla `speaking_sessions` | "Create session" | al editar nivel/notas, abrir/cerrar | al borrarla (los informes firmados se desvinculan, no se borran) | usuario |
| Material | `session_materials` + bucket `exam-context` | al subir foto/script (subida inmediata) | descripción manual o IA | al borrar sesión | Session |
| Attempt (= Queue item) | `session_attempts` + audio en `exam-audio` | "Save attempt" | en cada paso del pipeline | tras firmar (queda huérfano en `reviewing_report`) | Session |
| Transcript | columna `transcript` del attempt | al transcribir | se **sobrescribe** al confirmar speakers | — | Attempt |
| Speaker attribution | `speaker_map`, `split_points`, `speaker_overrides` | sugerido al transcribir | al confirmar | — | `live_words` |
| Analysis | `analysis_result` (JSON) | al analizar | "Complete per-part breakdown"; se borra en "Redo" | al firmar (no se copia como snapshot) | Transcript |
| Report | fila `exams` | al firmar cada candidato | solo si `confirmed_at` es null | nunca (o al borrar) | copia del Analysis editado |
| Signed Report | misma fila con `confirmed_at` | al firmar | bloqueado por RLS | — | — |
| Corrected Version | fila **nueva** en `exams` con `revision = anterior + 1` | "Corrected version" sobre un firmado | — | — | apunta al original solo por texto en `examiner_notes` |

No hay entidad "Queue item": la cola es la lista de attempts de la sesión. No hay tabla de versiones; "Corrected Version" es una fila hermana sin foreign key al original.

```text
Session ──< Material
   │
   └──< Attempt ──> Transcript + SpeakerMap + Analysis
                        │
                        └── (firma, por candidato) ──> Exam(confirmed_at)
                                                          │
                                                          └── Exam(revision+1)  [copia suelta]
```

## Parte 3 — Fuente de verdad del transcript

- La fuente original inmutable es **el audio** en `exam-audio` (borrado por el purge a los 15 días desde la firma; el attempt conserva su audio hasta que se borre la sesión).
- La fuente derivada estable es **`live_words`** (timeline diarizado palabra por palabra). Nunca se sobrescribe después de la transcripción.
- El campo `transcript` del attempt es **derivado y sobrescribible**: al confirmar speakers se reconstruye desde `live_words` + mapa + splits + overrides y reemplaza el anterior. No se versiona.
- Cada informe firmado guarda **su propia copia** de `transcript` y de `words_json`, más `speaker_map`/`split_points`/`speaker_overrides`. Ahí sí queda congelado.
- Al reabrir el oral se muestra el `transcript` actual del attempt (no hay historial de transcripts).
- Un nuevo análisis no crea copia del transcript del attempt: `analysis_result` se reemplaza entero.

Respuestas directas: hay un único transcript vivo por attempt; sí se sobrescribe; no se versiona a nivel attempt; sí queda una copia por cada informe firmado; sí, el audio permanece como original.

## Parte 4 — Auditoría de botones

| Botón | Qué ejecuta realmente | Estado / datos que cambia | Crea registros | Naturaleza |
|---|---|---|---|---|
| Start recording | crea la sesión si falta, exige 2 candidatos, limpia backup, arranca MediaRecorder + Wake Lock | ninguno en BD | no | producción |
| Stop recording | cierra el recorder y deja el blob pendiente | ninguno en BD | no | producción |
| Play back / Download audio / Discard | reproducen, descargan o tiran el blob local | IndexedDB | no | Download = red de seguridad de desarrollo |
| **Save attempt** | sube el audio a `exam-audio` y crea el attempt en `recorded` | audio + fila attempt | sí (Attempt) | producción |
| Transcribe | `transcribe-audio` (ElevenLabs) → guarda `transcript`, `live_words`, `speaker_map` sugerido | `recorded → reviewing_speakers` (o `analyzing` si 1 voz) | no | producción |
| Confirm speakers and analyse | guarda mapa, splits y overrides, reconstruye y **sobrescribe** `transcript`, luego llama a `handleAnalyze` | `reviewing_speakers → analyzing → reviewing_report` | no | producción |
| Analyze without confirming speakers | analiza el transcript crudo sin mapa | igual, sin guardar mapa | no | atajo de desarrollo |
| Analyze / Analyzed | mismo `handleAnalyze` (llama `analyze-exam`, reintenta hasta 2 veces la parte faltante) | escribe `analysis_result` | no | rescate cuando el attempt quedó en `analyzing`/`failed` |
| Complete per-part breakdown | re-consulta solo los candidatos sin `partFeedback` y hace merge | `analysis_result` | no | parche de desarrollo |
| **Review & sign report** | abre el Draft con `analysis_result` + audio + `live_words`; si hay borrador local con la misma huella, lo restaura | ninguno hasta firmar | no | producción |
| Confirm & sign (dentro del Draft) | inserta una fila en `exams` por candidato con `confirmed_at`, `session_id`, `attempt_id`, audio y expiración a 15 días; borra el autoguardado; al firmar el último vuelve a la cola | crea Reports | sí (Report) | producción |
| New Exam (dentro del Draft) | marca el attempt como `done` y cierra la revisión | `→ done` | no | efecto lateral no evidente |
| **Redo from speaker review** | confirma por `window.confirm`, pone `status = reviewing_speakers` y `analysis_result = null` | descarta el análisis pendiente | no | producción, pero mal rotulado |
| Back to speaker review | mismo handler que Redo | igual | no | duplicado |
| Headphones / Trash del attempt | URL firmada del audio / borra attempt + audio | — / borra Attempt | no | producción |
| Finish for today / Reopen / Delete session | `status closed/open` / borra materiales, attempts y archivos, desvincula informes | — | no | producción |
| Reports → **Corrected version** (informe firmado) | re-analiza el transcript editado e **inserta un informe nuevo** con `revision + 1`; el original no se toca | crea Report nuevo | sí | producción |
| Reports → **Re-analyze** (no firmado) | re-analiza y **sobrescribe** el informe, guardando snapshot en `previous_analyses` | modifica el Report | no | producción |
| Reports → Correct attribution | reabre el panel de speakers sobre `words_json`, reconstruye el script y abre el diálogo de re-análisis | prepara el paso anterior | no | producción |
| Generate per-part commentary | RPC `fill_missing_part_feedback` (solo rellena si está vacío) en firmados; update directo en no firmados | `part_feedback` | no | parche de desarrollo |
| Approve as calibration reference | inserta en `calibration_examples` (solo admin/senior) | — | sí | producción (rol senior) |

## Parte 5 — El caso de Fausto

El attempt seguía en `reviewing_report` porque firmar informes **no cambia el estado del attempt**. Por eso viste las dos opciones aunque el informe ya existía.

- **Opción A — Review & sign report:** habría reabierto el Draft con el mismo `analysis_result` que ya usaste (más tus ediciones autoguardadas, si la huella coincidía). No modifica nada por sí solo. El riesgo real es que al firmar otra vez **inserta un informe duplicado** para el mismo candidato: no hay verificación de que ya exista un informe firmado para ese attempt.
- **Opción B — Redo from speaker review:** "pending analysis" es exactamente `session_attempts.analysis_result`, el JSON del análisis todavía **no firmado**. Se borra ese JSON y el attempt vuelve a `reviewing_speakers`. Audio, `live_words` y el `transcript` actual quedan intactos. Los informes ya firmados en `exams` **no se tocan** (además la RLS impide actualizarlos). Al confirmar de nuevo se re-analiza el transcript reconstruido de esa nueva revisión de speakers, y si volvés a firmar se crea **otro** informe: no reemplaza ni actualiza al de Fausto.

En resumen: B no dañaba nada, pero tampoco corregía el informe existente de Fausto. Para corregir ese informe el camino correcto es Reports → Correct attribution → Corrected version.

## Parte 6 — Versionado

No existe un sistema de versionado formal.
- Firmados: cada corrección crea una **fila nueva** con `revision + 1`, sin puntero al original (solo una mención en `examiner_notes`). Reports lista todo por `created_at` desc, así que original y versión corregida aparecen como dos informes con el mismo título.
- No firmados: se **sobrescriben** y el estado anterior queda en `previous_analyses` (histórico visible en pantalla, no como informe navegable).
- "Corrected version" no abre otra versión: abre el diálogo que **crea** una.
- "Versión actual" no está definida en ningún lado: es implícitamente la fila más reciente.
- Los firmados están protegidos por RLS (`UPDATE` solo con `confirmed_at IS NULL`), salvo el RPC que solo rellena `part_feedback` vacío.

## Parte 7 — Analyze vs Re-analyze vs Redo

| Acción | Entrada | Salida | Cuándo usarla | Duplicación |
|---|---|---|---|---|
| Confirm speakers and analyse | transcript reconstruido + material + notas | `analysis_result` | camino normal | comparte `handleAnalyze` con Analyze |
| Analyze | `attempt.transcript` tal como está | `analysis_result` | rescate de attempts trabados o fallidos | mismo handler, distinta etiqueta |
| Redo from speaker review / Back to speaker review | nada (solo cambia estado) | vuelve a `reviewing_speakers` | corregir atribución antes de firmar | dos botones, un único handler |
| Reports → Re-analyze | transcript editado del informe | sobrescribe el informe | informe sin firmar | lógica de análisis **duplicada** en `ReportDetail` |
| Reports → Corrected version | transcript editado del informe firmado | informe nuevo | corregir después de firmar | idem |

Hay tres invocaciones separadas de `analyze-exam` (cola, complete-breakdown, ReportDetail) con contexto distinto: la de Reports **no envía material ni notas de la sesión**, así que una corrección post-firma se analiza con menos contexto que el análisis original.

## Parte 8 — Firma

- "Review & sign" = auditar el análisis contra el audio y, por candidato, insertar la fila definitiva en `exams` con `confirmed_at`.
- Al firmar: se calcula el score ponderado, se filtran evidencias no aceptadas, se anexan los overrides justificados a las notas, se fija `audio_expires_at` a 15 días y se borra el autoguardado local.
- Queda bloqueado: todo el contenido del informe, por RLS.
- Sigue "editable" solo por dos vías controladas: el RPC que rellena `part_feedback` vacío, y crear una versión corregida nueva.
- Garantía de inmutabilidad: sí, a nivel base de datos (política de UPDATE). Lo que **no** está garantizado es la unicidad: nada impide firmar dos veces el mismo attempt/candidato.

## Parte 9 — Acciones de desarrollo

| Acción | Uso real | Necesaria en producción | Puede ocultarse |
|---|---|---|---|
| Analyze without confirming speakers | saltear la revisión | No | Sí |
| Analyze / Analyzed (estado analyzing/failed) | desbloquear attempts trabados | Sí, como "Reintentar" | Reformular, no ocultar |
| Complete per-part breakdown | parchear análisis incompletos | No, si el reintento automático es fiable | Sí, dejar automático |
| Generate per-part commentary (Reports) | reparar informes firmados viejos | No para informes nuevos | Sí, solo si falta |
| Back to speaker review (duplicado de Redo) | igual que Redo | No | Sí |
| New Exam dentro del Draft | marca `done` sin que se note | No | Sí |
| Download audio (recording / recovery) | red de seguridad ante pérdidas | Opcional | Mantener en un menú secundario |
| Banner "signed report without per-part feedback" | diagnóstico de datos viejos | No | Sí |
| Approve as calibration reference | rol senior | Sí | No |

## Parte 10 — Riesgos por idea

| Idea | Seguridad | Archivos afectados | Riesgo |
|---|---|---|---|
| Abrir siempre la última versión | Segura solo de lectura | `Reports.tsx`, `ReportDetail.tsx` | Sin FK entre versiones hay que agrupar por candidato + attempt + título; con títulos repetidos puede agrupar mal. Bajo-medio |
| "Corrected Version" → "Version History" | Necesita lógica nueva | `ReportDetail.tsx`, `Reports.tsx`, migración (`parent_exam_id`) | Los informes ya existentes no tienen padre: requiere backfill o heurística. Medio |
| Quitar la ventana intermedia tras Confirm Speakers | Segura | `SpeakingSession.tsx` (abrir el Draft al terminar el análisis) | Hoy solo se abre solo si no falta ninguna parte; automatizar siempre exige decidir qué pasa cuando falta. Bajo |
| Unificar Confirm+Analyse con Re-analyze | Requiere tocar lógica | `SpeakingSession.tsx`, `ReportDetail.tsx`, helper nuevo | Cambia el contexto enviado a la IA (Reports hoy manda menos) y por tanto los scores. Medio-alto |
| Queue secuencial | Segura en UI | `SpeakingSession.tsx` | Perdés el rescate manual de attempts trabados si no queda una vía alternativa. Bajo-medio |
| Ocultar acciones de mantenimiento | Segura | `SpeakingSession.tsx`, `ReportDetail.tsx` | Sin ellas, un attempt trabado queda sin salida visible. Bajo si queda un "modo avanzado" |
| Herramientas de desarrollo detrás de un flag | Segura | `featureFlags.ts` + las dos pantallas | Ninguno relevante |

Dos riesgos que conviene resolver antes de simplificar, porque hoy son bugs latentes:
1. Firmar no cierra el attempt (`done` solo lo pone "New Exam") → botones engañosos y posibilidad de informes duplicados.
2. "Corrected version" no queda vinculada al original → cualquier "Version History" necesita un `parent_exam_id`.

## Parte 11 — Mapa de estados

```text
[sin grabar]           → Start recording          | sesión, material, candidatos
[grabando]             → Stop recording           | + audio en memoria/IndexedDB
[grabado sin guardar]  → Save attempt             | + blob, duración
recorded               → Transcribe               | + audio en la nube
transcribing           → (espera)                 | audio
reviewing_speakers     → Confirm speakers         | + transcript crudo, live_words, mapa sugerido
analyzing              → (espera / Analyze)       | + transcript final, splits, overrides
reviewing_report       → Review & sign / Redo     | + analysis_result
[Draft]                → Confirm & sign           | + ediciones locales
exams.confirmed_at     → PDFs, Share, Corrected   | informe congelado
exams.revision > 0     → (fila hermana)           | informe corregido, original intacto
failed                 → Analyze / Back to review | lo último guardado
done                   → (solo vía New Exam)      | attempt cerrado a mano
```

Diagnóstico cerrado, sin cambios aplicados. Cuando quieras, el paso siguiente natural es un plan de simplificación con dos correcciones previas (cerrar el attempt al firmar y vincular versiones) sobre las que apoyar el flujo final.
