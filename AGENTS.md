# D&D World — instrucciones para agentes

## Inicio obligatorio

Antes de analizar, modificar o desplegar el proyecto:

1. Lee completamente `.local-context/PROJECT_CONTEXT.md`.
2. Lee completamente `.local-context/CURRENT_STATE.md`.
3. Si la tarea incluye producción, despliegue, procesos o infraestructura, lee también `.local-context/OPERATIONS.md`.
4. Ejecuta `git status --short --branch` y preserva todos los cambios preexistentes del usuario.

Si `.local-context/` no existe, indícalo y reconstruye sólo la información necesaria mediante inspecciones de solo lectura. Nunca inventes rutas, procesos o credenciales.

## Alcance normal

- Cuando el usuario diga “el proyecto”, por defecto se refiere a `client/` (web) y `server/` (backend).
- No modificar `mobile/`, `archive-3d-pipeline/`, otros proyectos del EC2 ni infraestructura compartida salvo petición explícita.
- El usuario espera que los cambios de producto se validen, publiquen y desplieguen, a menos que indique lo contrario.
- Los cambios puramente locales de contexto operativo no se publican: `.local-context/` contiene información sensible del entorno y está ignorado por Git.

## Seguridad y convivencia

- Nunca leer, imprimir, copiar ni versionar valores de `.env`, claves privadas, tokens o credenciales.
- Puede documentarse el nombre de una variable o la ubicación local de una clave, pero nunca su contenido.
- En el EC2 sólo debe reiniciarse el proceso PM2 `dndworld` para tareas de este proyecto.
- No tocar Senda, Llevo, Oficios, PostgreSQL, reverse proxy ni otros servicios compartidos.
- Antes de un `git pull` remoto, verificar que el checkout de D&D World no tenga cambios inesperados.
- No ejecutar seeds, resets, migraciones destructivas ni restauraciones sin autorización explícita.

## Calidad y mantenimiento del contexto

- Para cambios del cliente: ejecutar al menos `npm run build` en `client/`; usar lint dirigido sobre los archivos modificados cuando el lint global tenga deuda previa.
- Para combate/backend: ejecutar `node --test tests/gameCombat.test.js` y `node --check` sobre los archivos de servidor modificados.
- Actualizar `.local-context/CURRENT_STATE.md` después de cambios sustanciales o despliegues.
- Actualizar `.local-context/OPERATIONS.md` cuando cambien host, rutas, dominios, puertos, procesos o procedimiento de despliegue.
- Actualizar `.local-context/PROJECT_CONTEXT.md` sólo cuando cambie la arquitectura estable o el alcance del producto.
- Mantener los documentos breves, concretos, fechados y libres de secretos.

## Sincronización del lore

- `ecos_de_la_guerra` es la fuente editorial; D&D World consume un snapshot versionado, no el repositorio completo.
- Antes de sincronizar, leer `server/docs/ecos-lore-sync.md` y confirmar que Ecos no tenga cambios sin commit.
- Ejecutar primero `npm --prefix server run lore:sync -- ../ecos_de_la_guerra` (vista previa) y luego repetir con `--apply`.
- Revisar y publicar los cambios generados en `server/data/lore/`; nunca sincronizar ZIP, DOCX, históricos o imágenes no referenciadas.
- La sincronización de lore no autoriza cambios automáticos en PostgreSQL, S3, fichas, POI ni mecánicas de combate.
