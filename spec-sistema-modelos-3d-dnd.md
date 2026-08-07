# Spec técnico: Sistema de modelos 3D (personajes, ítems, NPCs) para app de D&D

## 1. Resumen ejecutivo

Queremos incorporar a la app de D&D un sistema que permita:

1. Generar modelos 3D procedurales (Three.js) de personajes, NPCs e ítems a partir de una imagen de referencia, usando la skill **img2threejs** (https://github.com/img2threejs/img2threejs) corriendo en Claude Code.
2. Definir puntos de acople ("sockets") en cada modelo de personaje/NPC (mano, antebrazo, espalda, etc.).
3. Permitir que, en tiempo de ejecución (dentro de la app, sin IA de por medio), un ítem generado se "equipe" visualmente sobre un personaje, apareciendo en el socket correcto y con la escala/rotación correctas.
4. Soportar dos (o más) perfiles de presentación por ítem: `standalone` (vitrina/inventario) y `equipped` (puesto sobre el personaje).

Este documento separa claramente **qué se genera con IA (offline, una sola vez por asset)** de **qué corre en runtime dentro de la app (instantáneo, sin costo de IA)**.

---

## 2. Arquitectura general

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  FASE 1: Generación de assets │        │  FASE 2: Runtime en la app   │
│  (offline, con IA)            │        │  (sin IA, instantáneo)        │
│                                │        │                                │
│  Imagen → img2threejs (skill) │  ───▶  │  Catálogo de modelos (.ts)     │
│  → createXModel() + sockets   │        │  + tabla de escalas/rotación   │
│                                │        │  → equipar/desequipar en vivo  │
└─────────────────────────────┘        └──────────────────────────────┘
```

### Fase 1 — Generación (con la skill, offline)

- Se usa la skill `img2threejs` dentro de Claude Code.
- Instalación:
  ```
  git clone https://github.com/img2threejs/img2threejs.git ~/.claude/skills/img2threejs
  ```
- Invocación:
  ```
  /img2threejs Rebuild this [personaje|NPC|item] as a Three.js model, keep the proportions, angles, and colours.
  ```
- Salida por cada asset:
  - Un archivo TypeScript con una función factory, ej. `createGoblinModel(spec, options): THREE.Group`.
  - Un `ObjectSculptSpec` (JSON) con el árbol de componentes, materiales, sockets y sistema de repetición.
  - `root.userData.sculptRuntime` expone: nodos, **sockets**, colliders, y grupos de destrucción.

**Importante:** este pipeline NO corre en producción ni en el momento en que un jugador usa la app. Es una herramienta de autoría de contenido (la corremos nosotros / el equipo, o eventualmente un flujo admin, para poblar el catálogo).

### Fase 2 — Runtime en la app (sin IA)

Una vez que los modelos ya existen como archivos generados, todo lo que pasa cuando un jugador "equipa" algo es lógica normal de Three.js: nada de generación, nada de IA, nada de latencia de red hacia un modelo.

---

## 3. Sistema de sockets

Cada modelo de personaje/NPC generado por la skill viene con sockets nombrados y ubicados en coordenadas locales dentro de su pivote correspondiente (ej. la mano). Estos son `Object3D` vacíos pensados para "colgar" cosas ahí.

Acceso:
```javascript
const socket = personaje.userData.sculptRuntime.sockets["grip_right_hand"];
```

**Tarea para el agente:** al generar cada personaje/NPC con la skill, verificar en el `ObjectSculptSpec` resultante qué nombres de sockets efectivamente se crearon (no hay una lista fija estándar — depende de cómo la skill interpretó la imagen). Documentar esos nombres en el catálogo (ver sección 5).

---

## 4. Sistema de equipamiento (runtime)

### 4.1 Función core

```javascript
function equiparItem(personaje, itemFactory, itemId, modo = "equipped") {
  const item = itemFactory();
  const config = ITEM_DISPLAY[itemId][modo];

  item.scale.setScalar(config.scale);
  if (config.rotation) item.rotation.set(...config.rotation);

  if (modo === "equipped") {
    const socket = personaje.userData.sculptRuntime.sockets[config.socket];
    socket.clear(); // saca lo que hubiera antes en ese socket
    socket.add(item);
  }

  return item;
}
```

Al ser hijo del socket, el ítem hereda automáticamente posición y rotación del padre — no hace falta calcular offsets manualmente.

### 4.2 Desequipar

```javascript
function desequiparSocket(personaje, socketName) {
  personaje.userData.sculptRuntime.sockets[socketName].clear();
}
```

---

## 5. Catálogo de escalas por ítem (perfiles de presentación)

Problema a resolver: cada modelo se genera de una imagen distinta, sin unidad de medida compartida entre sí. Por eso cada ítem necesita, **una sola vez**, dos (o más) perfiles calibrados:

```javascript
const ITEM_DISPLAY = {
  espada_flamigera: {
    standalone: { scale: 1.0, rotation: [0, 0, 0] },              // vitrina / inventario
    equipped:   { scale: 0.9, rotation: [Math.PI / 2, 0, 0], socket: "grip_right_hand" },
  },
  pocion_curacion: {
    standalone: { scale: 1.0, rotation: [0, 0, 0] },
    equipped:   { scale: 0.15, rotation: [0, 0, 0], socket: "grip_left_hand" },
  },
  escudo_torre: {
    standalone: { scale: 1.0, rotation: [0, 0, 0] },
    equipped:   { scale: 0.6, rotation: [0, 0, 0], socket: "grip_left_forearm" },
  },
};
```

**Cómo calibrar cada entrada (proceso, no automático):**
1. Generar el ítem con la skill.
2. Calcular su bounding box: `new THREE.Box3().setFromObject(modelo)`.
3. Probarlo en el socket del personaje de referencia, ajustar `scale` y `rotation` a mano hasta que se vea proporcionado.
4. Guardar esos valores en `ITEM_DISPLAY` — de ahí en más, equipar ese ítem a cualquier personaje usa esos mismos valores automáticamente.

Este catálogo se puede extender con más modos si hace falta (ej. `"thumbnail"` para íconos de UI).

---

## 6. Tareas para el agente (orden sugerido de implementación)

1. **Instalar la skill `img2threejs`** en el entorno de desarrollo (`~/.claude/skills/img2threejs`).
2. **Generar un personaje de referencia** (ej. un guerrero genérico) y un par de ítems de prueba (espada, poción) para validar el flujo end-to-end.
3. **Inspeccionar el `ObjectSculptSpec`** de cada uno y documentar los nombres de sockets reales que aparecieron.
4. **Implementar `equiparItem` / `desequiparSocket`** como funciones reutilizables en el motor de la app (no específicas de una escena particular).
5. **Armar la estructura `ITEM_DISPLAY`** con al menos los ítems de prueba, calibrando escala y rotación a mano.
6. **Conectar con la UI de inventario**: al clickear "equipar", llamar a `equiparItem(personajeActivo, ITEM_FACTORIES[itemId], itemId, "equipped")`.
7. **(Opcional, fase posterior)** Evaluar un flujo admin dentro de la app para disparar la generación de nuevos assets sin pasar por la terminal — esto sí requeriría orquestar la skill vía API con visión, un render headless, y manejo de reintentos; no es parte del alcance inicial.

---

## 7. Fuera de alcance (por ahora)

- Generación de modelos 3D **en vivo** a partir de una foto que sube un jugador dentro de la app (requiere replicar el loop de generación-revisión de la skill fuera de Claude Code — trabajo de ingeniería considerable, no es el punto de partida).
- Animación/rigging avanzado de los ítems equipados (ej. que la espada se doble según la pose) — está en el roadmap de la skill como v1.4, todavía no lanzado.
- Sistema de colliders/destrucción de ítems — la skill ya expone esos datos en el spec, pero no es parte de este primer alcance.

---

## 8. Referencias

- Repo de la skill: https://github.com/img2threejs/img2threejs
- Documentación interna relevante dentro del repo: `grimoire/readiness/action_rigging.md` (reglas de pivotes, sockets y colliders).
