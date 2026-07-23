/**
 * Sincroniza el esquema (crea tabla blueprints + columna blueprints_known si
 * faltan) y siembra los 7 planos homebrew de Rakion (magia 100% via
 * gadgets/crafteo, sin spellcasting real de Artificer).
 *
 * Idempotente: usa slug como clave, no duplica si se corre de nuevo.
 */

const sequelize = require('../config/database');
const { Character, Blueprint } = require('../models');

const RAKION_BLUEPRINTS = [
    {
        slug: 'escupefuego',
        name: 'Escupefuego',
        category: 'arma',
        description: 'Arma a distancia estilo escopeta. Dano 1d10 + DES + INT (segun lo narrado por el DM). Capacidad 6 municiones; se atasca si el d20 de ataque es < 5.',
        item_template: { type: 'Arma', slot: 'weapon', damage: '1d10', weapon_category: 'Marcial' },
    },
    {
        slug: 'escudo-desplegable',
        name: 'Escudo desplegable',
        category: 'armadura',
        description: 'Escudo mecanico portatil: +5 CA mientras funciona. ESTADO: roto desde el intento de reparacion en la Torre del Don; no otorga CA hasta que se arregle o refabrique.',
        item_template: { type: 'Armadura', slot: 'secondary_weapon', stat_bonuses: { ac: 5 } },
    },
    {
        slug: 'granada-simple',
        name: 'Granada simple',
        category: 'consumible',
        description: 'Explosivo de un solo uso a base de polvora/dinamita minera. Dano en area (definir en mesa segun cantidad usada).',
        item_template: { type: 'Consumible', slot: 'none' },
    },
    {
        slug: 'pua-de-brumante',
        name: 'Pua de brumante',
        category: 'utilidad',
        description: 'Pieza de brumante refinada para Lucario: +1d4 al dano y a las curaciones. Ya crafteada y entregada; Rakion conserva el plano.',
        item_template: { type: 'Objeto Mágico', slot: 'ring', stat_bonuses: {}, use_effects: { bonus_dice: '1d4', applies_to: ['dano', 'curacion'] } },
    },
    {
        slug: 'goggles-brumosos',
        name: 'Goggles simples de brumosos',
        category: 'utilidad',
        description: 'Goggles para Paleas: ventaja en Percepcion. Efecto adicional pendiente de definir en ecos.',
        item_template: { type: 'Objeto Mágico', slot: 'helmet', stat_bonuses: {} },
    },
    {
        slug: 'guantes-reforzados-brumosos',
        name: 'Guantes reforzados brumosos',
        category: 'armadura',
        description: 'Guantes para Zik: +2 CA.',
        item_template: { type: 'Armadura', slot: 'gloves', stat_bonuses: { ac: 2 } },
    },
    {
        slug: 'spray-de-acido',
        name: 'Spray de acido',
        category: 'utilidad',
        description: 'Gadget que reemplaza el cantrip Acid Splash: en este mundo, para Rakion, no es un spell — es un plano igual que los demas. Mecanicamente funciona como Acid Splash (dano acido, tirada de salvacion DES). Solo el resto de la party sigue usando spells reales para esto.',
        item_template: { type: 'Objeto Mágico', slot: 'none', damage: '1d6', damage_type: 'Acido' },
    },
];

async function run() {
    await sequelize.sync({ alter: true });
    console.log('Esquema sincronizado (tabla blueprints + columna blueprints_known ok).');

    const slugs = [];
    for (const bp of RAKION_BLUEPRINTS) {
        const [record, created] = await Blueprint.findOrCreate({
            where: { slug: bp.slug },
            defaults: bp,
        });
        slugs.push(record.slug);
        console.log(`  ${created ? 'Creado' : 'Ya existia'}: ${bp.name} (${bp.slug})`);
    }

    const rakion = await Character.findOne({ where: { name: 'Rakion Altarion' } });
    if (!rakion) {
        console.log('No encontre a Rakion Altarion.');
        return;
    }

    const known = new Set(rakion.blueprints_known || []);
    slugs.forEach((s) => known.add(s));
    rakion.blueprints_known = [...known];
    // Rakion: magia 100% via gadgets/planos, sin spellcasting real de Artificer.
    rakion.spells_known = [];
    rakion.spells_prepared = [];
    rakion.spell_slots = {};
    await rakion.save();
    console.log('Rakion.blueprints_known ->', rakion.blueprints_known);
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('ERROR sembrando blueprints:', err);
        process.exit(1);
    });
