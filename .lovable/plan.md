## Diagnóstico

El orden del PDF mejoró porque el extractor ya agrega marcadores de página y reconstruye párrafos, pero la cursiva no aparece porque la detección actual mira sólo `item.fontName` de PDF.js. En muchos PDFs ese valor es un alias interno como `g_d0_f1`, no el nombre real de la fuente, por eso `italic/oblique` nunca coincide y el sistema no envuelve esas citas entre comillas.

## Objetivo

Hacer que los comentarios subidos a Cambridge Core Library sean más fiables para calibración, marcando mejor las citas del candidato cuando el PDF trae texto en cursiva.

## Plan mínimo y seguro

1. **Mejorar extracción de cursiva en PDF**
   - Modificar sólo `src/lib/extractText.ts`.
   - Pasar también `content.styles` desde PDF.js a `renderPage`.
   - Detectar cursiva usando:
     - `item.fontName`,
     - `content.styles[item.fontName].fontFamily`,
     - posibles variantes `Italic`, `Oblique`, `It`, `I`, `BoldItalic`, etc.
   - Mantener el comportamiento actual de páginas, párrafos y limpieza de espacios.

2. **Añadir fallback visible cuando el PDF no expone cursiva**
   - Si el PDF no trae metadatos de fuente suficientes, no inventar citas.
   - Mantener el texto ordenado, pero no marcar falsamente contenido como cita.
   - Opcionalmente dejar una marca interna simple para poder avisar en consola durante desarrollo, sin cambiar la UI ni tocar la base de datos.

3. **Proteger comillas existentes**
   - Si el PDF ya trae comillas, conservarlas.
   - No duplicar comillas cuando una frase ya empieza o termina con comillas.
   - Mantener el balanceado de comillas actual.

4. **No tocar nada fuera de lo necesario**
   - No cambiar scoring.
   - No cambiar reports/PDF.
   - No cambiar auth, RLS, storage ni calibration.
   - No cambiar la estructura de Cambridge Library salvo que luego quieras una advertencia visual.

## Validación recomendada

1. Subir el mismo PDF en Settings > Cambridge Core Library.
2. Revisar el campo `Content` después de la extracción.
3. Confirmar que las frases originalmente en cursiva aparecen entre comillas.
4. Confirmar que los separadores `--- Page N ---` siguen apareciendo.
5. Confirmar que las referencias tipo `(2.39 Part 2)` quedan pegadas a la cita correcta.

## Nota importante

Algunos PDFs no conservan información semántica de cursiva: visualmente se ve cursiva, pero el texto extraído no expone esa fuente al navegador. Esta mejora cubrirá los PDFs donde la fuente sí está identificada en los estilos de PDF.js; si tu PDF específico aún no lo refleja, el siguiente paso sería soportar importación DOCX enriquecida o un editor/manual marker para marcar citas con precisión.