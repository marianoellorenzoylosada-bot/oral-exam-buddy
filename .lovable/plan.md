# Feedback, FODA y ruta recomendada sobre tu plan de 8 auditorías

Verificado antes de escribir esto: esquema real de la base, políticas RLS vigentes, `useSpeakingSession.ts`, `SpeakingSession.tsx`, `DraftReport.tsx`, `ReportDetail.tsx`, `Reports.tsx`, `useRoles.ts`, y mediciones reales de tamaño en base y storage.

## 1. Veredicto general

La ruta es coherente y está bien priorizada. Casi todo es realizable en Lovable. Hay tres puntos que, tal como están escritos, **no son alcanzables literalmente** y conviene reformular (sección 3). El riesgo principal no es técnico sino de orden: la Auditoría 1 (workspaces + roles) es la única que obliga a reescribir *todas* las políticas de seguridad de la app, y si se hace después de las auditorías 2–6 hay que volver a tocar lo ya pulido.

## 2. Datos duros que faltaban (Auditoría 1.4, respondida)

Medido sobre tus datos actuales:

| Objeto | Tamaño real medido |
|---|---|
| Audio por attempt | **10,9 MB promedio** (17 archivos, 185 MB en total) |
| Duración media de attempt | **13 minutos** (783 s) |
| Fila de informe firmado (`exams`) | **57 KB** promedio, 72 KB máximo (transcript + `words_json`) |
| Fila de attempt | 37 KB |
| Material/foto | 0,95 MB promedio |
| Estado actual | 5 sesiones, 14 attempts, 29 informes (7 archivados), 58 alumnos, 7 grupos |
| Política de retención | audio: 15 días desde la firma (`audio_expires_at` + `purge-expired-audio`); base: indefinida |

Proyección para una institución de 500 alumnos, 2 mocks al año, en parejas → ~500 attempts/año:

- Audio generado: ~5,5 GB/año, pero con el purgado a 15 días el **almacenamiento pico es de ~200–400 MB**. Costo de storage: despreciable.
- Base de datos: ~1.000 informes × 57 KB ≈ **57 MB/año**. Despreciable.
- **El costo real es de procesamiento, no de almacenamiento:** ~6.500 minutos/año de transcripción (ElevenLabs Scribe) más ~1.000 análisis del modelo. Ahí está el 90 % del costo variable y es lo que el pricing por seat/licencia tiene que cubrir.

Conclusión: la escalabilidad técnica no es un riesgo. El riesgo es de *unit economics*: hay que fijar un límite de minutos por plan antes de vender.

## 3. Lo que hay que corregir del plan

1. **"Resume recording durante unos segundos si el Stop fue accidental" no es implementable de forma fiable tal cual.** Un `MediaRecorder` detenido no se puede reanudar sobre el mismo archivo, y concatenar dos WebM/Opus en el navegador da archivos que ElevenLabs puede rechazar. Alternativa equivalente y segura: el botón `Stop` primero **pausa** (`recorder.pause()`) y muestra "Reanudar / Detener y guardar". El guardado real ocurre en el segundo toque. Se logra el mismo objetivo sin riesgo de audio corrupto.
2. **"Session Ready" hoy no puede ser un estado real** porque `speaking_sessions.status` sólo admite `open`/`closed` en el código y no hay validación de "material listo". Es viable, pero es una columna nueva más un gate de UI: conviene implementarlo como *estado derivado* (material ≥ 1 y candidatos definidos) antes de gastar una migración.
3. **"Archived Reports" está bloqueado por seguridad hoy.** La columna `exams.archived` existe, pero la política de UPDATE sólo permite modificar informes con `confirmed_at IS NULL`. Es decir: **un informe firmado no se puede archivar desde la app**. Archivar requiere una función de servidor acotada (como la que ya existe para rellenar el feedback por parte). Sin eso, la Auditoría 5 no se puede completar.
4. **La "ventana intermedia" de la Auditoría 3 es el Draft Report**, que es también la pantalla de firma: no se puede eliminar sin eliminar la firma. Lo que sí sobra son los saltos y los botones paralelos ("Analyze without confirming speakers", "Back to speaker review" duplicado, "New Exam" dentro del Draft). Necesito que me confirmes si te referías a esa pantalla o a otra.
5. **Los roles objetivo no coinciden con los existentes.** Hoy hay `admin`, `educator`, `senior`. Tu modelo pide `examiner`, `teacher`, `coordinator`. Y más importante: **hoy los permisos no son por rol, son por dueño**. Todas las tablas filtran por `auth.uid() = user_id`. Un examinador no puede abrir la sesión de otro *ni siquiera si es de su institución*: la fila simplemente no existe para él. Los roles actuales sólo gobiernan Calibration y Team Admin. Por lo tanto "Teacher con lectura de los reportes de sus grupos" **no es un ajuste de permisos: es la introducción del concepto de workspace**. Es el trabajo más grande de todo el plan.

## 4. Análisis FODA

**Fortalezas**
- El pipeline crítico (grabar → transcribir → revisar speakers → analizar → firmar) ya funciona de punta a punta con protección contra pérdida de audio.
- Los informes firmados son inmutables a nivel de base de datos: base sólida para vender confiabilidad académica.
- El modelo de datos ya tiene `candidate_id`, `groups`, `students`, `revision`, `archived`: la mitad de la estructura que pide tu modelo objetivo ya está.
- Los datos para Insights (Auditoría 7) **ya existen**: no hace falta IA extra, sólo consultas sobre `criteria` y `candidate_id`.

**Oportunidades**
- Insights por grupo y por institución es el diferencial comercial real y es el módulo más barato de construir de todo el plan.
- El costo de infraestructura es marginal frente al precio de una licencia institucional.
- El PDF del alumno con ejemplos concretos en lenguaje amigable es reutilización de datos que ya se generan (el docente ya recibe los ejemplos).

**Debilidades**
- Cero multiusuario real: toda la seguridad asume un dueño único por fila.
- No hay unicidad de firma: se puede firmar el mismo attempt dos veces y generar informes duplicados.
- El attempt no se cierra al firmar (sólo lo cierra el botón "New Exam"), lo que produce los estados ambiguos que ya viste.
- Las versiones corregidas no están vinculadas al original (no hay `parent_exam_id`), así que "Version History" hoy es reconstrucción por heurística.
- Un alumno pertenece a un solo grupo, sin historial: la persistencia académica entre años exige una tabla nueva de inscripciones. Los grupos no tienen `archived`.
- La lógica de análisis está duplicada en tres lugares y la de Reports envía menos contexto a la IA que la de la cola, con lo que una corrección puede puntuar distinto que el análisis original.

**Amenazas**
- Migrar a workspaces con datos reales ya cargados: si se hace mal, se pierde visibilidad de informes existentes. Requiere backfill con un workspace personal por usuario.
- Sin límite de minutos por plan, una institución intensiva puede volver el plan no rentable.
- Retención de 15 días del audio: si una institución exige auditoría posterior o hay una impugnación de nota, el audio ya no está. Es una decisión de producto a definir por plan, no un detalle técnico.
- Datos de menores de edad: al vender a instituciones aparecen requisitos de consentimiento y retención que hoy no están documentados.

## 5. Prioridad recomendada (corrige el orden de tu plan)

**Fase 0 — Correcciones de integridad (1 tanda, riesgo bajo, imprescindible antes de tocar UI)**
1. Cerrar el attempt automáticamente cuando todos sus candidatos quedan firmados.
2. Impedir la doble firma (índice único por attempt + candidato entre informes confirmados) y ocultar "Review & sign" cuando ya existe informe firmado.
3. Vincular las versiones corregidas al original (`parent_exam_id`) — habilita el "modo avanzado" de la Auditoría 5 sin heurísticas.
4. Función de servidor acotada para archivar informes firmados — desbloquea Active/Archived.

**Fase 1 — Arquitectura de workspaces y roles (tu Auditoría 1, hacerla ANTES de las 2–6)**
- `workspaces` + `workspace_members(user_id, workspace_id, role)` + función `has_workspace_role()` de tipo security definer.
- `workspace_id` en `groups`, `students`, `speaking_sessions`, `session_attempts`, `session_materials`, `exams`.
- Reescritura de las políticas: de "soy el dueño" a "pertenezco al workspace con el rol adecuado".
- Backfill: un workspace personal por usuario existente → nadie pierde nada y el docente independiente no ve complejidad nueva.
- Roles finales sugeridos: `coordinator` (total + usuarios), `examiner` (tomar y firmar), `teacher` (grupos/alumnos + lectura de informes de sus grupos). `admin` y `senior` se conservan como roles de plataforma (calibración), no de institución.

**Fase 2 — Workflow oficial (tus Auditorías 2 y 3)**
- Un solo recorrido: Session Ready → Recording → Queue → Speaker Review → Analyze → Review → Sign → Archived.
- Guardado automático del attempt con pausa/reanudación segura y toast.
- Cola como bandeja de trabajo con un único botón por estado.
- Todo lo de rescate ("Analyze without confirming speakers", reintentos manuales, completar breakdown) pasa a **Advanced / Maintenance** detrás de un flag, no se elimina.
- Transcript navegable: el componente ya recibe `words` y ya soporta salto al audio; falta scroll completo, buscador y resaltado de la línea en curso. Es trabajo chico y contenido.

**Fase 3 — Firma y PDFs (tus Auditorías 4 y 6)**
- Checklist previo a la firma sin clics extra: tres casillas que se marcan solas cuando el examinador ya interactuó con esa sección, y bloqueo suave sólo si alguna quedó sin tocar.
- PDFs: encabezado que no se superponga, sin cortes en "What you did well" / "What to practice next", enlaces en una línea, y reutilización de los ejemplos concretos del informe docente traducidos a segunda persona amigable.

**Fase 4 — Insights (tu Auditoría 7)**
- Sólo SQL sobre datos existentes. Recomendado: una vista que aplane `criteria` a filas (alumno, criterio, puntaje, fecha) y sobre ella todo lo demás — evolución, fortalezas, criterio más débil del grupo, distribución.

**Fase 5 — Persistencia académica (tu Auditoría 8)**
- `academic_years` + `enrollments(student_id, group_id, year_id)` y `archived` en grupos. El alumno ya tiene ID permanente, así que activarlo más adelante no requiere migración grande **si en la Fase 1 ya se agregó `workspace_id`**.

## 6. Cosas no contempladas que conviene incluir

- **Límite de consumo por workspace** (minutos de transcripción / análisis por mes) verificado en el servidor, no en el cliente. Es el prerrequisito real de cualquier billing.
- **Retención del audio como parámetro por plan** (15 / 90 días) en lugar de constante fija.
- **Consentimiento y anonimización** para uso institucional con menores; ya existe el toggle de anonimización, falta el registro documental.
- **Invitaciones de usuarios al workspace** (hoy no hay forma de que un coordinador dé de alta a un examinador).
- **Cobro local:** Stripe primero como estándar; Mercado Pago sólo si el mercado uruguayo/argentino lo exige. El punto de menor impacto es `workspace_plan` + `entitlements` consultados dentro de las funciones de servidor `analyze-exam` y `transcribe-audio`: así el proveedor de pago se cambia sin tocar el producto.

## 7. Capacidad de Lovable

Todo lo anterior es realizable acá: base de datos con seguridad por filas, funciones de servidor, storage, IA y pagos son parte de la plataforma. La restricción real no es la herramienta sino el **orden y el tamaño de cada tanda**: la Fase 1 toca 6 tablas y todas sus políticas, y debe hacerse en una sola migración revisada, no de a pedazos.

## Próximo paso propuesto

Ejecutar **Fase 0** (4 correcciones de integridad, sin cambios visibles de flujo) y en la misma tanda dejar escrita la migración de la Fase 1 para que la revises antes de aplicarla. Confirmame también a qué pantalla te referías con la "ventana intermedia" de la Auditoría 3.
