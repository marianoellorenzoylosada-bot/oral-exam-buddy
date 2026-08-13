# Rehacer el recorrido del oral de Federica y Juana desde la adjudicación de speakers

## Se puede: los datos siguen ahí

Verificado en la base para ese par (grabación del 13/08, 14:34):

- El audio sigue guardado (no venció).
- La transcripción completa está guardada (10.704 caracteres) y, sobre todo, el **timeline palabra por palabra con diarización sigue disponible (3.802 palabras)** — es lo que necesita el panel de revisión de speakers con colores.
- La toma está en estado `reviewing_report`, o sea: se puede volver atrás sin perder nada.

También detecté que en los intentos de reparación quedaron **informes duplicados**: Federica tiene dos informes firmados de esa misma grabación (18:53 y 19:47) y Juana uno solo, sin desglose por parte.

## Qué se va a hacer

### 1. Acción "Rehacer desde la revisión de speakers"

En la cola de la Speaking Session, cada toma ya analizada tendrá una acción para **reabrir el recorrido**:

- Vuelve al paso de **revisión de speakers**, con el script completo desplazable y resaltado por color, y las correcciones línea por línea.
- Se descarta el análisis anterior de esa toma (no los informes ya firmados: eso se decide aparte, ver punto 3).
- Al confirmar speakers se vuelve a correr el análisis y se llega otra vez a "Review & sign", ahora con el desglose por parte verificado para **las dos candidatas** antes de poder firmar.
- Pide confirmación antes de reabrir, para que no se pierda por accidente un análisis en curso.

### 2. Reabrir esta toma en concreto

Se deja la toma de Federica + Juana lista para rehacer el recorrido: estado de revisión de speakers, mapeo previo precargado como punto de partida (se puede corregir), audio y script intactos.

### 3. Limpiar los informes viejos de esa grabación

Los tres informes firmados de esa grabación (dos de Federica, uno de Juana sin desglose) quedan **archivados** — no se borran, dejan de aparecer en la lista de informes — para que al firmar de nuevo quede un único informe correcto por candidata y no haya duplicados confundiendo el historial.

## Notas técnicas

- Nueva acción en la cola de `SpeakingSession.tsx`: `updateAttempt` con `status: "reviewing_speakers"` y `analysis_result: null`, detrás de un diálogo de confirmación; el panel `SpeakerReviewPanel` ya se monta con `live_words` + `speaker_map` existente, así que no hace falta lógica nueva de revisión.
- Para la toma `41ab2161…`: misma operación aplicada una vez vía migración de datos, más `archived = true` en los tres `exams` de esa grabación (`37e5b860…`, `9d590429…`, `7f36c7ed…`). Los `exams` con `confirmed_at` están bloqueados para edición por RLS, así que el archivado se hace en la migración, no desde el cliente.
- Sin cambios de esquema. Costo de IA: una única corrida de análisis nueva para esa toma.
