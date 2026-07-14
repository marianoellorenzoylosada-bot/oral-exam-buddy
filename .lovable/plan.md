# Plan: Calibración de scoring + aprendizaje desde correcciones de examinadores senior

Combina las dos partes que discutimos, con **control de acceso por rol** para el aprendizaje.

---

## Parte A — Calibración inmediata (sin que subas nada)

Cambios en `supabase/functions/analyze-exam/index.ts` únicamente.

1. **Anclas de calibración few-shot**: portar inline los 5 casos de `src/lib/calibrationCases.ts` (transcript + puntajes gold + rationale) al edge function. En cada análisis, inyectar 2 casos del mismo nivel que el examen actual como "CALIBRATION ANCHORS" dentro del Layer 1 del prompt.

2. **Reglas anti-pesimismo** en el prompt:
   - Los descriptores son **holísticos**, no una checklist. Errores aislados no bajan el puntaje si la performance globalmente encaja con la banda.
   - Hesitaciones y auto-correcciones son esperables en todas las bandas hasta 5.
   - Si dudás entre dos medias-bandas, elegí la más alta cuando el candidato cumpla la mitad superior del descriptor.
   - Los samples de la Core Library con puntaje asignado son **anclas de puntaje**, no solo texto de referencia.
   - Confianza baja se reporta vía `confidence`, **no** bajando el score.

3. **Self-check interno** antes del JSON final: pedir al modelo que compare cada criterio contra la ancla de calibración más similar y ajuste si la desviación es > 1 banda.

Efecto: los marks se acercan a los de los samples oficiales sin que tengas que hacer nada.

---

## Parte B — Aprender de correcciones (solo examinadores senior)

### B.1 Nuevo rol `senior`

- Se extiende el enum `app_role` con `'senior'`.
- Un `senior` es un examinador acreditado por Cambridge/experimentado cuyas correcciones se consideran "verdad de referencia".
- Los `admin` pueden asignar/quitar el rol `senior` desde **Team Admin**.
- Los `educator` regulares siguen pudiendo editar puntajes de sus propios reportes (comportamiento actual) — solo que sus ediciones **no** alimentan la calibración.

### B.2 Flujo de aprobación (solo visible para senior)

En `ReportDetail`, cuando el usuario logueado tiene rol `senior` y edita un puntaje, aparece un botón adicional:

> **Approve as calibration reference**

Al confirmar, se guarda una fila en la tabla `calibration_examples` (que ya existe y encaja perfecto):
- `transcript` — el transcript del examen
- `level` — nivel Cambridge
- `original_gold` — los puntajes originales de la IA
- `senior_corrections` — los puntajes finales del senior
- `score_differences` — diff por criterio
- `senior_notes` — comentario opcional del senior explicando el ajuste
- `examiner_id` — `auth.uid()` del senior
- `approved_at` — `now()`

Con RLS: solo `senior` y `admin` pueden `INSERT`; todos los autenticados pueden `SELECT` (el edge function lee vía `service_role`, pero mantenerlo abierto en lectura permite mostrar transparencia).

### B.3 Inyección al prompt

En `analyze-exam`, además de las anclas built-in de la Parte A, se cargan las **últimas 5 anclas aprobadas** del mismo nivel desde `calibration_examples` y se agregan al bloque de "CALIBRATION ANCHORS" con la etiqueta *"Senior examiner calibration (institution-specific)"*. Si hay conflicto con las anclas built-in, las del senior tienen prioridad — el prompt lo indica explícitamente.

Cap de 5 para no inflar el prompt; se rotan por más recientes.

### B.4 UI de gestión (mínima)

- En **Team Admin**: switch para asignar `senior` (solo visible a `admin`).
- Nueva pantalla simple **Calibration Library** (solo `senior`/`admin`): lista las anclas aprobadas, permite eliminar las propias. No es un editor completo, es una vista de auditoría.

---

## Qué necesito de vos (0 acciones técnicas)

Nada. Cuando esté implementado:
1. Te asigno rol `senior` a vos.
2. Corregís normalmente los reportes. Cuando un ajuste te parezca representativo de "así se puntúa esto en esta institución", tocás **Approve as calibration reference**.
3. Los siguientes análisis del mismo nivel se calibran con esa referencia.

---

## Qué NO se toca

- Pesos de scoring, schema de la respuesta de IA, PDFs, live transcription, Question Bank, storage.
- `src/integrations/supabase/client.ts`, `types.ts`, `.env`, `supabase/config.toml`.
- Comportamiento actual para `educator` (siguen editando sus reportes, sin cambios).

---

## Validación

1. Re-analizar un sample oficial → los marks quedan dentro de ±0.5 banda del oficial (Parte A).
2. Como `senior`, corregir un puntaje y aprobarlo → aparece fila en `calibration_examples`.
3. Re-analizar otro examen del mismo nivel → los edge function logs muestran que la ancla del senior se inyectó al prompt.
4. Como `educator` (no senior), el botón de aprobar no aparece.
5. Reportes previos y flujos existentes siguen funcionando.

---

## Nota

El aprendizaje **no es fine-tuning real** — es prompt-conditioning con anclas. Práctico, barato y reversible (podés borrar anclas y volver al estado base). Si con el tiempo acumulás >50 anclas de calidad, ahí sí tiene sentido evaluar fine-tuning real (fuera de scope hoy).
