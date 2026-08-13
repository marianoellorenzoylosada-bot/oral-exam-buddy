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

## Fuera de alcance

Configurar un dominio de envío de correos propio (se puede hacer después si querés remitente con tu marca).
