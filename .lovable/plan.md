## Problema

Hoy en el **Cambridge Core Library** (Settings) cuando subís un PDF de comentarios del examinador:

1. El texto extraído se carga en el campo **Content** del formulario de alta.
2. Al guardar, la entrada aparece en la lista de "Saved references" pero **solo muestra una vista previa de 240 caracteres** y los únicos botones disponibles son "Source ↗" y "Eliminar".
3. No hay forma de abrir el contenido completo ni de corregirlo si la extracción del PDF trajo errores (saltos de línea raros, caracteres mal reconocidos, etc.).

## Solución propuesta

Agregar un botón **"Ver / Editar"** (ícono de lápiz) en cada entrada de la lista, que abre un **diálogo modal** con el contenido completo editable.

### Comportamiento del diálogo

- Muestra los campos: **Título**, **Nivel**, **Tipo de material**, **Source URL**, y **Content** (textarea grande, ~20 filas, con contador de caracteres).
- Todos los campos son editables.
- Botones: **Cancelar** y **Guardar cambios**.
- Al guardar: `UPDATE` sobre `cambridge_reference_material` por `id`, refresca la lista y muestra un toast de confirmación.
- Si el contenido supera el límite (30.000 caracteres) se bloquea el guardado con el mismo mensaje que el alta.

### Sin cambios de archivos en edición

Para mantener el diálogo simple, **no incluye carga de archivos** — solo edición de texto. Si el educador quiere re-extraer un PDF corregido, puede borrar la entrada y volver a crearla desde el formulario de alta existente.

## Archivos involucrados

- **`src/components/CambridgeLibrary.tsx`** — único archivo modificado:
  - Nuevo estado `editing: RefItem | null`.
  - Nuevo botón `Pencil` junto al `Trash2` en cada `<li>`.
  - Nuevo componente `<Dialog>` (de `@/components/ui/dialog`, ya existente) con el formulario de edición.
  - Nueva función `handleUpdate()` que ejecuta el `update` en Supabase.

## Lo que NO cambia

- Esquema de base de datos (la tabla ya soporta `UPDATE`; las políticas RLS de admin ya permiten editar).
- Formulario de alta, extracción de PDF/DOCX/imagen, lógica de análisis, prompt del modelo, ni ningún otro componente.
- Permisos: sigue siendo admin-only (heredado del gate existente en el componente).

## Verificación

1. Subir un PDF de comentarios del examinador.
2. En "Saved references" hacer clic en el nuevo ícono de lápiz.
3. Confirmar que el texto completo aparece en el textarea.
4. Editar una palabra, guardar, y verificar que la vista previa de la lista refleja el cambio.
