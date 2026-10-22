# Arquitectura y decisiones

## Flujo principal

La web React usa endpoints Express para autenticación y operaciones HTTP. Socket.IO mantiene la interacción de la mesa. Los modelos Sequelize representan usuarios, campañas, membresías, personajes y sesiones en PostgreSQL. Los servicios encapsulan reglas reutilizables; los handlers coordinan acceso, persistencia y eventos.

- `server/services/campaignAccess.js`: autorización por campaña.
- `server/services/gameCombat.js` y `gameInitiative.js`: cálculo y validación de reglas.
- `server/sockets/gameSessionSocket.js`: sesiones y eventos de juego.
- `server/utils/s3Storage.js`: almacenamiento opcional de medios.
- `server/services/loreSync.js`: planificación y aplicación del snapshot de lore.
- `client/src/context/`: autenticación, campaña activa y socket.

## Decisiones visibles en el código

- Separar las reglas de combate permite probarlas sin iniciar el servidor ni una base real.
- La membresía de campaña permite delimitar permisos; su existencia no demuestra por sí sola cobertura completa de todos los endpoints y eventos.
- Los recursos multimedia se delegan a S3 en lugar de guardarlos en la base de datos.
- El lore se consume como snapshot versionado; no requiere publicar un repositorio editorial completo.
- La sincronización de esquema pasa a ser explícita y local. Los despliegues requieren migraciones revisadas, no `sync({ alter: true })` automático.

## Límites conocidos

El servidor y los handlers de sockets concentran múltiples responsabilidades. Separar comandos, validadores y políticas de autorización es una mejora incremental, no un requisito que se afirme resuelto en esta preparación. La consistencia ante reconexiones y acciones concurrentes necesita pruebas de integración dedicadas.

Las integraciones de IA y medios requieren cuentas externas. No se han ejecutado llamadas de pago ni cambios en infraestructura para preparar este repositorio.
