Contratás **Starter (~US$5, 30.000 créditos)** en ElevenLabs, y en la app dejamos la **transcripción en vivo apagada por defecto** con un toggle para encenderla. Con eso tenés margen para ~30 exámenes reales mañana.

## Plan de implementación

### 1. Transcripción en vivo apagada por defecto
- En la pantalla "New Exam", el componente de subtítulos en vivo (`LiveTranscript`) queda **oculto y desactivado** al abrir.
- Se agrega un toggle claro arriba del grabador:
  > **Live captions (consumen créditos extra)** — apagado por defecto
- Con el toggle apagado: no se pide token, no se abre WebSocket a ElevenLabs, cero consumo en vivo.
- La preferencia se recuerda en el navegador (`localStorage`) para que no tengas que apagarla cada vez.
- La **transcripción final** (la que usa la IA para puntuar) se mantiene igual — es imprescindible para el scoring.

### 2. Cortar el bucle infinito de análisis
- El auto-reintento pasa a correr **solo** para errores temporales (offline / red caída con `navigator.onLine === false`).
- Para errores permanentes (cuota agotada, error del proveedor, audio inválido, formato no soportado): se corta el ciclo, el examen queda marcado como "pendiente con error" y aparece un botón **Reintentar manualmente**.
- La pantalla "Confirm speakers" deja de quedarse pensando indefinidamente cuando el análisis falla.

### 3. Mensajes de error claros (reemplazan el genérico actual)
El edge function `transcribe-audio` empieza a devolver códigos de error tipados que la app traduce a mensajes entendibles:

- `quota_exceeded` → "Sin créditos de transcripción en ElevenLabs. Tu grabación quedó guardada — reponé créditos y tocá Reintentar."
- `network_error` → "La conexión se cortó durante el análisis. Tu audio está guardado, tocá Reintentar."
- `service_unavailable` → "El servicio de transcripción está temporalmente caído. Probá en unos minutos."
- `audio_invalid` → "El audio parece vacío o dañado. Volvé a grabar."
- Cualquier otro → mensaje genérico + botón para reintentar.

Mismo tratamiento en `LiveTranscript` cuando el toggle esté encendido y falle.

### 4. "Guardar para analizar después" en el flujo individual
- Después de detener la grabación, junto al botón actual **Submit for Analysis** aparece un segundo botón: **Guardar para analizar después**.
- Persiste el audio + metadatos en IndexedDB (mismo mecanismo que ya usa Batch Session, vía `useBatchQueue`/`batchQueueDb`).
- Aparece en una lista de "Exámenes pendientes" desde donde podés retomarlos cuando quieras.
- El botón "Submit for Analysis" y su flujo actual **no se tocan**.

### 5. Validación antes de mañana
- Compila y typechecks pasan.
- Con toggle apagado: ninguna llamada a `elevenlabs-scribe-token` en Network durante la grabación.
- Con toggle encendido: funciona igual que hoy.
- Simulando `quota_exceeded` en el edge function → aparece el mensaje específico y el botón de reintento manual (sin bucle).
- Grabar → detener → se ven las dos opciones (Submit / Guardar).
- Un examen guardado se retoma correctamente y se envía a analizar cuando haya cuota.

## Qué NO se toca

- Rúbricas, prompts, criterios de evaluación, scoring.
- Users, roles, RLS, políticas, storage buckets.
- Reportes, PDF, calibración, question bank.
- Integraciones de pago.
- `src/integrations/supabase/client.ts`, `types.ts`, `.env`.

## Confirmación operativa

ElevenLabs Starter ya está activa: 30.000 créditos frescos. Con la transcripción en vivo apagada por defecto, cada examen de ~15 min consume ~900 créditos, lo que da margen para ~30 orales. Si un examen falla, la grabación queda guardada y se puede reintentar sin regrabar.