# Poder escuchar cualquier momento del audio durante la revisión de speakers

Es barato de arreglar. Son dos cosas distintas, ambas del lado de la interfaz.

## Qué está pasando

1. **El timestamp no lleva al audio**: el panel de revisión de speakers se monta sin conectarle el reproductor. El panel ya sabe reproducir desde un segundo concreto (`onSeek`), pero en la cola no se le pasa nada, así que los timestamps quedan inertes (el cursor de mano aparece igual porque es un botón).
2. **El reproductor no deja adelantar**: el audio se reproduce desde un enlace remoto y los archivos grabados en el navegador (`.webm`) no traen la información de duración, así que el navegador no puede saltar a partes avanzadas. Solo avanza escuchando.

## Qué se va a hacer

### 1. Reproductor propio del panel de revisión

Dentro del bloque de revisión de speakers, arriba del script, un reproductor fijo (no al final de la página):

- Barra de progreso completa, arrastrable a cualquier punto, con tiempo actual y total.
- Botones de retroceder/avanzar 5 segundos y play/pausa.
- Al hacer clic en cualquier timestamp del script, el audio salta a ese momento y empieza a reproducir ese turno; la línea que suena queda marcada.

### 2. Audio realmente navegable

Antes de habilitar la reproducción, el audio de esa toma se descarga completo una vez (con un breve "Preparando audio…") y se reproduce desde la copia local. Así el navegador conoce la duración y se puede saltar libremente a cualquier parte, adelante o atrás. Se descarga una sola vez por toma.

### 3. Nada más cambia

El resto del recorrido (mapeo, corrección línea por línea, confirmar y analizar, informes, firma) queda exactamente igual. No se toca la base de datos ni el análisis, y no hay costo de IA adicional.

## Notas técnicas

- Nuevo componente de reproductor (`AttemptAudioPlayer`) usado dentro del bloque `reviewing_speakers` de `src/pages/SpeakingSession.tsx`; recibe `audio_path` y expone `seek(start)`.
- Descarga vía `supabase.storage.from("exam-audio").download(path)` → `URL.createObjectURL` para tener un origen seekable; se revoca al desmontar. Fallback a la URL firmada actual si la descarga falla.
- Se pasa `onSeek` a `SpeakerReviewPanel` (la prop ya existe y ya está usada por el script y por la lista de voces).
- Se mantiene el `<audio>` global existente para el botón "Play" de la cola; sin cambios de esquema ni de edge functions.
