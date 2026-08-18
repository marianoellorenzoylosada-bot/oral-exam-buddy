# Corregir turnos del script y pulir el informe del alumno

Cuatro correcciones acotadas: poder dividir un turno que mezcla varias voces, arreglar el recuadro superior derecho del PDF del alumno, evitar que el texto de cada parte salga cortado cuando sobra espacio, y redactar el informe del alumno dirigido a él o ella.

## 1. Dividir turnos en el punto exacto

En el panel de revisión de speakers (Speaker review), cada línea del script pasa a ser divisible:

- Al activar "Dividir", las palabras del turno se vuelven clicables. Al tocar la palabra donde empieza la otra voz, el turno se parte en dos líneas, cada una con su timestamp real y su propio selector de rol.
- Un turno dividido puede volver a unirse con el turno anterior ("Unir").
- Se pueden hacer varias divisiones en el mismo turno.
- No se agrega, quita ni reescribe ninguna palabra: solo se corta donde corresponde, así las citas con audio y los timestamps siguen siendo exactos.

Esto queda disponible tanto antes del análisis (cola de la sesión) como en un informe ya analizado.

## 2. Corregir un informe ya analizado

En el informe (Report) se agrega un bloque "Corregir atribución del script": abre el mismo panel de revisión con el audio arriba. Al confirmar:

- Se guarda el script corregido y la nueva asignación de voces.
- Se re-analiza ese informe con el script corregido: se recalculan marcas, comentarios por parte y evidencias.
- El informe vuelve a estado borrador para que lo revises y lo firmes de nuevo. El script y el análisis anteriores no se pierden: quedan registrados hasta que apruebes el nuevo.

## 3. PDF del alumno: encabezado

El recuadro blanco de la derecha hoy tiene ancho fijo y recorta frases como "Performing at B1 level". Pasa a ser un recuadro que se ajusta al texto: la frase se reparte en dos o tres líneas dentro del cuadro, con tamaño de letra adaptado, y el puntaje queda debajo. Nunca se recorta ni se pisa con el título.

## 4. PDF del alumno: texto de cada parte sin cortes

Hoy el texto de cada parte se recorta a un número fijo de líneas y termina en "…" aunque quede espacio libre en la página. El ajuste pasa a ser al revés: primero se intenta el texto completo y solo se recorta si realmente no entra, empezando por lo menos prioritario (links de práctica → listas → comentarios). Se sigue garantizando una sola página A4.

## 5. Informe del alumno dirigido a "you"

El texto se adapta a la segunda persona de forma real, no con un reemplazo mecánico de palabras: se reescribe el sujeto y se concuerda el verbo y los posesivos ("the candidate uses a good range" → "you use a good range"; "her pronunciation is clear" → "your pronunciation is clear"), incluidos casos con "she/he", "the student", "the candidate's". Se aplica al generar el PDF, así los informes ya existentes también quedan dirigidos al alumno. Los títulos ya están en segunda persona y se revisan para que sean consistentes. El informe docente no cambia: sigue en tercera persona.

## Detalles técnicos

- `src/lib/applySpeakerMap.ts`: `buildUtterances` acepta un set de puntos de corte por índice de palabra; nuevos helpers `splitAt` / `mergeWithPrevious` y estabilización de índices (clave compuesta por índice de palabra inicial, para que los overrides por línea no se descoloquen al dividir).
- `src/components/SpeakerReviewPanel.tsx`: modo dividir por palabra, botón unir, estado `splitPoints` incluido en `onConfirm` junto al mapa y el transcript.
- Persistencia: se guardan los puntos de corte junto al `speaker_map` (columna nueva `split_points` en el attempt de la sesión y en el informe) para que la revisión se pueda reabrir tal como quedó. Migración aditiva, con GRANTs y sin tocar políticas existentes.
- `src/components/ReportDetail.tsx`: bloque de corrección de atribución que reutiliza `SpeakerReviewWithAudio` y encadena el re-análisis existente (`analyze-exam`) sin duplicar lógica de scoring.
- `src/lib/generateStudentPdf.ts`: chip del encabezado con medición de texto y alto dinámico; pasada de ajuste desde la configuración más generosa hacia la más apretada; nuevo `src/lib/secondPerson.ts` con la reescritura a segunda persona (sujeto, verbo y posesivos) aplicada a comentarios, próximos pasos, fortalezas y áreas a mejorar.
- No se modifica la lógica de scoring ni el prompt de evaluación.
