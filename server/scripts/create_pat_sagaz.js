require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const { Character } = require('../models');

const APPLY = process.argv.includes('--apply');
const definition = {
    name: 'Pat Sagaz',
    race: 'Humanoide',
    class: 'Desconocido',
    alignment: 'Neutral',
    // null makes the public token/glossary omit the level instead of exposing a number.
    level: null,
    hp_current: 10,
    hp_max: 10,
    ac_base: 10,
    speed: 30,
    size: 'Mediano',
    creature_type: 'Humanoide',
    npc_type: 'neutral',
    party_known: false,
    origin: 'Desconocido',
    notes: 'NPC neutral. Su nivel permanece oculto.',
    abilities_text: '',
    custom_features: [],
    is_npc: true,
    is_active: false,
};

async function run() {
    const existing = await Character.findOne({ where: { name: definition.name, is_npc: true } });
    if (!APPLY) {
        console.log(JSON.stringify({
            mode: 'dry-run',
            operation: existing ? 'update' : 'create',
            id: existing?.id || null,
            name: definition.name,
            npcType: definition.npc_type,
            level: 'hidden',
            partyKnown: definition.party_known,
        }, null, 2));
        return;
    }

    const npc = existing || await Character.create({ name: definition.name, is_npc: true });
    const preserved = npc.toJSON();
    await npc.update({
        ...definition,
        image_url: preserved.image_url || null,
        base_body_url: preserved.base_body_url || null,
        rendered_url: preserved.rendered_url || null,
    });
    console.log(JSON.stringify({ mode: 'applied', id: npc.id, name: npc.name, npcType: npc.npc_type, level: npc.level, partyKnown: npc.party_known }, null, 2));
}

run()
    .then(() => sequelize.close())
    .catch(async error => {
        console.error(error);
        await sequelize.close();
        process.exit(1);
    });
