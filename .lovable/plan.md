# Registro de una segunda usuaria + revisión de hablantes en el informe

## 1. Qué significa el error que vio tu compañera

"Authorization failed — State verification failed — Error code: invalid_request" es un error del paso de autorización de Google, no de la app. Aparece cuando el intento de inicio de sesión no termina en el mismo contexto donde empezó: típicamente cuando se abre la app dentro de la vista previa del editor (que corre en un iframe), cuando se reutiliza un enlace de inicio de sesión viejo o ya usado, o cuando el navegador bloquea cookies de terceros (habitual en Safari/iOS con "Prevenir rastreo").

Datos verificados:
- El dominio publicado `oralexamassistant.lovable.app` está correctamente habilitado como URL de retorno, igual que el de vista previa.
- No existe ninguna cuenta nueva creada en el sistema: el registro nunca llegó a completarse (ni por Google ni por email).

Acción concreta para ella (sin cambios de código): abrir **https://oralexamassistant.lovable.app** en una pestaña normal del navegador (no el enlace de vista previa `id-preview--…`), y desde ahí registrarse.

## 2. Cambios en la app para que esto no vuelva a pasar

- **Detectar el contexto de vista previa**: si la app está corriendo dentro de un iframe, el botón "Continue with Google" abre primero la app en una pestaña propia en lugar de fallar.
- **Mensaje de error útil**: si el proveedor devuelve un error (state inválido, ventana cerrada, popup bloqueado), mostrar un mensaje claro en español/inglés con la causa probable y un botón "Reintentar" — hoy muestra un texto técnico o nada.
- **Registro por email más claro**: al crear cuenta, distinguir tres casos y decirlo en pantalla: cuenta creada y lista, cuenta creada pendiente de verificar el correo, o email ya registrado (con enlace a "Olvidé mi contraseña").
- **Verificar la confirmación de correo**: revisar si el proyecto está confirmando cuentas automáticamente. Si está desactivado, el correo de verificación se envía con el remitente por defecto de Lovable y puede caer en spam; en ese caso te propongo dejarlo confirmado automáticamente para la validación de la semana que viene, o configurar tu propio dominio de envío. Esto se cambia solo con tu confirmación explícita.

Además, para invitar colegas conviene una pequeña nota en la pantalla de acceso: "Si te invitaron, usá el enlace publicado de la app".

## 3. Revisión de hablantes en el informe de evaluación

Confirmado en el código: el panel de revisión de hablantes se renderiza en el detalle del informe (`ReportDetail`) siempre que existan palabras con marca de tiempo, sin importar que el informe ya esté analizado y firmado. Por eso te sigue apareciendo cuando ya no tiene utilidad.

Corrección: en el informe de evaluación el panel deja de ofrecer la corroboración. La asignación de hablantes queda visible solo como lectura (transcripción etiquetada, con clic para escuchar donde haya audio), y la corroboración editable queda únicamente en el paso previo al análisis dentro de Speaking Session.

## Detalle técnico

- `src/pages/Auth.tsx`: detectar `window.self !== window.top` y ofrecer "Abrir en una pestaña nueva" para el login con Google; mapear los errores devueltos por `lovable.auth.signInWithOAuth` a mensajes claros; en `handleSignup`, diferenciar `identities.length === 0` (email ya registrado) y sesión ya activa vs. verificación pendiente.
- `src/components/ReportDetail.tsx` (línea ~511): reemplazar `SpeakerMappingPanel` por la vista de solo lectura (`SpeakerTranscript`) usando `exam.speaker_map`.
- Sin cambios de esquema ni de funciones de servidor.

## 4. Enviar los informes por correo o WhatsApp (opcional, fase aparte)

Sí es posible, con dos niveles de esfuerzo muy distintos. No lo incluyo en esta corrección; lo dejo dimensionado para decidir después de la validación.

**Opción A — Compartir por enlace (barata, casi sin estructura)**
- El PDF se sube al almacenamiento de la app y se genera un enlace firmado con vencimiento (por ejemplo 7 o 30 días).
- Botones "Enviar por WhatsApp" (abre WhatsApp con el mensaje y el enlace ya escritos) y "Enviar por correo" (abre el correo del examinador con el mensaje armado).
- Costo: prácticamente nulo. Complejidad: baja. No requiere dominio propio ni aprobación de ningún proveedor. El envío lo hace el examinador desde su propio WhatsApp/correo, así que no hace falta tener los teléfonos de los alumnos en la base.

**Opción B — Envío automático desde la app por correo**
- Requiere un dominio propio de envío (por ejemplo `notify.tudominio.com`); no existe remitente gratuito. Costo: el del dominio (unos pocos dólares al año) más la infraestructura de envío ya incluida en la plataforma.
- Los adjuntos no están soportados: el correo lleva un enlace firmado al PDF, no el archivo pegado.
- Hay que guardar el correo del alumno (o del tutor) en la ficha del candidato, con el consentimiento correspondiente.
- Complejidad: media. Suma plantilla de correo, registro de envíos y manejo de rebotes.

**WhatsApp automático (no recomendado por ahora)**: enviar sin intervención humana exige la API de WhatsApp Business con proveedor externo, verificación de empresa, plantillas aprobadas y costo por mensaje. Para tu caso, la Opción A cubre el 100% de la necesidad sin ese peso.

Recomendación: Opción A cuando quieras avanzar, y evaluar B solo si querés envío masivo sin intervención del examinador.

## Fuera de alcance

Configurar un dominio de envío de correos propio y el envío automático de informes (queda como fase 4, a decidir después de la validación).

