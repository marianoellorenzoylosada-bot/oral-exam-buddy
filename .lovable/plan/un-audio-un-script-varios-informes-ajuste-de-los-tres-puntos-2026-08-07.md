# Un audio, un script, varios informes — ajuste de los tres puntos amarillos

Tu aclaración es correcta y **sí afecta a uno de los tres puntos**. El modelo actual ya asume audio y script compartidos: un `session_attempt` (una grabación) genera dos o tres filas en `exams`, una por candidato, todas apuntando al mismo `audio_path` y al mismo transcript/material. Eso no cambia. Lo que cambia es cómo se resuelven los datos *por candidato* dentro de ese informe compartido.

## Punto 1 — Institución/grupo en el PDF antes de firmar (afectado por tu aclaración)

Al firmar, cada informe ya toma la institución y el grupo del candidato concreto (resueltos desde el roster). Pero el botón "Descargar PDF" que se usa **antes** de firmar arma el documento con una única institución/grupo para todos los candidatos, así que en una pareja de grupos distintos el segundo alumno sale con los datos del primero.

Corrección: el PDF previo usará la misma resolución por candidato que ya usa la firma, de modo que cada uno de los dos o tres informes que se desprenden del mismo audio muestre su propio grupo, institución y docente.

## Punto 2 — `(object) (object)` en Strengths / Areas for improvement

Cuando la IA devuelve un objeto en lugar de texto en esas listas, el PDF imprime `(object)`. Se agrega una normalización a texto en el punto de guardado y en el generador de PDF, para los dos o tres candidatos por igual.

## Punto 3 — 4 informes archivados antiguos

Tienen un `audio_path` que no cumple el prefijo `${user_id}/` que ahora exige la base, así que no se pueden actualizar (sí borrar). Como son archivados y no los necesitás, se les limpia el `audio_path` (el archivo de audio ya expiró) para que dejen de estar bloqueados. No se toca ningún otro dato.

## Lo que NO cambia

- Un audio y un script por grabación, compartidos por los dos o tres candidatos.
- La revisión de adjudicación de speakers sigue siendo previa al análisis y única por grabación.
- Los informes ya confirmados siguen congelados.

## Detalle técnico

- `src/components/DraftReport.tsx`: la ruta de "Descargar PDF" pasa a usar `candidateMeta[candidateId]` (con fallback al valor de sesión), igual que `handleConfirm`.
- Normalización `toText(value)` aplicada a `strengths` y `areas_for_improvement` en `DraftReport.tsx` y en `src/lib/generateReportPdf.ts` / `generateStudentPdf.ts`.
- Migración puntual: `UPDATE public.exams SET audio_path = NULL WHERE archived = true AND audio_path NOT LIKE user_id || '/%'`.
- Sin cambios de esquema, de rutas ni del motor de scoring.

## Criterios de aceptación

- [ ] Una pareja de grupos distintos produce dos PDFs (previo y firmado) con grupo/institución correctos en cada uno.
- [ ] Ningún informe muestra `(object)` en Strengths ni en Areas for improvement.
- [ ] Los 4 archivados dejan de estar bloqueados y siguen legibles.
- [ ] Typecheck y build en verde.
