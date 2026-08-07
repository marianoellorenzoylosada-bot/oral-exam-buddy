# Revisión final antes de la validación

Sí, vale la pena. Antes de tomar orales reales conviene una pasada de verificación de solo lectura: nada de cambios de comportamiento, solo comprobar que el camino completo funciona y dejar por escrito qué está sólido y qué mirar con cuidado durante la prueba.

## Alcance de la revisión

1. **Recorrido completo simulado (end-to-end)**
   Ejecutar el flujo real en el navegador contra la app en marcha: iniciar sesión, crear grupo y candidatos, crear una speaking session, subir material y ver la descripción automática, grabar un intento corto, mandarlo a la cola, revisar la asignación de voces, analizar, abrir el informe para firmar y descargar los dos PDFs. Se captura evidencia en pantalla de cada paso.

2. **Consistencia de los PDFs**
   Verificar que el informe descargable sale organizado por parte del examen con los comentarios discriminados por criterio dentro de cada parte, y que no aparecen "(object)" ni secciones vacías en Strengths / Areas for improvement, incluidos los casos de pareja con candidatos de grupos distintos.

3. **Reglas de negocio críticas**
   - Un informe confirmado no puede volver a editarse.
   - Cada informe queda con su candidato, grupo e institución correctos.
   - La sesión sigue disponible ("open") para reutilizar el mismo material otro día.
   - El audio se guarda bajo la carpeta del examinador y caduca a los 15 días.
   - Solo Senior/Admin pueden aprobar un caso como referencia de calibración.

4. **Resistencia y errores**
   - Comportamiento sin conexión: la cola local no se pierde al refrescar.
   - Un intento que falla queda con "Retry" y con la descarga del audio original disponible.
   - Mensajes de error claros cuando la transcripción o el análisis fallan (cuota, red, audio vacío).

5. **Estado técnico**
   - Consola del navegador y registros de las funciones de servidor sin errores durante el recorrido.
   - Chequeo de tipos y tests existentes.
   - Linter de base de datos y escaneo de seguridad: confirmar que no hay hallazgos abiertos nuevos.

## Qué vas a recibir

Un informe en chat, en castellano, con:
- Semáforo por área (listo / mirar durante la prueba / arreglar antes).
- Lista concreta de defectos encontrados, con impacto y esfuerzo.
- Una guía corta de prueba manual: qué hacer, en qué orden y qué observar el día de la validación.

## Importante

Esta fase no cambia código. Si aparecen fallos, te los presento priorizados y decidís cuáles arreglar antes de la prueba; los arreglos irían en un paso aparte y aprobado por vos.

## Notas técnicas

- El recorrido se automatiza con Playwright sobre la app local, restaurando la sesión de usuario ya existente; solo lectura salvo los datos de prueba que la propia app crea.
- Revisión estática de `SpeakingSession.tsx`, `DraftReport.tsx`, `BatchSession.tsx`, `useSpeakingSession.ts`, `generateReportPdf.ts` y `generateStudentPdf.ts` buscando contratos de datos desalineados (la causa de los "(object)").
- Comprobación de políticas de acceso y del prefijo `${user_id}/` en `exam-audio` / `exam-context` mediante consultas de solo lectura y el linter.
