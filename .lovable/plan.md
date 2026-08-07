# Foto del material en el celular: por qué no queda registrada

## Qué está pasando (confirmado en el código)

La subida del material tiene **dos pasos**: primero elegís el archivo, y recién al tocar "Upload material" se sube al servidor. El archivo elegido vive solo en memoria de React (`file`, `previewUrl` en `SessionMaterialPanel.tsx`).

En el celular, cuando el sistema abre la cámara o la galería, el navegador suele **descartar y recargar la pestaña** al volver. Con el arreglo anterior la sesión ya no se pierde (está en la URL), pero el archivo elegido **sí se pierde**: al volver, `file` vuelve a ser `null`. De ahí los tres síntomas exactos que describís:

- No aparece la miniatura (`previewUrl` se perdió).
- No aparece descripción (nunca se llamó a la IA).
- "Upload material" queda gris: está deshabilitado con `disabled={uploading || !file}`, y `file` es `null`.

O sea: la foto nunca llegó a subirse. No es un fallo de permisos ni de almacenamiento, es que el paso de subida quedó cortado a la mitad por la recarga.

**Sobre el botón de cámara:** usa `<input type="file" capture="environment">`. Eso depende del navegador; dentro del visor embebido de Lovable (un iframe) muchos navegadores móviles ignoran o bloquean el atributo y "no hace nada". Es una limitación del contenedor, no del código.

**Y una cosa más:** aun cuando la subida sí funciona (por ejemplo desde la computadora), la lista de materiales guardados **no muestra la imagen**, solo texto. Nunca se genera una URL firmada para mostrarla. Así que el examinador no tiene confirmación visual de que el material quedó registrado.

## Qué propongo (nada caro, y sin tocar la lógica de examen)

### 1. Subida inmediata al elegir el archivo
En cuanto se selecciona la foto, se sube directo al servidor y se crea el registro del material. Nada queda esperando en memoria, así que una recarga del navegador ya no puede perder nada. Desaparece el botón "Upload material" como paso obligatorio; queda solo el tipo de material y, después, la descripción editable.

### 2. Miniaturas reales de lo ya subido
Cada material guardado muestra su miniatura (URL firmada del archivo). Eso es la confirmación visual que pedís: si se ve la foto en la lista, quedó registrada.

### 3. Descripción por IA después de subir
La varita trabaja sobre el archivo ya subido (no sobre uno temporal). Si la IA falla, el material sigue existiendo y la descripción se puede escribir a mano. Opcionalmente se dispara sola al subir una foto, con el texto editable.

### 4. Cámara: alternativa que sí funciona en el celular
- Mantener el input con `capture` (funciona en varios navegadores).
- Agregar una **cámara dentro de la página** (`getUserMedia`): se abre un visor, se toca "Capturar" y la foto se sube al instante, sin salir de la pestaña ni recargar nada. Es la única forma robusta en móvil.
- Si el navegador o el visor embebido bloquea la cámara, mostrar un aviso claro con la sugerencia de abrir la app en una pestaña propia.

### 5. Estado visible de cada material
Indicador por material: "Subiendo…" → "Guardado" → miniatura + descripción. Sin ambigüedad sobre si algo se registró.

## Detalles técnicos

- `src/components/session/SessionMaterialPanel.tsx`: reemplazar el flujo `file → botón Upload` por subida en el `onChange` del input; quitar el estado `file`/`uploading` como bloqueo del botón; agregar componente de cámara con `getUserMedia` + `canvas.toBlob` y subida directa.
- `src/hooks/useSpeakingSession.ts`: agregar un hook que genere URLs firmadas para `image_path` de los materiales (batch, `createSignedUrls`), para las miniaturas.
- La descripción por IA reutiliza `describe-material` con el `image_path` definitivo (ya cumple el prefijo `${user.id}/`), así que se elimina la subida temporal y su borrado.
- Sin migraciones, sin cambios en `analyze-exam`, grabación, cola, informes ni firmas.

## Fuera de alcance

No se toca el scoring, el PDF, la grabación de audio ni los informes existentes.

## Criterios de aceptación

- [ ] En el celular, elegir una foto desde la galería la sube sola; al volver a la pestaña la foto ya figura en la lista con miniatura.
- [ ] El botón de cámara abre un visor dentro de la página y la foto capturada queda subida sin recargar.
- [ ] Cada material guardado muestra miniatura y descripción editable.
- [ ] Si la IA falla, el material sigue guardado y la descripción se puede escribir a mano.
- [ ] Grabar, encolar, transcribir, confirmar speakers, analizar y firmar siguen igual.
