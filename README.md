# D&D World

Plataforma full stack para dirigir y jugar campañas de rol: un espacio compartido para el director de juego y sus jugadores, con personajes, mapas, escenas y combate sincronizado en tiempo real.

El repositorio muestra la implementación web y backend de un producto en evolución. No se presenta como una plataforma auditada ni como una demo pública con disponibilidad garantizada.

## Qué permite explorar

- **Campañas y personajes:** acceso por membresía, fichas, inventario, equipamiento y registro de cambios.
- **Mesa en tiempo real:** sesiones, presencia, mapas, tokens, tiradas y mensajes entre jugador y director de juego mediante Socket.IO.
- **Combate:** iniciativa, turnos, acciones, alcance, daño, curación y reglas personalizadas de campaña.
- **Narrativa:** escenas, misiones, cronología, lore y recursos multimedia.
- **Integraciones opcionales:** almacenamiento S3, generación de imágenes y asistente para el director de juego mediante OpenAI. Requieren configuración y pueden generar costos; no son necesarias para ejecutar los tests unitarios.

## Stack y organización

| Capa | Tecnologías | Código |
| --- | --- | --- |
| Web | React 19, Vite, Tailwind CSS, React Router, Leaflet | [`client/`](client/) |
| API y tiempo real | Node.js, Express 5, Socket.IO, JWT | [`server/`](server/) |
| Persistencia | PostgreSQL, Sequelize | [`server/models/`](server/models/) |
| Reglas y permisos | Servicios de dominio y controles de campaña | [`server/services/`](server/services/) |
| Pruebas | Node.js test runner | [`server/tests/`](server/tests/) |

También hay un cliente Expo en `mobile/` y experimentos históricos en `archive-3d-pipeline/`. No forman parte de la validación web/backend descrita aquí.

## Recorrido técnico recomendado

1. [`campaignAccess.js`](server/services/campaignAccess.js): membresías y permisos por campaña.
2. [`gameCombat.js`](server/services/gameCombat.js) y [`gameInitiative.js`](server/services/gameInitiative.js): reglas separadas del transporte HTTP/socket.
3. [`gameSessionSocket.js`](server/sockets/gameSessionSocket.js): coordinación del estado de la mesa y eventos en tiempo real.
4. [`GameMasterPanel.jsx`](client/src/dm/GameMasterPanel.jsx) y [`PlayerBoard.jsx`](client/src/pages/PlayerBoard.jsx): perspectivas del director y del jugador.
5. [`server/tests/`](server/tests/): casos concretos de combate, visibilidad de mensajes, recursos y sincronización de lore.

Consulta [arquitectura y decisiones](docs/architecture.md) y el [estado de verificación](docs/verification.md) para entender alcance y límites.

## Requisitos

- Node.js 22.12 o superior y npm; los lockfiles están versionados.
- PostgreSQL local para ejecutar la aplicación completa. Los tests no requieren una base activa.
- Una base descartable y exclusiva para desarrollo. No uses credenciales, dumps ni servicios de producción.

## Instalación y comprobaciones sin servicios externos

Desde la raíz del repositorio:

```bash
npm --prefix server ci --ignore-scripts
npm --prefix client ci --ignore-scripts
npm --prefix server test
npm --prefix client test
npm --prefix client run lint
npm --prefix client run build
```

`npm test` ejecuta todos los archivos `server/tests/*.test.js`. Para revisar sólo combate: `npm --prefix server run test:combat`. El workflow de CI ejecuta tests del servidor y cliente, lint y compilación web, sin despliegues ni secretos de producción.

## Ejecución local

1. Crea una base PostgreSQL local vacía, por ejemplo `dndworld_demo`, con un usuario de desarrollo.
2. Copia `server/.env.example` a `server/.env` y configura las variables `DB_*` y un `JWT_SECRET` aleatorio. Nunca publiques ese archivo.
3. Sólo para inicializar el esquema local, cambia `DB_SYNC_MODE=alter`. El arranque por defecto (`none`) autentica la conexión sin sincronizar el esquema. Vuelve a `none` después de inicializarlo.
4. Inicia el backend desde `server/`, para que dotenv cargue su configuración:

```bash
cd server
npm run dev
```

5. En otra terminal, desde `client/`, ejecuta `npm run dev`. Vite muestra la URL local. El cliente usa `http://127.0.0.1:3001` en desarrollo; `client/.env.example` documenta cómo cambiarla.
6. El registro crea usuarios con rol `PLAYER`. Para mostrar una campaña completa hace falta preparar una cuenta de director, membresías y datos locales revisados. No se publica una contraseña compartida ni se ejecuta un seed automáticamente.

Una base recién creada no contiene campañas, escenas ni recursos de demostración. Esta guía permite iniciar la base de la aplicación, no promete una demo completa con un único comando. Para una presentación, sigue la [lista de verificación](docs/verification.md).

### Operaciones de datos

`seed`, `seed:reset`, scripts de importación y exportación no son pasos rutinarios de instalación. Pueden modificar datos existentes. Revisa cada script y el destino antes de usarlos, sólo con autorización expresa. `seed:reset` ya no añade `--force` automáticamente. La sincronización y los scripts de seed/reset se restringen a un host local fuera de `NODE_ENV=production`; esto es una barrera de seguridad, no sustituye backups ni revisión humana.

## Alcance y siguientes mejoras

- Los tests cubren reglas y funciones concretas, no sustituyen pruebas end-to-end de autenticación, permisos, concurrencia ni una auditoría de seguridad.
- El esquema requiere un proceso de migraciones versionadas antes de considerar nuevos despliegues; no se modifica automáticamente al iniciar en producción.
- Lint y pruebas unitarias pasan; los módulos de sockets de gran tamaño y la falta de pruebas end-to-end siguen siendo oportunidades de mejora.
- Para compartir imágenes o una demo, utiliza datos propios o autorizados. La presencia de material de rol o recursos de terceros no concede automáticamente una licencia de redistribución.
