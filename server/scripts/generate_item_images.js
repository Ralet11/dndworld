/**
 * Genera un icono de ítem con IA (OpenAI gpt-image-1) para cada Item que no
 * tenga image_url, y lo sube a Cloudinary. Pensado para correr en lote en vez
 * de generar imagen por imagen a mano.
 *
 * Uso:
 *   node scripts/generate_item_images.js --dry-run          (solo lista, no gasta nada)
 *   node scripts/generate_item_images.js --limit 3          (prueba con pocos)
 *   node scripts/generate_item_images.js                    (corre sobre todos los faltantes)
 *   node scripts/generate_item_images.js --overwrite         (regenera incluso los que ya tienen imagen)
 */

const OpenAI = require('openai');
const { Op } = require('sequelize');
const { Item } = require('../models');
const { cloudinary } = require('../utils/cloudinary');

// Mismo lenguaje visual que heroRenderer.js (biblia de estilo "Ember"), pero
// para objetos sueltos en vez de personajes de cuerpo entero.
const STYLE = 'ilustración digital de fantasía pintada a mano, semi-realista, calidad de portada de libro de rol. Iluminación cálida y dramática con leve brillo ámbar. Objeto único, centrado, ocupando la mayor parte del encuadre, sobre fondo simple oscuro (sin escenario ni personajes), como el ícono de un objeto de inventario en un RPG premium.';

let _client = null;
function getClient() {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no está configurada.');
    if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _client;
}

function parseArgs(argv) {
    const opts = { dryRun: false, overwrite: false, limit: Infinity, quality: 'low', ids: null };
    argv.forEach((arg, i) => {
        if (arg === '--dry-run') opts.dryRun = true;
        else if (arg === '--overwrite') opts.overwrite = true;
        else if (arg === '--limit') opts.limit = parseInt(argv[i + 1], 10) || Infinity;
        else if (arg === '--quality') opts.quality = argv[i + 1];
        else if (arg === '--ids') opts.ids = argv[i + 1].split(',').map((n) => parseInt(n, 10)).filter(Boolean);
    });
    return opts;
}

function buildPrompt(item) {
    const parts = [
        `${item.name}: objeto de fantasía D&D.`,
        item.type ? `Tipo: ${item.type}.` : '',
        item.rarity ? `Rareza: ${item.rarity}.` : '',
        item.armor_type ? `Material de armadura: ${item.armor_type}.` : '',
        item.damage ? `Arma con daño ${item.damage}${item.damage_type ? ' ' + item.damage_type : ''}.` : '',
        item.description ? `Descripción: ${item.description}` : '',
        STYLE,
    ].filter(Boolean);
    return parts.join(' ');
}

async function run() {
    const opts = parseArgs(process.argv.slice(2));

    const where = opts.overwrite ? {} : { image_url: null };
    if (opts.ids) where.id = { [Op.in]: opts.ids };
    const items = await Item.findAll({ where, order: [['id', 'ASC']] });
    // No gastar generando arte de parches temporales (no son ítems de canon).
    const filtered = items.filter((it) => it.name !== 'Ajuste de CA (nivel 5)');
    const targets = filtered.slice(0, opts.limit);

    console.log(`Items a procesar: ${targets.length} (de ${items.length} candidatos, overwrite=${opts.overwrite}).`);

    if (opts.dryRun) {
        targets.forEach((it) => console.log(`  [dry-run] #${it.id} "${it.name}" (${it.type})`));
        return;
    }

    const client = getClient();
    let done = 0;
    for (const item of targets) {
        const prompt = buildPrompt(item);
        try {
            console.log(`→ Generando #${item.id} "${item.name}"...`);
            const result = await client.images.generate({
                model: 'gpt-image-1',
                prompt,
                size: '1024x1024',
                quality: opts.quality,
            });
            const b64 = result.data?.[0]?.b64_json;
            if (!b64) throw new Error('OpenAI no devolvió imagen.');

            const uploaded = await cloudinary.uploader.upload(
                `data:image/png;base64,${b64}`,
                { folder: 'dndworld_uploads/items', public_id: `item_${item.id}` }
            );

            item.image_url = uploaded.secure_url;
            await item.save();
            done++;
            console.log(`  OK -> ${uploaded.secure_url}`);
        } catch (err) {
            console.error(`  ERROR en #${item.id} "${item.name}":`, err.message);
        }
    }
    console.log(`Listo: ${done}/${targets.length} generados y guardados.`);
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('ERROR generando imagenes de items:', err);
        process.exit(1);
    });
