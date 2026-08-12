const OpenAI = require('openai');
const { uploadDataUri } = require('./s3Storage');

const MODEL = process.env.NPC_IMAGE_MODEL || 'gpt-image-1';
const ALLOWED_QUALITIES = new Set(['low', 'medium', 'high']);

let client;

function getClient() {
    if (!process.env.OPENAI_API_KEY) {
        const error = new Error('OPENAI_API_KEY no esta configurada.');
        error.code = 'NO_API_KEY';
        throw error;
    }
    if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return client;
}

function clean(value, limit = 600) {
    return String(value || '').trim().slice(0, limit);
}

function buildPortraitPrompt(npc, actions = [], direction = '') {
    const actionSummary = actions
        .slice(0, 12)
        .map((action) => `${clean(action.name, 100)}: ${clean(action.description, 280)}`)
        .filter((line) => line !== ': ')
        .join('\n');

    return [
        'Crea un retrato cuadrado original para la ficha de un NPC de una campana de fantasia oscura.',
        'Debe mostrar un unico personaje, con rostro y silueta claramente legibles incluso como miniatura circular.',
        'Composicion de busto o tres cuartos, iluminacion cinematografica, fondo atmosferico discreto.',
        'Sin texto, letras, marcos, interfaz, logos, marcas de agua ni personajes adicionales.',
        `Nombre: ${clean(npc.name, 120)}.`,
        `Raza o especie: ${clean(npc.race || npc.creature_type || 'Humanoide', 100)}.`,
        `Clase o rol: ${clean(npc.class || 'NPC', 100)}.`,
        `Relacion narrativa: ${clean(npc.npc_type || 'neutral', 40)}.`,
        `Nivel: ${Number(npc.level) || 1}.`,
        npc.abilities_text ? `Rasgos narrativos publicos: ${clean(npc.abilities_text, 900)}.` : '',
        actionSummary ? `Habilidades visibles:\n${actionSummary}` : '',
        direction ? `Direccion visual indicada por el Dungeon Master: ${clean(direction, 1500)}` : '',
    ].filter(Boolean).join('\n');
}

async function generateNpcPortrait({ npc, actions, direction, quality }) {
    const prompt = buildPortraitPrompt(npc, actions, direction);
    const response = await getClient().images.generate({
        model: MODEL,
        prompt,
        size: '1024x1024',
        quality: ALLOWED_QUALITIES.has(quality) ? quality : 'medium',
    });
    const base64 = response.data?.[0]?.b64_json;
    if (!base64) throw new Error('El generador no devolvio una imagen utilizable.');

    const uploaded = await uploadDataUri(`data:image/png;base64,${base64}`, {
        folder: 'npc-generated',
        name: `npc-${npc.id}`,
        originalName: `npc-${npc.id}.png`,
    });

    return { ...uploaded, model: MODEL };
}

module.exports = { buildPortraitPrompt, generateNpcPortrait };
