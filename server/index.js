const express = require('express');
const http = require('http');
const { pipeline } = require('stream');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET debe estar configurado.');

const { Op } = require('sequelize');
const sequelize = require('./config/database');
const { Character, Item, AbilityScore, Skill, Quest, EquipmentSlots, MapState, Media, TimelineEvent, Scene, Class, Race, Spell, Blueprint, NpcAction, CharacterAuditLog, CharacterInventory, AudioTrack, GameSession, AssistantConversation, AssistantMessage } = require('./models');
const StatEngine = require('./utils/statEngine');
const { resolveSlotColumn, deriveSlot } = require('./utils/itemSlots');
const seedDatabase = require('./utils/seeder');
const { renderHero, buildSignature } = require('./utils/heroRenderer');
const { getAssistantContext, executeAssistantCommand } = require('./utils/dmAssistant');
const { registerGameSessionSocket } = require('./sockets/gameSessionSocket');
const { resolveCharacterImage } = require('./utils/npcImages');
const { deriveWorldConditions, normalizeWorldTime } = require('./utils/worldTime');

const app = express();
const server = http.createServer(app);

// Simple cache for spell lists
const classSpellCache = {};
const silencedScenes = new Set();

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
const { deleteObject, getObject, headObject, uploadBuffer } = require('./utils/s3Storage');
const MAX_CONCURRENT_MEDIA_STREAMS = 8;
let activeMediaStreams = 0;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, done) => done(null, /^image\/(?:jpeg|png|webp|gif)$/.test(file.mimetype)),
});
const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 120 * 1024 * 1024 },
    fileFilter: (_req, file, done) => done(null, /^audio\/(?:mpeg|ogg|wav|x-wav|mp4|aac|flac)$/.test(file.mimetype)),
});
const authController = require('./controllers/authController');
const { verifyToken, isDm } = require('./middleware/auth');
const gameAssetRoutes = require('./routes/gameAssetRoutes');

// Auth Routes
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', verifyToken, authController.getMe);
app.use('/api/game-assets', gameAssetRoutes);

// POI Routes
app.use('/api/pois', require('./routes/poiRoutes'));

app.use('/npc-images', express.static(path.join(__dirname, 'data', 'npc-images')));
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

app.post('/api/upload', verifyToken, (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('Server: Upload error →', err);
            return res.status(500).json({ message: err.message || 'Fallo al subir la imagen.' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No se recibió una imagen JPG, PNG, WEBP o GIF válida.' });
        }
        uploadBuffer(req.file.buffer, {
            folder: 'images', originalName: req.file.originalname, contentType: req.file.mimetype,
        }).then(result => {
            console.log('Server: image uploaded to S3:', result.key);
            res.json({ url: result.url, key: result.key });
        }).catch(uploadError => {
            console.error('Server: S3 image upload error →', uploadError);
            res.status(uploadError.code === 'S3_NOT_CONFIGURED' ? 503 : 500).json({ message: uploadError.message || 'Fallo al guardar la imagen.' });
        });
    });
});

// Public delivery endpoint backed by the private S3 bucket. Keys are generated
// with UUIDs and cannot be listed. Range support keeps audio seeking efficient.
app.all(/^\/api\/media\/(.+)$/, async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) return res.sendStatus(405);
    let streamSlotAcquired = false;
    try {
        const key = decodeURIComponent(req.params[0]);
        if (!key || key.includes('..') || !key.startsWith(`${process.env.S3_PREFIX || 'production'}/`)) return res.sendStatus(404);
        if (req.method === 'HEAD') {
            const metadata = await headObject(key);
            if (metadata.ContentType) res.type(metadata.ContentType);
            if (metadata.ContentLength != null) res.set('Content-Length', String(metadata.ContentLength));
            res.set('Accept-Ranges', 'bytes');
            res.set('Cache-Control', metadata.CacheControl || 'public, max-age=31536000, immutable');
            return res.status(200).end();
        }
        if (activeMediaStreams >= MAX_CONCURRENT_MEDIA_STREAMS) {
            res.set('Retry-After', '2');
            return res.status(503).end();
        }
        activeMediaStreams += 1;
        streamSlotAcquired = true;
        const object = await getObject(key, req.headers.range);
        if (object.ContentType) res.type(object.ContentType);
        if (object.ContentLength != null) res.set('Content-Length', String(object.ContentLength));
        if (object.ContentRange) res.set('Content-Range', object.ContentRange);
        res.set('Accept-Ranges', object.AcceptRanges || 'bytes');
        res.set('Cache-Control', object.CacheControl || 'public, max-age=31536000, immutable');
        res.status(object.ContentRange ? 206 : 200);
        pipeline(object.Body, res, streamError => {
            activeMediaStreams = Math.max(0, activeMediaStreams - 1);
            streamSlotAcquired = false;
            if (streamError && !res.destroyed) res.destroy(streamError);
        });
    } catch (error) {
        if (streamSlotAcquired) activeMediaStreams = Math.max(0, activeMediaStreams - 1);
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NoSuchKey') return res.sendStatus(404);
        console.error('S3 media delivery error:', error);
        if (!res.headersSent) res.status(500).json({ message: 'No se pudo entregar el archivo.' });
    }
});

app.get('/api/audio/tracks', verifyToken, async (_req, res) => {
    try {
        const tracks = await AudioTrack.findAll({ order: [['name', 'ASC']] });
        res.json(tracks);
    } catch (error) {
        console.error('Audio library error:', error);
        res.status(500).json({ message: 'No se pudo cargar la biblioteca de audio.' });
    }
});

app.post('/api/audio/tracks', verifyToken, isDm, (req, res) => {
    audioUpload.single('audio')(req, res, async error => {
        if (error) return res.status(400).json({ message: error.message || 'No se pudo procesar el audio.' });
        if (!req.file) return res.status(400).json({ message: 'Selecciona un archivo MP3, OGG, WAV, M4A, AAC o FLAC.' });
        try {
            const stored = await uploadBuffer(req.file.buffer, {
                folder: 'audio', originalName: req.file.originalname, contentType: req.file.mimetype,
                name: req.body?.name || req.file.originalname,
            });
            const track = await AudioTrack.create({
                name: String(req.body?.name || req.file.originalname.replace(/\.[^.]+$/, '')).trim().slice(0, 160),
                category: String(req.body?.category || 'Ambiente').trim().slice(0, 80),
                url: stored.url,
                storage_key: stored.key,
                mime_type: req.file.mimetype,
                size_bytes: req.file.size,
                uploaded_by: req.user.id,
            });
            res.status(201).json(track);
        } catch (uploadError) {
            console.error('Audio upload error:', uploadError);
            res.status(uploadError.code === 'S3_NOT_CONFIGURED' ? 503 : 500).json({ message: uploadError.message || 'No se pudo guardar el audio.' });
        }
    });
});

app.delete('/api/audio/tracks/:id', verifyToken, isDm, async (req, res) => {
    try {
        const track = await AudioTrack.findByPk(req.params.id);
        if (!track) return res.status(404).json({ message: 'Tema no encontrado.' });
        await GameSession.update({ audio_track_id: null, audio_status: 'STOPPED', audio_position_seconds: 0, audio_started_at: null }, { where: { audio_track_id: track.id } });
        await deleteObject(track.storage_key);
        await track.destroy();
        res.json({ ok: true });
    } catch (error) {
        console.error('Audio delete error:', error);
        res.status(500).json({ message: 'No se pudo eliminar el tema.' });
    }
});

// AI Narrator Endpoint (Architecture Ready)
app.post('/api/ai/narrate', verifyToken, isDm, async (req, res) => {
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

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('AUTH_REQUIRED'));
    jwt.verify(token, JWT_SECRET, (error, decoded) => {
        if (error) return next(new Error('AUTH_INVALID'));
        socket.user = decoded;
        next();
    });
});

app.get('/api/dm-assistant/context', verifyToken, isDm, async (req, res) => {
    try {
        const sceneId = req.query.sceneId ? parseInt(req.query.sceneId, 10) : null;
        const context = await getAssistantContext({ sceneId, getCalculatedPartyStats });
        res.json(context);
    } catch (err) {
        console.error('DM Assistant context error:', err);
        res.status(500).json({ message: 'No se pudo cargar el contexto del asistente.' });
    }
});

const assistantMessageJson = (message) => ({
    id: String(message.id),
    role: message.role,
    kind: message.kind,
    text: message.text,
    tool: message.tool,
    suggestions: message.suggestions || [],
    undoAvailable: !!message.undo_available,
    createdAt: message.createdAt,
});

app.get('/api/dm-assistant/conversations', verifyToken, isDm, async (req, res) => {
    try {
        const conversations = await AssistantConversation.findAll({
            where: { user_id: req.user.id }, order: [['updatedAt', 'DESC']], limit: 60,
        });
        res.json(conversations);
    } catch (err) {
        console.error('DM Assistant conversations error:', err);
        res.status(500).json({ message: 'No se pudo cargar el historial del asistente.' });
    }
});

app.post('/api/dm-assistant/conversations', verifyToken, isDm, async (req, res) => {
    try {
        const requestedTitle = String(req.body?.title || 'Nueva conversación').trim();
        const conversation = await AssistantConversation.create({
            user_id: req.user.id,
            title: requestedTitle.slice(0, 120) || 'Nueva conversación',
            scene_id: Number.isInteger(req.body?.sceneId) ? req.body.sceneId : null,
        });
        res.status(201).json(conversation);
    } catch (err) {
        console.error('DM Assistant create conversation error:', err);
        res.status(500).json({ message: 'No se pudo crear la conversación.' });
    }
});

app.get('/api/dm-assistant/conversations/:id', verifyToken, isDm, async (req, res) => {
    try {
        const conversation = await AssistantConversation.findOne({ where: { id: req.params.id, user_id: req.user.id } });
        if (!conversation) return res.status(404).json({ message: 'Conversación no encontrada.' });
        const messages = await AssistantMessage.findAll({
            where: { conversation_id: conversation.id }, order: [['createdAt', 'ASC']], limit: 200,
        });
        res.json({ conversation, messages: messages.map(assistantMessageJson) });
    } catch (err) {
        console.error('DM Assistant conversation detail error:', err);
        res.status(500).json({ message: 'No se pudo abrir la conversación.' });
    }
});

app.delete('/api/dm-assistant/conversations/:id', verifyToken, isDm, async (req, res) => {
    try {
        const conversation = await AssistantConversation.findOne({ where: { id: req.params.id, user_id: req.user.id } });
        if (!conversation) return res.status(404).json({ message: 'Conversación no encontrada.' });
        // Explicitly remove its messages as well, even on installations where the
        // foreign-key cascade was created before this model existed.
        await AssistantMessage.destroy({ where: { conversation_id: conversation.id } });
        await conversation.destroy();
        res.json({ ok: true, id: String(conversation.id) });
    } catch (err) {
        console.error('DM Assistant delete conversation error:', err);
        res.status(500).json({ message: 'No se pudo eliminar la conversación.' });
    }
});

app.post('/api/dm-assistant/command', verifyToken, isDm, async (req, res) => {
    try {
        const { message, conversationId, sceneId } = req.body || {};
        let conversation;
        if (conversationId) {
            conversation = await AssistantConversation.findOne({ where: { id: conversationId, user_id: req.user.id } });
            if (!conversation) return res.status(404).json({ message: 'Conversación no encontrada.' });
        } else {
            conversation = await AssistantConversation.create({ user_id: req.user.id, title: 'Nueva conversación' });
        }
        const historyRows = await AssistantMessage.findAll({
            where: { conversation_id: conversation.id }, order: [['createdAt', 'DESC']], limit: 8,
        });
        const history = historyRows.reverse().map(assistantMessageJson);
        const cleanMessage = String(message || '').trim();
        if (conversation.title === 'Nueva conversación' && cleanMessage) {
            await conversation.update({ title: cleanMessage.replace(/\s+/g, ' ').slice(0, 72) });
        }
        await AssistantMessage.create({
            conversation_id: conversation.id, role: 'user', kind: 'user', text: cleanMessage,
        });
        const result = await executeAssistantCommand({
            message: cleanMessage,
            history,
            sceneId: sceneId ? parseInt(sceneId, 10) : null,
            user: req.user,
            io,
            getCalculatedPartyStats,
        });
        const reply = result?.reply || { kind: 'error', text: 'El asistente no devolvió una respuesta.' };
        const storedReply = await AssistantMessage.create({
            conversation_id: conversation.id,
            role: 'assistant',
            kind: reply.kind || 'help',
            text: reply.text || '',
            tool: reply.tool || null,
            suggestions: reply.suggestions || [],
            undo_available: !!reply.undoAvailable,
        });
        await conversation.update({ updatedAt: new Date() });
        // Los errores de interpretación o validación son respuestas normales del
        // asistente: el cliente debe mostrarlas, no tratarlas como un fallo HTTP.
        res.status(200).json({ ...result, conversationId: conversation.id, reply: assistantMessageJson(storedReply) });
    } catch (err) {
        console.error('DM Assistant command error:', err);
        res.status(500).json({
            ok: false,
            reply: {
                kind: 'error',
                text: 'Fallo la ejecucion del asistente del DM.',
            },
        });
    }
});

// Render del héroe con el equipo puesto (OpenAI gpt-image-1 → S3).
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
        const isPrivileged = req.user?.role === 'DM' || req.user?.role === 'ADMIN';
        const ownsCharacter = character.UserId === req.user?.id;
        if (!isPrivileged && (!ownsCharacter || !character.self_edit_enabled)) {
            return res.status(403).json({ message: 'El DM no habilitó la edición de este personaje.' });
        }

        // Indicaciones libres del jugador: si vienen en el body, se guardan y se
        // reaplicarán en este y los próximos renders.
        const previousRenderPrompt = character.render_prompt;
        const previousRenderedUrl = character.rendered_url;
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
        await CharacterAuditLog.create({
            character_id: character.id,
            actor_user_id: req.user.id,
            actor_username: req.user.username || req.user.email || 'Usuario',
            actor_role: req.user.role,
            source: isPrivileged ? 'dm-hero-render' : 'player-hero-render',
            changes: {
                rendered_url: { before: previousRenderedUrl, after: url },
                ...(previousRenderPrompt !== character.render_prompt ? { render_prompt: { before: previousRenderPrompt, after: character.render_prompt } } : {}),
            },
        });

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
const buildCalculatedPartyStats = async () => {
    const characters = await Character.findAll({
        where: {
            [Op.or]: [
                { is_npc: false },
                { is_active: true }
            ]
        },
        include: [
            // Fetch has-many collections independently. Joining abilities,
            // skills and quests in one query multiplies rows per character and
            // can exhaust the Node heap as the roster grows.
            { model: AbilityScore, as: 'abilityScores', separate: true },
            { model: Skill, as: 'skills', separate: true },
            { model: Quest, as: 'quests', separate: true },
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

    const allBlueprints = await Blueprint.findAll();
    const blueprintMap = {};
    allBlueprints.forEach(blueprint => { blueprintMap[blueprint.slug] = blueprint; });

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
            subrace: char.subrace,
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
            hp_temp: char.hp_temp,
            ac_base: char.ac_base,
            initiative_bonus: char.initiative_bonus,
            background: char.background,
            alignment: char.alignment,
            inspiration: char.inspiration,
            notes: char.notes,
            saving_throws: char.saving_throws,
            self_edit_enabled: char.self_edit_enabled,
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
            image_offset_y: char.image_offset_y,
            is_npc: char.is_npc,
            // Magic
            spell_slots: char.spell_slots,
            spells_known: char.spells_known,
            spells_prepared: char.spells_prepared,
            blueprints_known: char.blueprints_known,
            blueprints: (Array.isArray(char.blueprints_known) ? char.blueprints_known : [])
                .map(slug => blueprintMap[slug])
                .filter(Boolean),
            talent_choices: char.talent_choices,
            feature_choices: char.feature_choices,
            UserId: char.UserId, // Critical for frontend identity
        };
    });
};

let partyStatsSnapshot = null;
let partyStatsSnapshotAt = 0;
let partyStatsInFlight = null;
const getCalculatedPartyStats = async () => {
    const now = Date.now();
    if (partyStatsSnapshot && now - partyStatsSnapshotAt < 1500) return partyStatsSnapshot;
    if (partyStatsInFlight) return partyStatsInFlight;
    partyStatsInFlight = buildCalculatedPartyStats();
    try {
        partyStatsSnapshot = await partyStatsInFlight;
        partyStatsSnapshotAt = Date.now();
        return partyStatsSnapshot;
    } finally {
        partyStatsInFlight = null;
    }
};

const DM_ROLES = new Set(['DM', 'ADMIN']);
const EDITABLE_CHARACTER_FIELDS = {
    name: 'string', race: 'string', subrace: 'string', class: 'string', background: 'string', alignment: 'string', notes: 'string',
    level: 'number', xp: 'number', gold: 'number', hp_current: 'number', hp_max: 'number', hp_temp: 'number',
    ac_base: 'number', initiative_bonus: 'number', speed: 'number', inspiration: 'boolean',
    abilities_text: 'string', spell_slots: 'json', spells_known: 'json', spells_prepared: 'json', blueprints_known: 'json',
    custom_features: 'json', talent_choices: 'json', feature_choices: 'json',
    image_url: 'string', base_body_url: 'string', image_scale: 'float', image_offset_x: 'float', image_offset_y: 'float',
    rendered_url: 'string', npc_type: 'string', origin: 'string', creature_type: 'string', size: 'string', challenge_rating: 'string',
    proficiency_bonus: 'number', passive_perception: 'number', damage_resistances: 'json', damage_vulnerabilities: 'json',
    damage_immunities: 'json', condition_immunities: 'json', senses: 'json', languages: 'json',
};

function isDmUser(socket) {
    return DM_ROLES.has(socket.user?.role);
}

function fail(socket, message) {
    socket.emit('character:error', { message });
    return null;
}

function canEditCharacter(socket, character) {
    return isDmUser(socket) || (
        socket.user?.role === 'PLAYER'
        && character.UserId === socket.user.id
        && character.self_edit_enabled
    );
}

function playerRoom(userId) {
    return `player:${userId}`;
}

function emitPlayerToast(io, character, payload) {
    if (!character?.UserId) return;
    io.to(playerRoom(character.UserId)).emit('player:toast', {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        characterId: character.id,
        ...payload,
    });
}

function normalizedFieldValue(type, value) {
    if (type === 'number') return Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : null;
    if (type === 'float') return Number.isFinite(Number(value)) ? Number(value) : null;
    if (type === 'boolean') return Boolean(value);
    if (type === 'json') return value && typeof value === 'object' ? value : (Array.isArray(value) ? value : {});
    return String(value ?? '').trim().slice(0, type === 'string' ? 4000 : 255);
}

function valuesEqual(before, after) {
    if (before && typeof before === 'object') return JSON.stringify(before) === JSON.stringify(after);
    return before === after;
}

async function updateCharacterSecure(io, socket, characterId, diff = {}, source = 'character-editor') {
    const character = await Character.findByPk(characterId, {
        include: [{ model: AbilityScore, as: 'abilityScores' }, { model: Skill, as: 'skills' }],
    });
    if (!character) throw new Error('Personaje no encontrado.');
    if (!canEditCharacter(socket, character)) throw new Error('No tienes permiso para editar este personaje.');

    const changes = {};
    await sequelize.transaction(async transaction => {
        const coreUpdates = {};
        for (const [field, type] of Object.entries(EDITABLE_CHARACTER_FIELDS)) {
            if (!Object.prototype.hasOwnProperty.call(diff, field)) continue;
            // La CA de un PJ se deriva exclusivamente del equipo equipado.
            // ac_base queda reservada para NPCs con CA plana.
            if (field === 'ac_base' && !character.is_npc) continue;
            const next = normalizedFieldValue(type, diff[field]);
            if (next === null || valuesEqual(character[field], next)) continue;
            changes[field] = { before: character[field], after: next };
            coreUpdates[field] = next;
        }

        if ((diff.savingThrows || diff.saving_throws) && typeof (diff.savingThrows || diff.saving_throws) === 'object') {
            const requestedSaves = diff.saving_throws || diff.savingThrows;
            const next = {};
            ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(key => {
                if (!requestedSaves[key]) return;
                // Los NPCs pueden declarar el bono final de salvación; para
                // fichas de jugador se conserva el booleano de competencia.
                next[key] = character.is_npc && isDmUser(socket) && Number.isFinite(Number(requestedSaves[key]))
                    ? Number(requestedSaves[key])
                    : true;
            });
            if (!valuesEqual(character.saving_throws || {}, next)) {
                changes.saving_throws = { before: character.saving_throws || {}, after: next };
                coreUpdates.saving_throws = next;
            }
        }
        if (Object.keys(coreUpdates).length) await character.update(coreUpdates, { transaction });

        if (diff.abilityScores && typeof diff.abilityScores === 'object') {
            const before = {};
            const after = {};
            for (const ability of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
                if (!Object.prototype.hasOwnProperty.call(diff.abilityScores, ability)) continue;
                const next = Math.max(1, Math.min(30, Math.trunc(Number(diff.abilityScores[ability]) || 10)));
                let score = character.abilityScores.find(item => item.ability === ability);
                const previous = score ? Number(score.base_value) : null;
                if (previous === next) continue;
                before[ability] = previous;
                if (score) await score.update({ base_value: next }, { transaction });
                else score = await AbilityScore.create({ character_id: character.id, ability, base_value: next, bonus_value: 0 }, { transaction });
                after[ability] = next;
            }
            if (Object.keys(after).length) changes.abilityScores = { before, after };
        }

        if (diff.skills && typeof diff.skills === 'object') {
            const before = {};
            const after = {};
            for (const [name, enabled] of Object.entries(diff.skills)) {
                const safeName = String(name).trim().slice(0, 80);
                if (!safeName) continue;
                let skill = character.skills.find(item => item.name === safeName);
                const previous = Number(skill?.proficiency_level || 0);
                const level = enabled ? 1 : 0;
                if (previous === level) continue;
                before[safeName] = previous;
                if (skill) await skill.update({ proficiency_level: level }, { transaction });
                else skill = await Skill.create({ character_id: character.id, name: safeName, proficiency_level: level }, { transaction });
                after[safeName] = level;
            }
            if (Object.keys(after).length) changes.skills = { before, after };
        }

        if (Object.keys(changes).length) {
            await CharacterAuditLog.create({
                character_id: character.id,
                actor_user_id: socket.user?.id || null,
                actor_username: socket.user?.username || socket.user?.email || 'Usuario',
                actor_role: socket.user?.role || 'UNKNOWN',
                source,
                changes,
            }, { transaction });
        }
    });

    const updatedStats = await getCalculatedPartyStats();
    io.emit('stats-updated', updatedStats);
    if (character.is_npc) {
        npcSnapshot = null;
        await emitNpcCatalog(io);
    }
    if (isDmUser(socket) && changes.gold) {
        const before = Number(changes.gold.before || 0);
        const after = Number(changes.gold.after || 0);
        const amount = after - before;
        if (amount) emitPlayerToast(io, character, {
            type: amount > 0 ? 'gold_received' : 'gold_lost',
            eyebrow: 'Recompensa del Dungeon Master',
            title: amount > 0 ? 'Recibiste oro' : 'Se retiró oro',
            text: amount > 0 ? `El DM agregó ${amount} de oro a tu bolsa.` : `El DM retiró ${Math.abs(amount)} de oro de tu bolsa.`,
            amount: Math.abs(amount),
            total: after,
            actor: { name: 'Dungeon Master', role: 'DM' },
        });
    }
    return { character: updatedStats.find(item => item.id === Number(characterId)), changes };
}

const buildNpcsForClient = async ({ partyOnly = false } = {}) => {
    const npcs = await Character.findAll({
        where: partyOnly
            ? { is_npc: true, [Op.or]: [{ party_known: true }, { party_known: null }] }
            : { is_npc: true },
        include: [
            { model: AbilityScore, as: 'abilityScores', separate: true },
            { model: Skill, as: 'skills', separate: true },
            { model: Item, as: 'items' },
            { model: NpcAction, as: 'npcActions', separate: true },
        ],
    });

    return npcs.map(npc => {
        const payload = npc.toJSON();
        return { ...payload, image_url: resolveCharacterImage(payload) };
    });
};

let npcSnapshot = null;
let npcSnapshotAt = 0;
let npcsInFlight = null;
const getNpcsForClient = async ({ partyOnly = false } = {}) => {
    if (partyOnly) return buildNpcsForClient({ partyOnly: true });
    const now = Date.now();
    if (npcSnapshot && now - npcSnapshotAt < 1500) return npcSnapshot;
    if (npcsInFlight) return npcsInFlight;
    npcsInFlight = buildNpcsForClient();
    try {
        npcSnapshot = await npcsInFlight;
        npcSnapshotAt = Date.now();
        return npcSnapshot;
    } finally {
        npcsInFlight = null;
    }
};

const emitNpcCatalog = async (io) => {
    const [dmNpcs, partyNpcs] = await Promise.all([
        getNpcsForClient(),
        getNpcsForClient({ partyOnly: true }),
    ]);
    io.sockets.sockets.forEach(client => {
        client.emit('all-npcs', isDmUser(client) ? dmNpcs : partyNpcs);
    });
};

io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);
    socket.join(playerRoom(socket.user.id));
    // Live-table state, annotations, and media tools share this socket contract.
    registerGameSessionSocket(io, socket);

    socket.on('character:update', async ({ characterId, diff } = {}, reply = () => {}) => {
        try {
            const result = await updateCharacterSecure(io, socket, characterId, diff, isDmUser(socket) ? 'dm-editor' : 'player-editor');
            reply({ ok: true, ...result });
        } catch (error) {
            reply({ ok: false, message: error.message || 'No se pudo actualizar el personaje.' });
        }
    });

    socket.on('character:set-self-edit', async ({ characterId, enabled } = {}, reply = () => {}) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede cambiar este permiso.');
            const character = await Character.findByPk(characterId);
            if (!character || character.is_npc) throw new Error('Jugador no encontrado.');
            const before = Boolean(character.self_edit_enabled);
            const after = Boolean(enabled);
            if (before !== after) {
                await sequelize.transaction(async transaction => {
                    await character.update({ self_edit_enabled: after }, { transaction });
                    await CharacterAuditLog.create({
                        character_id: character.id,
                        actor_user_id: socket.user.id,
                        actor_username: socket.user.username || socket.user.email || 'DM',
                        actor_role: socket.user.role,
                        source: 'permission-control',
                        changes: { self_edit_enabled: { before, after } },
                    }, { transaction });
                });
            }
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
            reply({ ok: true, enabled: after });
        } catch (error) {
            reply({ ok: false, message: error.message || 'No se pudo cambiar el permiso.' });
        }
    });

    socket.on('character:audit:list', async ({ characterId, limit = 100 } = {}, reply = () => {}) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede consultar el historial.');
            const logs = await CharacterAuditLog.findAll({
                where: { character_id: characterId },
                order: [['createdAt', 'DESC']],
                limit: Math.max(1, Math.min(250, Number(limit) || 100)),
            });
            reply({ ok: true, logs });
        } catch (error) {
            reply({ ok: false, message: error.message || 'No se pudo cargar el historial.' });
        }
    });

    // The live table needs this catalog during its initial socket handshake.
    socket.on('get-all-npcs', async (ack) => {
        try {
            const npcs = await getNpcsForClient({ partyOnly: !isDmUser(socket) });
            socket.emit('all-npcs', npcs);
            if (typeof ack === 'function') ack({ ok: true, npcs });
        } catch (error) {
            console.error('Get NPCs error:', error);
            if (typeof ack === 'function') ack({ ok: false, message: 'No se pudieron cargar los NPCs.' });
        }
    });

    // --- TIMELINE / CHAT ---
    socket.on('get-timeline', async (sceneId) => {
        try {
            if (sceneId && !isDmUser(socket)) {
                const scene = await Scene.findByPk(sceneId);
                const character = await Character.findOne({ where: { UserId: socket.user.id, is_npc: false } });
                if (!scene || !character || !(await scene.hasParticipant(character))) {
                    throw new Error('No tienes acceso a esta escena.');
                }
            }
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
            const visibleEvents = isDmUser(socket)
                ? events
                : events.filter(event => event.metadata?.mode !== 'THINK' || event.author?.UserId === socket.user.id);
            socket.emit('timeline-data', visibleEvents.reverse());
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
            const visibleScenes = isDmUser(socket)
                ? scenes
                : scenes.filter(scene => scene.participants.some(character => character.UserId === socket.user.id));
            socket.emit('scenes-data', visibleScenes);
        } catch (err) {
            console.error('Get scenes error:', err);
        }
    });

    socket.on('create-scene', async (data) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede crear escenas.');
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
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede cambiar participantes.');
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
    socket.on('toggle-silence', ({ sceneId, isSilenced }) => {
        if (!isDmUser(socket)) return fail(socket, 'Sólo el DM puede silenciar una escena.');
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
            const conditions = deriveWorldConditions(state.global_time);
            if (state.global_time !== conditions.time || state.day_period !== conditions.dayPeriod || state.temperature_c !== conditions.temperatureC) {
                await state.update({ global_time: conditions.time, day_period: conditions.dayPeriod, temperature_c: conditions.temperatureC });
            }
            socket.emit('global-state-data', state);
        } catch (err) {
            console.error('Get global state error:', err);
        }
    });

    socket.on('update-global-state', async (data = {}, reply = () => {}) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede cambiar el estado del mundo.');
            const { global_time, global_location } = data;
            const [state] = await MapState.findOrCreate({ where: { id: 1 } });

            if (global_time !== undefined) {
                const normalizedTime = normalizeWorldTime(global_time);
                if (!normalizedTime) throw new Error('La hora debe tener formato HH:MM.');
                const conditions = deriveWorldConditions(normalizedTime);
                state.global_time = conditions.time;
                state.day_period = conditions.dayPeriod;
                state.temperature_c = conditions.temperatureC;
            }
            if (global_location !== undefined) state.global_location = global_location;

            await state.save();
            // Broadcast to absolutely everyone connected
            io.emit('global-state-data', state);
            reply({ ok: true, state });
        } catch (err) {
            console.error('Update global state error:', err);
            reply({ ok: false, message: err.message || 'No se pudo cambiar el estado del mundo.' });
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
            const { text, mode, author_id, image, replyTo, type, sceneId } = data;
            if (!String(text || '').trim()) throw new Error('El mensaje no puede estar vacío.');
            const author = await Character.findByPk(author_id);
            if (!author || (!isDmUser(socket) && author.UserId !== socket.user.id)) {
                throw new Error('No tienes permiso para hablar como ese personaje.');
            }
            if (sceneId && !isDmUser(socket)) {
                const scene = await Scene.findByPk(sceneId);
                if (!scene || !(await scene.hasParticipant(author))) throw new Error('Tu personaje no participa de esta escena.');
            }
            if (mode === 'DO' && author.is_npc) throw new Error('Los NPC no pueden declarar acciones de jugador.');

            const newMessage = await TimelineEvent.create({
                type: type || 'CHAT',
                content: String(text).trim().slice(0, 5000),
                author_id: author.id,
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
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede resolver acciones o editar mensajes.');

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
        const sharedMedia = await Media.findAll({ limit: 20, order: [['timestamp', 'DESC']] });
        const mapState = await MapState.findByPk(1);

        socket.emit('init', {
            sharedMedia,
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
            if (!isDmUser(socket)) return fail(socket, 'Sólo el DM puede editar objetos.');
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
        if (!isDmUser(socket)) return fail(socket, 'Sólo el DM puede consultar el grupo completo.');
        const players = await getCalculatedPartyStats();
        socket.emit('all-players', players.filter(character => !character.is_npc));
    });

    socket.on('assign-item', async ({ characterId, itemId, quantity = 1 } = {}, reply = () => {}) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede asignar objetos.');
            const char = await Character.findByPk(characterId);
            const item = await Item.findByPk(itemId);
            if (!char || !item || char.is_npc) throw new Error('Jugador u objeto no encontrado.');
            const added = Math.max(1, Math.min(999, Math.trunc(Number(quantity) || 1)));
            const [inventoryRow, created] = await CharacterInventory.findOrCreate({
                where: { character_id: char.id, item_id: item.id },
                defaults: { quantity: added },
            });
            const before = created ? 0 : Number(inventoryRow.quantity || 1);
            const after = created ? added : Math.min(999, before + added);
            if (!created) await inventoryRow.update({ quantity: after });
            await CharacterAuditLog.create({
                character_id: char.id,
                actor_user_id: socket.user.id,
                actor_username: socket.user.username || socket.user.email || 'DM',
                actor_role: socket.user.role,
                source: 'dm-inventory-add',
                changes: { inventory: { before: { item_id: item.id, name: item.name, quantity: before }, after: { item_id: item.id, name: item.name, quantity: after } } },
            });
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
            emitPlayerToast(io, char, {
                type: 'item_received',
                eyebrow: 'Obsequio del Dungeon Master',
                title: 'Nuevo objeto recibido',
                text: `El DM agregó ${added} × ${item.name} a tu inventario.`,
                actor: { name: 'Dungeon Master', role: 'DM' },
                item: { id: item.id, name: item.name, imageUrl: item.image_url, rarity: item.rarity, type: item.type, quantity: added },
            });
            reply({ ok: true, quantity: after });
        } catch (e) {
            console.error('Assign item error:', e);
            fail(socket, e.message || 'No se pudo asignar el objeto.');
            reply({ ok: false, message: e.message || 'No se pudo asignar el objeto.' });
        }
    });

    socket.on('poi:visibility-changed', async ({ poiId } = {}) => {
        if (!isDmUser(socket)) return;
        const poi = await PointOfInterest.findByPk(Number(poiId), { attributes: ['id', 'parent_id', 'party_known'] });
        if (!poi) return;
        io.emit('poi:visibility-changed', poi.toJSON());
    });

    socket.on('character:item:set-quantity', async ({ characterId, itemId, quantity } = {}, reply = () => {}) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede administrar inventarios.');
            const [char, item, inventoryRow] = await Promise.all([
                Character.findByPk(characterId),
                Item.findByPk(itemId),
                CharacterInventory.findOne({ where: { character_id: characterId, item_id: itemId } }),
            ]);
            if (!char || !item || !inventoryRow || char.is_npc) throw new Error('El objeto no está en el inventario del jugador.');
            const before = Number(inventoryRow.quantity || 1);
            const after = Math.max(0, Math.min(999, Math.trunc(Number(quantity) || 0)));
            const clearedSlots = [];
            await sequelize.transaction(async transaction => {
                if (after === 0) {
                    const equipment = await EquipmentSlots.findOne({ where: { character_id: char.id }, transaction });
                    if (equipment) {
                        for (const slot of ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon']) {
                            if (Number(equipment.get(`${slot}_id`)) === Number(item.id)) {
                                equipment.set(`${slot}_id`, null);
                                clearedSlots.push(slot);
                            }
                        }
                        if (clearedSlots.length) await equipment.save({ transaction });
                    }
                    await inventoryRow.destroy({ transaction });
                } else if (after !== before) {
                    await inventoryRow.update({ quantity: after }, { transaction });
                }
                if (after !== before) await CharacterAuditLog.create({
                    character_id: char.id,
                    actor_user_id: socket.user.id,
                    actor_username: socket.user.username || socket.user.email || 'DM',
                    actor_role: socket.user.role,
                    source: after === 0 ? 'dm-inventory-remove' : 'dm-inventory-quantity',
                    changes: {
                        inventory: { before: { item_id: item.id, name: item.name, quantity: before }, after: after ? { item_id: item.id, name: item.name, quantity: after } : null },
                        ...(clearedSlots.length ? { equipment: { before: clearedSlots, after: [] } } : {}),
                    },
                }, { transaction });
            });
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
            io.emit('notification', { text: after === 0 ? `${item.name} fue retirado de ${char.name}.` : `${item.name}: cantidad actualizada a ${after}.` });
            reply({ ok: true, quantity: after });
        } catch (error) {
            fail(socket, error.message || 'No se pudo modificar el inventario.');
            reply({ ok: false, message: error.message || 'No se pudo modificar el inventario.' });
        }
    });

    socket.on('character:share-targets', async (reply = () => {}) => {
        try {
            const ownCharacters = await Character.findAll({ where: { UserId: socket.user.id, is_npc: false }, attributes: ['id'] });
            const ownIds = ownCharacters.map(character => character.id);
            const targets = await Character.findAll({
                where: { is_npc: false, UserId: { [Op.ne]: null }, ...(ownIds.length ? { id: { [Op.notIn]: ownIds } } : {}) },
                attributes: ['id', 'name', 'image_url', 'rendered_url'],
                order: [['name', 'ASC']],
            });
            reply({ ok: true, targets: targets.map(target => ({ id: target.id, name: target.name, imageUrl: resolveCharacterImage(target) })) });
        } catch (error) {
            reply({ ok: false, message: 'No se pudieron cargar los compañeros.' });
        }
    });

    socket.on('character:item:share', async ({ fromCharacterId, toCharacterId, itemId } = {}, reply = () => {}) => {
        try {
            if (socket.user.role !== 'PLAYER') throw new Error('Sólo los jugadores pueden compartir objetos entre sí.');
            const [source, target, item, sourceRow] = await Promise.all([
                Character.findByPk(fromCharacterId),
                Character.findByPk(toCharacterId),
                Item.findByPk(itemId),
                CharacterInventory.findOne({ where: { character_id: fromCharacterId, item_id: itemId } }),
            ]);
            if (!source || source.UserId !== socket.user.id || !source.self_edit_enabled) throw new Error('El DM no habilitó la edición de tu inventario.');
            if (!target || target.is_npc || !target.UserId || target.id === source.id) throw new Error('El destinatario no es válido.');
            if (!item || !sourceRow || Number(sourceRow.quantity || 0) < 1) throw new Error('Ya no tenés ese objeto disponible.');
            const sourceBefore = Number(sourceRow.quantity || 1);
            let targetAfter = 1;
            const clearedSlots = [];
            await sequelize.transaction(async transaction => {
                if (sourceBefore === 1) {
                    const equipment = await EquipmentSlots.findOne({ where: { character_id: source.id }, transaction });
                    if (equipment) {
                        for (const slot of ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon']) {
                            if (Number(equipment.get(`${slot}_id`)) === Number(item.id)) {
                                equipment.set(`${slot}_id`, null);
                                clearedSlots.push(slot);
                            }
                        }
                        if (clearedSlots.length) await equipment.save({ transaction });
                    }
                    await sourceRow.destroy({ transaction });
                } else {
                    await sourceRow.update({ quantity: sourceBefore - 1 }, { transaction });
                }
                const [targetRow, created] = await CharacterInventory.findOrCreate({
                    where: { character_id: target.id, item_id: item.id },
                    defaults: { quantity: 1 },
                    transaction,
                });
                if (!created) {
                    targetAfter = Math.min(999, Number(targetRow.quantity || 1) + 1);
                    await targetRow.update({ quantity: targetAfter }, { transaction });
                }
                const auditBase = {
                    actor_user_id: socket.user.id,
                    actor_username: source.name,
                    actor_role: socket.user.role,
                    source: 'player-item-share',
                };
                await CharacterAuditLog.create({ ...auditBase, character_id: source.id, changes: { inventory: { before: { item_id: item.id, name: item.name, quantity: sourceBefore }, after: sourceBefore > 1 ? { item_id: item.id, name: item.name, quantity: sourceBefore - 1 } : null }, recipient: { before: null, after: { character_id: target.id, name: target.name } }, ...(clearedSlots.length ? { equipment: { before: clearedSlots, after: [] } } : {}) } }, { transaction });
                await CharacterAuditLog.create({ ...auditBase, character_id: target.id, changes: { inventory: { before: { item_id: item.id, name: item.name, quantity: targetAfter - 1 }, after: { item_id: item.id, name: item.name, quantity: targetAfter } }, sender: { before: null, after: { character_id: source.id, name: source.name } } } }, { transaction });
            });
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
            emitPlayerToast(io, target, {
                type: 'item_shared',
                eyebrow: 'Regalo de un compañero',
                title: `${source.name} compartió un objeto`,
                text: `${item.name} fue añadido a tu inventario.`,
                actor: { name: source.name, role: 'Jugador', imageUrl: resolveCharacterImage(source) },
                item: { id: item.id, name: item.name, imageUrl: item.image_url, rarity: item.rarity, type: item.type, quantity: 1 },
            });
            emitPlayerToast(io, source, {
                type: 'item_sent',
                eyebrow: 'Intercambio completado',
                title: `Objeto enviado a ${target.name}`,
                text: `Compartiste 1 × ${item.name}.`,
                actor: { name: target.name, role: 'Jugador', imageUrl: resolveCharacterImage(target) },
                item: { id: item.id, name: item.name, imageUrl: item.image_url, rarity: item.rarity, type: item.type, quantity: 1 },
            });
            reply({ ok: true });
        } catch (error) {
            fail(socket, error.message || 'No se pudo compartir el objeto.');
            reply({ ok: false, message: error.message || 'No se pudo compartir el objeto.' });
        }
    });

    // El DM otorga XP. Si el total cruza un umbral, sube de nivel en el acto
    // (puede subir varios niveles de una). characterIds: array de ids.
    socket.on('award-xp', async ({ characterIds, amount }) => {
        try {
            if (!isDmUser(socket)) return fail(socket, 'Sólo el DM puede otorgar experiencia.');
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
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede asignar misiones.');
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
            await updateCharacterSecure(io, socket, characterId, {
                image_url: imageUrl,
                image_scale: scale,
                image_offset_x: offsetX,
                image_offset_y: offsetY
            }, isDmUser(socket) ? 'dm-character-image' : 'player-character-image');
        } catch (err) {
            console.error('Update character image error:', err);
            fail(socket, err.message);
        }
    });

    socket.on('update-character-base-body', async ({ characterId, imageUrl }) => {
        try {
            await updateCharacterSecure(io, socket, characterId, { base_body_url: imageUrl }, isDmUser(socket) ? 'dm-base-body' : 'player-base-body');
        } catch (err) {
            console.error('Update character base body error:', err);
            fail(socket, err.message);
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
            if (!char || !canEditCharacter(socket, char)) return fail(socket, 'No tienes permiso para editar talentos.');

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
            await CharacterAuditLog.create({ character_id: char.id, actor_user_id: socket.user.id, actor_username: socket.user.username || 'Usuario', actor_role: socket.user.role, source: 'talent-choice', changes: { talent_choices: { after: choices } } });

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
            if (!char || !canEditCharacter(socket, char)) return fail(socket, 'No tienes permiso para editar rasgos.');
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
            await CharacterAuditLog.create({ character_id: char.id, actor_user_id: socket.user.id, actor_username: socket.user.username || 'Usuario', actor_role: socket.user.role, source: 'feature-choice', changes: { feature_choices: { after: choices } } });
            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
        } catch (err) {
            console.error('choose-feature error:', err);
        }
    });

    socket.on('update-abilities-text', async ({ characterId, text }) => {
        try {
            await updateCharacterSecure(io, socket, characterId, { abilities_text: text }, isDmUser(socket) ? 'dm-abilities' : 'player-abilities');
        } catch (err) {
            console.error('Update abilities text error:', err);
            fail(socket, err.message);
        }
    });

    socket.on('update-custom-features', async ({ characterId, customFeatures }) => {
        try {
            await updateCharacterSecure(io, socket, characterId, { custom_features: Array.isArray(customFeatures) ? customFeatures : [] }, isDmUser(socket) ? 'dm-features' : 'player-features');
        } catch (err) {
            console.error('Update custom features error:', err);
            fail(socket, err.message);
        }
    });

    socket.on('toggle-skill-proficiency', async ({ characterId, skillName }) => {
        try {
            const character = await Character.findByPk(characterId);
            if (!character || !canEditCharacter(socket, character)) return fail(socket, 'No tienes permiso para editar competencias.');
            const [skill, created] = await Skill.findOrCreate({
                where: { character_id: characterId, name: skillName },
                defaults: { proficiency_level: 0 }
            });

            // Toggle: If 0 -> 1, If >= 1 -> 0
            // (Simple toggle for now. Could cycle 0->1->2->0 for Expertise later)
            const newLevel = skill.proficiency_level >= 1 ? 0 : 1;

            skill.proficiency_level = newLevel;
            await skill.save();

            await CharacterAuditLog.create({
                character_id: character.id,
                actor_user_id: socket.user.id,
                actor_username: socket.user.username || socket.user.email || 'Usuario',
                actor_role: socket.user.role,
                source: isDmUser(socket) ? 'dm-skill-toggle' : 'player-skill-toggle',
                changes: { skills: { before: { [skillName]: newLevel ? 0 : 1 }, after: { [skillName]: newLevel } } },
            });

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
            if (!isDmUser(socket) && quest.Character?.UserId !== socket.user.id) {
                return fail(socket, 'No tienes permiso para actualizar esta misión.');
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

    socket.on('create-npc', async (npcData, reply = () => {}) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede crear NPCs.');
            const npc = await Character.create({
                ...npcData,
                is_npc: true,
                party_known: Boolean(npcData.party_known),
                hp_current: npcData.hp_max, // Default full HP
            });
            npcSnapshot = null;
            await emitNpcCatalog(io);
            reply({ ok: true, npc });
        } catch (e) {
            console.error('Create NPC error:', e);
            reply({ ok: false, message: e.message || 'No se pudo crear el NPC.' });
        }
    });

    socket.on('npc:set-party-known', async ({ characterId, partyKnown } = {}, reply = () => {}) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede cambiar el conocimiento de la party.');
            const npc = await Character.findOne({ where: { id: Number(characterId), is_npc: true } });
            if (!npc) throw new Error('NPC no encontrado.');
            npc.party_known = Boolean(partyKnown);
            await npc.save();
            npcSnapshot = null;
            await emitNpcCatalog(io);
            reply({ ok: true, partyKnown: npc.party_known });
        } catch (error) {
            console.error('NPC party knowledge error:', error);
            reply({ ok: false, message: error.message || 'No se pudo cambiar la visibilidad del NPC.' });
        }
    });

    // --- END DM TOOLS ---

    socket.on('share-image', async (data) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede compartir imágenes.');
            const newImage = await Media.create({ url: data.url, caption: data.caption });
            io.emit('image-shared', newImage);
        } catch (err) {
            console.error('Share-image error:', err);
        }
    });

    socket.on('stop-sharing-image', () => {
        if (!isDmUser(socket)) return fail(socket, 'Sólo el DM puede ocultar la imagen compartida.');
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
            await updateCharacterSecure(io, socket, characterId, { hp_current: newHp }, isDmUser(socket) ? 'dm-hp-control' : 'player-hp-control');
        } catch (err) {
            console.error('Update-hp error:', err);
            fail(socket, err.message);
        }
    });

    socket.on('npc:save-actions', async ({ characterId, actions } = {}, reply = () => {}) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede editar acciones de NPC.');
            const npc = await Character.findOne({ where: { id: characterId, is_npc: true } });
            if (!npc) throw new Error('NPC no encontrado.');
            await sequelize.transaction(async transaction => {
                await NpcAction.destroy({ where: { character_id: npc.id }, transaction });
                for (const [index, raw] of (Array.isArray(actions) ? actions.slice(0, 40) : []).entries()) {
                    const action = raw || {};
                    const name = String(action.name || '').trim().slice(0, 120);
                    if (!name) continue;
                    await NpcAction.create({
                        character_id: npc.id, name, action_type: String(action.action_type || 'acción').trim().slice(0, 24),
                        description: String(action.description || '').trim().slice(0, 5000) || null,
                        attack_bonus: Number.isFinite(Number(action.attack_bonus)) ? Number(action.attack_bonus) : null,
                        damage_dice: String(action.damage_dice || '').trim().slice(0, 32) || null,
                        damage_bonus: Number.isFinite(Number(action.damage_bonus)) ? Number(action.damage_bonus) : null,
                        damage_type: String(action.damage_type || '').trim().slice(0, 40) || null,
                        reach: String(action.reach || '').trim().slice(0, 60) || null,
                        save_ability: String(action.save_ability || '').trim().toUpperCase().slice(0, 3) || null,
                        save_dc: Number.isFinite(Number(action.save_dc)) ? Number(action.save_dc) : null,
                        recharge: String(action.recharge || '').trim().slice(0, 24) || null,
                        max_uses: Number.isFinite(Number(action.max_uses)) ? Number(action.max_uses) : null,
                        used_uses: Math.max(0, Number(action.used_uses) || 0), is_public: Boolean(action.is_public), sort_order: index,
                    }, { transaction });
                }
            });
            npcSnapshot = null;
            await emitNpcCatalog(io);
            reply({ ok: true });
        } catch (error) { reply({ ok: false, message: error.message || 'No se pudieron guardar las acciones.' }); }
    });

    socket.on('update-character-archetype', async ({ characterId, archetypeSlug }) => {
        try {
            console.log(`Setting archetype ${archetypeSlug} for char ${characterId}`);
            const char = await Character.findByPk(characterId);
            if (char && canEditCharacter(socket, char)) {
                const before = char.archetype_slug;
                char.archetype_slug = archetypeSlug;
                await char.save();
                await CharacterAuditLog.create({
                    character_id: char.id,
                    actor_user_id: socket.user.id,
                    actor_username: socket.user.username || socket.user.email || 'Usuario',
                    actor_role: socket.user.role,
                    source: 'character-archetype',
                    changes: { archetype_slug: { before, after: archetypeSlug } },
                });

                const updatedStats = await getCalculatedPartyStats();
                io.emit('players-data', updatedStats);
                io.emit('stats-updated', updatedStats);
            } else if (char) {
                fail(socket, 'No tienes permiso para cambiar el arquetipo.');
            }
        } catch (err) {
            console.error('Error updating archetype:', err);
        }
    });

    // Compatibility for existing character-sheet controls. It now uses the same
    // permission checks and audit trail as the new editor.
    socket.on('update-character-full', async ({ characterId, diff } = {}, reply = () => {}) => {
        try {
            const result = await updateCharacterSecure(io, socket, characterId, diff, isDmUser(socket) ? 'dm-legacy-control' : 'player-sheet-control');
            reply({ ok: true, ...result });
        } catch (error) {
            reply({ ok: false, message: error.message || 'No se pudo actualizar el personaje.' });
        }
    });

    socket.on('update-position', async (pos) => {
        try {
            if (!isDmUser(socket)) throw new Error('Sólo el DM puede mover a la party.');
            if (!Number.isFinite(Number(pos?.x)) || !Number.isFinite(Number(pos?.y))) throw new Error('La posición no es válida.');
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
        try {
            const character = await Character.findByPk(characterId);
            if (!character || !canEditCharacter(socket, character)) throw new Error('No tienes permiso para usar ese objeto.');
            await consumeItemLogic(characterId, itemId);
        } catch (error) {
            fail(socket, error.message || 'No se pudo usar el objeto.');
        }
    });

    socket.on('unequip-item', async ({ characterId, slot } = {}, reply = () => {}) => {
        try {
            const char = await Character.findByPk(characterId);
            if (!char || !canEditCharacter(socket, char)) throw new Error('No tienes permiso para cambiar el equipo.');
            const validSlots = ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon'];
            if (!validSlots.includes(slot)) throw new Error('La ranura de equipo no es válida.');

            const equipment = await EquipmentSlots.findOne({ where: { character_id: characterId } });
            if (equipment) {
                const previousItemId = equipment.get(`${slot}_id`);
                equipment.set(`${slot}_id`, null);
                await equipment.save();
                await CharacterAuditLog.create({ character_id: char.id, actor_user_id: socket.user.id, actor_username: socket.user.username || 'Usuario', actor_role: socket.user.role, source: isDmUser(socket) ? 'dm-unequip-item' : 'player-unequip-item', changes: { equipment: { slot, before: previousItemId, after: null } } });

                const updatedStats = await getCalculatedPartyStats();
                io.emit('stats-updated', updatedStats);
                io.emit('notification', { text: `${char.name} se desequipó un objeto.` });
            }
            reply({ ok: true });
        } catch (err) {
            console.error('Unequip-item error:', err);
            fail(socket, err.message || 'No se pudo desequipar el objeto.');
            reply({ ok: false, message: err.message || 'No se pudo desequipar el objeto.' });
        }
    });

    socket.on('equip-item', async ({ characterId, itemId, slot: explicitSlot } = {}, reply = () => {}) => {
        try {
            const char = await Character.findByPk(characterId);
            const item = await Item.findByPk(itemId);
            if (!char || !item || !canEditCharacter(socket, char)) throw new Error('No tienes permiso para cambiar el equipo.');
            const inventoryRow = await CharacterInventory.findOne({ where: { character_id: characterId, item_id: itemId } });
            if (!inventoryRow) throw new Error('El objeto no está en el inventario del personaje.');

            const [equipment] = await EquipmentSlots.findOrCreate({ where: { character_id: characterId } });

            // Slot lógico: explícito del cliente > el del item > deducido.
            const logical = explicitSlot || item.slot || deriveSlot(item);
            const slot = resolveSlotColumn(logical, equipment);

            if (!slot) {
                throw new Error(`${item.name} no se puede equipar.`);
            }

            const previousItemId = equipment.get(`${slot}_id`);
            equipment.set(`${slot}_id`, item.id);
            await equipment.save();
            await CharacterAuditLog.create({ character_id: char.id, actor_user_id: socket.user.id, actor_username: socket.user.username || 'Usuario', actor_role: socket.user.role, source: isDmUser(socket) ? 'dm-equip-item' : 'player-equip-item', changes: { equipment: { slot, before: previousItemId, after: { item_id: item.id, name: item.name } } } });

            const updatedStats = await getCalculatedPartyStats();
            io.emit('stats-updated', updatedStats);
            io.emit('notification', { text: `${char.name} se equipó ${item.name}.` });
            reply({ ok: true, slot });
        } catch (err) {
            console.error('Equip-item error:', err);
            fail(socket, err.message || 'No se pudo equipar el objeto.');
            reply({ ok: false, message: err.message || 'No se pudo equipar el objeto.' });
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
const RUN_STARTUP_SEED = /^(1|true|yes)$/i.test(String(process.env.RUN_STARTUP_SEED || ''));

// Database Sync and Server Launch
sequelize.sync({ alter: true }).then(async () => {
    console.log('Database connected and synced.');
    if (RUN_STARTUP_SEED) {
        console.warn('RUN_STARTUP_SEED habilitado: ejecutando seed de arranque.');
        await seedDatabase();
    } else {
        console.log('Seed de arranque deshabilitado. Usa `npm run seed` sólo cuando sea intencional.');
    }
    // Listen on 0.0.0.0 to allow external connections (e.g. from Android Emulator)
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Master Server running on port ${PORT} `);
        console.log(`Listening on all network interfaces (0.0.0.0)`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
