# Estado de verificación

Revisión local: **22 de octubre de 2026**. Base revisada: `71ed246`.

## Comprobado en una copia aislada

- Instalación de dependencias de `server/` y `client/` con sus lockfiles y scripts de instalación desactivados.
- **44 tests de backend aprobados**, sin fallos ni casos omitidos. Incluyen cuatro casos nuevos para el arranque sin cambios de esquema, opt-in local y rechazo de sincronización en producción/hosts remotos.
- `node --check` aprobado para los archivos de servidor modificados.
- **Compilación web aprobada** con Vite; persiste la advertencia de bundles mayores a 500 kB y datos Browserslist antiguos.
- **Lint global del cliente aprobado: 0 errores y 0 advertencias**, sin desactivar reglas.
- **6 tests de regresión React aprobados**: borradores, cambio de clase/socket, limpieza de listeners, sesión sin token/token rechazado y selección de campaña sin socket. Se usan transporte y almacenamiento simulados, no un navegador ni una base real. El renderer de React usado para estas pruebas avisa que está deprecado; conviene migrarlas a un runner de navegador en una mejora posterior.
- `git diff --check` aprobado.

Entorno de esta comprobación: Node.js 24.19.0 y npm 11.9.0. El workflow propone Node.js 22; su ejecución remota debe verificarse por commit, no inferirse de este resultado local.

## Pendiente o con deuda conocida


- No se inició PostgreSQL ni se ejecutaron seeds, resets o migraciones.
- No se verificaron flujos end-to-end, autorización de todos los eventos, reconexión, concurrencia ni experiencia móvil.
- La respuesta `class-spells-result` no contiene un identificador de solicitud: el cambio de clase en la misma conexión todavía puede recibir una respuesta anterior fuera de orden. La limpieza probada cubre listeners y sockets sustituidos, no correlación del protocolo.
- No se llamaron OpenAI, S3 ni otros servicios externos. No se desplegó ni se certificó el funcionamiento de una instancia pública.
- No se generaron capturas ficticias ni se publicaron datos/credenciales de una campaña real.

## Antes de una demo pública

1. Preparar una base aislada con contenido ficticio/autorizado y roles de director y jugador, sin reutilizar contraseñas compartidas del seed histórico.
2. Validar login/registro, acceso a una campaña permitida y rechazo a una ajena.
3. Probar dos sesiones simultáneas: director/jugador, mapa, tokens, turnos, tiradas y visibilidad de mensajes.
4. Comprobar desconexión/reconexión y repetición de acciones, incluyendo mensajes privados y cambios de campaña.
5. Capturar pantallas reales de esos recorridos, sin información privada ni tokens.
6. Revisar licencias de los recursos antes de redistribuirlos y completar QA visual de los flujos modificados.

Los tests y la documentación hacen el código más evaluable. No equivalen a aceptación del producto ni a una auditoría completa de seguridad.
