# Cierre de esta tanda de orales: obtener los informes correctos antes de pulir a fondo

Objetivo de esta etapa: que puedas **exportar los informes definitivos (docente y alumno) de esta ronda sin re-analizar nada**, y recién después borrar los datos y encarar el rediseño profundo del flujo. Todo lo que sigue es presentación y navegación: no toca scoring, ni el prompt de la IA, ni la estructura de la base.

## 1. Respuestas a tus dudas (verificado en el código)

- **Los porcentajes al lado de cada área NO son la nota.** Es el campo `confidence` que devuelve la IA: qué tan segura está de ese juicio. Por eso un 2,5 puede mostrar 75 % y dos notas iguales muestran porcentajes distintos. Es información interna que no debería estar visible en un informe: se quita (o se muestra sólo en modo avanzado).
- **Los porcentajes en la revisión de speakers** son el reparto del tiempo de habla de cada voz detectada por la transcripción. No cambian al reasignar roles porque miden minutos de audio por voz, no roles. Se van a re-etiquetar como "tiempo de habla" y a recalcularse por rol una vez asignados.
- **Karaoke del audio (palabra en curso resaltada):** barato y sin IA. Los tiempos por palabra ya están guardados (`live_words` / `words_json`); es sincronizar con el evento de avance del reproductor. Es la mejora de mayor impacto por menor costo de toda la lista.
- **Velocidad de reproducción (0,75× / 1× / 1,25× / 1,5×):** trivial, una propiedad nativa del reproductor. Costo cero.
- **"Corrected version" y "Correct attribution" en Reports:** te generan confusión con razón. No abren una versión corregida: **crean una nueva**, y permiten editar el script completo de un informe ya firmado. Son herramientas de mantenimiento y no deben estar en el recorrido normal.
- **"Download audio" que sólo reproduce:** hoy abre el enlace firmado en una pestaña; el navegador reproduce en vez de descargar. Se corrige forzando la descarga.

## 2. Estrategia recomendada

**No repares los datos: repará la presentación y exportá.** Los informes firmados ya tienen la información correcta (notas, feedback por parte, evidencias). Lo que está mal es cómo se muestra y cómo se imprime. Entonces:

1. **Fix pack de cierre** (una tanda, sin migraciones, sin re-análisis): arreglar PDFs, sujeto/nombre, script navegable, audio, y sacar del camino los botones peligrosos.
2. **Vos exportás** los PDFs docente y alumno de esta ronda y los entregás.
3. **Recién después** se borra todo y se arranca con la Fase 0 y la arquitectura de workspaces del informe anterior.

Ventaja: cero riesgo de perder o alterar información, porque no se vuelve a llamar a la IA ni se escriben datos en los informes firmados.

## 3. Fix pack de cierre — contenido exacto

**PDF del alumno (prioridad máxima, es lo que entregás)**
- Encabezado: quitar "Your", quitar el nombre repetido, y que el recuadro de nivel no muestre el texto duplicado ni quede apretado.
- Nombres de criterios completos, sin abreviar.
- Texto de cada parte: dirigido al alumno de forma coherente y **sin cortes con puntos suspensivos**.
- "What you did well" / "What to practise next": una sola columna a lo ancho, texto completo.
- Links en una línea: "Objetivo — nombre del sitio: enlace".
- Reutilizar los ejemplos y citas concretas del informe docente, reescritos en lenguaje amigable de segunda persona (los datos ya existen, no hace falta IA).

**PDF docente**
- Corregir el texto superpuesto del encabezado (nombre + nivel).
- Tabla de notas compacta, con el mismo estilo que te gustó del PDF del alumno, y sin la columna de confianza.
- "Suggested focus" contenido dentro del recuadro.

**Versión para imprimir**
- Misma corrección de encabezado y tabla: hoy imprime con el nombre repetido y texto superpuesto.

**Coherencia de sujeto y nombre**
- Capa de normalización al generar cada informe: el PDF docente siempre en tercera persona con el nombre real; el del alumno siempre en segunda persona. Se aplica al render, así los informes ya firmados quedan bien sin tocar la base.

**Report en pantalla**
- Quitar los porcentajes de confianza.
- Script **navegable y no editable**, junto al audio, desplegable: scroll completo, buscador, timestamps clicables, palabra en curso resaltada y control de velocidad.
- "Correct attribution" y "Corrected version" pasan a modo avanzado (no desaparecen, dejan de estar en el camino del docente).
- "Download audio" descarga de verdad.
- Ampliar un poco el margen de las citas con audio para que la frase entre completa.

**Cola de trabajo (mínimo necesario para no confundirte al cerrar esta ronda)**
- Un attempt cuyos informes ya están firmados se marca **"Completed"** y deja de ofrecer "Review & sign" y "Redo from speaker review". Sin esto no se puede distinguir lo hecho de lo pendiente.
- La revisión de speakers gana un botón **"Volver sin analizar"**, para poder mirar la atribución y salir sin re-analizar.
- El "Speaker unclear" en todo el script que viste en algunos casos ocurre cuando la revisión se reabre sin el mapa guardado: se corrige recargando el mapa que ya está en la base antes de mostrar el panel.

## 4. Lo que NO se toca en esta tanda

- Lógica de evaluación, notas, prompt de la IA.
- Workspaces, roles, billing (van después, según el informe anterior).
- Rediseño completo de la cola como bandeja de trabajo con un botón por estado (queda para la Fase 2).
- El "flag / solicitud de revisión" del script por parte del docente: buena idea, pero pertenece al modelo multiusuario. Se diseña cuando existan los roles.

## 5. Riesgos

- Bajo en general: son cambios de presentación y de visibilidad de botones.
- Riesgo real único: al marcar attempts como "Completed" hay que estar seguro de que la coincidencia informe↔attempt es correcta, para no ocultar un oral que en realidad quedó a medias. Se resuelve verificando por attempt y candidato antes de ocultar, y dejando siempre visible el attempt si falta algún informe.
- Los PDFs hay que revisarlos visualmente uno por uno antes de que los entregues; con un caso real de cada tipo (pareja, trío, informe sin feedback por parte) alcanza.

## 6. Necesito que me confirmes tres cosas

1. **¿Cuántos informes de esta ronda tenés que entregar y son todos del mismo nivel?** Hoy veo 29 informes firmados (7 archivados) — decime si el entregable es todo eso o sólo la última tanda.
2. **La tabla de notas del PDF docente:** ¿la querés igual a la del PDF del alumno (compacta, nombres completos), o preferís mantener algo más técnico en el docente?
3. **Las frases naranjas ("Suggested focus"):** ¿las conservamos sólo cuando proponen una acción concreta y las eliminamos cuando son genéricas, o las saco del PDF del alumno por completo y quedan sólo en el docente?

Con eso arranco por el PDF del alumno y el PDF docente, que es lo que necesitás para cerrar la ronda.
