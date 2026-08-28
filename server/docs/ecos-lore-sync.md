# Sincronizacion de lore desde Ecos

`ecos_de_la_guerra` es la fuente editorial. D&D World conserva una copia versionada y determinista para que Oracle pueda consumirla en produccion.

## Flujo normal

Desde la raiz de `dndworld`:

```powershell
npm --prefix server run lore:sync -- ../ecos_de_la_guerra
npm --prefix server run lore:sync -- ../ecos_de_la_guerra --apply
git diff -- server/data/lore
```

El primer comando es siempre una vista previa. `--apply` se niega a trabajar si Ecos tiene cambios sin commit. `--allow-dirty` existe para una recuperacion deliberada, no para el flujo normal. `--check` permite verificar en CI si falta sincronizar.

Despues de revisar el diff, se hace commit y push **en D&D World**. Produccion no necesita ni debe clonar Ecos: recibe el snapshot junto con el backend.

## Alcance

Se incluyen solamente:

- `campaign/maestro.md`, `campaign/chronology.txt` y el resumen de campana;
- texto Markdown/TXT de `sessions`, `characters`, `npcs` y `cities`;
- imagenes dentro de `campaign/` referenciadas expresamente por esos textos.

Se excluyen ZIP, DOCX, carpetas historicas, imagenes sueltas y cualquier archivo ajeno a `campaign/`. Los enlaces HTTP permanecen como enlaces.

El espejo queda en `server/data/lore/ecos/`, su inventario en `server/data/lore/ecos-sync-manifest.json` y el contexto compacto que ya consume Oracle en `server/data/lore/campaign-context.md`.

Este proceso no modifica PostgreSQL, S3, NPC, POI, fichas ni reglas de combate. Esos cambios requieren importadores estructurados y revision explicita por separado.
