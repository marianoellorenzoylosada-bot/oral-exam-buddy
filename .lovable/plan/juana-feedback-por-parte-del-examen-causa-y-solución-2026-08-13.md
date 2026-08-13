# Juana: feedback por parte del examen — causa y solución

## Qué encontré (verificado en los datos)

- La toma de **Federica y Juana** ya tiene el análisis **completo**: en la base, ambas candidatas tienen sus 4 partes con comentarios por criterio.
- Sin embargo, el **informe firmado de Juana** (21:11) se guardó con el campo de feedback por parte **vacío**.
- Causa: al revisar y firmar, la pantalla de revisión **restaura un borrador autoguardado** en el navegador (localStorage) de la primera vez que se analizó esa toma — cuando Juana todavía no tenía el desglose por parte. Ese borrador viejo pisa el análisis nuevo, y al firmar se guarda sin el desglose.
- El aviso "Complete per-part breakdown" que ves **no está mal ubicado**: pertenece a la pareja **Sabrina y Agustín**, donde el análisis de Sabrina sí está genuinamente sin desglose. En la tarjeta de Federica/Juana no aparece porque su análisis ya está completo.
- Además, los informes ya **confirmados quedan congelados** y no admiten cambios, por eso el botón "Generate per-part commentary" no puede reparar el informe firmado de Juana.

## Qué voy a hacer

1. **Invalidar borradores viejos.** El borrador autoguardado quedará marcado con la versión del análisis. Si el análisis se rehizo después, el borrador se descarta automáticamente y se usa el análisis nuevo (los puntajes editados a mano de una revisión ya obsoleta no se arrastran).
2. **Botón "Descartar ediciones guardadas y usar el análisis más reciente"** en la pantalla de revisión, con aviso visible cuando se restauró un borrador, para poder forzarlo a mano.
3. **Aviso en la cola cuando un informe ya firmado quedó sin desglose por parte**, para detectarlo sin abrir cada informe.
4. **Permitir reparar informes firmados** solo en este punto: se podrá completar feedback por parte y resumen general cuando estén vacíos, sin tocar bandas, puntajes ni criterios (el resto sigue congelado).
5. **Reparar el informe de Juana ahora**: copiar su desglose por parte y resumen ya existentes en el análisis al informe firmado. Para **Sabrina** primero completo el desglose faltante en su análisis y luego se repara su informe igual.

## Detalles técnicos

- `DraftReport.tsx`: agregar `analysisVersion` (huella del `analysis_result`: cantidad de partes + `updated_at` del intento) a `PersistedDraft`; descartar el borrador si no coincide. Nuevo botón de descarte que borra la clave `oralassess-draft:<attemptId>` y reinicia el estado desde `result`.
- `SpeakingSession.tsx`: en cada tarjeta de la cola, consultar los `exams` firmados de ese `attempt_id` y mostrar un aviso si alguno tiene `part_feedback` nulo.
- Migración: función `security definer` `fill_missing_part_feedback(_exam_id, _part_feedback, _overall_summary)` que solo actualiza filas del propio usuario y solo si `part_feedback` es nulo; usada por "Generate per-part commentary" en `ReportDetail.tsx`.
- Migración de datos puntual: rellenar el informe de Juana desde `session_attempts.analysis_result`.
- Nada del flujo de speakers, grabación, PDFs ni informes ya correctos se modifica.
