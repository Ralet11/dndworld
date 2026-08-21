require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const {
    AbilityScore,
    Character,
    CharacterAuditLog,
    CharacterInventory,
    EquipmentSlots,
    Item,
    Skill,
} = require('../models');
const { PALEAS_ARMOR } = require('../data/paleasEquipment');
const StatEngine = require('../utils/statEngine');

const APPLY = process.argv.includes('--apply');
const ARMOR_SLOTS = ['shoulders', 'chest', 'pants', 'boots'];
const LEGACY_NAMES = ['Mithral Half Plate', 'Ajuste de CA (nivel 5)'];
const INCLUDE = [
    { model: AbilityScore, as: 'abilityScores' },
    { model: Skill, as: 'skills' },
    { model: Item, as: 'items' },
    {
        model: EquipmentSlots,
        as: 'equipment',
        include: ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon']
            .map(as => ({ model: Item, as })),
    },
];

async function loadPaleas() {
    return Character.findOne({ where: { name: 'Paleas Mucron' }, include: INCLUDE });
}

function equipmentSnapshot(character) {
    return Object.fromEntries(
        ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon']
            .map(slot => [slot, character.equipment?.[slot]?.name || null]),
    );
}

async function run() {
    const paleas = await loadPaleas();
    if (!paleas) throw new Error('No se encontr\u00f3 Paleas Mucron.');

    const before = {
        hp: [paleas.hp_current, paleas.hp_max],
        ac: StatEngine.calculate(paleas).ac,
        equipment: equipmentSnapshot(paleas),
    };
    const preview = {
        characterId: paleas.id,
        before,
        after: {
            ac: 15,
            armor: PALEAS_ARMOR.map(item => ({ name: item.name, slot: item.slot, ca_value: item.ca_value })),
        },
    };
    if (!APPLY) return console.log(JSON.stringify({ mode: 'dry-run', ...preview }, null, 2));

    await sequelize.transaction(async transaction => {
        const armorBySlot = {};
        for (const definition of PALEAS_ARMOR) {
            const [item] = await Item.findOrCreate({ where: { name: definition.name }, defaults: definition, transaction });
            await item.update(definition, { transaction });
            armorBySlot[definition.slot] = item;
            await CharacterInventory.findOrCreate({
                where: { character_id: paleas.id, item_id: item.id },
                defaults: { quantity: 1 },
                transaction,
            });
        }

        const legacyItems = await Item.findAll({ where: { name: LEGACY_NAMES }, transaction });
        if (legacyItems.length) {
            await CharacterInventory.destroy({
                where: { character_id: paleas.id, item_id: legacyItems.map(item => item.id) },
                transaction,
            });
        }

        const [equipment] = await EquipmentSlots.findOrCreate({ where: { character_id: paleas.id }, transaction });
        const equipmentPatch = {
            helmet_id: null,
            gloves_id: null,
            shoulders_id: armorBySlot.shoulders.id,
            chest_id: armorBySlot.chest.id,
            pants_id: armorBySlot.pants.id,
            boots_id: armorBySlot.boots.id,
        };
        for (const ring of ['ring_1', 'ring_2']) {
            if (LEGACY_NAMES.includes(paleas.equipment?.[ring]?.name)) equipmentPatch[`${ring}_id`] = null;
        }
        await equipment.update(equipmentPatch, { transaction });
        await paleas.update({ ac_base: 15 }, { transaction });
        await CharacterAuditLog.create({
            character_id: paleas.id,
            actor_username: 'Codex / DM',
            actor_role: 'DM',
            source: 'paleas-modular-mail-set',
            changes: { armor_set: preview },
        }, { transaction });
    });

    const updated = await loadPaleas();
    const calculated = StatEngine.calculate(updated);
    const invalidSlots = ARMOR_SLOTS.filter(slot => (
        updated.equipment?.[slot]?.armor_type !== 'malla'
        || Number(updated.equipment?.[slot]?.ca_value) !== 1.25
        || Number(updated.equipment?.[slot]?.stat_bonuses?.ac || 0) !== 0
    ));
    if (calculated.ac !== 15 || invalidSlots.length || updated.equipment?.helmet || updated.equipment?.gloves) {
        throw new Error(`Verificaci\u00f3n fallida: CA ${calculated.ac}; slots inv\u00e1lidos: ${invalidSlots.join(', ') || 'ninguno'}.`);
    }
    console.log(JSON.stringify({
        mode: 'applied',
        character: {
            id: updated.id,
            hp: [updated.hp_current, updated.hp_max],
            ac: calculated.ac,
            armorType: calculated.armorType,
            equipment: equipmentSnapshot(updated),
        },
    }, null, 2));
}

run().then(() => sequelize.close()).catch(async error => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
});
