# Fase 2 — Speaking Session unificada (según el procedimiento real)

## El procedimiento que vamos a implementar

```text
1. Crear sesión  → nivel + idioma + título
2. Elegir modo de transcripción
     · En vivo (más rápido, consume créditos mientras grabás)
     · Manual (más económico, por defecto; ideal para pruebas)
3. Subir material una sola vez
     · foto del set de imágenes a comparar (Parte 2)
     · foto del diagrama (Parte 3)
     · script del examinador (foto, PDF o texto)
   → la IA lee cada foto y devuelve una descripción
   → el examinador la revisa y corrige antes de guardarla
4. Elegir la pareja/trío del roster (pueden ser de grupos y docentes distintos)
5. Grabar → detener → "Mandar a la cola"
6. Volver al paso 4 con la pareja siguiente (sin esperar nada)
7. Terminada la jornada: abrir la cola ítem por ítem
     · Si el modo es en vivo: solo confirmar quién es quién → analizar con IA
     · Si el modo es manual: transcribir → confirmar quién es quién → analizar con IA
     → revisar el informe → confirmar y firmar → siguiente
8. Otro día: reabrir la misma sesión y seguir desde el paso 4
```

Nada se procesa por su cuenta mientras estás tomando orales, **salvo que el modo en vivo esté activado**. En ese caso, la transcripción avanza en paralelo y el ítem entra directamente en el paso de revisión de speakers. El análisis con IA sigue siendo manual y confirmado por vos.

---

## Decisiones confirmadas

- **Material por foto**: la IA la interpreta y genera la descripción; vos podés editarla antes de guardar. Esa descripción editada es lo que recibe el análisis, así que el examen sabe qué mostraba la imagen.
- **Grupos mixtos**: la sesión no tiene un grupo único. Cada candidato se elige del roster y su evaluación queda con su propio grupo, su docente y su institución. Una pareja de dos grupos distintos produce dos informes con grupos distintos.
- **Reutilizar material**: la sesión se reabre. Queda abierta hasta que la cierres, y el material sube una sola vez para todos los días que la uses.
- **Procesamiento**: manual por defecto, con opción de transcripción en vivo que se puede activar por sesión. El análisis con IA siempre es manual y requiere confirmación.

---

## Cómo se verá

1. En el menú, un solo ítem: **Speaking Session**. Ya no hay New Exam ni Batch Session.
2. Crear sesión: título + nivel + idioma + interruptor "Transcripción en vivo" (desactivado por defecto).
3. Pantalla de sesiones: las sesiones abiertas con su material, nivel, modo de transcripción y cuántos orales tienen tomados. Botón "Retomar" y botón "Cerrar sesión".
4. Dentro de la sesión, tres zonas:
   - **Material** (colapsable una vez cargado): fotos + descripciones editables + script.
   - **Grabar**: elegir candidatos del roster → grabar → mandar a la cola.
   - **Cola**: cada ítem con sus candidatos, su estado, y el botón para procesarlo.
5. Al procesar un ítem:
   - Modo manual: transcribir → confirmar speakers → analizar.
   - Modo en vivo: confirmar speakers → analizar.
   - Luego: informe → confirmar y firmar (queda congelado, como en Fase 0).

---

## Cambios técnicos

### Datos

```text
public.speaking_sessions
  id, user_id, title, level_code, language,
  status ('open' | 'closed'), notes,
  created_at, updated_at
  RLS: solo el dueño. GRANT authenticated + service_role.

public.session_materials
  id, session_id, user_id,
  kind ('part2_pictures' | 'part3_diagram' | 'examiner_script' | 'notes'),
  image_path (storage, nullable),
  ai_description   -- lo que devolvió la IA
  description      -- la versión editada por el examinador (la que se usa)
  created_at, updated_at
  RLS: solo el dueño. GRANT authenticated + service_role.

public.session_attempts
  id, session_id, user_id, audio_path, transcript, speaker_map,
  candidate_ids jsonb, candidate_names jsonb,
  duration_seconds, status, recorded_at, created_at, updated_at
  RLS: solo el dueño. GRANT authenticated + service_role.

exams (columnas nuevas, nullable)
  session_id  → speaking_sessions.id
  attempt_id  → session_attempts.id
```

`group` e `institution` de cada `exams` se siguen resolviendo por candidato (a partir de su fila en `students` → `groups`), no por sesión.

Las fotos van al bucket privado `exam-context` bajo `${user.id}/sessions/${session_id}/…`, con policies de `storage.objects` por prefijo de usuario.

### Interpretación de las fotos

- Nueva edge function `describe-material`: recibe la imagen (signed URL o base64) y el `kind`, y devuelve una descripción pensada para examinadores (para Parte 2: qué muestra cada foto y en qué se diferencian; para Parte 3: el tema central y las opciones del diagrama).
- Modelo: `google/gemini-3.6-flash` vía Lovable AI Gateway.
- La respuesta se guarda en `ai_description`; el textarea editable escribe en `description`.
- `analyze-exam` recibe esas descripciones dentro de `examContext` con `kind: "candidate_prompt"` / `"examiner_script"`. La firma del function no cambia.

### Frontend

- `src/pages/SpeakingSession.tsx` (nuevo): lista de sesiones + vista de sesión.
- `src/components/SessionMaterialPanel.tsx` (nuevo): captura (`<input type="file" accept="image/*" capture="environment">`), llamada a `describe-material`, textarea editable.
- `src/hooks/useSpeakingSession.ts` (nuevo): CRUD de sesión, material e intentos.
- `useBatchQueue.ts`: se adapta para que cada ítem sea un `session_attempt` con `sessionId`, y para que el envío a la cola **no** dispare transcripción.
- `DraftReport.tsx`: guarda `session_id` y `attempt_id`; resuelve grupo/institución por candidato.
- `App.tsx` / `AppSidebar.tsx`: una sola entrada; `/new-exam` y `/batch` redirigen a `/session`.
- IndexedDB sigue siendo el respaldo local del audio hasta que el intento se sube.

### Fuera de alcance en esta fase

Academic Year / Enrollments · cambiar el motor de scoring · calibración · banco de preguntas · KET/CAE/CPE.

---

## Criterios de aceptación

- [ ] Un solo ítem "Speaking Session" en el menú; New Exam y Batch redirigen ahí.
- [ ] Se saca foto del material con el celular, la IA la describe y la descripción se puede editar y guardar.
- [ ] Los candidatos se eligen del roster y pueden ser de grupos distintos; cada informe queda con el grupo correcto.
- [ ] Grabar → mandar a la cola no dispara ningún procesamiento.
- [ ] Se pueden encolar varios orales seguidos sin esperas.
- [ ] Cada ítem de la cola se procesa a pedido: transcribir → confirmar speakers → analizar.
- [ ] Al confirmar y firmar, el informe queda congelado y guarda `session_id`, `attempt_id`, `candidate_id` y el audio.
- [ ] La sesión se puede cerrar y reabrir otro día, con el material intacto.
- [ ] Los informes archivados anteriores siguen siendo legibles.
- [ ] Typecheck y build en verde, más una prueba de punta a punta con un audio corto.

---

## Riesgos

- **Foto ilegible o mal interpretada** → por eso la descripción es editable; además queda a la vista la versión original de la IA.
- **Cambio de navegación** → New Exam y Batch se redirigen, no se borran.
- **Consumo de IA** → describir una foto es una llamada barata y ocurre una vez por sesión; el análisis sigue siendo manual y los informes confirmados no se pueden re-analizar.

---

## Después

**Fase 3**: contrato de datos canónico (Zod) entre IA, base de datos y PDF, para eliminar los `(object)(object)` y las inconsistencias de formato entre candidatos.
