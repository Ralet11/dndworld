const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const MODEL = process.env.DM_ASSISTANT_MODEL || 'gpt-4o-mini';

const CAMPAIGN_LORE_PATH = path.join(__dirname, '..', 'data', 'lore', 'campaign-context.md');
let _campaignLoreCache = null;

function loadCampaignLore() {
    if (_campaignLoreCache !== null) return _campaignLoreCache;
    try {
        _campaignLoreCache = fs.readFileSync(CAMPAIGN_LORE_PATH, 'utf8').trim();
    } catch (_err) {
        _campaignLoreCache = '';
    }
    return _campaignLoreCache;
}

function buildCampaignLoreMessage() {
    const lore = loadCampaignLore();
    if (!lore) return null;
    return [
        'LORE DE CAMPANA (contexto narrativo fijo, actualizado manualmente; NO es estado en vivo).',
        'Usalo para nombres, relaciones, trasfondo y motivaciones. Para HP/XP/oro/escena actual siempre confia en session.get_context, no en este texto.',
        '---',
        lore,
    ].join('\n');
}

let _client = null;

function getClient() {
    if (!process.env.OPENAI_API_KEY) {
        const err = new Error('OPENAI_API_KEY no esta configurada.');
        err.code = 'NO_API_KEY';
        throw err;
    }
    if (!_client) {
        _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _client;
}

function clampText(value, max = 500) {
    return String(value || '').trim().slice(0, max);
}

function normalizeSuggestions(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => clampText(item, 120))
        .filter(Boolean)
        .slice(0, 6);
}

function buildSystemPrompt() {
    return [
        'Sos el asistente conversacional del Dungeon Master en DNDWorld.',
        'Hablas en espanol natural, con tono util y directo.',
        'Debes conversar normalmente, pero cuando el usuario quiera leer o cambiar estado de la sesion debes usar tools.',
        'Nunca digas que vas a hacer un cambio si no llamaste la tool correspondiente.',
        'Si el pedido es claro y ejecutable, llama la tool. No pidas confirmacion innecesaria.',
        'Si faltan datos criticos o hay ambiguedad real, pregunta de forma breve y concreta.',
        'Puedes encadenar hasta 3 tools en un mismo turno.',
        'Puedes usar el historial reciente para resolver referencias como "quitale 5", "hacelo", "lo mismo", "ese goblin".',
        'Si el usuario viene hablando de un NPC y luego dice "pasalo a compañero de la party", debes inferir ese mismo NPC del historial y usar la tool correspondiente.',
        'No inventes personajes, quests, escenas ni numeros fuera del contexto y resultados de tools.',
        'Si el usuario pide descripcion, ideas, recap, dialogo, improvisacion o humor, responde normal sin tools salvo que tambien pida cambiar estado.',
        'Despues de ejecutar tools, responde de forma natural resumiendo lo que hiciste y el resultado.',
        'Si una tool devuelve error o ambiguedad, transforma eso en una pregunta o explicacion util para el DM.',
    ].join('\n');
}

function buildContextMessage(context) {
    return [
        'CONTEXTO ACTUAL DEL MUNDO Y LA SESION.',
        'Usalo para entender referencias, no para inventar datos.',
        JSON.stringify(context),
    ].join('\n');
}

function historyToMessages(history) {
    if (!Array.isArray(history)) return [];
    return history
        .slice(-8)
        .map((item) => {
            if (item?.role === 'assistant') {
                return {
                    role: 'assistant',
                    content: clampText(item.text || '', 2000) || '...',
                };
            }
            return {
                role: 'user',
                content: clampText(item?.text || '', 2000) || '...',
            };
        });
}

const TOOL_SPECS = [
    {
        type: 'function',
        function: {
            name: 'help',
            description: 'Explica brevemente que puede hacer el asistente y da ejemplos.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_session_context',
            description: 'Devuelve el contexto actual de la sesion, escena, mundo y party.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_character_status',
            description: 'Consulta el estado puntual de un personaje o NPC.',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string', description: 'Nombre del personaje o NPC.' },
                },
                required: ['target'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_character_hp',
            description: 'Fija la vida actual de un personaje en un valor exacto.',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string' },
                    value: { type: 'number', description: 'PG finales exactos.' },
                },
                required: ['target', 'value'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'adjust_character_hp',
            description: 'Suma o resta vida a un personaje. Usa negativo para dano y positivo para curacion.',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string' },
                    amount: { type: 'number', description: 'Negativo para dano, positivo para curacion.' },
                },
                required: ['target', 'amount'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'adjust_character_xp',
            description: 'Suma o resta experiencia a un personaje.',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string' },
                    amount: { type: 'number', description: 'Positivo o negativo.' },
                },
                required: ['target', 'amount'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'adjust_character_gold',
            description: 'Suma o resta oro a un personaje.',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string' },
                    amount: { type: 'number', description: 'Positivo o negativo.' },
                },
                required: ['target', 'amount'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_character_inspiration',
            description: 'Da o quita inspiracion a un personaje.',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string' },
                    value: { type: 'boolean', description: 'true para dar inspiracion, false para quitarla.' },
                },
                required: ['target', 'value'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_world_time',
            description: 'Cambia la hora global del mundo en formato HH:MM.',
            parameters: {
                type: 'object',
                properties: {
                    time: { type: 'string', description: 'Hora en formato HH:MM, por ejemplo 19:30.' },
                },
                required: ['time'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_world_location',
            description: 'Cambia la ubicacion global del mundo o de la sesion.',
            parameters: {
                type: 'object',
                properties: {
                    location: { type: 'string' },
                },
                required: ['location'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'toggle_quest_objective',
            description: 'Marca o desmarca un objetivo de una mision.',
            parameters: {
                type: 'object',
                properties: {
                    questTarget: { type: 'string', description: 'Titulo o referencia de la mision.' },
                    objectiveTarget: { type: 'string', description: 'Texto o numero del objetivo.' },
                    completed: { type: 'boolean', description: 'true para completar, false para reabrir/desmarcar.' },
                },
                required: ['questTarget', 'objectiveTarget', 'completed'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_npc_active',
            description: 'Activa o desactiva un NPC aliado.',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string', description: 'Nombre del NPC.' },
                    active: { type: 'boolean', description: 'true para activarlo, false para retirarlo.' },
                },
                required: ['target', 'active'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'set_npc_role',
            description: 'Cambia el rol narrativo del NPC. Usa activeInParty=true si el usuario pide que pase a ser compañero de la party o entre al grupo activo.',
            parameters: {
                type: 'object',
                properties: {
                    target: { type: 'string', description: 'Nombre del NPC.' },
                    npcType: {
                        type: 'string',
                        enum: ['neutral', 'amigo', 'compañero', 'enemigo'],
                        description: 'Nuevo rol del NPC.',
                    },
                    activeInParty: {
                        type: 'boolean',
                        description: 'Opcional. true si debe entrar a la party activa, false si debe salir.',
                    },
                },
                required: ['target', 'npcType'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'post_timeline_message',
            description: 'Publica una narracion o mensaje del DM en el timeline de la escena actual.',
            parameters: {
                type: 'object',
                properties: {
                    content: { type: 'string', description: 'Texto a publicar en la escena o timeline.' },
                },
                required: ['content'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'undo_last_action',
            description: 'Deshace la ultima accion operativa ejecutada por el assistant para este DM.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
];

function normalizeToolCall(toolCall) {
    if (!toolCall?.function?.name) return null;

    let args = {};
    try {
        args = JSON.parse(toolCall.function.arguments || '{}');
    } catch (_err) {
        args = {};
    }

    switch (toolCall.function.name) {
        case 'help':
            return { tool: 'help' };
        case 'get_session_context':
            return { tool: 'session.get_context' };
        case 'get_character_status':
            return args.target ? { tool: 'character.get', target: clampText(args.target, 120) } : null;
        case 'set_character_hp':
            return args.target !== undefined && Number.isFinite(Number(args.value))
                ? { tool: 'character.hp.set', target: clampText(args.target, 120), value: Number(args.value) }
                : null;
        case 'adjust_character_hp':
            return args.target !== undefined && Number.isFinite(Number(args.amount))
                ? { tool: 'character.hp.adjust', target: clampText(args.target, 120), amount: Number(args.amount) }
                : null;
        case 'adjust_character_xp':
            return args.target !== undefined && Number.isFinite(Number(args.amount))
                ? { tool: 'character.xp.adjust', target: clampText(args.target, 120), amount: Number(args.amount) }
                : null;
        case 'adjust_character_gold':
            return args.target !== undefined && Number.isFinite(Number(args.amount))
                ? { tool: 'character.gold.adjust', target: clampText(args.target, 120), amount: Number(args.amount) }
                : null;
        case 'set_character_inspiration':
            return args.target !== undefined && typeof args.value === 'boolean'
                ? { tool: 'character.inspiration.set', target: clampText(args.target, 120), value: args.value }
                : null;
        case 'set_world_time':
            return args.time ? { tool: 'world.time.set', time: clampText(args.time, 20) } : null;
        case 'set_world_location':
            return args.location ? { tool: 'world.location.set', location: clampText(args.location, 120) } : null;
        case 'toggle_quest_objective':
            return args.questTarget && args.objectiveTarget && typeof args.completed === 'boolean'
                ? {
                    tool: 'quest.objective.toggle',
                    questTarget: clampText(args.questTarget, 160),
                    objectiveTarget: clampText(args.objectiveTarget, 160),
                    completed: args.completed,
                }
                : null;
        case 'set_npc_active':
            return args.target && typeof args.active === 'boolean'
                ? { tool: 'npc.activate', target: clampText(args.target, 120), active: args.active }
                : null;
        case 'set_npc_role':
            return args.target && args.npcType
                ? {
                    tool: 'npc.role.set',
                    target: clampText(args.target, 120),
                    npcType: clampText(args.npcType, 20),
                    ...(typeof args.activeInParty === 'boolean' ? { activeInParty: args.activeInParty } : {}),
                }
                : null;
        case 'post_timeline_message':
            return args.content ? { tool: 'timeline.post', content: clampText(args.content, 4000) } : null;
        case 'undo_last_action':
            return { tool: 'action.undo' };
        default:
            return null;
    }
}

function toolResultToContent(result) {
    return JSON.stringify({
        ok: !!result?.ok,
        kind: result?.reply?.kind || 'error',
        text: result?.reply?.text || 'Sin respuesta.',
        data: result?.reply?.data || null,
        undoAvailable: !!result?.reply?.undoAvailable,
        suggestions: normalizeSuggestions(result?.reply?.suggestions),
    });
}

async function runAssistantConversation({
    message,
    history,
    executeTool,
    defaultSuggestions,
}) {
    const client = getClient();
    const campaignLoreMessage = buildCampaignLoreMessage();
    const messages = [
        { role: 'system', content: buildSystemPrompt() },
        ...(campaignLoreMessage ? [{ role: 'system', content: campaignLoreMessage }] : []),
        ...historyToMessages(history),
        { role: 'user', content: String(message || '').trim() },
    ];

    let undoAvailable = false;
    let usedTool = false;

    for (let step = 0; step < 3; step += 1) {
        const res = await client.chat.completions.create({
            model: MODEL,
            messages,
            tools: TOOL_SPECS,
            tool_choice: 'auto',
            temperature: 0.2,
            max_tokens: 900,
        });

        const assistantMessage = res.choices?.[0]?.message;
        if (!assistantMessage) {
            throw new Error('La IA no devolvio ningun mensaje.');
        }

        if (Array.isArray(assistantMessage.tool_calls) && assistantMessage.tool_calls.length) {
            usedTool = true;
            messages.push({
                role: 'assistant',
                content: assistantMessage.content || '',
                tool_calls: assistantMessage.tool_calls,
            });

            for (const rawToolCall of assistantMessage.tool_calls) {
                const normalizedToolCall = normalizeToolCall(rawToolCall);
                let result;
                try {
                    result = normalizedToolCall
                        ? await executeTool(normalizedToolCall)
                        : {
                            ok: false,
                            reply: { kind: 'error', text: 'La IA intento usar una tool invalida o incompleta.' },
                        };
                } catch (_toolErr) {
                    result = { ok: false, reply: { kind: 'error', text: 'Ocurrio un error al ejecutar la accion.' } };
                }

                undoAvailable = undoAvailable || !!result?.reply?.undoAvailable;

                messages.push({
                    role: 'tool',
                    tool_call_id: rawToolCall.id,
                    content: toolResultToContent(result),
                });
            }

            continue;
        }

        const content = clampText(assistantMessage.content || '', 4000);
        if (!content) {
            continue;
        }

        return {
            ok: true,
            reply: {
                kind: 'reply',
                text: content,
                tool: usedTool ? 'assistant.tools' : 'assistant.reply',
                undoAvailable,
                suggestions: Array.isArray(defaultSuggestions) ? defaultSuggestions.slice(0, 6) : [],
            },
        };
    }

    return {
        ok: false,
        reply: {
            kind: 'error',
            text: 'No pude cerrar bien la respuesta del assistant.',
            tool: 'assistant.error',
            suggestions: Array.isArray(defaultSuggestions) ? defaultSuggestions.slice(0, 6) : [],
        },
    };
}

module.exports = {
    runAssistantConversation,
};
