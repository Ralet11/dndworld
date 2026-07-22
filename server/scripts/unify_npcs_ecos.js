/**
 * Unifica los NPCs de la DB (local o produccion) contra el canon de ecos
 * (campaign/npcs/glosario_desbloqueados.txt + dossiers de ciudad).
 * Idempotente: correrlo varias veces no duplica ni rompe nada.
 *
 * Uso: node scripts/unify_npcs_ecos.js
 */

const { Character } = require('../models');

const SIMPLE_RENAMES = [
    { from: ['Tiefling Oscuro', 'Tiefling negro'], to: 'Tiste Andi (sin identificar)' },
    { from: ['Dedos'], to: 'Dedos Bonasera' },
    { from: ['Primo'], to: 'Primo Bonasera' },
    { from: ['Sony'], to: 'Sony Bonasera' },
];

const RELATION_FIXES = [
    { name: 'Leandro Bonasera', fields: { npc_type: 'amigo', is_active: false } },
    { name: 'Teo Malvern', fields: { npc_type: 'enemigo' } },
];

// Datos canonicos para NPCs que puedan faltar por completo (ej. entorno local
// atrasado respecto a produccion). Tomados 1:1 de los registros ya correctos.
const ENSURE_NPCS = [
    {
        name: 'Osken Davra',
        race: 'Humano', race_slug: 'human', class: 'Guerrero', class_slug: 'fighter',
        npc_type: 'neutral', origin: 'Prontera', is_active: false,
        notes: 'Líder militar que comandó el asalto de Prontera desde el zepelín. Llegó gracias al aviso enviado por Albert y cambió por completo el equilibrio de poder en Costa Oscura. Controla la nueva fase política y militar de Costa Oscura; puede transformarse en aliado, reclutador o problema.',
    },
    {
        name: 'Dedos Bonasera',
        race: 'Humano', race_slug: 'human', class: null, class_slug: null,
        npc_type: 'amigo', origin: 'Costa Oscura', is_active: false,
        notes: 'Miembro de la red Bonasera en la Taberna del Tuerto. Forma parte del núcleo de apoyo que rodea a la party en Costa Oscura y, tras el rescate de Primo, pasa de contacto local cauteloso a aliado real dentro de la red de favores y movimientos del puerto.',
    },
    {
        name: 'Primo Bonasera',
        race: 'Humano', race_slug: 'human', class: null, class_slug: null,
        npc_type: 'amigo', origin: 'Costa Oscura', is_active: false,
        notes: 'Familiar de los Bonasera, puente con el Arrabal y el puerto. Estuvo cautivo de los Dientes Rotos hasta que la party lo rescato; ya libre, afianzo la alianza con los Bonasera.',
    },
    {
        name: 'Sony Bonasera',
        race: 'Humano', race_slug: 'human', class: null, class_slug: null,
        npc_type: 'amigo', origin: 'Costa Oscura', is_active: false,
        notes: 'Integrante de la familia Bonasera ligada a la Taberna del Tuerto. Su peso está en sostener el refugio, los vínculos y la logística del grupo en Costa Oscura. Tras el rescate de Primo, queda alineado con la party como parte del entramado Bonasera.',
    },
    {
        name: 'Teo Malvern',
        race: 'Humano', race_slug: 'human', class: 'Puño de Prontera', class_slug: null,
        npc_type: 'enemigo', origin: 'Prontera', is_active: false,
        notes: 'Joven promesa de una casa importante de Prontera y uno de los Puños. Durante la sesión de adivinación en la Torre del Don quedó marcado junto a Paleas y Zik, entró en trance y se convirtió en canal de una fuerza mucho más oscura. Zik comprendió que era el objetivo mostrado por el Dios Encadenado y lo mató en el acto.',
    },
    {
        name: 'Varek',
        race: 'Tiefling Andii', race_slug: 'tiefling', class: 'Agente', class_slug: null,
        npc_type: 'neutral', origin: 'Costa Oscura', is_active: false,
        notes: 'Tiefling Andii negro que aparece del lado de Prontera tras la toma de Costa Oscura. Se instaló dentro de la Torre del Don cerca de Osken Davra y Albert O\'Brien, y se presenta como una línea disidente dentro de su propio pueblo. Dice querer impedir que los Andii completen sus planes y necesita la ayuda de Lucario para abrir una senda e infiltrarse del otro lado.',
    },
];

async function findByAnyName(names) {
    return Character.findOne({ where: { name: names } });
}

async function run() {
    console.log('--- 1) Renames simples ---');
    for (const { from, to } of SIMPLE_RENAMES) {
        const existingTarget = await Character.findOne({ where: { name: to } });
        if (existingTarget) {
            console.log(`  "${to}" ya existe, salteo renombrar ${from.join('/')}.`);
            continue;
        }
        const source = await findByAnyName(from);
        if (!source) {
            console.log(`  No encontre ninguno de [${from.join(', ')}], nada que renombrar.`);
            continue;
        }
        source.name = to;
        await source.save();
        console.log(`  Renombrado: "${source.previous('name')}" -> "${to}" (id=${source.id})`);
    }

    console.log('--- 2) Merge Comandante de Prontera -> Osken Davra ---');
    const comandante = await Character.findOne({ where: { name: 'Comandante de Prontera' } });
    const osken = await Character.findOne({ where: { name: 'Osken Davra' } });
    if (comandante && osken) {
        await comandante.destroy();
        console.log(`  Duplicado eliminado: "Comandante de Prontera" (id=${comandante.id}); queda "Osken Davra" (id=${osken.id}).`);
    } else if (comandante && !osken) {
        comandante.name = 'Osken Davra';
        comandante.origin = 'Prontera';
        await comandante.save();
        console.log(`  Renombrado en lugar: "Comandante de Prontera" -> "Osken Davra" (id=${comandante.id}).`);
    } else {
        console.log('  Nada que fusionar (ya esta resuelto o no existe ninguno).');
    }

    console.log('--- 3) Crear NPCs faltantes (canon ecos) ---');
    for (const npc of ENSURE_NPCS) {
        const [record, created] = await Character.findOrCreate({
            where: { name: npc.name },
            defaults: { ...npc, is_npc: true },
        });
        console.log(`  ${created ? 'Creado' : 'Ya existia'}: ${npc.name} (id=${record.id})`);
    }

    console.log('--- 4) Fixes de relacion (npc_type / is_active) ---');
    for (const { name, fields } of RELATION_FIXES) {
        const record = await Character.findOne({ where: { name } });
        if (!record) {
            console.log(`  No encontre a "${name}", salteo.`);
            continue;
        }
        const before = { npc_type: record.npc_type, is_active: record.is_active };
        Object.assign(record, fields);
        await record.save();
        console.log(`  ${name}: ${JSON.stringify(before)} -> ${JSON.stringify(fields)}`);
    }

    console.log('--- Listo ---');
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('ERROR unificando NPCs:', err);
        process.exit(1);
    });
