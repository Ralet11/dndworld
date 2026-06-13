const OpenAI = require('openai');

let _client = null;
function getClient() {
    if (!process.env.OPENAI_API_KEY) {
        const err = new Error('OPENAI_API_KEY no está configurada.');
        err.code = 'NO_API_KEY';
        throw err;
    }
    if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _client;
}

const MODEL = process.env.SPELL_TRANSLATE_MODEL || 'gpt-4o-mini';

/**
 * Traduce un conjuro al español (terminología D&D 2024). Devuelve
 * { name, desc, higher_level }. Mantiene números, CD, tiradas, etc.
 */
async function translateSpell(spell) {
    const client = getClient();
    const payload = {
        name: spell.name,
        desc: spell.desc || '',
        higher_level: spell.higher_level || '',
    };

    const system = [
        'Sos un traductor experto de Dungeons & Dragons al español (terminología 2024 / castellano neutro).',
        'Traducí el conjuro manteniendo el sentido EXACTO, los números, dados, CD y mecánicas (tirada de salvación, acción adicional, concentración, etc.).',
        'Usá términos estándar en español: "tirada de salvación", "Clase de Dificultad (CD)", "acción adicional", "reacción", "pie/pies" → "metros" solo si el original ya está en metros; si está en pies, dejá pies.',
        'No agregues ni quites contenido. Conservá saltos de línea.',
        'Devolvé SOLO un JSON con las claves: name, desc, higher_level.',
    ].join(' ');

    const res = await client.chat.completions.create({
        model: MODEL,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(payload) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
    });

    const parsed = JSON.parse(res.choices[0].message.content);
    return {
        name: parsed.name || spell.name,
        desc: parsed.desc || spell.desc,
        higher_level: parsed.higher_level || '',
    };
}

module.exports = { translateSpell };
