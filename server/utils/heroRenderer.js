const axios = require('axios');
const OpenAI = require('openai');
const { toFile } = require('openai');
const { cloudinary } = require('./cloudinary');

// ─────────────────────────────────────────────────────────────────────────────
// BIBLIA DE ESTILO — única fuente de verdad del look de TODOS los retratos.
// Editá ACÁ para cambiar el aspecto de todos los héroes a la vez.
// Nota: la imagen base del PJ ya impone su propio estilo (es la referencia más
// fuerte); este texto lo refuerza y unifica. Para máxima consistencia, mantené
// todas las imágenes base de los PJs en este mismo estilo.
// ─────────────────────────────────────────────────────────────────────────────
const ART_STYLE = {
    // El "qué medium" — cambialo por 'pixel art', 'anime cel-shaded', 'óleo', etc.
    medium: 'ilustración digital de fantasía pintada a mano, semi-realista, calidad de portada de libro de rol',
    // Iluminación y atmósfera.
    lighting: 'iluminación dramática y cálida, sombras profundas, leve brillo ámbar de hoguera',
    // Paleta — alineada al lenguaje "Ember" de la app (ámbar/bronce sobre oscuro).
    palette: 'paleta oscura con acentos ámbar y bronce, ambiente nocturno de taberna/mazmorra',
    // Composición — mantené el encuadre de cuerpo entero centrado, pero dejá que
    // la pose sea dinámica y natural (no de maniquí).
    composition: 'personaje de cuerpo entero, figura centrada, pose dinámica, natural y heroica (evitá una postura rígida, simétrica o de maniquí; un leve contrapposto o ángulo cinematográfico queda mejor), fondo simple y oscuro sin escenario recargado para que destaque el personaje',
};

/** Convierte la biblia de estilo en la línea ESTILO del prompt. */
function styleLine() {
    return `ESTILO: ${ART_STYLE.medium}. ${ART_STYLE.lighting}. ${ART_STYLE.palette}. ${ART_STYLE.composition}.`;
}

// Slots que aportan apariencia visible en un retrato de cuerpo entero.
// Los anillos se omiten: no se distinguen y solo gastan referencias/tokens.
const VISIBLE_SLOTS = [
    { key: 'helmet', label: 'casco / tocado' },
    { key: 'shoulders', label: 'capa / hombreras' },
    { key: 'chest', label: 'armadura de torso' },
    { key: 'gloves', label: 'guantes' },
    { key: 'pants', label: 'piernas' },
    { key: 'boots', label: 'botas' },
    { key: 'primary_weapon', label: 'arma principal' },
    { key: 'secondary_weapon', label: 'arma / escudo / instrumento secundario' },
];

let _client = null;
function getClient() {
    if (!process.env.OPENAI_API_KEY) {
        const err = new Error('OPENAI_API_KEY no está configurada en el .env del server.');
        err.code = 'NO_API_KEY';
        throw err;
    }
    if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _client;
}

/**
 * Devuelve el ítem equipado en un slot dado, ya sea por asociación anidada
 * (equipment.helmet) o resolviendo el *_id contra el inventario.
 */
function getEquippedItem(equipment, inventory, slotKey) {
    if (!equipment) return null;
    if (equipment[slotKey] && typeof equipment[slotKey] === 'object') return equipment[slotKey];
    const id = equipment[`${slotKey}_id`];
    if (id && Array.isArray(inventory)) return inventory.find((i) => i.id === id) || null;
    return null;
}

/**
 * Firma estable del equipo (slot:itemId ordenados) + las indicaciones del
 * jugador. Si no cambió, no hace falta regenerar el retrato. Incluir el prompt
 * hace que editar el texto invalide el caché y dispare un render nuevo.
 */
function buildSignature(equipment, inventory, extra = '') {
    const parts = VISIBLE_SLOTS.map(({ key }) => {
        const item = getEquippedItem(equipment, inventory, key);
        return `${key}:${item ? item.id : 0}`;
    });
    if (extra) parts.push(`p:${String(extra).trim()}`);
    return parts.join('|');
}

/** Descarga una imagen (Cloudinary u otra URL) a un buffer reutilizable. */
async function urlToBuffer(url, name) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
    const contentType = res.headers['content-type'] || 'image/png';
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg'
        : contentType.includes('webp') ? 'webp' : 'png';
    return { buffer: Buffer.from(res.data), contentType, filename: `${name}.${ext}` };
}

// Modelo con visión que actúa de "juez" de la imagen generada.
const JUDGE_MODEL = process.env.IMAGE_JUDGE_MODEL || 'gpt-4o';

/**
 * Revisa una imagen generada contra reglas estrictas y devuelve un veredicto.
 * Si el juez falla por cualquier motivo, NO bloquea (acceptable: true).
 * @returns {Promise<{ acceptable: boolean, score: number, issues: string[] }>}
 */
async function judgeImage(client, dataUri, equippedList) {
    const gear = equippedList.length
        ? equippedList.map((e) => `- ${e.label}: ${e.item.name}`).join('\n')
        : '- (sin equipo relevante)';

    const checklist = [
        'Sos un crítico de arte estricto. Evaluá esta ilustración de un personaje de fantasía y devolvé SOLO JSON.',
        '',
        'REGLAS (un incumplimiento de la 1 a la 4 = NO aceptable):',
        '1. Ningún objeto/arma atraviesa, corta ni se incrusta en el cuerpo.',
        '2. NO hay un arma en cada mano ni una pose simétrica de "presentación"; como máximo una empuñada, el resto guardado (cinto/espalda).',
        '3. Las armas/objetos tienen proporciones creíbles (nada en miniatura ni gigante sin sentido).',
        '4. Anatomía correcta: manos, dedos y miembros sin fusiones ni deformidades.',
        '5. El personaje lleva, de forma coherente, el equipo esperado:',
        gear,
        '',
        'Devolvé EXACTAMENTE este JSON: {"acceptable": boolean, "score": number 0-100, "issues": [string]}.',
        'issues = lista de problemas concretos y accionables para corregir en una regeneración (vacío si está perfecto).',
    ].join('\n');

    try {
        const res = await client.chat.completions.create({
            model: JUDGE_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: checklist },
                    { type: 'image_url', image_url: { url: dataUri } },
                ],
            }],
            response_format: { type: 'json_object' },
            max_tokens: 400,
        });
        const parsed = JSON.parse(res.choices[0].message.content);
        return {
            acceptable: !!parsed.acceptable,
            score: Number(parsed.score) || 0,
            issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        };
    } catch (err) {
        console.error('[judgeImage] el juez falló, no bloqueo:', err.message);
        return { acceptable: true, score: 50, issues: [] };
    }
}

// Traduce un tamaño relativo a una escala respecto al cuerpo (lo que el modelo
// de imagen sí entiende; los centímetros no le sirven).
const SIZE_PHRASES = {
    'Pequeño': 'tamaño pequeño, del tamaño de una mano o antebrazo',
    'Mediano': 'tamaño mediano, aprox. el largo del brazo',
    'Grande': 'tamaño grande, del suelo al hombro o la cabeza del personaje',
    'Enorme': 'tamaño enorme, tan alto como el personaje o más',
};

// Inferencia de tamaño a partir del nombre del arma/objeto sostenido.
function inferSizeKey(name = '') {
    const n = name.toLowerCase();
    if (/(daga|cuchillo|puñal|punal|varita|wand|dardo|honda|cetro corto)/.test(n)) return 'Pequeño';
    if (/(bast[oó]n|b[aá]culo|staff|lanza|pica|spear|arco|bow|ballesta|alabarda|halberd|guada[ñn]a|mandoble|greatsword|martillo de guerra|hacha de guerra|pike|tridente)/.test(n)) return 'Grande';
    return 'Mediano'; // espadas, hachas, mazas, estoques, instrumentos, escudos…
}

// Devuelve la frase de escala para un ítem SOSTENIDO (arma/mano 2ª). El resto
// (armaduras, prendas) no necesita escala porque va puesto sobre el cuerpo.
// Prioridad: size_hint explícito del ítem > inferido por nombre.
function sizePhraseFor(item, slotKey) {
    const isHeld = slotKey === 'primary_weapon' || slotKey === 'secondary_weapon';
    if (!isHeld) return null;
    const key = item.size_hint || inferSizeKey(item.name);
    return SIZE_PHRASES[key] || null;
}

/** Construye el prompt textual a partir del PJ y los ítems equipados. */
function buildPrompt(character, equippedList) {
    const race = character.subrace || character.race || 'aventurero';
    const klass = character.class || 'aventurero';

    const gearLines = equippedList.length > 0
        ? equippedList.map((e) => {
            const desc = e.item.description ? ` — ${e.item.description}` : '';
            const sizePhrase = sizePhraseFor(e.item, e.key);
            const size = sizePhrase ? ` [ESCALA: ${sizePhrase}]` : '';
            return `• ${e.label}: "${e.item.name}"${desc}${size}`;
        }).join('\n')
        : '• (sin equipo: muestra al personaje con su vestimenta básica)';

    return [
        `Ilustración de personaje de cuerpo entero de ${character.name}, un/una ${race} ${klass} de un mundo de fantasía estilo Dungeons & Dragons. Componé la escena de la forma más épica y natural posible.`,
        ``,
        `IDENTIDAD: La PRIMERA imagen de referencia es el personaje canónico. Mantené EXACTAMENTE su rostro, color de piel, peinado, rasgos (cuernos, cola, orejas) y proporciones corporales. No cambies su identidad.`,
        ``,
        `EQUIPO: las imágenes de referencia siguientes son objetos que el personaje lleva equipados. Mostralo usándolos de la forma más natural y heroica según el tipo de cada objeto:`,
        gearLines,
        ``,
        `CÓMO EQUIPAR (importante):`,
        `- Las armaduras y prendas van PUESTAS sobre el cuerpo, bien ajustadas (no en la mano).`,
        `- REGLA DE ARMAS (obligatoria): PROHIBIDO poner un arma en cada mano o una pose simétrica de "presentación" mostrando los objetos. Como MÁXIMO una sola arma empuñada en una mano, de forma relajada y natural. TODAS las demás armas van guardadas: envainadas al cinto, a la cadera o cruzadas a la espalda.`,
        `- Los instrumentos cuelgan del cuerpo o van a la espalda, no en la mano.`,
        `- El personaje NO está exhibiendo su equipo: simplemente lo lleva puesto mientras adopta una pose natural y con actitud, como un retrato de aventurero real.`,
        ``,
        `PROPORCIONES: respetá tamaños realistas relativos al cuerpo. Una espada/arma larga mide aprox. el largo del brazo o más; un bastón o lanza llega del hombro a por encima de la cabeza; un escudo cubre buena parte del torso. NADA en miniatura: cada objeto debe verse a una escala creíble con la figura.`,
        ``,
        `ANATOMÍA Y OCLUSIÓN (crítico): los objetos NUNCA deben atravesar, cortar ni incrustarse en el cuerpo. Respetá la profundidad: un arma a la espalda va por DETRÁS del torso; una empuñada va por DELANTE. Manos, dedos y empuñaduras coherentes. Cuerpo completo y anatómicamente correcto, sin miembros ni armas fusionados.`,
        ``,
        styleLine(),
        // Indicaciones del jugador al final y con prioridad alta (pero sin romper
        // identidad, anatomía ni las reglas anteriores).
        character.render_prompt && character.render_prompt.trim()
            ? `\nINDICACIONES DEL JUGADOR (prioritarias — respetalas mientras no contradigan la identidad ni las reglas de anatomía/oclusión): ${character.render_prompt.trim()}`
            : null,
    ].filter(Boolean).join('\n');
}

/**
 * Genera el retrato del personaje con el equipo puesto, con un ciclo de
 * auto-revisión: genera → un juez con visión la evalúa → si no pasa, regenera
 * con el feedback del juez (hasta maxAttempts) → sube la MEJOR de todas.
 * @returns {Promise<{ url, signature, prompt, verdict, attempts }>}
 */
async function renderHero(character, { quality = 'medium', maxAttempts = 2, review = true, onProgress = () => {} } = {}) {
    const client = getClient();
    const equipment = character.equipment || {};
    const inventory = character.items || character.inventory || [];

    // Identidad: preferimos la imagen de cuerpo entero; si no hay, el avatar.
    const identityUrl = character.base_body_url || character.image_url;
    if (!identityUrl) {
        const err = new Error('El personaje no tiene imagen base (base_body_url ni image_url) para usar como identidad.');
        err.code = 'NO_BASE_IMAGE';
        throw err;
    }

    // Reunir ítems equipados visibles que tengan imagen de referencia.
    const equippedList = [];
    for (const { key, label } of VISIBLE_SLOTS) {
        const item = getEquippedItem(equipment, inventory, key);
        if (item && item.image_url) equippedList.push({ key, label, item });
    }

    // Descargar referencias UNA sola vez (se reutilizan en cada intento):
    // primero el cuerpo base (identidad), después los ítems.
    onProgress({ stage: 'Preparando referencias…', pct: 5 });
    const refs = [await urlToBuffer(identityUrl, 'base')];
    for (const e of equippedList) {
        refs.push(await urlToBuffer(e.item.image_url, `item_${e.key}`));
    }

    const basePrompt = buildPrompt(character, equippedList);
    const attempts = Math.max(1, maxAttempts);

    let best = null;      // { b64, verdict }
    let feedback = '';     // problemas del intento anterior, para corregir

    for (let attempt = 1; attempt <= attempts; attempt++) {
        const prompt = feedback
            ? `${basePrompt}\n\nCORRECCIONES (el intento anterior tuvo estos problemas, corregilos sí o sí): ${feedback}`
            : basePrompt;

        onProgress({
            stage: attempts > 1 ? `Pintando el héroe… (intento ${attempt}/${attempts})` : 'Pintando el héroe…',
            pct: 10 + Math.round(((attempt - 1) / attempts) * 75),
        });

        // gpt-image-1 admite varias imágenes de entrada en /images/edits.
        const images = await Promise.all(
            refs.map((r) => toFile(r.buffer, r.filename, { type: r.contentType }))
        );

        const result = await client.images.edit({
            model: 'gpt-image-1',
            image: images,
            prompt,
            size: '1024x1536', // retrato vertical de cuerpo entero
            quality,
        });

        const b64 = result.data?.[0]?.b64_json;
        if (!b64) throw new Error('OpenAI no devolvió imagen.');

        // Sin revisión: la primera imagen es la definitiva.
        if (!review) { best = { b64, verdict: { acceptable: true, score: 100, issues: [] } }; break; }

        // Juzgamos sobre el base64 directo (data URI), sin subir todavía.
        onProgress({ stage: 'Revisando calidad…', pct: 10 + Math.round((attempt / attempts) * 75) });
        const verdict = await judgeImage(client, `data:image/png;base64,${b64}`, equippedList);
        console.log(`[renderHero] intento ${attempt}/${attempts} → score ${verdict.score}, aceptable=${verdict.acceptable}`, verdict.issues);

        if (!best || verdict.score > best.verdict.score) best = { b64, verdict };
        if (verdict.acceptable) break;
        feedback = verdict.issues.join('; ');
    }

    // Subimos a Cloudinary SOLO la mejor imagen del ciclo.
    onProgress({ stage: 'Guardando el retrato…', pct: 92 });
    const uploaded = await cloudinary.uploader.upload(
        `data:image/png;base64,${best.b64}`,
        { folder: 'dndworld_renders', public_id: `hero_${character.id}_${Date.now()}` }
    );

    return {
        url: uploaded.secure_url,
        signature: buildSignature(equipment, inventory, character.render_prompt),
        prompt: basePrompt,
        verdict: best.verdict,
    };
}

module.exports = { renderHero, buildSignature, VISIBLE_SLOTS };
