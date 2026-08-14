# Auditar → Validar → Comunicar: auditoría, distancia y plan

## 1. Dónde estamos hoy (verificado en el código)

**Speaker Mapping** — Ya cumple todo lo pedido: script completo con scroll, colores por speaker, reasignación por línea, aprobación, y reproductor con seek por timestamp (`SpeakerReviewPanel` + `SpeakerReviewWithAudio` + `AttemptAudioPlayer`). No hay que tocarlo.

**Draft (`DraftReport.tsx`, 894 líneas)** — Ya tiene el script completo (`SpeakerTranscript` con words) y firma por candidato. Falta / sobra:
- No hay reproductor de audio dentro del Draft (el player existe pero solo se usa en la cola/mapping).
- El script está al final, no arriba; el audio no está accesible arriba.
- Tiene `Teacher PDF`, `Student PDF` y `Download all` → se quitan.
- Al firmar no vuelve a la cola (navega a `/`).

**Reports (`ReportDetail.tsx`, 1022 líneas)** — Hoy la pantalla y el PDF docente son dos construcciones distintas: la pantalla muestra criterios + partes + strengths + transcript; el PDF (`generateReportPdf.ts`) arma su propio orden. De ahí la inconsistencia "Report ≠ PDF docente". Ya existen: script completo, PDF docente, PDF alumno, compartir por WhatsApp/email, citas clicables (`QuotedAudio`).

**Script en fragmentos** — Confirmado: `QuotedAudio` reproduce citas y hay transcript completo en Draft y Report; no hay fragmentos "arbitrarios" salvo las citas de evidencia, que sí queremos conservar.

**Timestamps / citas** — El prompt ya obliga a citar verbatim en strengths/areas, pero no exige contexto (3–4 palabras antes/después) ni limita las citas a evidencia concreta.

**PDF alumno (`generateStudentPdf.ts`, 341 líneas)** — Hoy es varias páginas: tabla de criterios grande, partes con desglose completo por criterio, strengths, areas, links. Está lejos de "una A4".

**Recursos de práctica (`practiceData.ts`)** — Lista fija de 30 links (British Council/BBC) elegidos por el criterio más bajo. Ya es "según debilidad" pero muy grueso (5 skills × 6 niveles).

## 2. Distancia, complejidad, riesgo y costo

| Punto | Distancia | Complejidad | Riesgo de regresión | Costo mantenimiento |
|---|---|---|---|---|
| Mapping intacto | Ya está | — | Ninguno | — |
| Draft = auditoría (audio arriba, script arriba, sin PDFs) | Cerca | Baja | Bajo (solo presentación) | Bajo |
| Volver a la cola al aprobar | Cerca | Muy baja | Bajo | Nulo |
| Report = misma fuente que PDF docente | Media | Media | Medio (hay que respetar informes ya firmados) | Baja tras unificar |
| Script completo desplegable al final del Report | Cerca | Baja | Bajo | Nulo |
| Citas con contexto + timestamp | Media | Baja-media (prompt) | Bajo, no toca scoring | Bajo |
| PDF alumno en 1 A4 | Media | Media | Bajo (archivo aislado) | Bajo |
| PDF docente híbrido por parte | Media | Media | Medio | Bajo |
| Recursos según debilidad | Cerca | Baja | Bajo | Medio (curar links) |
| Lenguaje enriquecido (IA) | Lejos | Alta | Medio-alto | Medio | → **fuera de alcance ahora** |

Principio que se respeta: **no se toca el scoring ni la lógica de evaluación**. Todo el trabajo es presentación, flujo y contenido del prompt en campos nuevos/existentes de texto.

## 3. Plan de cambios

### Fase A — Draft como herramienta de auditoría
1. Reproductor de audio fijo en la parte superior del Draft (reutilizar `AttemptAudioPlayer`), con seek desde cualquier cita y desde el script.
2. Mover el script completo arriba, plegable, con scroll y colores de speaker (mismo componente que el mapping, en modo lectura).
3. Quitar `Teacher PDF`, `Student PDF` y `Download all` del Draft. Descargas solo en Reports.
4. Mantener "regenerar análisis" en el Draft, visible solo para el examinador (rol `senior`/dueño del intento) mediante `RoleGate`.
5. Al confirmar y firmar: volver siempre a la cola de la sesión (`/speaking-session` con la sesión activa), con toast "Informe firmado — siguiente candidato".

### Fase B — Una sola fuente de verdad para el informe docente
6. Crear `src/lib/teacherReportModel.ts`: una función que, dado el examen, devuelva el modelo del informe docente (encabezado, tabla compacta de marks, secciones Part 1..N con solo los criterios relevantes y su evidencia, patrones/observaciones, notas del examinador, script completo).
7. `ReportDetail.tsx` y `generateReportPdf.ts` consumen ese mismo modelo → pantalla y PDF idénticos en contenido y orden.
8. Estructura híbrida: se elimina la sección repetida "por criterio"; los criterios aparecen dentro de cada parte, y solo los que aportan información (se omite el criterio sin comentario en esa parte). La tabla de marks queda compacta arriba.
9. Script completo al final del informe en pantalla, en bloque desplegable; en el PDF docente va completo al final.
10. Informes ya firmados sin `part_feedback`: se sigue mostrando el fallback actual y el botón de reparación existente; no se rompen.

### Fase C — Informe alumno en una A4
11. Reescribir `generateStudentPdf.ts` con presupuesto de espacio de una página:
    - franja de encabezado con nombre, nivel, fecha y banda;
    - tabla de marks en una fila compacta (criterio → banda);
    - Part 1..N: 1–2 líneas de feedback concreto + cita con timestamp cuando haya evidencia + corrección/alternativa;
    - Strengths y Areas for Improvement en dos columnas, 3 ítems máximo cada una;
    - 2–3 links de práctica accionables;
    - sin script, sin desglose criterio por criterio dentro de cada parte;
    - si el contenido excede la página, se recorta por prioridad (partes > strengths/areas > links) en lugar de pasar a página 2.

### Fase D — Citas con contexto (sin tocar scoring)
12. En `analyze-exam`: exigir que cada evidencia concreta (error gramatical, preposición, collocation, elección léxica, tiempos verbales, pronunciación, buena producción) se cite con 3–4 palabras de contexto antes y después, y que las observaciones generales **no** lleven cita. Sin cambios en bandas ni puntajes.
13. `QuotedAudio` ya localiza la cita en `words_json` para el seek; se ajusta el matching para citas más largas (coincidencia por primeras palabras).

### Fase E — Recursos según debilidad
14. Ampliar `practiceData.ts` con etiquetas más finas (grammar/tenses, collocations, discourse markers, fluency, pronunciation, interaction) y elegir 2–3 links según las áreas de mejora detectadas, no solo el criterio más bajo. Se añaden fuentes Cambridge además de BC/BBC.

### Queda fuera de este plan
- Lenguaje enriquecido como capacidad de IA (se evalúa después, con su costo por análisis).
- Toggle "Confirm & continue / Confirm & open report" (se aprueba volver siempre a la cola).
- Cualquier cambio en scoring, rúbricas, anchors de calibración o mapping.

## 4. Detalles técnicos
- Nuevo `src/lib/teacherReportModel.ts` como contrato compartido pantalla/PDF; `ReportDetail` y `generateReportPdf` pasan a renderizar el mismo array de secciones.
- `DraftReport.tsx`: quitar `generateReportPdf`/`generateStudentPdf` y sus botones; insertar `AttemptAudioPlayer` con `audioPath`/blob; reubicar `SpeakerTranscript` arriba dentro de un `Collapsible`; `navigate` al cerrar la firma apunta a la sesión del intento.
- `generateStudentPdf.ts`: reescritura con medición previa (`splitTextToSize` + presupuesto de mm por bloque) y recorte por prioridad; sin `addPage`.
- `analyze-exam/index.ts`: solo cambian las instrucciones de citación; el esquema JSON de salida no cambia (`partFeedback`, `criteriaBreakdown`, `strengths`, `areasForImprovement`).
- Sin migraciones de base de datos. Sin cambios en `session_attempts`, `exams`, RLS ni storage.
- Verificación: recorrido completo mapping → draft → firma → cola → Report → PDF docente → PDF alumno con un intento existente, comparando pantalla vs PDF y contando páginas del informe alumno.
