# Correcciones tras la prueba de punta a punta de Speaking Session

Seis observaciones, seis causas. Esto es lo que encontré y lo que propongo hacer.

## 1. No se pudo verificar los speakers antes del análisis (el más importante)

Causa confirmada: al transcribir, el código guarda el texto pero **descarta las palabras con marcas de tiempo y de hablante**. El panel de revisión de speakers recibe una lista vacía, así que no hay nada que revisar y el intento pasa directo a análisis.

Corrección:
- Guardar las palabras devueltas por la transcripción en el intento (`live_words`), no solo el texto.
- Reconstruir el transcript etiquetado a partir de esas palabras cuando el examinador confirma quién es quién.
- El paso "Review speakers" queda obligatorio cuando hay dos o más hablantes detectados; el botón "Skip review & analyze" pasa a ser secundario y avisa que se analizará sin confirmar.

## 2. Informes distintos entre candidatos (uno por área, otro por partes)

El análisis a veces devuelve el desglose por parte para un candidato y no para el otro. La pantalla y el PDF entonces caen al formato por criterio.

Corrección:
- Normalizar el resultado antes de mostrarlo: si a un candidato le falta el desglose por parte, se pide **solo para ese candidato** un complemento al análisis, en lugar de mostrar un formato distinto.
- Si aun así no llega, la sección se muestra igual para todos con un aviso claro ("desglose por parte no disponible"), nunca dos formatos distintos en la misma tanda.

## 3. La versión para imprimir corta los textos

La impresión usa la vista de pantalla, y los recuadros de la interfaz recortan el texto al pasar de página.

Corrección: el botón **Print** deja de imprimir la pantalla y genera el mismo documento del PDF, abriendo directamente el diálogo de impresión. Lo que se imprime es idéntico a lo que se descarga, con saltos de página correctos.

## 4. Solo un informe por candidato, sin informe docente

Hoy la pantalla de revisión ofrece un único PDF. La versión para el alumno ya existe en la aplicación, pero no está disponible desde ahí.

Corrección: dos botones por candidato en la pantalla de revisión:
- **Student PDF** — versión para el alumno.
- **Teacher PDF** — informe docente completo (con transcript y notas del examinador).

Y un botón **Download all** que genera los dos documentos de cada candidato de una vez.

## 5. No se puede sacar foto

El navegador bloquea la cámara dentro de la ventana de vista previa: no es un problema del código de captura. En la app publicada (o abierta en una pestaña propia) la cámara sí puede pedir permiso.

Corrección:
- Detectar el caso y mostrar un mensaje útil en lugar de un error genérico, con un botón "Abrir en una pestaña nueva" para poder usar la cámara.
- Mantener el adjuntar archivo como camino garantizado (es el que ya funciona en el celular).

## 6. No hay forma de borrar speaking sessions

Corrección: en la lista de sesiones y dentro de la sesión, un botón **Delete session** con confirmación, que borra la sesión, sus materiales, sus intentos y los archivos asociados (fotos y audios). Los informes ya firmados **no** se borran: quedan en Reports. La confirmación lo dice explícitamente.

---

## Detalle técnico

- `src/pages/SpeakingSession.tsx`: persistir `out.words` en `live_words` al transcribir; forzar el paso de speakers cuando `speakerStats(words).length >= 2`; usar esas palabras en `applySpeakerMap`; añadir borrado de sesión.
- `src/hooks/useSpeakingSession.ts`: nuevo `useDeleteSession` (borra objetos de `exam-context` y `exam-audio`, luego la fila; los `session_materials` / `session_attempts` caen por cascada).
- `src/components/DraftReport.tsx`: botones Student/Teacher PDF por candidato + "Download all"; `handlePrint` pasa a usar el generador de PDF con `autoPrint`.
- `src/components/session/SessionMaterialPanel.tsx`: mensaje específico para `NotAllowedError` en iframe + acción para abrir en pestaña nueva.
- Normalización de `partFeedback` en el cliente y reintento por candidato faltante contra `analyze-exam` (sin cambiar la firma del function).
- Sin cambios de esquema: `session_attempts.live_words` ya existe.

## Fuera de alcance

Cambiar el motor de puntuación, calibración, y el rediseño del PDF.
