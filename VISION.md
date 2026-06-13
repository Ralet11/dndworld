# DnD World — Documento de Visión

> Destilado de la versión actual para reconstruir desde cero sin perder la esencia.
> No describe *cómo está hecho* (eso lo reseteamos), sino **qué quisimos lograr**.

---

## 1. La visión en una frase

Una **app-compañera en tiempo real para jugar mesas de D&D 5e**, donde el Dungeon Master
narra y arbitra desde su teléfono y los jugadores viven la aventura desde el suyo: hoja de
personaje viva, chat narrativo por escenas, mapa del mundo con secretos, y todo el estado
del juego compartido y sincronizado al instante.

No es una hoja de personaje digital. No es un VTT (mesa virtual con grilla). Es algo más
íntimo: **el "teatro de la mente" llevado al celular**, con el DM como director de orquesta.

---

## 2. El concepto central

- **Un mundo, muchos teléfonos.** Existe un único estado de mundo (personajes, escenas,
  mapa, tiempo, misiones) que todos comparten. Lo que el DM cambia, los jugadores lo ven
  en vivo. Lo que un jugador hace, repercute en la mesa.
- **El DM es el filtro.** Las acciones importantes de los jugadores no "suceden" solas:
  se **proponen** y el DM las **aprueba, rechaza o pide una tirada**. El juego respeta la
  autoridad narrativa del Director.
- **Mediado, no automático.** A diferencia de un videojuego, las reglas asisten pero no
  imponen. El DM puede sobreescribir, narrar, dar items, mover el tiempo, revelar lore.
- **Mobile-first, atmósfera ante todo.** Oscuro, ritual, inmersivo. La interfaz se siente
  como un grimorio mágico, no como una planilla.

---

## 3. Los dos roles y sus mundos

La misma app se transforma según quién la use. La navegación inferior **cambia de pestañas
y de color de acento** según el rol.

| | **Jugador** (acento azul `#38bdf8`) | **Dungeon Master** (acento púrpura `#A855F7`) |
|---|---|---|
| Identidad | Encarna **un** héroe | Orquesta **todo** el mundo |
| Pestañas | Chronicle · Hero · Atlas · Campfire | Chronicle · Party · Cast · Atlas · Session |
| Foco | Su hoja, sus tiradas, su inventario | Narración, NPCs, monitoreo, control del mundo |

> En el reset, el rol debe venir del **usuario autenticado** (rol real en el servidor),
> no de un toggle manual de UI. Hoy es un toggle — fue útil para prototipar, pero es la
> causa raíz de los problemas de seguridad.

---

## 4. El vocabulario temático (el alma del producto)

Los nombres **no son decorativos**: definen el tono. Hay que preservarlos.

- **Chronicle** (Crónica) — el feed/chat narrativo. La pantalla central. Una lista de
  **Escenas**; al entrar a una, es un chat inmersivo con fondo ilustrado.
- **Hero** (Héroe) — la hoja de personaje del jugador.
- **Atlas** — el mapa interactivo del mundo con Puntos de Interés.
- **Campfire** (Campamento) — el "hogar" del jugador: descanso, perfil, cerrar sesión.
- **Grimoire** (Grimorio) — el compendio de hechizos/conocimiento.
- **Party** — el monitor del grupo (vista DM de todos los jugadores).
- **Cast / Bestiary** — el elenco de NPCs y criaturas del DM.
- **Session** — el panel de control de la sesión (tiempo, clocks, ritmo).
- **The Oracle** (El Oráculo) — el narrador asistido por IA del DM.
- **Master Deck / Input Deck** — las "barras de acción" contextuales del DM y del jugador.
- **Dungeon Master / Crown (👑)** — la autoridad narrativa, marcada con corona.

---

## 5. Los pilares funcionales

### 5.1 Chronicle — Escenas + Chat narrativo (EL CORAZÓN)

Lo más desarrollado y lo más importante. Es donde se *juega*.

**Estructura:** la Crónica es una lista de **Escenas** (título, descripción, imagen de
fondo, estado ACTIVE/FINISHED/ARCHIVED, participantes). El DM las crea y elige qué
personajes participan. Al tocar una escena, se abre el **chat de esa escena**.

**El chat tiene "modos de mensaje" (verbos de juego):**

Jugador (*Input Deck*):
- **Say** 💬 — hablar en voz alta (diálogo normal).
- **Think** ☁️ — pensamiento privado (solo lo ve quien lo escribe y el DM).
- **Do** ⚔️ — **declarar una acción**. Esto NO se resuelve solo: queda `PENDING` y
  espera al DM. Mientras hay un Do pendiente, el jugador no puede mandar otro (se bloquea).

DM (*Master Deck*):
- **Narrate** 📜 — describir lo que sucede (mensaje de sistema, estilo "voz del mundo").
- **NPC** 💀 — hablar como un personaje no jugador.
- **Oracle AI** ✨ — pedirle a la IA que genere una narración inmersiva a partir de una
  idea breve (*"entran a una taberna oscura y llena de humo…"*).

**El flujo de resolución de acciones (la mecánica clave):**

```
Jugador: [DO] "Intento saltar el abismo"   → estado PENDING
   │
DM ve la acción con botones:  ✓ Aprobar   ✗ Rechazar   🎲 Pedir tirada
   │
   ├─ Aprobar  → la acción ocurre, el DM narra la consecuencia
   ├─ Rechazar → la acción se deniega
   └─ Pedir tirada → elige tipo (CA/salvación/habilidad) y ventaja/desventaja
          │
       Jugador recibe la solicitud → abre el Dado → tira (animado)
          │
       Resultado (total + dado natural) vuelve al chat para que el DM narre
```

**Otras capacidades del chat ya pensadas:**
- **Responder/citar** mensajes (reply con banner de contexto coloreado por personaje).
- **Imágenes** en mensajes (el DM puede mostrar una ilustración de escena).
- **Solicitud de consumo de item:** el jugador pide usar una poción → es una acción `DO`
  que el DM aprueba → el servidor descuenta el item y aplica la curación.
- **Silenciar la sala** (el DM congela el input de los jugadores).
- **Indicadores de "escribiendo…"** ("El DM está reescribiendo el destino…").
- **Día/Noche y ubicación global** en el header (sol/luna según la hora del mundo).
- **Gestión de participantes** de la escena (buscar, agregar, quitar personajes).

### 5.2 Hero — La hoja de personaje viva

El jugador primero **elige/reclama un héroe** de una lista de personajes disponibles
(creados por el DM). Una vez reclamado, ve su hoja completa, organizada en pestañas:

- **Principal:** vitales (CA, Iniciativa, Velocidad, Bono de Competencia), los seis
  atributos en **hexágonos** (FUE/DES/CON/INT/SAB/CAR con su modificador), y la lista de
  **habilidades** con competencias marcables.
- **Equipo:** inventario + **paper-doll** de equipamiento (casco, pecho, hombros, botas,
  pantalón, guantes, 2 anillos, arma principal/secundaria). Equipar/desequipar, ver detalle
  de items, ataques derivados de armas equipadas.
- **Rasgos:** features de raza/clase/arquetipo + texto libre editable de habilidades.
- **Hechizos:** espacios de conjuro por nivel, hechizos conocidos y preparados, explorables.

La hoja es **reactiva**: si el DM cambia el HP, da un item, o el jugador equipa algo, el
**StatEngine** recalcula y todos lo ven.

### 5.3 Atlas — El mapa del mundo con secretos por capas

Mapa interactivo (imagen) con **Puntos de Interés** (ciudades, lugares) posicionados.
La **posición del grupo** se marca y se mueve en vivo. Lo distintivo es el **lore por capas
de conocimiento**:

- **Descripción global** — visible para todos.
- **Conocimiento del grupo** (`partyKnowledge`) — lo que la party ya descubrió.
- **Nota personal del jugador** (`userNotes`) — su propio cuaderno de viaje.
- **Conocimiento especializado** (`specializedKnowledge`) — secreto que el DM le da a UN
  personaje en particular (ej: el erudito sabe algo que los demás no).
- **Descripción secreta del DM** (`dmDescription`) — solo para el Director.

Esta idea de "cada quien sabe cosas distintas del mismo lugar" es una seña de identidad.

### 5.4 Campfire (jugador) / Session (DM)

- **Campfire:** el espacio de descanso del jugador — perfil, descanso, cerrar sesión. Tono
  cálido, hoguera.
- **Session:** el centro de mando del DM para el ritmo de la partida — tiempo global,
  **Clocks** (relojes de progreso estilo Blades in the Dark: segmentos que se llenan hacia
  una consecuencia), control de la sesión.

### 5.5 Herramientas del DM (transversales)

- **Party Monitor:** ver stats de todos los jugadores en vivo.
- **Cast / NPCs:** crear NPCs/criaturas, activarlos como aliados temporales del grupo,
  editar su HP en combate.
- **Quests:** crear y asignar misiones (individuales o a toda la party) con objetivos
  marcables y recompensas; los jugadores reciben notificación y siguen su progreso.
- **Items:** repartir objetos a personajes.
- **Mundo:** mover el tiempo y la ubicación globales; compartir imágenes a toda la mesa.

---

## 6. El motor de reglas (D&D 5e)

Un **StatEngine** centraliza el cálculo para que la hoja sea consistente:

- Modificador = `floor((puntuación − 10) / 2)`.
- Bono de competencia por nivel.
- CA = base + mod DES + bonos de equipo + efectos de estado.
- Salvaciones, habilidades (18 habilidades en español), percepción pasiva.
- Sistema de magia: espacios por nivel, conocidos/preparados.
- Efectos de estado (buffs/debuffs) que modifican stats temporalmente.

> En el reset: las competencias de salvación/clase deben venir de **datos** (tablas de
> clase), no de `if (clase === 'Ranger')` hardcodeado. Y unificar idioma (todo en español
> o todo con claves neutrales + i18n).

---

## 7. El modelo de datos (entidades del dominio)

- **User** — cuenta (username, email, rol PLAYER/DM/ADMIN).
- **Character** — héroe o NPC. Reclamable por un User. Stats base, HP, CA, nivel, imagen,
  magia. Vinculado a Class/Race por slug.
- **AbilityScore** — las 6 puntuaciones de un personaje (base + bonus).
- **Skill** — competencia de un personaje en una habilidad.
- **Item** + **EquipmentSlots** + inventario (N:M) — objetos, equipamiento por slot,
  bonos de stats y efectos de uso.
- **Spell** — compendio de hechizos 5e (por clase, nivel, escuela…).
- **Class** / **Race** — datos de reglas (dados de golpe, competencias, rasgos, arquetipos).
- **Quest** — misiones con objetivos (JSON) y recompensas, asignadas a personajes.
- **Scene** — unidad narrativa con participantes (N:M) e imagen de fondo.
- **TimelineEvent** — cada mensaje/evento del chat (tipo CHAT/SYSTEM/SCENE/ACTION, metadata
  flexible: modo, tirada, imagen, reply, status, itemRequest…).
- **PointOfInterest** + **UserPoiData** — lugares del mapa y el lore por-usuario (las capas
  de conocimiento de §5.3).
- **MapState** — estado global singleton: posición del grupo, hora y ubicación del mundo.
- **Clock** — relojes de progreso del DM (segmentos / consecuencia).
- **Faction** — facciones con influencia y postura (aliada/neutral/hostil).
- **StatusEffect** — efectos temporales que modifican stats.
- **Media** — imágenes compartidas a la mesa.

---

## 8. La identidad visual

- **Dark fantasy.** Fondos casi negros azulados ("night blue" `#0B0F19` / `#0E0B14`).
- **Glassmorphism:** paneles con blur, bordes sutiles translúcidos, tarjetas flotantes.
- **Acentos por rol:** azul para jugador, **púrpura para el DM**; **oro** (`#C9A24D`) para
  lo heroico/legendario; rojo crítico, verde éxito.
- **Iconografía** (lucide): pergamino, espada, calavera, llama, corona, dados, frasco,
  chispa (IA). Cada concepto tiene su símbolo.
- **Microcopys con tono ritual:** *"El DM está reescribiendo el destino…"*,
  *"Las energías arcanas vibran…"*, *"Los aliados regresan al campamento."*
- **Tacto:** animaciones de presión (PressableScale), haptics, dados animados.

---

## 9. La arquitectura conceptual (qué conservar, no cómo)

- **Tres superficies:** servidor (cerebro + estado), app mobile (la experiencia principal),
  y un panel web (originalmente la mesa del DM en pantalla grande).
- **Tiempo real:** el estado del mundo se sincroniza por sockets; las mutaciones se emiten
  a todos.
- **Una base de datos = un mundo.** Estado autoritativo en el servidor; los clientes son
  vistas reactivas.

> En el reset hay que decidir conscientemente: **toda mutación pasa por una capa con
> identidad y permisos** (el jugador X solo mueve a su personaje; solo el DM narra, reparte
> items, mueve el tiempo). Hoy las mutaciones van por sockets sin autenticación — esa es la
> deuda número uno a no repetir.

---

## 10. Estado actual: qué está vivo y qué es esqueleto

**Vivo y profundo:**
- Chronicle: escenas + chat con modos, aprobación de acciones, tiradas, items, Oráculo
  (stub), silencio, typing, día/noche, participantes.
- Hero: hoja completa con pestañas, atributos, habilidades, inventario/equipo, rasgos,
  hechizos.
- Atlas: mapa interactivo con POIs y lore por capas.
- Servidor: modelo de datos completo, StatEngine, todas las mutaciones por socket.

**Esqueleto / pendiente (pantallas "Coming Soon"):**
- **Party** (monitor DM), **Cast/Bestiary** (NPCs), **Session** (control DM), **Grimoire**
  (compendio) — existen como tabs pero casi vacías en mobile. Su lógica vive a medias en el
  panel web y en eventos de socket ya implementados.
- **Oracle AI:** la arquitectura está; falta conectar un modelo real (hoy responde un texto
  simulado).

**Deuda a no arrastrar al reset:**
1. Sockets sin autenticación ni autorización (riesgo crítico).
2. Rol DM como toggle de cliente en vez de permiso de servidor.
3. `JWT_SECRET` con fallback hardcodeado; endpoints de mapa/upload sin auth.
4. `sequelize.sync({ alter: true })` en cada arranque en vez de migraciones.
5. Monolito de ~1000 líneas en el index del servidor.
6. URL de API hardcodeada a una IP de LAN (sin config por entorno).
7. Bug de equipamiento (`${slot} _id` con espacio) y `silencedScenes` con scope erróneo.
8. Datos de reglas hardcodeados (competencias por `if clase === ...`) y mezcla de idiomas.

---

## 11. La esencia, en un párrafo (lo que DEBE sobrevivir)

> **DnD World es una mesa de rol que vive en el bolsillo.** El DM dirige y narra desde su
> teléfono; cada jugador encarna un héroe en el suyo. El alma está en la **Crónica**: un
> chat por escenas donde los jugadores *dicen, piensan y declaran acciones*, y el DM las
> *aprueba, rechaza o convierte en una tirada de dados*, manteniendo siempre la autoridad
> narrativa. Alrededor de ese corazón orbitan una **hoja de personaje viva**, un **Atlas**
> donde cada quien conoce secretos distintos del mismo mundo, y las **herramientas del DM**
> para tejer misiones, NPCs, tiempo y destino. Todo en tiempo real, todo compartido, con una
> estética de **grimorio oscuro**: oro heroico, púrpura del Director, azul del aventurero.
> Reglas de D&D 5e que **asisten sin imponer**. El objetivo no es simular un videojuego:
> es **amplificar la imaginación de una mesa de amigos**.

---

*¿Reconstruir desde cero conservando todo esto? Sí, se puede — y conviene. La visión está
clara y es buena; lo que falla es la base técnica, no la idea.*

---

## 12. Addendum — Dirección del MVP del fin de semana (2026-06-10)

Decisiones que **ajustan el rumbo** para tener una versión usable y bella para el finde.
Trabajamos **sobre la app actual** (no reset desde cero todavía); el foco es la
**experiencia del jugador**, no el chat.

### Aclaraciones
- **La corona del DM y el "cambiar de héroe" son herramientas de desarrollo** (atajos para
  alternar modo/PJ rápido mientras construyo). No son features del producto → se ocultan en
  producción. El rol real debe venir del usuario autenticado.
- **El Chat (Chronicle) queda fuera de scope por ahora.** Es lo más importante pero lo más
  denso; lo retomamos después. Esta semana: PJ, habilidades, equipo, consumibles,
  conocimiento de NPCs y mapa.
- **Problema a resolver:** cada sección se siente distinta. La solución es un **sistema de
  diseño único** (tokens + componentes) aplicado parejo a todas las pantallas.

### Dirección visual elegida → "Ember / Campfire"
Referencia: pantalla de inventario de RPG móvil premium (figura central + slots, glows por
rareza, marcos de bronce, atmósfera cálida de fuego).
- **Base:** carbón/teal oscuro (`#0F1518` / `#16211F`).
- **Acento:** ámbar-fuego (`#F59E0B` / `#FF7A1A`).
- **Marcos:** bronce (`#8A6A3B`).
- **Texto:** pergamino cálido (`#EDE6D8`).
- **Rareza:** común gris · poco común verde · raro azul · muy raro morado · legendario ámbar.
- Fuente única de verdad: `mobile/constants/Theme.ts` (tokens: colores, rareza, espaciado,
  radios, tipografía, glows). Nada de hex sueltos en pantallas.

### Navegación inferior (jugador) — nueva estructura
1. **Chronicles** — pantalla "En construcción" (placeholder con estilo Ember).
2. **My Hero** — rediseño profundo. Pantalla estrella. Equipo con **figura de cuerpo entero
   centrada + slots alrededor** estilo referencia. (Necesita arte de cuerpo entero por PJ;
   mientras tanto, silueta estilizada de fallback.)
3. **Lore** (antes Map) — al entrar, elegís **Mapa** o **Glosario tipo Pokédex** de
   NPCs/criaturas conocidas (funcional, filtrado por conocimiento del grupo).
4. **Campfire** — el perfil, transformado en campamento.

### Pendiente del usuario
- Proveer/generar **arte de cuerpo entero** por personaje para la pantalla de Equipo.
