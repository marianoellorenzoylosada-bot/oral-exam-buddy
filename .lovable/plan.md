# Fase 2 — Speaking Session unificada

## Alcance de esta fase

Reemplazar los dos flujos paralelos (New Exam / Batch Session) por una única **Speaking Session**:

- Se carga el material de la sesión **una vez** (nivel, idioma, booklet, rubric, institución, grupo).
- Dentro de esa sesión se pueden grabar **varios intentos** (pares/tríos de candidatos).
- Cada intento sigue el mismo ciclo: grabar → transcribir → confirmar speakers → scorear IA → revisar → guardar.
- Cada evaluación final se vincula al candidato real del roster (gracias a Fase 1) y queda congelada al confirmar (gracias a Fase 0).
- Una misma sesión, con su material, puede usarse hoy con unos alumnos y mañana con otros, porque la sesión persiste mientras no se cierre.

**Lo que NO hace esta fase:**
- No borra los reportes viejos (Fase 1 ya los archivó).
- No agrega Academic Year / Enrollments (sigue en backlog).
- No reemplaza aún el sistema de calibración ni el banco de preguntas.
- No cambia el motor de IA ni el edge function `analyze-exam`.

---

## Cómo se verá para el usuario

1. En el sidebar desaparecen **New Exam** y **Batch Session**; aparece **Speaking Session**.
2. Al entrar, el docente crea una nueva sesión: elige nivel, idioma, institución, grupo y sube el booklet/rubric (una sola vez).
3. Puede grabar el primer par/trío de candidatos. Si quiere, guarda la sesión y la retoma otro día.
4. Cada intento aparece en una cola y pasa por transcribir → confirmar speakers → scorear IA.
5. El informe de cada candidato se guarda como una evaluación confirmada individual.

Los reportes de `Reports` seguirán siendo las evaluaciones individuales; el material compartido quedará visible en cada informe como "Session context".

---

## Cambios técnicos (para tu asesor)

### Modelo de datos

Nuevas tablas:

```text
public.speaking_sessions
  - id, user_id, level_code, language, institution, group_id,
    title, booklet_text, rubric_text, notes,
    created_at, updated_at
  - RLS: el dueño puede leer/escribir sus propias sesiones.
  - service_role: ALL.

public.session_attempts
  - id, session_id, user_id, audio_path, transcript, speaker_map,
    duration_seconds, recorded_at, created_at, updated_at
  - RLS: el dueño puede leer/escribir sus propios intentos.
  - service_role: ALL.
```

Columnas nuevas en `exams`:

```text
  - session_id (uuid -> speaking_sessions.id, nullable)
  - attempt_id (uuid -> session_attempts.id, nullable)
```

Ambas columnas son `nullable` para no romper reportes existentes (Fase 1 ya los archivó con `archived = true`).

### Código

- `src/pages/SpeakingSession.tsx`: nuevo único flujo, basado en la estructura actual de `BatchSession.tsx` pero sin el concepto de material por intento.
- `src/pages/NewExam.tsx` y `src/pages/BatchSession.tsx`: se dejarán de usar en el router; se redirigirán a `SpeakingSession` para no romper favoritos / links.
- `src/components/AppSidebar.tsx` y `src/App.tsx`: un solo ítem de navegación.
- `src/hooks/useBatchQueue.ts`: renombrar a `useSessionQueue.ts` o refactorizar para que cada ítem de la cola sea un `SessionAttempt` vinculado a una `sessionId`.
- `src/components/DraftReport.tsx`: adaptar `handleConfirmSign` para crear también la fila en `session_attempts` (si aún no existe) y guardar `session_id`/`attempt_id` en `exams`.
- IndexedDB: sigue siendo el respaldo local del audio mientras la sesión no se haya persistido en la base de datos.

### Edge functions / migraciones

- `supabase/migration`: crear tablas + GRANT + RLS + triggers `updated_at`.
- `supabase/functions/analyze-exam`: sin cambios en esta fase; sigue recibiendo transcript, nombres, booklet y rubric.

---

## Criterios de aceptación

- [ ] El sidebar muestra solo "Speaking Session".
- [ ] Al crear una sesión se sube el material una sola vez.
- [ ] Se puede grabar un intento con 2-3 candidatos del roster.
- [ ] Se pueden grabar varios intentos en la misma sesión.
- [ ] Se pueden guardar la sesión y retomarla (al menos en el mismo dispositivo/browser).
- [ ] Cada intento pasa por transcribir → confirmar speakers → scorear IA.
- [ ] Cada evaluación confirmada se guarda con `candidate_id`, `session_id`, `attempt_id` y el audio compartido.
- [ ] Los reportes antiguos siguen siendo legibles (columnas `session_id`/`attempt_id` son null).
- [ ] Build y typecheck pasan sin errores.
- [ ] Prueba de punta a punta con un audio corto produce informes de cada candidato.

---

## Riesgos y mitigaciones

- **Riesgo**: Cambiar la navegación puede confundir a quienes ya usan New Exam/Batch Session.
  - **Mitigación**: New Exam y Batch Session se redirigen a Speaking Session; no se borran de golpe.
- **Riesgo**: El audio compartido por intento necesita que todos los candidatos del intento estén en la misma grabación.
  - **Mitigación**: mantenemos el flujo actual de grabación por par/trío; no mezclamos candidatos de distintos intentos.
- **Riesgo**: Reportes antiguos podrían perder la relación con el material si se migra agresivamente.
  - **Mitigación**: los viejos reportes permanecen `archived = true` y no tocamos sus `audio_path` ni `transcript`.

---

## Después de esta fase

- **Fase 3**: contrato de datos canónico (Zod) entre IA, DB y PDF para evitar `(object)(object)` e inconsistencias.
- **Backlog**: Academic Year / Enrollments, roles Coordinador, KET/CAE/CPE, app móvil, etc.

## Pregunta para aprobar

¿Aprobás este alcance para Fase 2?

- [ ] Sí, arrancar con el modelo `speaking_sessions` + `session_attempts`.
- [ ] Prefiero una versión más simple: solo renombrar Batch Session a Speaking Session y eliminar New Exam, sin nuevas tablas por ahora.
- [ ] Quiero ajustar algo antes.
