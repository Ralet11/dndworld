# DM AI Tooling Implementation

## Source Scope

This document is based on the current codebase and the stated product goal: a DM-facing AI assistant that can execute live session actions from text or voice without forcing the DM to leave the flow of play.

Relevant backend sources reviewed:

- `server/index.js`
- `server/models/Character.js`
- `server/models/Quest.js`
- `server/models/Scene.js`
- `server/models/TimelineEvent.js`
- `server/models/Item.js`
- `server/models/StatusEffect.js`
- `server/models/Clock.js`
- `server/models/Faction.js`
- `server/models/MapState.js`
- `server/models/PointOfInterest.js`
- `server/models/Media.js`
- `server/models/Spell.js`
- `server/routes/poiRoutes.js`
- `server/controllers/poiController.js`

Relevant UI sources reviewed:

- `client/src/layouts/DmLayout.jsx`
- `client/src/dm/PartyPanel.jsx`
- `client/src/dm/ScenesPanel.jsx`
- `client/src/dm/QuestsPanel.jsx`
- `client/src/dm/NpcsPanel.jsx`
- `client/src/dm/ItemsPanel.jsx`
- `client/src/dm/MediaPanel.jsx`
- `client/src/components/Chronicle/SceneChat.jsx`
- `mobile/app/(tabs)/_layout.tsx`
- `mobile/components/Chronicle/MasterDeck.tsx`
- `mobile/components/Chronicle/SceneChat.tsx`
- `mobile/components/Atlas/InteractiveMap.tsx`

Current backend primitives already available today:

- Character reads and recalculated party snapshots
- HP updates via `update-hp`
- XP awards via `award-xp`
- Full character updates via `update-character-full`
- Skill toggles via `toggle-skill-proficiency`
- Talent and feature choices via `choose-talent` and `choose-feature`
- Archetype selection via `update-character-archetype`
- Inventory assignment, equip, unequip, and consume
- Scene creation and participant updates
- Timeline reads plus generic chat writes via `chat-message` and `update-message`
- Global time/location updates via `get-global-state` and `update-global-state`
- Party map position updates via `update-position`
- Quest creation and quest progress updates
- NPC creation and ally toggling via `toggle-npc-active`
- POI CRUD and lore updates via REST
- Media sharing via `share-image` and `stop-sharing-image`
- Spell lookup and translation helpers

Known UI/backend contract gaps already visible:

- `client/src/dm/PartyPanel.jsx` emits `update-character-quick`, but `server/index.js` does not handle it
- `client/src/dm/ScenesPanel.jsx` emits `update-scene-status`, but `server/index.js` does not handle it
- `client/src/dm/ScenesPanel.jsx` and `client/src/components/Chronicle/SceneChat.jsx` emit `dm-send-message`, but `server/index.js` handles `chat-message`
- `client/src/components/Chronicle/SceneChat.jsx` emits `player-send-action`, but `server/index.js` does not handle it
- `client/src/dm/NpcsPanel.jsx` emits `activate-npc`, but `server/index.js` exposes `toggle-npc-active`
- `client/src/dm/QuestsPanel.jsx` emits `complete-objective`, but `server/index.js` exposes `update-quest-progress`

These gaps matter because the AI layer cannot be reliable if the human-facing DM tools are already pointing at dead or mismatched contracts.

## Current Scope and Assumptions

- The AI assistant is an operational DM copilot, not a freeform chatbot with direct database access.
- The assistant must translate natural language or speech into structured tool calls.
- The backend remains the only authority that mutates game state.
- All mutating tools are DM-only.
- All mutating tools must emit a human-readable result and a machine-readable audit record.
- Undo must exist for high-frequency session actions whenever feasible.
- Voice input is a transport layer over the same command executor used by text commands.
- The assistant must live inside a DM-facing panel with chat-style interaction, not only as invisible background tooling.
- The assistant must be accessible from both the web DM client and the mobile DM app.
- Web can ship first for sequencing reasons, but the panel contract and conversation model should be shared from day one.
- Socket.IO is the current command transport, but the AI should call internal server services rather than talking directly to raw socket handlers.
- Existing domain entities are enough for a strong v1, but true encounter tracking, initiative rounds, and command history will need new models or services.

Status labels used in the tool inventory:

- `exists`: already backed by a current handler or route
- `partial`: a close primitive exists, but the final tool contract, validation, or UX behavior is missing
- `new`: no current backend capability exists

## Implementation Tasks Ordered by Importance

### 1. Define the canonical command execution contract

- Introduce a single server-side command envelope for AI and manual DM actions.
- Why it matters: without one envelope, the AI layer will call a fragile mix of socket events and REST routes with inconsistent auth, validation, and response shapes.
- Primary owner: `server`

### 2. Fix current UI/backend contract drift before adding AI

- Align dead or mismatched DM UI events with backend handlers, or replace them with the new command endpoint.
- Why it matters: the AI assistant should not be built on top of already broken operator paths.
- Primary owner: `server` + `client`

### 3. Build entity resolution and alias matching

- Add a resolver layer that can map `Lucario`, `luca`, `el bardo`, or duplicated names to the right entity.
- Why it matters: name resolution is the first hard problem in live session automation, and every later tool depends on it.
- Primary owner: `server`

### 4. Add audit logging, preview mode, and undo primitives

- Every mutating tool should support dry-run summaries, durable logs, and explicit undo metadata when possible.
- Why it matters: live DM actions are fast and error-prone; rollback is a product requirement, not a nice-to-have.
- Primary owner: `server`

### 5. Ship the v1 live-session tool set

- Cover the actions that save the most table time: HP, temp HP, XP, gold, inspiration, conditions, notes, time, location, timeline posts, quest objective toggles, and NPC activation.
- Why it matters: this is the smallest slice that immediately changes the DM experience during play.
- Primary owner: `server` + `client`

### 6. Add a dedicated DM assistant panel in web and mobile

- Create a persistent assistant panel with chat history, command input, previews, confirmations, and result cards.
- Why it matters: the assistant should feel like an operational chat console for the DM, not a collection of disconnected quick actions.
- Primary owner: `client` + `mobile`

### 7. Add speech-to-text and voice command review flow

- Support push-to-talk, transcript preview, ambiguity handling, and explicit confirmation for risky actions.
- Why it matters: voice only helps if the system is fast and trustworthy under noisy table conditions.
- Primary owner: `client` + `server`

### 8. Expand into scene, world, inventory, and lore operations

- Once the base is stable, add scene control, media actions, POI edits, item grants, and richer narrative control.
- Why it matters: these are powerful DM workflows, but they should not arrive before the command foundation is reliable.
- Primary owner: `server` + `client`

### 9. Add encounter-grade combat tools and session memory

- Introduce initiative, turn order, combat rounds, and memory/recap actions only after the foundational command layer is mature.
- Why it matters: these features depend on stable identity, audit, and state mutation patterns.
- Primary owner: `server` + `client`

## Operational Delivery Blocks

### Block 1. Foundation and Contract Cleanup

Status:

- proposed

Tasks included:

- `1`
- `2`
- `3`

Scope:

- canonical command envelope
- entity resolution
- UI/backend event cleanup

Deliverable:

- one stable operator contract for human and AI commands

Why this block comes now:

- every later tool depends on consistent transport, validation, and entity lookup

### Block 2. Safety and Audit Layer

Status:

- proposed

Tasks included:

- `4`

Scope:

- audit log
- dry-run
- undo metadata
- confirmation tokens

Deliverable:

- safe mutation framework for live DM use

Why this block comes now:

- the assistant should not be allowed to mutate session state before rollback and review exist

### Block 3. V1 Live Session Tools

Status:

- proposed

Tasks included:

- `5`
- `6`

Scope:

- high-frequency session commands
- shared DM assistant panel and chat UX

Deliverable:

- text-driven DM copilot usable in actual play from web and with a defined mobile entry

Why this block comes now:

- it captures the highest-value time savings with the least new domain complexity

### Block 4. Voice and Extended Domain Coverage

Status:

- proposed

Tasks included:

- `7`
- `8`

Scope:

- push-to-talk
- transcript review
- scene, world, item, lore, and media actions

Deliverable:

- broader session assistant with voice entry

Why this block comes now:

- voice only pays off after text execution is stable and trusted

### Block 5. Combat Automation and Session Intelligence

Status:

- proposed

Tasks included:

- `9`

Scope:

- initiative
- turn flow
- recap and memory
- more autonomous assistance

Deliverable:

- advanced DM copilot beyond simple state mutation

Why this block comes later:

- it introduces new domain models and more failure modes than the v1 operational tools

## Repo Ownership and Contract Impact

This is a single repository, but the work spans three application layers with shared contracts.

Backend ownership:

- `server/index.js` should stop being the long-term home for tool logic
- new server-side services should own validation, resolution, execution, logging, and undo
- existing socket handlers should become thin transport adapters or be replaced by a DM command endpoint

Web ownership:

- `client/src/layouts/DmLayout.jsx` should expose a first-class `Assistant` or `Oracle` panel in the DM navigation
- `client/src/dm/*` panels should consume the same command results instead of bespoke event shapes
- current DM panel emitters should be aligned to the canonical command contract

Mobile ownership:

- `mobile/components/Chronicle/MasterDeck.tsx` already exposes an `Oracle AI` affordance and should become the main launch point for the DM assistant in session flow
- `mobile/app/(tabs)/_layout.tsx` should keep player tabs clean while exposing the DM assistant through a hidden DM route, modal sheet, or session overlay
- mobile should reuse the same command/result contract as web, not a mobile-specific assistant API

Shared contract impact:

- every mutating operation needs a canonical `tool name`, `args`, `result`, and `undo` shape
- entity references must support ids plus fuzzy aliases
- notifications, timeline posts, and live socket refreshes should be standardized by the executor

Recommended new shared contract:

```json
{
  "commandId": "uuid",
  "source": "dm_text",
  "tool": "character.hp.adjust",
  "args": {
    "target": "Lucario",
    "delta": -5
  },
  "dryRun": false,
  "requiresConfirmation": false
}
```

Recommended execution result:

```json
{
  "commandId": "uuid",
  "status": "applied",
  "tool": "character.hp.adjust",
  "summary": "Lucario: 10 -> 5 HP",
  "entities": {
    "characterIds": [4]
  },
  "patches": [
    { "entity": "character", "id": 4, "field": "hp_current", "before": 10, "after": 5 }
  ],
  "undo": {
    "tool": "character.hp.set",
    "args": { "targetId": 4, "value": 10 }
  },
  "notifications": [
    { "type": "info", "text": "Lucario pierde 5 PG." }
  ]
}
```

## Backend Plan

### Command execution architecture

Recommended new backend modules:

- `server/ai/commandExecutor.js`
- `server/ai/entityResolver.js`
- `server/ai/toolRegistry.js`
- `server/ai/toolSchemas.js`
- `server/ai/tools/*.js`
- `server/services/characters/*.js`
- `server/services/scenes/*.js`
- `server/services/quests/*.js`
- `server/services/world/*.js`
- `server/services/items/*.js`
- `server/services/media/*.js`
- `server/services/spells/*.js`
- `server/models/CommandLog.js`

Recommended responsibilities:

- `toolRegistry`: canonical tool metadata and permissions
- `toolSchemas`: argument validation and normalization
- `entityResolver`: fuzzy lookup, aliases, ambiguity handling
- `commandExecutor`: transactions, logging, notifications, undo packaging
- `services/*`: business logic reusable by sockets, REST, and AI
- `CommandLog`: durable execution history

Recommended permission model:

- DM-only for all mutating tools
- read tools can later be role-scoped per player or observer
- voice commands must authenticate exactly like typed commands

Recommended safety rules:

- `dryRun` on every mutating tool
- explicit `requiresConfirmation` for multi-target or destructive operations
- `undo` attached when reversible
- server-side bounds checks on HP, spell slots, item quantities, and quest status transitions

### Canonical Tool Catalog

#### Base platform tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `session.get_context` | Return current scene, party, time, location, active NPCs, and recent command history. | new | Best first read tool for AI grounding. |
| `entity.resolve` | Resolve fuzzy names to concrete ids. | new | Required by almost every mutating tool. |
| `entity.search` | Search characters, NPCs, quests, items, scenes, POIs, and factions. | new | Needed for ambiguity and disambiguation. |
| `action.preview` | Dry-run any tool and return summary without writing state. | new | Core safety primitive. |
| `action.confirm` | Apply a previewed action after explicit approval. | new | Needed for risky commands. |
| `action.undo` | Revert the latest undoable action. | new | Mandatory for live use. |
| `action.log.get` | Read command history and results. | new | Supports trust and debugging. |
| `notification.push` | Emit a DM or player-facing message from a tool result. | partial | Notifications exist, but not as a standardized tool. |

#### Character and party tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `party.list` | Return all current party members plus active allied NPCs. | exists | Derived from `get-players` and calculated stats. |
| `character.get` | Fetch one character sheet snapshot. | partial | Can be built from current character includes. |
| `character.hp.adjust` | Add or subtract current HP by delta. | partial | Current backend only supports absolute `update-hp`. |
| `character.hp.set` | Set current HP to an exact value. | exists | Maps to `update-hp` with validation. |
| `character.temp_hp.set` | Set temporary HP. | new | Model supports `hp_temp`, but no handler exists. |
| `character.xp.adjust` | Add or subtract XP. | partial | `award-xp` exists for positive group grants only. |
| `character.gold.adjust` | Add or subtract gold. | new | Model exists, no direct handler. |
| `character.inspiration.set` | Set inspiration on or off. | new | Model exists, no direct handler. |
| `character.level.set` | Set level. | partial | Possible via `update-character-full`, but no focused tool. |
| `character.notes.append` | Add DM notes to a character. | new | Maps to `notes` field. |
| `character.notes.replace` | Replace character notes. | new | Safer when paired with preview. |
| `character.custom_feature.add` | Add a custom feature entry. | partial | Related to `update-custom-features`. |
| `character.skill.toggle` | Toggle a skill proficiency. | exists | Already supported by `toggle-skill-proficiency`. |
| `character.archetype.set` | Set subclass/archetype. | exists | Already supported. |
| `character.sheet.update` | Apply a structured multi-field patch. | partial | Related to `update-character-full`. |
| `character.image.update` | Update avatar, body image, or crop params. | partial | Current handlers exist for image changes. |

#### Combat and conditions tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `combat.damage.apply` | Apply damage to one or more targets. | new | Should call `character.hp.adjust` plus combat log text. |
| `combat.heal.apply` | Heal one or more targets. | new | Same execution path as HP adjust. |
| `combat.condition.add` | Apply a condition or status effect. | new | `StatusEffect` model exists, no runtime handler yet. |
| `combat.condition.remove` | Remove a condition. | new | Same missing runtime support. |
| `combat.concentration.set` | Mark concentration active or broken. | new | Requires new per-character state or effect convention. |
| `combat.death_save.mark` | Track death save success/failure. | new | Requires new model fields or encounter state. |
| `combat.rest.short` | Apply short rest rules. | new | Useful but needs clear rule ownership. |
| `combat.rest.long` | Apply long rest rules. | new | High power; must require confirmation. |
| `combat.turn.next` | Advance turn order. | new | Requires encounter/initiative model. |
| `combat.initiative.set` | Set initiative values. | new | Current model only stores initiative bonus, not round order. |

#### NPC and encounter tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `npc.list` | List all NPCs and creatures. | exists | Backed by `get-all-npcs`. |
| `npc.get` | Fetch one NPC snapshot. | partial | Straightforward wrapper around current model. |
| `npc.create` | Create an NPC or creature. | exists | Backed by `create-npc`. |
| `npc.update` | Update NPC stats and notes. | partial | Could reuse `update-character-full` for NPCs. |
| `npc.hp.adjust` | Apply damage or healing to NPCs. | partial | Absolute HP exists via `update-hp`. |
| `npc.activate` | Add or toggle an NPC into the active party or scene. | partial | Current backend has `toggle-npc-active`, but UI contract is inconsistent. |
| `npc.owner.set` | Attach a companion or summon to a player. | partial | Model has `owner_id`, no focused tool. |
| `npc.clone` | Duplicate an NPC template for repeated enemies. | new | Useful for encounters and swarms. |

#### Item, loot, and equipment tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `item.list` | Search all items in the compendium. | exists | Backed by `get-all-items`. |
| `item.get` | Fetch item details. | partial | Data exists, tool contract missing. |
| `item.create` | Create a custom item. | new | High value for DM improvisation. |
| `item.update` | Patch item data. | partial | `update-item` exists. |
| `item.assign` | Give an item to a character. | exists | Backed by `assign-item`. |
| `item.remove` | Remove or revoke an item. | new | Needed for cursed or consumed objects. |
| `item.consume` | Use a consumable. | partial | `use-item` exists, but not as structured tool output. |
| `item.equip` | Equip an item in a target slot. | exists | Backed by `equip-item`. |
| `item.unequip` | Unequip an item from a target slot. | exists | Backed by `unequip-item`. |
| `loot.roll` | Generate or pick loot by level and type. | partial | UI has random item generation, but no canonical backend tool. |
| `loot.distribute` | Split loot across targets. | new | Useful for post-combat flow. |

#### Scene, timeline, and narrative tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `scene.list` | Return scenes by status. | exists | Backed by `get-scenes`. |
| `scene.get` | Return one scene with participants and recent timeline. | partial | Needs aggregation wrapper. |
| `scene.create` | Create a new scene. | exists | Backed by `create-scene`. |
| `scene.update` | Update title, description, image, or location. | new | Scene creation exists; edit tool does not. |
| `scene.status.set` | Mark scene active, finished, or archived. | new | UI expects this, backend does not support it. |
| `scene.participants.sync` | Replace participant list. | exists | Backed by `update-scene-participants`. |
| `scene.silence.set` | Silence or unsilence a scene chat. | exists | Backed by `toggle-silence`. |
| `timeline.post` | Post a DM narration, action, or system message. | partial | Current transport uses `chat-message`; DM-specific contract is missing. |
| `timeline.edit` | Edit a timeline message. | exists | Backed by `update-message`. |
| `timeline.delete` | Remove a timeline message. | new | No delete flow exists. |
| `timeline.recap` | Summarize scene events for the DM. | new | AI read tool built on timeline history. |
| `timeline.pin` | Mark a message as important canon. | new | Useful for long campaigns. |

#### World, map, and lore tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `world.state.get` | Return current time, location, map position, scene, and party context. | partial | Can aggregate `MapState` plus scene and party reads. |
| `world.time.set` | Set current world time. | exists | Backed by `update-global-state`. |
| `world.location.set` | Set current world location. | exists | Backed by `update-global-state`. |
| `map.party.move` | Move party marker on world map. | exists | Backed by `update-position`. |
| `poi.list` | List POIs at current level or by parent. | exists | Backed by REST `GET /api/pois`. |
| `poi.get` | Read one POI and lore bundle. | exists | Backed by REST plus `/lore`. |
| `poi.create` | Create a POI or sub-POI. | exists | Backed by REST `POST /api/pois`. |
| `poi.update` | Update a POI core record. | exists | Backed by REST `PUT /api/pois/:id`. |
| `poi.map_image.set` | Set or replace city map image. | exists | Already supported through POI updates. |
| `poi.lore.update_global` | Update shared lore fields. | exists | Backed by `PUT /api/pois/:id/global-lore`. |
| `poi.notes.update_personal` | Update per-user notes. | exists | Backed by `PUT /api/pois/:id/user-notes`. |
| `poi.reveal` | Mark lore, map, or sub-POI visible to players. | new | Needs new visibility semantics. |

#### Quest, clocks, and factions tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `quest.list` | Return all quests with status and targets. | exists | Backed by `get-all-qs`. |
| `quest.get` | Read one quest in detail. | partial | Easy wrapper around current model. |
| `quest.create` | Create an unassigned quest template. | new | Current backend creates and assigns in one step. |
| `quest.assign` | Assign a quest to one or more characters. | partial | `create-assign-quest` exists, but only in combined form. |
| `quest.objective.add` | Add an objective to a quest. | new | Needed for live adaptation. |
| `quest.objective.update` | Edit an objective text or ordering. | new | No current support. |
| `quest.objective.toggle` | Mark an objective done or undone. | partial | Backed by `update-quest-progress`. |
| `quest.status.set` | Set status to in progress, completed, blocked, or failed. | partial | Current support exists only through progress update side effects. |
| `quest.reward.grant` | Apply quest rewards to targets. | new | Rewards are stored but not granted automatically. |
| `clock.list` | Return all clocks. | new | Model exists, no handlers. |
| `clock.create` | Create a progress clock. | new | High-value narrative tool. |
| `clock.tick` | Advance or reduce clock segments. | new | Core DM pressure mechanic. |
| `clock.reset` | Reset a clock. | new | Needed for reusable mechanics. |
| `faction.list` | List factions and current influence. | new | Model exists, no handlers. |
| `faction.influence.adjust` | Raise or lower faction influence. | new | Important for campaign state. |
| `faction.status.set` | Set faction to allied, neutral, or hostile. | new | Simple but powerful campaign tool. |

#### Spells, features, and rules tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `spell.lookup` | Search spells by class, level, or slug. | exists | Current spell read paths exist. |
| `spell.details.get` | Fetch full spell details. | exists | Backed by `get-spell-details`. |
| `spell.translate` | Translate one spell to Spanish. | exists | Backed by `translate-spell`. |
| `spell.slot.use` | Spend a spell slot. | new | Model has `spell_slots`, but no focused runtime tool. |
| `spell.slot.restore` | Restore spent spell slots. | new | Needed for rest and manual correction. |
| `spell.prepare` | Mark a spell prepared. | partial | Can be done through `update-character-full`. |
| `feature.choose` | Choose a class feature option. | exists | Backed by `choose-feature`. |
| `talent.choose` | Choose a talent tree node. | exists | Backed by `choose-talent`. |
| `rules.lookup` | Read concise rules snippets for the DM. | new | AI read helper over compendium and stored data. |

#### Media, voice, memory, and automation tools

| Tool | Purpose | Status | Notes |
| --- | --- | --- | --- |
| `media.upload` | Upload a file and return a canonical URL. | partial | Current REST upload exists, but not as a command tool. |
| `media.share` | Share an image with players. | exists | Backed by `share-image`. |
| `media.stop` | Stop active sharing. | exists | Backed by `stop-sharing-image`. |
| `media.reshare` | Re-share a recent asset. | partial | UI supports it; tool layer should standardize it. |
| `voice.transcribe` | Convert spoken audio to text. | new | Required for real voice commands. |
| `command.parse` | Convert text into candidate tool calls. | new | AI adapter, not a direct domain tool. |
| `command.disambiguate` | Ask follow-up questions when targets are unclear. | new | Important for trust. |
| `memory.note_create` | Save a DM memory note with tags and links. | new | Useful for campaign continuity. |
| `memory.note_search` | Search DM memory notes. | new | Should become part of context retrieval. |
| `recap.session` | Summarize recent events, unresolved quests, and state changes. | new | Valuable between turns or at session end. |

### V1 tool set recommendation

The first shippable tool set should be intentionally small:

- `session.get_context`
- `entity.resolve`
- `character.hp.adjust`
- `character.hp.set`
- `character.temp_hp.set`
- `character.xp.adjust`
- `character.gold.adjust`
- `character.inspiration.set`
- `combat.condition.add`
- `combat.condition.remove`
- `npc.activate`
- `timeline.post`
- `world.time.set`
- `world.location.set`
- `quest.objective.toggle`
- `action.preview`
- `action.undo`

### Suggested transport strategy

Recommended near-term choice:

- keep Socket.IO for live refresh broadcasts
- execute DM commands server-side through internal services
- expose one new transport entrypoint such as `dm-command`

Recommended request flow:

1. client captures text or transcript
2. AI parser proposes tool call
3. server validates tool and resolves entities
4. server returns preview if required
5. server applies transaction
6. server emits standard refresh events and command result

## Frontend / UI Plan

### Scope

- shared DM assistant experience across web and mobile
- web DM panel plus mobile DM launch surface
- no player-facing AI entry in v1

### Product Goals

- let the DM stay inside the table flow
- reduce panel hopping and manual state edits
- make high-frequency actions faster than clicking through forms
- keep dangerous actions reviewable and reversible
- keep the assistant interaction in one visible conversation panel so the DM can see what was asked and what changed

### Visual Direction

- preserve the existing DM visual language in `client/src/dm/*`
- introduce one assistant panel that feels integrated, not like an external chatbot
- prioritize speed, transcript clarity, previews, and compact audit output over conversational ornament

### Route Map

- web: add an `Assistant` or `Oracle` section to `client/src/layouts/DmLayout.jsx` navigation and render a full-height assistant panel in the main work area
- web: keep a compact floating entry point or omnibox available from other DM panels for quick commands, but route full interaction to the assistant panel
- mobile: use `mobile/components/Chronicle/MasterDeck.tsx` `Oracle AI` trigger to open a dedicated assistant sheet or full-screen panel during active session flow
- mobile: if broader DM use outside Chronicle is needed, add a hidden DM route rather than placing the assistant in player-facing bottom tabs

### Core Screens

- DM assistant panel with conversation history
- compact quick-command launcher
- command history panel
- ambiguity resolver sheet
- confirmation modal for risky actions
- execution result toast or inline result card
- voice transcript panel

### Information Architecture

- the assistant conversation is a first-class DM workspace, not a transient modal only
- the same conversation should mix natural-language prompts, tool execution summaries, follow-up questions, and undo actions
- quick actions from party, quest, scene, or map surfaces should be able to deep-link into the assistant with prefilled context
- the assistant should be aware of current scene, selected character, and world state so the DM does not need to restate context constantly

- command input should be global to the DM workspace
- result history should be centralized, not split per panel
- domain panels such as Party, Scenes, Quests, NPCs, Items, and Media should remain readable sources of truth
- AI actions should deep link back to the affected entity when possible

### States That Must Be Designed

- empty input
- parsing in progress
- entity ambiguity
- permission denied
- dry-run preview
- waiting for confirmation
- execution success
- partial success in batch commands
- undo available
- undo applied
- network failure
- stale client data
- transcript low confidence

### Component Strategy

Recommended shared components:

- `DmAssistantPanel`
- `DmAssistantComposer`
- `DmAssistantMessageList`
- `DmQuickCommandLauncher`
- `CommandPreviewCard`
- `CommandResultCard`
- `CommandHistoryList`
- `EntityDisambiguationModal`
- `VoiceRecorderButton`
- `RiskConfirmationModal`
- `AssistantContextChips`
- `AssistantSuggestedActions`

### Frontend Delivery Recommendation by Block

Block 1:

- add the shared assistant state model and backend contract
- create the web assistant panel skeleton inside `DmLayout`
- wire the mobile `Oracle AI` trigger in `MasterDeck` to the same assistant state machine
- do not add voice execution yet

Block 2:

- add preview and undo UX
- add ambiguity resolution and command history
- add prefilled context jumps from Party, Scenes, Quests, NPCs, Items, Media, and Atlas

Block 3:

- make the assistant panel always available in the DM workspace
- add quick examples, slash-style prompts, and keyboard-first interaction on web
- add the mobile assistant sheet or full-screen route for session use

Block 4:

- add push-to-talk, transcript review, and microphone states

### Non-Goals

- no autonomous AI agent that mutates the campaign without explicit DM intent
- no player-facing voice assistant in v1
- no freeform LLM access to raw socket events

## Testing and Validation Plan

Backend validation:

- unit tests for tool arg validation
- unit tests for entity resolution with aliases, partial names, and duplicate names
- unit tests for undo generation
- unit tests for permission checks
- service-level tests for HP, XP, gold, inspiration, quest, and world-state mutations

Contract validation:

- test the canonical command request and result shape
- verify that preview mode never writes state
- verify that confirmed actions generate logs and socket refreshes
- verify that legacy DM UI actions are either migrated or removed

UI validation:

- keyboard-first command entry
- ambiguity modal behavior
- confirmation behavior for risky actions
- stale state recovery after a live update
- visual confirmation that undo is available

End-to-end validation:

- DM text command updates one player in real time on web and mobile
- DM text command updates a quest objective in real time
- DM text command updates world time and location in real time
- undo restores the previous state and emits refresh events

Voice validation:

- push-to-talk transcript round-trip under table noise
- ambiguous transcript requires review instead of applying blindly
- low-confidence transcript never skips confirmation

## Risks and Open Questions

- Socket auth and role gating should be reviewed before high-power DM commands are added.
- `server/index.js` is already carrying too much transport and business logic; adding AI directly there would make maintenance much worse.
- Duplicate or similar names will create ambiguity unless aliasing and resolver quality are treated as first-class work.
- True combat automation will need encounter state that does not exist yet.
- Status effects exist as a model but not as a runtime workflow.
- Quest rewards are stored as data but not yet applied by a server-side reward engine.
- Voice support strategy is still open: browser-native speech APIs, third-party STT, or server-side transcription.
- It is still open whether the AI parser should run client-side, server-side, or both with server authority.
- The current DM UI contains dead event names; that instability should be removed before the assistant is exposed.

## Rollout Recommendation

Recommended rollout path:

1. Ship text-only commands behind a DM feature flag.
2. Restrict v1 to a narrow set of high-frequency actions with preview and undo.
3. Standardize all existing DM panel mutations onto the same backend command executor.
4. Add voice only after text commands show low error rates in real play.
5. Add advanced combat, memory, and recap tools after the base operator experience is trusted.

Recommended v1 success criteria:

- the DM can change HP in fewer than 3 seconds from typing
- the DM can complete a quest objective without opening the quests panel
- the DM can change world time/location without leaving the active scene
- every command returns a clear result and can be traced in history
- no command writes state without validation and auth
