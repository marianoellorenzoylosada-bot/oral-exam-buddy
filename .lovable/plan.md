# Cierre de la tanda: entregar los 19 informes correctos

Plan de una sola tanda, sin migraciones y sin re-analizar nada: se arregla la presentación (PDF docente, PDF alumno, impresión), se completa lo que falta en dos informes y se deja la cola sin estados ambiguos. Después de exportar, se borra todo y se pasa al rediseño profundo.

## 1. Estado real de tu entregable (verificado en la base)

Hay **39 informes, todos B2**, y 24 nombres distintos. De tu lista de 19:

| Alumno pedido | En la base | Versión a entregar | Estado |
|---|---|---|---|
| Fausto | Cuccia Fausto | 19/08 | completo |
| Sabrina | Carro Sabrina | 19/08 | **falta feedback por parte** |
| Agustín | Batista Agustín | 19/08 | completo |
| Federica | Ponce de León Federica | 19/08 (la última de 5) | completo |
| Juana | Goya Juana | 19/08 (la última de 5) | completo |
| Catalina R | Romero Catalina | 19/08 | **falta feedback por parte** |
| Sofía B | Belén Sofía | 19/08 | completo (nombre invertido, ver punto 4) |
| Micaela | Vives Micaela | 20/08 | completo |
| Renata | Pereira Renata | 20/08 | completo |
| Belén M | Massiolo Belén | 20/08 (la más reciente de 2) | completo |
| Catalina L | Lores Catalina | 20/08 | completo |
| Vicente | Ortiz Vicente | 20/08 | completo |
| Gabriel | Giglio Gabriel | 20/08 | completo |
| Mateo | Zubiaguirre Mateo | 19/08 | completo |
| Nicolás | Rivero Nicolás | 19/08 | completo |
| Ma José | Dalía María José | 20/08 | completo |
| Ma Pía | Sanzone María Pía | 20/08 (la más reciente de 2) | completo |
| **Carolina** | **no existe ningún informe** | — | ver punto 4 |
| **Martina** | **no existe ningún informe** | — | ver punto 4 |

Todos tienen los 5 criterios y el timeline de palabras guardado, así que las citas con audio y el script navegable funcionan para todos.

## 2. Qué se arregla en esta tanda

**PDF del alumno**
- Encabezado: sin "Your", sin el nombre repetido, y el recuadro de nivel sin texto duplicado ni apretado.
- Nombres de criterios completos (sin "Voc.", "Mgmt", "Pron.").
- Texto por parte dirigido al alumno de forma coherente y **sin cortes con puntos suspensivos**.
- "What you did well" / "What to practise next" a una sola columna, texto completo.
- Links en una línea: "Objetivo — sitio: enlace".
- "Suggested focus" se conserva; sólo se recorta si es lo único que impide que entre en una A4.
- Prioridad de ajuste a una página: primero se comprime el interlineado y se reduce mínimamente el cuerpo; recién después se recorta contenido, empezando por los links.

**PDF docente**
- Encabezado sin texto superpuesto (nombre + nivel).
- **Tabla de notas igual a la del alumno**: tira compacta, nombres completos, sin la columna de confianza.
- "Suggested focus" contenido dentro del recuadro.

**Versión para imprimir**
- Misma corrección de encabezado y de tabla (hoy repite el nombre y superpone el texto).

**Coherencia de sujeto y nombre**
- Capa de normalización al generar: PDF docente siempre en tercera persona con el nombre real; PDF del alumno siempre en segunda persona. Se aplica al render, así los 19 informes ya firmados salen bien sin tocar la base.

**Porcentaje de confianza de la IA**
- Sale de los informes (pantalla y PDFs) y **queda sólo en el Draft del examinador**, con la etiqueta "Confianza IA" y una nota que explica que mide cuán segura está la IA de ese juicio, no la nota.

**Informe en pantalla (Reports)**
- Script **navegable y no editable** junto al audio, desplegable: scroll completo, buscador, timestamps clicables, palabra en curso resaltada y control de velocidad (0,75× a 1,5×).
- "Correct attribution" y "Corrected version" salen del recorrido normal y pasan a modo avanzado.
- "Download audio" descarga de verdad en lugar de abrir el reproductor.
- Margen algo mayor en las citas con audio para que la frase entre completa.

**Draft (auditoría)**
- Mismo reproductor con velocidad y resaltado de palabra en curso, y el extracto del script navegable.
- "Candidate B" identificado igual que Examiner y Candidate A.

**Cola (mínimo para cerrar sin confusión)**
- Attempt con todos sus informes firmados → **"Completed"**, sin "Review & sign" ni "Redo from speaker review".
- En la revisión de speakers, botón **"Volver sin analizar"**.
- Corregir el caso en que la revisión se reabre y todo aparece como "Speaker unclear": se recarga el mapa guardado antes de mostrar el panel.

**Dos informes incompletos**
- Sabrina y Catalina R: completar el feedback por parte con la herramienta existente, que sólo rellena lo que está vacío y **no modifica notas ni criterios**.

## 3. Lo que NO se toca ahora

Scoring, prompt de la IA, workspaces, roles, billing, rediseño completo de la cola y el "flag de revisión" del script. Todo eso queda para las fases del informe anterior, después de que exportes y limpiemos los datos.

## 4. Tres cosas que necesito que me confirmes

1. **Carolina y Martina no tienen ningún informe en la base.** ¿Quedaron sin grabar, se grabaron con otro nombre, o su audio quedó en la cola sin firmar? Si el attempt existe todavía, se puede procesar; si no, no hay dato que recuperar.
2. **"Sofía B"**: en la base figura como "Belén Sofía" (19/08), aparentemente la pareja de Catalina Romero. Hay además una "Sofía Belén" de julio, archivada. ¿Confirmás que la que va es la del 19/08 y con qué orden de nombre querés que salga impreso? Los nombres están cargados como "Apellido Nombre" y así se imprimen.
3. **Versiones duplicadas**: en Juana (5), Federica (5), Belén M, Ma Pía, Micaela, Renata, Fausto, Agustín y Sabrina hay más de una versión firmada con puntajes a veces distintos (por ejemplo Ma Pía 3,3 y 3,0; Federica 3,5 → 3,9). Tomo **la más reciente** de cada uno, como pediste. ¿Confirmás ese criterio también cuando la más reciente tiene una nota más baja?

Con tu confirmación arranco por los dos PDFs, que es lo que necesitás para cerrar la ronda.
