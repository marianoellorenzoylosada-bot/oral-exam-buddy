# Grabaciones perdidas en Speaking Session: causa y protección

## Qué pasó (verificado en el código)

`Speaking Session` graba con `useAudioRecorder()` **sin ninguna de las protecciones** que sí tenía la vieja `Batch Session`. Comprobado línea por línea:

- **No guarda nada mientras graba.** En Batch Session el grabador recibía un callback `onChunk` que escribía un respaldo del audio en IndexedDB cada segundo. En Speaking Session no se pasa ese callback: el audio existe solo en memoria hasta que se toca "Stop". Si la página se recarga o el navegador mata la pestaña, se pierde todo.
- **No pide Wake Lock.** Batch Session pedía `navigator.wakeLock` para que la pantalla no se durmiera durante la grabación. Speaking Session no lo pide, así que el celular entra en descanso y el sistema corta el micrófono.
- **No hay chequeo de salud al volver a la pantalla.** Batch Session escuchaba `visibilitychange` y llamaba a `recorder.healthCheck()`, que detecta un grabador muerto y cierra el audio parcial. Sin eso, el grabador puede morir en silencio.
- **Por eso desapareció el botón "Stop".** El botón se muestra solo cuando `recorder.state === "recording"`. Cuando el grabador falla, el hook pasa a `"stopped"` y notifica por `onError` — pero Speaking Session **no pasa ningún `onError`**, así que no se muestra ningún aviso: el botón simplemente desaparece sin explicación y el audio parcial no se recupera.

## ¿Se pueden recuperar esas dos grabaciones?

No. Como Speaking Session nunca escribió un respaldo en el navegador, no quedó copia ni en el dispositivo ni en el servidor. Las grabaciones de hoy están perdidas. Lo que sigue es para que no vuelva a pasar.

## Lo que se va a implementar

1. **Respaldo continuo mientras graba.** Speaking Session guarda un respaldo del audio en IndexedDB (junto con duración, candidatos y sesión) cada pocos segundos, igual que hacía Batch Session.
2. **Banner de recuperación.** Al volver a Speaking Session, si hay un respaldo con audio útil, aparece un aviso: "Se encontró una grabación sin guardar de X minutos" con botones **Recuperar** (la carga como grabación lista para enviar a la cola) y **Descartar**. También queda un botón para **descargar el audio** crudo por si algo más falla.
3. **Wake Lock durante la grabación.** Se pide el bloqueo de pantalla al empezar a grabar y se re-pide al volver a la app; se libera al detener. Con esto la pantalla no se apaga sola durante el oral.
4. **Detección de grabador muerto.** Al volver a la app (`visibilitychange`) se corre `healthCheck()`: si el grabador murió, se cierra el audio parcial, se guarda el respaldo y se avisa en pantalla.
5. **Aviso visible en vez de botón que desaparece.** Se conecta `onError` del grabador: si la grabación se corta, se muestra un cartel rojo persistente ("La grabación se detuvo: micrófono desconectado / pantalla apagada") con la opción de recuperar el audio parcial, en lugar de que el botón "Stop" se esfume sin más.
6. **Nota de uso en la pestaña Record.** Un texto corto: mantener la app en primer plano, no bloquear el teléfono, y el recordatorio de que el respaldo se guarda automáticamente.

## Sobre el wifi

Que no pudiera entrar con wifi y sí con datos móviles es un bloqueo de red de ese wifi (red de institución con filtrado/DNS restringido), no de la app. Si se repite, la vía es pedir a la institución que permita el dominio publicado, o usar datos móviles.

## Detalle técnico

- `src/pages/SpeakingSession.tsx`: pasar `{ onChunk, onError }` a `useAudioRecorder`; ref con el contexto actual (sesión, candidatos, nivel) para el snapshot; efecto de Wake Lock y de `visibilitychange` → `healthCheck()`; estado `recoverable` + banner; limpiar el respaldo al guardar el attempt o al descartar.
- Nuevo `src/lib/sessionRecordingDb.ts`: store IndexedDB propio del flujo de Speaking Session (audio como `ArrayBuffer` + `mimeType`, patrón ya probado en `batchQueueDb.ts` para evitar el bug de Blobs en iOS Safari).
- `src/hooks/useAudioRecorder.ts`: sin cambios — ya expone `healthCheck`, `snapshot`, `onChunk` y `onError`.
- Sin cambios de esquema ni de funciones de servidor.
