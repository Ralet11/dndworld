---
name: weekend-mvp-direction
description: Dirección del MVP del fin de semana para DnD World (rumbo, nav, diseño Ember, scope)
metadata:
  type: project
---

A partir de 2026-06-10, el foco NO es el reset desde cero ni el chat. Se trabaja **sobre la
app mobile actual** para tener una versión usable y visualmente unificada para el fin de
semana (~13-14 jun 2026), centrada en la **experiencia del jugador**.

Decisiones fijadas:
- **Dirección visual: "Ember / Campfire"** — base carbón/teal oscuro, acento ámbar-fuego,
  marcos de bronce, texto pergamino, glows por rareza. Fuente única de verdad:
  `mobile/constants/Theme.ts` (tokens COLORS/RARITY/SPACING/RADIUS/TYPO/GLOWS). Regla: sin
  hex sueltos en pantallas. Referencia: inventario de RPG móvil premium (figura central +
  slots).
- **Nueva nav inferior (jugador):** Chronicles (en construcción) · My Hero (rediseño, equipo
  con figura de cuerpo entero + slots) · Lore (selector Mapa | Glosario/Bestiario tipo
  Pokédex, funcional, filtrado por conocimiento del grupo) · Campfire (perfil-campamento).
- **Chat (Chronicle) fuera de scope** por ahora: es lo más importante pero lo más denso.
- **La corona del DM y el "cambiar de héroe" son dev tools** (atajos del dev), no features;
  ocultar en producción. El rol real debe venir del usuario autenticado.
- **Hero/Equipo necesita arte de cuerpo entero por PJ** (lo provee el usuario); mientras
  tanto, silueta estilizada de fallback.

Detalle completo en [[../VISION.md]] §12. Deuda técnica a no arrastrar (sockets sin auth,
rol como toggle, sync alter, etc.) sigue vigente para el reset posterior.
