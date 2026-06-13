const axios = require('axios');
const Spell = require('../models/Spell');
const sequelize = require('../config/database');

/**
 * Siembra los conjuros desde Open5e (v1). Idempotente: si ya hay conjuros en la
 * base, NO re-descarga (así no pisa las traducciones cacheadas). Bootstrap-ready.
 */
async function seedSpells() {
    await Spell.sync(); // crea la tabla si no existe (sin force → no borra nada)

    const existing = await Spell.count();
    if (existing > 0) {
        console.log(`Conjuros: ya hay ${existing} en la base, omito la descarga.`);
        return;
    }

    console.log('Descargando conjuros de Open5e (v1)...');
    const response = await axios.get('https://api.open5e.com/v1/spells/?limit=2000', { timeout: 60000 });
    const spellsIn = response.data?.results || [];
    console.log(`Descargados ${spellsIn.length} conjuros.`);

    const spellsData = spellsIn.map((s) => ({
        slug: s.slug,
        name: s.name,
        desc: s.desc,
        higher_level: s.higher_level,
        page: s.page,
        range: s.range,
        components: s.components,
        material: s.material,
        ritual: s.ritual === 'yes' || s.ritual === true,
        duration: s.duration,
        concentration: s.concentration === 'yes' || s.concentration === true,
        casting_time: s.casting_time,
        level: s.level_int,
        school: s.school,
        dnd_class: s.dnd_class,
        spell_lists: s.spell_lists,
        archetype: s.archetype,
        circles: s.circles,
        document__slug: s.document__slug,
        document__title: s.document__title,
    }));

    await Spell.bulkCreate(spellsData, { ignoreDuplicates: true });
    console.log(`Insertados ${spellsData.length} conjuros.`);
}

module.exports = { seedSpells };

// Permite correrlo directo: node utils/seed_spells.js
if (require.main === module) {
    const path = require('path');
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    (async () => {
        try {
            await sequelize.authenticate();
            await seedSpells();
            process.exit(0);
        } catch (e) {
            console.error('Error sembrando conjuros:', e.message);
            process.exit(1);
        }
    })();
}
