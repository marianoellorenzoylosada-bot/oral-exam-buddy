# Mejoras: revisión de speakers, timer, mic check y el caso Juana Goya

## 1. Revisión de speakers con transcripción completa y colores

Hoy el panel de mapeo sólo muestra unas pocas palabras de muestra por voz, sin forma de verificar el resto.

Nuevo panel de revisión (en la Queue de Speaking Session, paso previo al análisis):

- Arriba: la asignación global de cada voz detectada a un rol (Examiner, Candidate A/B/C, Speaker unclear), como ahora, con duración, porcentaje y botón de reproducir muestra.
- Debajo: la **transcripción completa desplazable**, una intervención por línea, con **fondo tipo highlighter** de color distinto por rol (Examiner neutro, Candidate A / B / C con colores propios, "unclear" en rojo suave) y timestamp clicable para escuchar ese punto.
- Cada línea tiene un selector rápido para **reasignarla individualmente** cuando la atribución automática se equivocó en una frase suelta. La corrección se guarda a nivel de esa intervención y no altera el resto.
- Botón final **"Confirmar speakers y analizar"**: recién ahí se reconstruye el script definitivo (mapeo global + correcciones por línea) y se pasa al análisis.
- El mismo componente coloreado se reutiliza en modo **sólo lectura** en el informe final, para leer el script sin poder editarlo.

## 2. Countdown automático por parte del examen

- Vuelve el timer a la pestaña de grabación de Speaking Session, con las partes y duraciones del nivel de la sesión (PET/FCE, etc.).
- Cuenta hacia atrás dentro de cada parte y **avanza solo** al cumplirse el tiempo objetivo, con un **chime muy suave** y cambio de color en la barra segmentada (parte cumplida / parte activa / parte pendiente; ámbar si se está pasando del tiempo).
- Es orientativo: se puede adelantar a la parte siguiente a mano o reiniciar en cualquier momento, y no interrumpe ni condiciona la grabación.

## 3. Mic check antes de grabar

- Panel de prueba de micrófono visible arriba del botón de grabar, opcional: mide nivel de entrada y permite elegir dispositivo antes de empezar.
- No bloquea el flujo; se puede grabar directamente sin usarlo.

## 4. Caso Juana Goya

Qué pasó, confirmado en los datos: en esa grabación el análisis se pidió para las dos candidatas juntas y el modelo devolvió el desglose por parte del examen sólo para Federica (4 partes) y **vacío para Juana**. Existe un reintento automático que vuelve a pedir el desglose de la candidata faltante, pero falló silenciosamente y el informe se firmó igual, con el resumen general presente y `part_feedback` vacío — de ahí el mensaje "Per-part commentary is unavailable".

Acciones:

- **Reparar su informe ahora**: se vuelve a pedir el desglose por parte usando el mismo script (que sigue guardado) y se guarda en su informe como **revisión 1** con el motivo registrado, sin tocar los marks ni el resumen ya firmados.
- **Evitar que se repita**: el reintento pasa a ser visible y verificado — si tras los reintentos alguna candidata sigue sin desglose, el análisis **no se marca como listo**; queda un aviso claro con botón "Completar desglose" antes de poder firmar.
- Además, en cualquier informe firmado sin desglose queda disponible una acción para regenerarlo como nueva revisión.

## Notas técnicas

- Nuevo `SpeakerReviewPanel` (componente compartido) que reemplaza el uso actual de `SpeakerMappingPanel` en `SpeakingSession`, sobre `live_words` (timeline por palabra de Scribe) agrupado en intervenciones; overrides por intervención guardados junto a `speaker_map` en `session_attempts`.
- `applySpeakerMap` extendido para aceptar overrides por índice de intervención; sin overrides, comportamiento idéntico al actual.
- `PhaseTimer` extendido con auto-avance y volumen de chime reducido; se monta en la pestaña Record de `SpeakingSession` junto a `MicCheck` (ambos componentes ya existen y hoy sólo se usan en las pantallas antiguas).
- Guardia en `handleAnalyze`: la escritura de `analysis_result` con estado `reviewing_report` sólo ocurre si todas las candidatas traen `partFeedback`; si no, estado `needs_part_breakdown` con acción de reparación.
- La reparación del informe de Juana requiere una excepción puntual: las filas con `confirmed_at` están bloqueadas para edición, así que se aplica como revisión controlada (revision 1 + motivo) desde el flujo de revisión existente.
- Sin cambios de esquema nuevos salvo el campo de overrides dentro del JSON ya existente. Costo de IA adicional: sólo la llamada de reparación por candidata faltante.
