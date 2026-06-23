---
name: web-rebuild-2026-06
description: Reconstrucción completa del cliente web para que coincida con la app mobile — estructura, rutas, componentes y DM tools
metadata:
  type: project
---

La web fue reconstruida de 0 en junio 2026 para coincidir con la app mobile (React Native/Expo).

**Por qué:** La web y la app mobile eran completamente distintas — la web tenía 3 páginas monolíticas (LoginPage, PlayerBoard, DMAdmin), mientras la mobile tenía una arquitectura limpia con tabs. El usuario pidió igualarlas.

**Estructura nueva del cliente (`client/src/`):**
- `context/` — AuthContext (JWT + localStorage), SocketContext (socket.io singleton)
- `pages/` — LoginPage, RegisterPage (diseño idéntico al login mobile, ember/bronze)
- `layouts/` — PlayerLayout (tab bar inferior: Chronicles/Hero/Lore/Campfire), DmLayout (sidebar con herramientas)
- `tabs/` — Chronicles, HeroTab, LoreTab, CampfireTab
- `components/Chronicle/` — SceneList, SceneChat, CreateSceneModal
- `components/Hero/` — CharacterSheet (stats, inventario, misiones, mapa)
- `components/Lore/` — MapView, BestiaryView, QuestsView
- `components/UI/` — NotificationBanner
- `dm/` — PartyPanel, ScenesPanel (escenas + viñetas DM), ItemsPanel, QuestsPanel, NpcsPanel, MediaPanel

**Rutas:**
- `/login`, `/register` — auth
- `/*` (player) — tab bar con 4 tabs
- `/dm/*` (DM/ADMIN) — sidebar DM con herramientas

**Lo que se conservó del DMAdmin.jsx original:** La funcionalidad fue extraída y reorganizada en los paneles `dm/`. El archivo original sigue en `pages/` pero ya no es importado.

**Tema visual:** Idéntico al mobile — ember (FF7A1A), amber (F59E0B), bronze (8A6A3B/C8A36A), background #0F1518, surface #16211F.

**How to apply:** Al trabajar en la web, la fuente de verdad de estilos es `src/index.css` (clases `.panel`, `.panel-raised`, `.input-base`, `.label-caps`, `.tab-bar`, `.glow-ember`) y `tailwind.config.js`. Los archivos legacy `PlayerBoard.jsx` y `DMAdmin.jsx` están obsoletos.
