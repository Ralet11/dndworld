const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { Op } = require('sequelize');
const sequelize = require('./config/database');
const { Character, Item, AbilityScore, Skill, Quest, EquipmentSlots, MapState, Media, TimelineEvent, Scene, Class, Race, Spell } = require('./models');
const StatEngine = require('./utils/statEngine');
const { resolveSlotColumn, deriveSlot } = require('./utils/itemSlots');
const seedDatabase = require('./utils/seeder');
const { renderHero, buildSignature } = require('./utils/heroRenderer');

const app = express();
const server = http.createServer(app);

// Simple cache for spell lists
const classSpellCache = {};

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const morgan = require('morgan');

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

const multer = require('multer');
const path = require('path');
// const fs = require('fs'); // Not needed for Cloudinary
const { storage } = require('./utils/cloudinary'); // Import Cloudinary storage

const upload = multer({ storage: storage });
const authController = require('./controllers/authController');
const { verifyToken } = require('./middleware/auth');

// Auth Routes
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', verifyToken, authController.getMe);

// POI Routes
app.use('/api/pois', require('./routes/poiRoutes'));

// app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Not needed for Cloudinary
// Serve Static Frontend (Vite Build)
app.use(express.static(path.join(__dirname, '../client/dist')));

// Character Assignment Routes
app.get('/api/characters/available', verifyToken, async (req, res) => {
    try {
        const characters = await Character.findAll({
            where: {
                [Op.or]: [
                    { UserId: null }, // Unclaimed
                    { UserId: req.user.id } // Already claimed by me
                ],
                is_npc: false // Only player characters
            }
        });
        res.json(characters);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/characters/assign', verifyToken, async (req, res) => {
    try {
        const { characterId } = req.body;
        const character = await Character.findByPk(characterId);

        if (!character) {
            return res.status(404).json({ message: "Character not found" });
        }

        if (character.UserId && character.UserId !== req.user.id) {
            return res.status(400).json({ message: "Character already claimed by another user." });
        }

        character.UserId = req.user.id;
        await character.save();

        res.json({ message: "Character assigned successfully", character });

        // Notify sockets so player list updates immediately
        const players = await getCalculatedPartyStats();
        io.emit('players-data', players);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/upload', (req, res) => {
    // Llamamos a multer manualmente para CAPTURAR el error de Cloudinary/multer
    // (si no, cae en el handler por defecto de Express y devuelve HTML, lo que
    // rompe el res.json() del cliente con un falso "error de conexión").
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('Server: Upload error →', err);
            return res.status(500).json({ message: err.message || 'Fallo al subir la imagen.' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No se recibió ningún archivo.' });
        }
        console.log('Server: File uploaded to Cloudinary:', req.file.path);
        res.json({ url: req.file.path });
    });
});

// AI Narrator Endpoint (Architecture Ready)
app.post('/api/ai/narrate', verifyToken, async (req, res) => {
    try {
        const { prompt } = req.body;
        // HERE is where we would connect to OpenAI / Gemini.
        // const response = await openai.chat.completions.create({ ... });

        // For now, we simulate the "Oracle" answering from the server.
        const narration = `(Oracle @ Server) Las energías arcanas vibran... "${prompt}". El destino se reescribe ante tus ojos.`;

        // Simulate latency
        await new Promise(r => setTimeout(r, 1500));

        res.json({ text: narration });
    } catch (err) {
        console.error('AI Error:', err);
        res.status(500).json({ message: "Failed to consult the Oracle." });
    }
});

// Render del héroe con el equipo puesto (OpenAI gpt-image-1 → Cloudinary).
app.post('/api/characters/:id/render', verifyToken, async (req, res) => {
    try {
        const character = await Character.findByPk(req.params.id, {
            include: [
                { model: Item, as: 'items' },
                {
                    model: EquipmentSlots,
                    as: 'equipment',
                    include: [
                        { model: Item, as: 'helmet' },
                        { model: Item, as: 'chest' },
                        { model: Item, as: 'shoulders' },
                        { model: Item, as: 'boots' },
                        { model: Item, as: 'pants' },
                        { model: Item, as: 'gloves' },
                        { model: Item, as: 'primary_weapon' },
                        { model: Item, as: 'secondary_weapon' },
                    ]
                }
            ]
        });

        if (!character) return res.status(404).json({ message: 'Personaje no encontrado.' });

        // Indicaciones libres del jugador: si vienen en el body, se guardan y se
        // reaplicarán en este y los próximos renders.
        if (req.body?.customPrompt !== undefined) {
            character.render_prompt = String(req.body.customPrompt).slice(0, 1000);
        }

        // Si el equipo Y las indicaciones no cambiaron, devolvemos el cacheado.
        const currentSig = buildSignature(character.equipment, character.items, character.render_prompt);
        if (!req.body?.force && character.rendered_url && character.rendered_signature === currentSig) {
            return res.json({ url: character.rendered_url, cached: true });
        }

        const quality = req.body?.quality || 'medium';
        // review: auto-revisión con juez de visión (default on). maxAttempts: tope
        // de regeneraciones del ciclo (cada una cuesta una imagen).
        const review = req.body?.review !== false;
        const maxAttempts = Math.min(Math.max(parseInt(req.body?.maxAttempts, 10) || 2, 1), 4);

        // Reporta cada etapa por socket para alimentar la barra de carga del cliente.
        const onProgress = ({ stage, pct }) =>
            io.emit('render-progress', { characterId: character.id, stage, pct });
        onProgress({ stage: 'Iniciando…', pct: 2 });

        const { url, signature, verdict } = await renderHero(character, { quality, review, maxAttempts, onProgress });
        onProgress({ stage: 'Listo', pct: 100 });

        character.rendered_url = url;
        character.rendered_signature = signature;
        await character.save();

        // Avisar a todos para que la figura se actualice en vivo.
        const updatedStats = await getCalculatedPartyStats();
        io.emit('stats-updated', updatedStats);

        res.json({ url, cached: false, verdict });
    } catch (err) {
        console.error('Render hero error:', err);
        if (err.code === 'NO_API_KEY') return res.status(503).json({ message: err.message });
        if (err.code === 'NO_BASE_IMAGE') return res.status(400).json({ message: err.message });
        res.status(500).json({ message: 'No se pudo renderizar el héroe.' });
    }
});

// Helper to get full calculated stats for all characters (Players only by default)
const getCalculatedPartyStats = async () => {
    const characters = await Character.findAll({
        where: {
            [Op.or]: [
                { is_npc: false },
                { is_active: true }
            ]
        },
        include: [
            { model: AbilityScore, as: 'abilityScores' },
            { model: Skill, as: 'skills' },
            { model: Quest, as: 'quests' },
            { model: Item, as: 'items' },
            { model: Class, as: 'classData' }, // Include Class Data
            { model: Race, as: 'raceData' },   // Include Race Data
            {
                model: EquipmentSlots,
                as: 'equipment',
                include: [
                    { model: Item, as: 'helmet' },
                    { model: Item, as: 'chest' },
                    { model: Item, as: 'shoulders' },
                    { model: Item, as: 'boots' },
                    { model: Item, as: 'pants' },
                    { model: Item, as: 'gloves' },
                    { model: Item, as: 'ring_1' },
                    { model: Item, as: 'ring_2' },
                    { model: Item, as: 'primary_weapon' },
                    { model: Item, as: 'secondary_weapon' }
                ]
            }
        ]
    });

    // Mapa de clases (para resolver multiclase desde char.classes).
    const allClasses = await Class.findAll();
    const classMap = {};
    allClasses.forEach(c => { classMap[c.slug] = c; });

    // Definiciones de elección de rasgos (Estilo de Combate, etc.) — viven en el
    // compendio local (la tabla Class no las guarda).
    const compendium = require('./data/compendium2024');
    const choicesBySlug = {};
    compendium.classes.forEach(c => { choicesBySlug[c.slug] = c.choices || []; });

    return characters.map(char => {
        const baseStats = StatEngine.calculate(char);

        // Multiclase: lista de clases con su nivel. Fallback a clase única.
        const classEntries = (Array.isArray(char.classes) && char.classes.length)
            ? char.classes
            : (char.class_slug ? [{ slug: char.class_slug, level: char.level }] : []);
        const classesData = classEntries.map(e => {
            const cm = classMap[e.slug];
            if (!cm) return null;
            return {
                slug: cm.slug, name: cm.name, hit_dice: cm.hit_dice,
                prof_armor: cm.prof_armor, prof_weapons: cm.prof_weapons,
                prof_saving_throws: cm.prof_saving_throws, spellcasting_ability: cm.spellcasting_ability,
                subtypes_name: cm.subtypes_name, archetypes: cm.archetypes,
                table: cm.table, desc: cm.desc, level: e.level,
                choices: choicesBySlug[cm.slug] || [],
            };
        }).filter(Boolean);

        return {
            ...baseStats,
            id: char.id,
            name: char.name, // Explicitly return name
            race: char.race,
            class: char.class,
            race_slug: char.race_slug,
            class_slug: char.class_slug,
            archetype_slug: char.archetype_slug,
            raceData: char.raceData,
            classData: char.classData,
            classes: classesData,
            level: char.level,
            xp: char.xp,
            gold: char.gold,
            inventory: char.items, // Map 'items' to 'inventory' for frontend
            quests: char.quests,
            equipment: char.equipment,
            abilities_text: char.abilities_text,
            custom_features: char.custom_features,
            image_url: char.image_url,
            base_body_url: char.base_body_url,
            rendered_url: char.rendered_url,
            rendered_signature: char.rendered_signature,
            render_prompt: char.render_prompt,
            image_scale: char.image_scale,
            image_offset_x: char.image_offset_x,
            image_offset_x: char.image_offset_x,
            image_offset_y: char.image_offset_y,
            // Magic
            spell_slots: char.spell_slots,
            spells_known: char.spells_known,
            spells_prepared: char.spells_prepared,
            talent_choices: char.talent_choices,
            feature_choices: char.feature_choices,
            UserId: char.UserId, // Critical for frontend identity
        };
    });
};

io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);

    // --- TIMELINE / CHAT ---
    socket.on('get-timeline', async (sceneId) => {
        try {
            const whereClause = {};
            if (sceneId) {
                whereClause.scene_id = sceneId;
            } else {
                // If no scene specified, maybe return nothing? Or global?
                // For now, let's assume we ONLY want scene-specific chat if sceneId is passed.
                // If sceneId is null/undefined, maybe we want 'general' chat or nothing.
                // User said "Chronicle is default a list", "When enter scene, chat".
                // So we might want to strict filter.

                // For backward compatibility or "Global" chat, we can leave it nullable.
                // But let's stricten it if possible.
                // whereClause.scene_id = null; // Only global messages
            }

            const events = await TimelineEvent.findAll({
                where: whereClause,
                limit: 50,
                order: [['timestamp', 'DESC']],
                include: [{ model: Character, as: 'author' }]
            });
            // Send back in chronological order (Oldest -> Newest) for the chat UI
            socket.emit('timeline-data', events.reverse());
        } catch (err) {
            console.error('Get timeline error:', err);
        }
    });

    socket.on('get-scenes', async () => {
        try {
            const scenes = await Scene.findAll({
                order: [['updatedAt', 'DESC']],
                include: [{ model: Character, as: 'participants' }]
            });
            socket.emit('scenes-data', scenes);
        } catch (err) {
            console.error('Get scenes error:', err);
        }
    });

    socket.on('create-scene', async (data) => {
        try {
            const { title, description, imageUrl, participants } = data;
            const newScene = await Scene.create({
                title,
                description,
                imageUrl,
                status: 'ACTIVE'
            });

            // If participants sent (array of character IDs)
            if (participants && participants.length > 0) {
                const chars = await Character.findAll({ where: { id: participants } });
                await newScene.addParticipants(chars);
            }

            // Broadcast new scene list
            const scenes = await Scene.findAll({ order: [['updatedAt', 'DESC']] });
            io.emit('scenes-data', scenes);
        } catch (err) {
            console.error('Create scene error:', err);
        }
    });

    socket.on('update-scene-participants', async (data) => {
        try {
            const { sceneId, participants } = data;
            const scene = await Scene.findByPk(sceneId);
            if (!scene) return;

            // Set participants (replaces existing list)
            const chars = await Character.findAll({ where: { id: participants } });
            await scene.setParticipants(chars);

            // Broadcast updated scene list to everyone
            const scenes = await Scene.findAll({
                order: [['updatedAt', 'DESC']],
                include: [{ model: Character, as: 'participants' }]
            });
            io.emit('scenes-data', scenes);

            // Also notify specifically for this scene update if needed
            io.emit('scene-updated', { sceneId, participants: chars });
        } catch (err) {
            console.error('Update scene participants error:', err);
        }
    });

    // --- NEW: CHAT CONTROLS (SILENCE & TYPING) ---
    // Memory state for silenced scenes
    const silencedScenes = new Set();

    socket.on('toggle-silence', ({ sceneId, isSilenced }) => {
        if (isSilenced) {
            silencedScenes.add(sceneId);
        } else {
            silencedScenes.delete(sceneId);
        }
        // Broadcast the new silence state
        io.emit('scene-silence-changed', { sceneId, isSilenced });
    });

    socket.on('get-silence-state', (sceneId) => {
        socket.emit('scene-silence-changed', { sceneId, isSilenced: silencedScenes.has(sceneId) });
    });

    socket.on('typing-start', ({ sceneId, authorName, isDm }) => {
        // Broadcast to everyone else
        socket.broadcast.emit('user-typing-start', { sceneId, authorName, isDm });
    });

    socket.on('typing-stop', ({ sceneId, authorName }) => {
        socket.broadcast.emit('user-typing-stop', { sceneId, authorName });
    });

    socket.on('get-players', async () => {
        try {
            const players = await getCalculatedPartyStats();
            socket.emit('players-data', players);
        } catch (err) {
            console.error('Get players error:', err);
        }
    });

    // --- NEW: GLOBAL STATE (TIME & LOCATION) ---
    socket.on('get-global-state', async () => {
        try {
            const [state] = await MapState.findOrCreate({ where: { id: 1 } });
            socket.emit('global-state-data', state);
        } catch (err) {
            console.error('Get global state error:', err);
        }
    });

    socket.on('update-global-state', async (data) => {
        try {
            const { global_time, global_location } = data;
            const [state] = await MapState.findOrCreate({ where: { id: 1 } });

            if (global_time !== undefined) state.global_time = global_time;
            if (global_location !== undefined) state.global_location = global_location;

            await state.save();
            // Broadcast to absolutely everyone connected
            io.emit('global-state-data', state);
        } catch (err) {
            console.error('Update global state error:', err);
        }
    });

    // --- REUSABLE ITEM USAGE LOGIC ---
    const consumeItemLogic = async (characterId, itemId) => {
        try {
            const character = await Character.findByPk(characterId);
            const item = await Item.findByPk(itemId);

            const inventoryItem = await sequelize.models.CharacterInventory.findOne({
                where: { character_id: characterId, item_id: itemId }
            });

            if (character && item && item.type === 'Consumible' && inventoryItem) {
                const effects = item.use_effects || {};

                if (effects.heal) {
                    let healAmount = 0;
                    if (typeof effects.heal === 'string' && effects.heal.includes('d')) {
                        const [dice, bonus] = effects.heal.split('+');
                        const [count, type] = dice.split('d');
                        for (let i = 0; i < parseInt(count); i++) {
                            healAmount += Math.floor(Math.random() * parseInt(type)) + 1;
                        }
                        if (bonus) healAmount += parseInt(bonus);
                    } else {
                        healAmount = parseInt(effects.heal) || 10;
                    }

                    character.hp_current = Math.min(character.hp_max, character.hp_current + healAmount);
                    await character.save();

                    io.emit('item-used-effect', { type: 'heal', amount: healAmount, targetId: characterId });
                }

                if (inventoryItem.quantity > 1) {
                    inventoryItem.quantity -= 1;
                    await inventoryItem.save();
                } else {
                    await inventoryItem.destroy();
                }

                const updatedStats = await getCalculatedPartyStats();
                io.emit('stats-updated', updatedStats);
                io.emit('notification', { text: `${character.name} usó ${item.name}.` });
                return true;
            }
            return false;
        } catch (err) {
            console.error('consumeItemLogic error:', err);
            return false;
        }
    };

    socket.on('chat-message', async (data) => {
        try {
            console.log('Server: chat-message received. Content:', data.text, 'UID:', Math.random());
            const { text, mode, author_id, image, replyTo, type, sceneId } = data;

            const newMessage = await TimelineEvent.create({
                type: type || 'CHAT',
                content: text,
                author_id: author_id,
                scene_id: sceneId || null,
                metadata: {
                    ...(data.metadata || {}), // IMPORTANT: Capture itemRequest and other dynamic data
                    mode: mode || 'SAY',
                    image: image || null,
                    repliedTo: replyTo || null,
                    status: mode === 'DO' ? 'PENDING' : undefined
                }
            });

            // Re-fetch to get author details fully populated immediately
            const fullMessage = await TimelineEvent.findByPk(newMessage.id, {
                include: [{ model: Character, as: 'author' }]
            });

            io.emit('new-message', fullMessage);
        } catch (err) {
            console.error('Chat message error:', err);
        }
    });

    socket.on('update-message', async (data) => {
        try {
            const { messageId, updates } = data;
            const msg = await TimelineEvent.findByPk(messageId);

            if (!msg) return;

            // Apply updates
            if (updates.status) {
                msg.status = updates.status; // For socket optimistic returns
                msg.metadata = {
                    ...(msg.metadata || {}),
                    status: updates.status
                };
            }

            // Merge metadata if provided
            if (updates.metadata) {
                msg.metadata = {
                    ...(msg.metadata || {}),
                    ...updates.metadata
                };
            }

            await msg.save();

            // Auto-consume item logic
            if (updates.status === 'APPROVED' && msg.metadata?.itemRequest) {
                const { characterId, itemId } = msg.metadata.itemRequest;
                await consumeItemLogic(characterId, itemId);
            }

            // Return full message with author for client consistency
            const fullMsg = await TimelineEvent.findByPk(messageId, {
                include: [{ model: Character, as: 'author' }]
            });

            io.emit('message-updated', fullMsg);
        } catch (err) {
            console.error('Update message error:', err);
        }
    });
    // --- END TIMELINE ---

    // --- END TIMELINE ---

    try {
        const partyStats = await getCalculatedPartyStats();
        const sharedMedia = await Media.findAll({ limit: 20, order: [['timestamp', 'DESC']] });
        const mapState = await MapState.findByPk(1);

        socket.emit('init', {
            sharedMedia,
            partyStats,
            partyPosition: { x: mapState?.party_x || 50, y: mapState?.party_y || 50 }
        });
    } catch (err) {
        console.error('Init error:', err);
    }

    // --- DM TOOLS ---

    socket.on('get-my-npcs', async (characterId) => {
        try {
            const npcs = await Character.findAll({
                where: {
                    owner_id: characterId,
                    is_npc: true
                },
                include: [{ model: AbilityScore, as: 'abilityScores' }]
            });
            socket.emit('my-npcs', npcs);
        } catch (err) {
            console.error('Get my NPCs error:', err);
        }
    });

    socket.on('toggle-npc-active', async ({ characterId, npcId }) => {
        try {
            // 1. Deactivate all other NPCs for this owner
            await Character.update({ is_active: false }, {
                where: {
                    owner_id: characterId,
                    is_npc: true
                }
            });

            // 2. Activate the target NPC (if provided and valid)
            if (npcId) {
                const npc = await Character.findOne({ where: { id: npcId, owner_id: characterId } });
                if (npc) {
                    // Update: User requested toggle logic or just set active?
                    // "elegir uno como activo" implies selection. I'll force set to true here since we cleared others.
                    // If the user clicks the same one, maybe they want to deactivate it?
                    // Let's implement: if it was already active, leave it inactive (toggle off). 
                    // But I just mass-updated to false. So I need to check state BEFORE update.
                    // Optimization: Check target first.
                    // Actually, safer pattern: Just set target to true. The mass update handled the "exclusive" part.
                    // User might want to have NO active ally. 
                    // Let's assume if they click, they want to ACTIVATE it. If I want a deactivate, I'll need a different check.
                    // For now: Activate target.
                    npc.is_active = true;
                    await npc.save();

                    io.emit('notification', { text: `${npc.name} se une al grupo!` });
                }
            } else {
                io.emit('notification', { text: `Los aliados regresan al campamento.` });
            }

            // 3. Update Party Stats (so DM and everyone sees the new party member)
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);

            // 4. Send updated list to owner
            const npcs = await Character.findAll({
                where: { owner_id: characterId, is_npc: true },
                include: [{ model: AbilityScore, as: 'abilityScores' }]
            });
            socket.emit('my-npcs', npcs);

        } catch (err) {
            console.error('Toggle NPC active error:', err);
        }
    });

    socket.on('get-all-items', async () => {
        const items = await Item.findAll();
        socket.emit('all-items', items);
    });

    // Editar propiedades de un item (DM): material/categoría de armadura, etc.
    socket.on('update-item', async ({ itemId, updates }) => {
        try {
            const item = await Item.findByPk(itemId);
            if (!item || !updates) return;

            const allowed = ['name', 'description', 'image_url', 'rarity', 'type', 'slot', 'armor_weight', 'armor_material', 'level', 'weight', 'stat_bonuses', 'use_effects', 'size_hint', 'armor_type', 'ca_value', 'talent_stats', 'ability', 'weapon_category', 'damage', 'damage_type', 'properties', 'mastery'];
            for (const key of allowed) {
                if (updates[key] !== undefined) item.set(key, updates[key]);
            }
            await item.save();

            // Refrescar a todos: inventarios (quien lo tenga) + lista global.
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
            const items = await Item.findAll();
            io.emit('all-items', items);
        } catch (err) {
            console.error('Update-item error:', err);
        }
    });

    socket.on('get-all-players', async () => {
        const players = await Character.findAll({ where: { is_npc: false } });
        socket.emit('all-players', players);
    });

    socket.on('assign-item', async ({ characterId, itemId }) => {
        try {
            const char = await Character.findByPk(characterId);
            const item = await Item.findByPk(itemId);
            if (char && item) {
                // Check if already has it? Allow duplicates for consumables/others? Yes.
                await char.addItem(item, { through: { quantity: 1 } });

                // Notify DM and Players
                const updatedStats = await getCalculatedPartyStats();
                io.emit('stats-updated', updatedStats);
                io.emit('notification', { text: `${char.name} recibió ${item.name} del DM.` });
            }
        } catch (e) {
            console.error('Assign item error:', e);
        }
    });

    // El DM otorga XP. Si el total cruza un umbral, sube de nivel en el acto
    // (puede subir varios niveles de una). characterIds: array de ids.
    socket.on('award-xp', async ({ characterIds, amount }) => {
        try {
            const amt = parseInt(amount, 10);
            if (!amt || !Array.isArray(characterIds) || !characterIds.length) return;
            const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
                85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

            for (const id of characterIds) {
                const char = await Character.findByPk(id);
                if (!char) continue;
                char.xp = (char.xp || 0) + amt;

                let leveled = false;
                while (char.level < 20 && char.xp >= XP_THRESHOLDS[char.level]) {
                    char.level += 1;
                    leveled = true;
                }
                await char.save();

                io.emit('notification', {
                    text: leveled
                        ? `¡${char.name} subió a nivel ${char.level}! (${amt > 0 ? '+' : ''}${amt} XP)`
                        : `${char.name} ganó ${amt} XP.`,
                });
            }

            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
        } catch (err) {
            console.error('award-xp error:', err);
        }
    });

    socket.on('get-all-qs', async () => {
        // Return distinct quests or all assigned quests?
        // Plan says "View and search all quests". 
        // Maybe we just want a list of defined quests? 
        // The current data model repeats Quest rows for each character assignment.
        // We'll return all quests for now to list them.
        const quests = await Quest.findAll({ include: [{ model: Character }] });
        socket.emit('all-quests', quests);
    });

    socket.on('create-assign-quest', async (data) => {
        try {
            const { characterId, title, description, rewards, objectives } = data; // Added objectives to destructure

            const createForCharacter = async (cId) => {
                const char = await Character.findByPk(cId);
                if (!char) return;
                await Quest.create({
                    title,
                    description,
                    rewards,
                    level: data.level || 1, // Default level
                    objectives: objectives || [],
                    character_id: cId,
                    status: 'En Progreso'
                });
                return char.name;
            };

            if (characterId === 'party') {
                const players = await Character.findAll({ where: { is_npc: false } });
                for (const player of players) {
                    await createForCharacter(player.id);
                }
                io.emit('notification', {
                    text: `⚔️ ¡Nueva Misión de Grupo: ${title} !`,
                    type: 'new_quest'
                });
            } else {
                const charName = await createForCharacter(characterId);
                io.emit('notification', {
                    text: `📜 Misión asignada a ${charName}: ${title} `,
                    type: 'new_quest'
                });
            }

            const qs = await Quest.findAll({ include: Character });
            io.emit('all-quests', qs);

            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);

        } catch (err) {
            console.error('Create quest error:', err);
        }
    });

    socket.on('update-character-image', async ({ characterId, imageUrl, scale, offsetX, offsetY }) => {
        try {
            await Character.update({
                image_url: imageUrl,
                image_scale: scale,
                image_offset_x: offsetX,
                image_offset_y: offsetY
            }, { where: { id: characterId } });

            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
        } catch (err) {
            console.error('Update character image error:', err);
        }
    });

    socket.on('update-character-base-body', async ({ characterId, imageUrl }) => {
        try {
            await Character.update({ base_body_url: imageUrl }, { where: { id: characterId } });
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
        } catch (err) {
            console.error('Update character base body error:', err);
        }
    });

    // Elegir (o limpiar) un talento en un umbral de un árbol de dote.
    socket.on('choose-talent', async ({ characterId, tree, threshold, option }) => {
        try {
            const VALID_TREES = ['espiritu', 'agilidad', 'aguante'];
            const VALID_OPTS = ['a', 'b', 'c'];
            if (!VALID_TREES.includes(tree)) return;
            const th = String(threshold);

            const char = await Character.findByPk(characterId, {
                include: [
                    { model: Item, as: 'items' },
                    {
                        model: EquipmentSlots, as: 'equipment', include: [
                            { model: Item, as: 'helmet' }, { model: Item, as: 'chest' }, { model: Item, as: 'shoulders' },
                            { model: Item, as: 'boots' }, { model: Item, as: 'pants' }, { model: Item, as: 'gloves' },
                        ]
                    },
                ],
            });
            if (!char) return;

            // Validar que el umbral esté desbloqueado (talento del equipo >= umbral).
            const armor = StatEngine.computeArmor(char, char.equipment || {}, 0);
            if (Number(threshold) > (armor.talents[tree] || 0)) {
                io.emit('notification', { text: 'Ese umbral aún no está desbloqueado.' });
                return;
            }

            const choices = { ...(char.talent_choices || {}) };
            const treeChoices = { ...(choices[tree] || {}) };
            if (option === null || treeChoices[th] === option) {
                delete treeChoices[th]; // toggle off / limpiar
            } else if (VALID_OPTS.includes(option)) {
                treeChoices[th] = option;
            } else {
                return;
            }
            choices[tree] = treeChoices;
            char.talent_choices = choices;
            await char.save();

            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
        } catch (err) {
            console.error('choose-talent error:', err);
        }
    });

    // Elegir (o limpiar) un rasgo con opciones (Estilo de Combate, etc.).
    socket.on('choose-feature', async ({ characterId, classSlug, feature, key, multi }) => {
        try {
            if (!classSlug || !feature) return;
            const char = await Character.findByPk(characterId);
            if (!char) return;
            const k = `${classSlug}:${feature}`;
            const choices = { ...(char.feature_choices || {}) };
            if (multi) {
                const arr = Array.isArray(choices[k]) ? [...choices[k]] : [];
                const i = arr.indexOf(key);
                if (i >= 0) arr.splice(i, 1); else arr.push(key);
                choices[k] = arr;
            } else {
                if (choices[k] === key) delete choices[k]; // toggle off
                else choices[k] = key;
            }
            char.feature_choices = choices;
            await char.save();
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
        } catch (err) {
            console.error('choose-feature error:', err);
        }
    });

    socket.on('update-abilities-text', async ({ characterId, text }) => {
        try {
            await Character.update({ abilities_text: text }, { where: { id: characterId } });

            // Emit stats updated so everyone (including DM) gets the new text
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
        } catch (err) {
            console.error('Update abilities text error:', err);
        }
    });

    socket.on('update-custom-features', async ({ characterId, customFeatures }) => {
        try {
            const value = Array.isArray(customFeatures) ? customFeatures : [];
            await Character.update({ custom_features: value }, { where: { id: characterId } });

            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
        } catch (err) {
            console.error('Update custom features error:', err);
        }
    });

    socket.on('toggle-skill-proficiency', async ({ characterId, skillName }) => {
        try {
            const [skill, created] = await Skill.findOrCreate({
                where: { character_id: characterId, name: skillName },
                defaults: { proficiency_level: 0 }
            });

            // Toggle: If 0 -> 1, If >= 1 -> 0
            // (Simple toggle for now. Could cycle 0->1->2->0 for Expertise later)
            const newLevel = skill.proficiency_level >= 1 ? 0 : 1;

            skill.proficiency_level = newLevel;
            await skill.save();

            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);

            // Should individual notification be sent? Maybe too spammy for edits.
        } catch (err) {
            console.error('Toggle skill error:', err);
        }
    });

    socket.on('update-quest-progress', async ({ questId, objectiveId, completed, isQuestComplete }) => {

        console.log(`Received update - quest - progress: `, { questId, objectiveId, completed, isQuestComplete });
        try {
            const quest = await Quest.findByPk(questId, { include: Character });
            if (!quest) {
                console.error(`Quest ${questId} not found`);
                return;
            }

            // Update Objective
            if (objectiveId !== undefined) {
                const newObjectives = (quest.objectives || []).map(obj => {
                    if (obj.id === objectiveId) return { ...obj, completed };
                    return obj;
                });
                quest.objectives = newObjectives;

                const objText = newObjectives.find(o => o.id === objectiveId)?.text || 'Objetivo';
                if (completed) {
                    const charName = quest.Character ? quest.Character.name : 'Alguien';
                    io.emit('notification', {
                        text: `✅ ${charName} completó: ${objText} `,
                        type: 'objective_success'
                    });
                }
            }

            // Update Quest Status
            if (isQuestComplete) {
                console.log(`Marking quest ${questId} as complete...`);
                quest.status = 'Completada';
                io.emit('notification', {
                    text: `🏆 ¡Misión Completada: ${quest.title} !`,
                    type: 'quest_success'
                });
            }

            // Use update for objectives to ensure JSONB change is detected if save() is flaky
            if (objectiveId !== undefined) {
                quest.changed('objectives', true);
            }

            await quest.save();
            console.log(`Quest ${questId} saved successfully.`);

            // Refresh Data
            const qs = await Quest.findAll({ include: Character });
            io.emit('all-quests', qs);
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);

        } catch (err) {
            console.error('Update quest progress error:', err);
        }
    });

    socket.on('get-all-npcs', async () => {
        const npcs = await Character.findAll({
            where: { is_npc: true },
            include: [
                { model: AbilityScore, as: 'abilityScores' },
                { model: Item, as: 'items' },
            ],
        });
        socket.emit('all-npcs', npcs);
    });

    socket.on('create-npc', async (npcData) => {
        try {
            await Character.create({
                ...npcData,
                is_npc: true,
                hp_current: npcData.hp_max, // Default full HP
            });
            const npcs = await Character.findAll({ where: { is_npc: true } });
            io.emit('all-npcs', npcs); // Broadcast to DMs (or just emit back to socket?)
        } catch (e) {
            console.error('Create NPC error:', e);
        }
    });

    // --- END DM TOOLS ---

    socket.on('share-image', async (data) => {
        try {
            const newImage = await Media.create({ url: data.url, caption: data.caption });
            io.emit('image-shared', newImage);
        } catch (err) {
            console.error('Share-image error:', err);
        }
    });

    socket.on('stop-sharing-image', () => {
        io.emit('image-sharing-stopped');
    });

    // --- SPELL SYSTEM ---
    socket.on('get-class-spells', async ({ class_name, class_names }) => {
        try {
            // Acepta una clase o varias (multiclase). Capitaliza para matchear el
            // dnd_class del compendio (inglés): 'ranger' → 'Ranger'.
            let names = Array.isArray(class_names) ? class_names : (class_name ? [class_name] : []);
            names = names.filter(Boolean).map((n) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase());
            if (!names.length) return;

            const cacheKey = names.slice().sort().join('|');
            if (classSpellCache[cacheKey]) {
                socket.emit('class-spells-result', classSpellCache[cacheKey]);
                return;
            }

            // OR sobre todas las clases (un conjuro en ambas listas aparece una vez).
            // Filtramos al SRD oficial (wotc-srd) para evitar duplicados y contenido
            // de terceros que trae Open5e (a5e, Deep Magic, etc.).
            const spells = await Spell.findAll({
                where: {
                    document__slug: 'wotc-srd',
                    [Op.or]: names.map((n) => ({ dnd_class: { [Op.like]: `%${n}%` } })),
                },
                attributes: ['slug', 'name', 'level', 'school', 'range', 'components', 'duration', 'concentration', 'ritual', 'casting_time', 'translation'],
            });

            classSpellCache[cacheKey] = spells;
            socket.emit('class-spells-result', spells);
        } catch (err) {
            console.error('Error fetching class spells:', err);
        }
    });

    // Traduce un conjuro al español (vía IA) y cachea el resultado en la base.
    socket.on('translate-spell', async ({ slug }) => {
        try {
            const spell = await Spell.findOne({ where: { slug } });
            if (!spell) return;
            // Cacheado: si ya está la traducción COMPLETA (con descripción), directo.
            if (spell.translation && spell.translation.desc) {
                socket.emit('spell-translated', { slug, translation: spell.translation, cached: true });
                return;
            }
            // Si solo tenía el nombre (traducción masiva), completamos lo demás.
            const { translateSpell } = require('./utils/translateSpell');
            const translation = await translateSpell(spell);
            spell.translation = { ...(spell.translation || {}), ...translation };
            await spell.save();
            socket.emit('spell-translated', { slug, translation, cached: false });
        } catch (err) {
            console.error('translate-spell error:', err);
            socket.emit('spell-translate-error', {
                slug,
                message: err.code === 'NO_API_KEY' ? 'OPENAI_API_KEY no configurada en el server.' : 'No se pudo traducir el conjuro.',
            });
        }
    });

    socket.on('get-spell-details', async ({ slug }) => {
        try {
            const spell = await Spell.findOne({ where: { slug } });
            if (spell) {
                socket.emit('spell-details-result', spell);
            }
        } catch (err) {
            console.error('Error fetching spell details:', err);
        }
    });

    socket.on('update-hp', async ({ characterId, newHp }) => {
        try {
            const char = await Character.findByPk(characterId);
            if (char) {
                char.hp_current = newHp;
                await char.save();

                if (char.is_npc) {
                    const npcs = await Character.findAll({ where: { is_npc: true } });
                    io.emit('all-npcs', npcs);
                } else {
                    const updatedStats = await getCalculatedPartyStats();
                    io.emit('stats-updated', updatedStats);
                }
            }
        } catch (err) {
            console.error('Update-hp error:', err);
        }
    });

    socket.on('update-character-archetype', async ({ characterId, archetypeSlug }) => {
        try {
            console.log(`Setting archetype ${archetypeSlug} for char ${characterId}`);
            const char = await Character.findByPk(characterId);
            if (char) {
                char.archetype_slug = archetypeSlug;
                await char.save();

                const updatedStats = await getCalculatedPartyStats();
                io.emit('players-data', updatedStats);
                io.emit('stats-updated', updatedStats);
            }
        } catch (err) {
            console.error('Error updating archetype:', err);
        }
    });

    socket.on('update-character-full', async (data) => {
        console.log('Received full character update:', data);
        try {
            const { characterId, diff } = data;
            const char = await Character.findByPk(characterId);
            if (!char) return;

            // Update core stats
            if (diff.name) char.name = diff.name;
            if (diff.race) char.race = diff.race;
            if (diff.class) char.class = diff.class;
            if (diff.race_slug) char.race_slug = diff.race_slug;
            if (diff.class_slug) char.class_slug = diff.class_slug;
            if (diff.level) char.level = parseInt(diff.level);
            if (diff.hp_max) char.hp_max = parseInt(diff.hp_max);
            if (diff.hp_current) char.hp_current = parseInt(diff.hp_current);
            if (diff.ac_base) char.ac_base = parseInt(diff.ac_base);
            if (diff.ac_base) char.ac_base = parseInt(diff.ac_base);
            if (diff.speed) char.speed = parseInt(diff.speed);

            // Magic Updates
            if (diff.spell_slots) char.spell_slots = diff.spell_slots;
            if (diff.spells_known) char.spells_known = diff.spells_known;
            if (diff.spells_prepared) char.spells_prepared = diff.spells_prepared;

            await char.save();

            // Update Ability Scores if provided
            if (diff.abilityScores) {
                const existingScores = await AbilityScore.findAll({ where: { character_id: characterId } });

                for (const [ability, val] of Object.entries(diff.abilityScores)) {
                    const cleanAbility = ability.toUpperCase();
                    const existing = existingScores.find(s => s.ability === cleanAbility);

                    if (existing) {
                        existing.base_value = parseInt(val);
                        await existing.save();
                    } else {
                        await AbilityScore.create({
                            character_id: characterId,
                            ability: cleanAbility,
                            base_value: parseInt(val)
                        });
                    }
                }
            }

            console.log(`Character ${char.name} updated successfully.`);

            // Broadcast updates
            if (char.is_npc) {
                const npcs = await Character.findAll({ where: { is_npc: true } });
                io.emit('all-npcs', npcs);
            }

            // Determine if we need to update party stats (Players OR Active NPCs)
            if (!char.is_npc || char.is_active) {
                const updatedStats = await getCalculatedPartyStats();
                io.emit('stats-updated', updatedStats);
            }
        } catch (err) {
            console.error('Update full character error:', err);
        }
    });

    socket.on('update-position', async (pos) => {
        try {
            const mapState = await MapState.findByPk(1);
            if (mapState) {
                mapState.party_x = pos.x;
                mapState.party_y = pos.y;
                await mapState.save();
            }
            io.emit('party-position-updated', pos);
        } catch (err) {
            console.error('Update-position error:', err);
        }
    });

    // RPG Logic: Using an item (e.g., Potion)
    // RPG Logic: Using an item (e.g., Potion) with Quantity Tracking
    socket.on('use-item', async ({ characterId, itemId }) => {
        await consumeItemLogic(characterId, itemId);
    });

    socket.on('unequip-item', async ({ characterId, slot }) => {
        try {
            const char = await Character.findByPk(characterId);
            if (!char) return;

            const equipment = await EquipmentSlots.findOne({ where: { character_id: characterId } });
            if (equipment) {
                equipment.set(`${slot}_id`, null);
                await equipment.save();

                const updatedStats = await getCalculatedPartyStats();
                io.emit('stats-updated', updatedStats);
                io.emit('notification', { text: `${char.name} se desequipó un objeto.` });
            }
        } catch (err) {
            console.error('Unequip-item error:', err);
        }
    });

    socket.on('equip-item', async ({ characterId, itemId, slot: explicitSlot }) => {
        try {
            const char = await Character.findByPk(characterId);
            const item = await Item.findByPk(itemId);
            if (!char || !item) return;

            const [equipment] = await EquipmentSlots.findOrCreate({ where: { character_id: characterId } });

            // Slot lógico: explícito del cliente > el del item > deducido.
            const logical = explicitSlot || item.slot || deriveSlot(item);
            const slot = resolveSlotColumn(logical, equipment);

            if (!slot) {
                io.emit('notification', { text: `${item.name} no se puede equipar.` });
                return;
            }

            equipment.set(`${slot}_id`, item.id);
            await equipment.save();

            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
            io.emit('notification', { text: `${char.name} se equipó ${item.name}.` });
        } catch (err) {
            console.error('Equip-item error:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// SPA Fallback: Serve index.html for any unknown routes (must be after API routes)
// SPA Fallback: Serve index.html for any unknown routes (must be after API routes)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;

// Database Sync and Server Launch
sequelize.sync({ alter: true }).then(async () => {
    console.log('Database connected and synced.');
    await seedDatabase();
    // Listen on 0.0.0.0 to allow external connections (e.g. from Android Emulator)
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Master Server running on port ${PORT} `);
        console.log(`Listening on all network interfaces (0.0.0.0)`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
