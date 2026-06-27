## Respuesta corta

No hay un inconveniente importante en subir un documento de Word a la biblioteca. De hecho, para tu caso puede ser mejor que PDF, porque Word conserva la estructura de formato —incluida la cursiva— de forma mucho más explícita.

El inconveniente actual no es Word en sí, sino que la aplicación hoy extrae DOCX con `mammoth.extractRawText`, que convierte todo a texto plano y descarta la cursiva. Por eso, si subís Word ahora, probablemente el contenido quedará más ordenado que el PDF, pero la cursiva seguirá sin transformarse automáticamente en comillas/citas.

## Diagnóstico

- El PDF no está exponiendo la cursiva de una forma que PDF.js pueda leer de manera fiable.
- Al convertirlo a Word, la cursiva sí queda preservada dentro del DOCX.
- DOCX es un formato más adecuado para detectar cursiva porque el estilo está marcado en XML como formato de texto, no como una reconstrucción visual de página.
- La aplicación ya acepta Word, pero lo trata como texto plano, así que todavía no aprovecha esa información.

## Inconvenientes de usar Word

1. **No debería afectar la calibración negativamente** si el texto está bien extraído.
2. **Puede perder paginación exacta del PDF**, porque Word no siempre mantiene páginas equivalentes. Para la biblioteca esto no es grave; lo importante es que comentario, candidato, cita y parte del examen queden claros.
3. **Puede traer encabezados/pies o saltos raros** si la conversión PDF → Word fue automática. Eso se puede corregir en el campo `Content` antes de guardar.
4. **Hoy todavía no marca cursiva automáticamente**, hasta que ajustemos el extractor DOCX.

## Plan mínimo recomendado

### 1. Mejorar sólo extracción DOCX
Modificar únicamente `src/lib/extractText.ts`, en la función `extractDocxText`.

Cambiar de:

```ts
mammoth.extractRawText(...)
```

a una extracción HTML con Mammoth, para poder detectar formato:

```ts
mammoth.convertToHtml(...)
```

Luego convertir ese HTML a texto enriquecido simple.

### 2. Convertir cursiva a comillas
Cuando el DOCX tenga texto en cursiva:

```text
In the first picture ...
```

se guardaría en `Content` como:

```text
"In the first picture ..."
```

Esto mantiene el contenido compatible con el campo actual, sin crear editor enriquecido ni cambiar base de datos.

### 3. Mantener estructura clara
Durante la conversión DOCX → texto:

- conservar párrafos,
- conservar listas como líneas separadas,
- evitar texto todo corrido,
- normalizar espacios múltiples,
- preservar comillas existentes,
- no duplicar comillas si el texto ya estaba entre comillas.

### 4. No tocar nada fuera de esto
No cambiar:

- scoring,
- reports/PDF,
- auth,
- RLS,
- storage,
- calibration,
- estructura de Cambridge Library.

## Resultado esperado

Después del cambio, el camino más fiable sería:

1. Convertir PDF a Word.
2. Revisar en Word que la cursiva esté correcta.
3. Subir el DOCX a Cambridge Core Library.
4. Ver en el campo `Content` que las citas en cursiva aparezcan entre comillas.
5. Corregir manualmente cualquier candidato o comentario ambiguo antes de guardar.

## Validación

Probar con tu mismo documento Word y confirmar:

- el texto aparece ordenado,
- las frases en cursiva aparecen entre comillas,
- los timestamps como `(2.39 Part 2)` se conservan,
- las citas quedan asociadas al comentario del candidato correcto,
- no se modificó ningún otro flujo de la aplicación.