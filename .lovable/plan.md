# OralAssess — Del estado actual al producto del documento

Objetivo inmediato: que la validación de la semana que viene funcione sin sorpresas. Objetivo de fondo: alinear la app con las decisiones consolidadas del documento (candidato como centro, sesión única, evaluación confirmada = congelada).

---

## Primero, la respuesta a tus dudas

**"Texto libre"** significa esto: hoy, cuando tomás un oral, el nombre del candidato se guarda como una palabra escrita, no como un vínculo al alumno de tu roster. Si en marzo escribís "Sofía Pérez" y en junio "Sofia Perez", el sistema cree que son dos personas distintas y el historial de progreso se parte en dos. Eso contradice directamente la decisión #4 del documento ("El candidato es el centro del sistema"). Verificado: no existe ninguna referencia a un identificador de candidato en todo el código; el vínculo es solo el nombre escrito.

**Academic Year y Enrollments — mi recomendación: al Backlog.** Razón concreta: implementarlos ahora significa reescribir Grupos, Roster, Reportes y Progreso a la vez, en la misma semana en que vas a validar. El riesgo (romper lo que ya funciona) es alto y el beneficio para validar el MVP es cero: con una sola cohorte, "año académico" no cambia ninguna decisión pedagógica. Lo que sí hago ahora es dejar la puerta abierta: el candidato pasa a ser una entidad propia con identidad estable, y el año académico después se cuelga de ahí sin migrar nada. Esto cumple el criterio de aceptación del documento ("¿es necesaria para validar el MVP?" → No).

---

## Contraste documento vs. realidad (auditado)

| Decisión del documento | Estado real verificado |
|---|---|
| El candidato es la entidad central | ❌ vínculo solo por nombre escrito |
| Sesión única de speaking que produce evaluaciones | ❌ dos flujos paralelos (New Exam / Batch Session) |
| El examinador confirma la asignación de speakers antes de enviar a IA | 🟡 existe en New Exam, **ausente** en Batch Session |
| Evaluación confirmada = congelada | ❌ "Confirm & sign" es solo una marca visual; la evaluación sigue editable |
| El audio es la evidencia primaria | ❌ la subida del audio falla: se guarda sin la carpeta del usuario, y la regla de seguridad del storage la rechaza → "Audio no longer available" |
| Una evaluación nunca se pierde | 🟡 hay historial de re-análisis, pero sobrescribe en lugar de versionar |
| Feedback accionable por parte del examen | ✅ implementado |
| MVP solo PET y FCE | ✅ activo |
| Examinador Calibrador | ✅ rol senior operativo |
| Academic Year / Enrollments | ❌ no existen (→ Backlog, ver arriba) |

---

## Fase 0 — Antes de la validación (esta semana, prioridad absoluta)

Estas cuatro cosas son las que van a arruinar la prueba si no se arreglan.

1. **Arreglar la subida de audio.** El archivo se guarda dentro de tu carpeta de usuario. Esto sana el "Audio no longer available" y hace que la evidencia primaria realmente exista. Además: subir el audio *antes* de crear la evaluación, y para todos los candidatos de la sesión, no solo el primero.
2. **Congelar la evaluación confirmada.** Al confirmar, la evaluación queda de solo lectura: puntajes, comentarios y feedback dejan de ser editables y la IA no puede recalcularla. Para corregir después, un botón explícito **"Abrir revisión"** crea una nueva versión con motivo obligatorio; la versión anterior queda archivada y visible. Cumple decisiones #1, #2 y #3 del documento sin perder trazabilidad.
3. **Revisión de speakers en Batch Session.** Hoy Batch manda a la IA la transcripción cruda: si el sistema confundió a dos candidatos, los puntajes salen contaminados sin que lo veas. Se agrega el mismo paso de confirmación de speakers que ya tiene New Exam. Es el punto 1.9/1.10 del ciclo del documento.
4. **Corregir el falso "Analysis interrupted".** El temporizador mide la antigüedad de la grabación, no el tiempo de procesamiento: en una sesión larga marca error aunque el análisis vaya bien. Pasa a medir el tiempo real de procesamiento.

Después de esta fase pruebo el circuito completo en el navegador de punta a punta antes de que lo toques.

---

## Fase 1 — El candidato como centro (arranque limpio)

Como no necesitás los reportes actuales, aprovechamos para hacerlo bien de una vez.

- Cada evaluación se vincula al **candidato real** del roster (identidad estable, no el nombre escrito). Al crear una sesión, los candidatos se eligen del roster; si no existen, se crean ahí mismo.
- Los reportes actuales quedan archivados y ocultos del historial (no se borran, por si querés mirarlos).
- **Ficha del candidato**: una pantalla por alumno con sus evaluaciones, evolución por criterio y por parte del examen, fortalezas persistentes y áreas recurrentes. Esto es lo que responde la pregunta de éxito del documento: *"¿cuál es el estado de preparación de este candidato y qué hacer?"*
- Progreso deja de agrupar por nombre escrito y pasa a agrupar por candidato.
- El progreso solo se muestra con 2 o más evaluaciones (decisión del documento: nunca estimar progreso con una sola).

---

## Fase 2 — Speaking Session única

Un solo flujo, como pediste:

```text
Crear sesión → material (una vez) → elegir candidatos del roster
  → armar parejas/tríos → grabar cada pareja
  → transcribir → confirmar speakers → análisis IA
  → revisión docente → confirmar → informes → historial del candidato
```

New Exam desaparece como flujo separado: tomar un oral suelto es simplemente una sesión con una sola pareja. El material del examen se carga una vez por sesión y se comparte (principio de "una sola copia" del documento). La sesión es temporal; lo que queda para siempre es la evaluación confirmada y su audio.

---

## Fase 3 — Consolidación del contrato de datos

Causa raíz de los `(object)(object)` y de los PDF inconsistentes: no existe una forma única y validada del resultado de evaluación entre IA, base de datos y PDF.

- Definir una forma canónica única y validarla al recibir la respuesta de la IA, normalizando lo que venga mal antes de guardar.
- Los PDF leen solo de esa forma canónica → nunca más objetos crudos ni layouts distintos entre candidatos de la misma sesión.

---

## Backlog explícito (no MVP)

Academic Year · Enrollments · cambio de grupo/nivel · rol Coordinador académico · vistas institucionales agregadas · comparativas entre cohortes · KET/CAE/CPE · app móvil · integraciones LMS.

---

## Sugerencias de producto (más allá del documento)

1. **Semáforo de preparación**: en la ficha del candidato, un indicador de "listo / cerca / necesita trabajo" para el examen oficial, derivado de las últimas evaluaciones confirmadas. Es la traducción directa de la definición de éxito, y es lo que un padre o un coordinador entiende de un vistazo.
2. **Comparativa contra el grupo**: mostrar el desempeño del candidato junto al promedio de su grupo por criterio. Ayuda al docente a decidir si el problema es individual o de clase.
3. **Costos**: el análisis se cobra por uso. Bloquear el re-análisis accidental de una evaluación ya confirmada (Fase 0.2) es también el mayor ahorro disponible hoy.
4. **Ensayo previo a la validación**: antes de la prueba real, hacer una sesión de práctica completa con dos candidatos ficticios y un audio corto, para verificar el circuito entero de punta a punta.

---

## Detalles técnicos

- **Fase 0**: prefijo `${user.id}/` en `audio_path` (DraftReport), reordenar upload antes del insert y aplicarlo a cada candidato; columnas nuevas en `exams` (`confirmed_at`, `revision`, `supersedes_id`, `revision_reason`) + policy de UPDATE que rechaza cambios sobre filas confirmadas; portar `SpeakerMappingPanel` + `applySpeakerMap` al flujo de Batch; el watchdog pasa a usar un `analysisStartedAt` propio en lugar de `recordedAt`.
- **Fase 1**: `exams.candidate_id` → `students.id`; archivado de filas actuales vía flag; nueva ruta `/candidates/:id`; `Progress` agrupa por `candidate_id`.
- **Fase 2**: nuevas tablas `speaking_sessions` y `session_attempts` (audio/transcript/material compartidos, N evaluaciones individuales); `NewExam` y `BatchSession` convergen en una sola página; IndexedDB sigue siendo el respaldo local del audio.
- **Fase 3**: esquema Zod para la respuesta de `analyze-exam`, normalización en el borde, PDFs consumiendo solo el tipo validado.
- Sin tocar: `client.ts`, `types.ts`, `.env`, `config.toml`, Question Bank, pesos de scoring.
