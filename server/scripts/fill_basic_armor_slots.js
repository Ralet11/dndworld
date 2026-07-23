/**
 * Completa los slots de armadura VACIOS de cada PJ con piezas basicas
 * (rareza Comun, sin talentos ni habilidad) del mismo armor_type que ya usa
 * cada personaje. No toca slots que ya tienen algo puesto.
 *
 * Como esto cambia la CA "real" (suma de piezas), reajusta el item
 * "Ajuste de CA (nivel 5)" de cada PJ para que el total siga dando
 * exactamente el oficial (14/16/14/14) confirmado antes.
 */

const { Character, AbilityScore, Skill, Item, EquipmentSlots } = require('../models');
const StatEngine = require('../utils/statEngine');
const { buildArmorPiece } = require('../utils/armorBuilder');

const ARMOR_SLOTS = ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves'];

const NAME_BY_SLOT_TYPE = {
    tela: {
        helmet: 'Capucha de Tela', chest: 'Tunica de Tela', shoulders: 'Capa de Tela',
        boots: 'Botas de Tela', pants: 'Pantalon de Tela', gloves: 'Guantes de Tela',
    },
    cuero: {
        helmet: 'Casco de Cuero', chest: 'Peto de Cuero', shoulders: 'Hombreras de Cuero',
        boots: 'Botas de Cuero', pants: 'Grebas de Cuero', gloves: 'Guantes de Cuero',
    },
    malla: {
        helmet: 'Yelmo de Malla', chest: 'Coraza de Malla', shoulders: 'Hombreras de Malla',
        boots: 'Botas de Malla', pants: 'Grebas de Malla', gloves: 'Guantes de Malla',
    },
};

// Tipo de armadura base por personaje (coincide con lo que ya llevan puesto).
const CHAR_ARMOR_TYPE = {
    'Zik': 'cuero',
    'Rakion Altarion': 'tela',
    'Paleas Mucron': 'cuero',
    'Lucario': 'tela',
};

// CA oficial confirmada (nivel 5) que debe seguir dando el total.
const OFFICIAL_AC = {
    'Zik': 14,
    'Paleas Mucron': 16,
    'Rakion Altarion': 14,
    'Lucario': 14,
};

const ADJUSTMENT_ITEM_NAME = 'Ajuste de CA (nivel 5)';

const INCLUDE = [
    { model: AbilityScore, as: 'abilityScores' },
    { model: Skill, as: 'skills' },
    {
        model: EquipmentSlots, as: 'equipment', include: [
            { model: Item, as: 'helmet' }, { model: Item, as: 'chest' }, { model: Item, as: 'shoulders' },
            { model: Item, as: 'boots' }, { model: Item, as: 'pants' }, { model: Item, as: 'gloves' },
            { model: Item, as: 'ring_1' }, { model: Item, as: 'ring_2' },
            { model: Item, as: 'primary_weapon' }, { model: Item, as: 'secondary_weapon' },
        ],
    },
];

async function run() {
    for (const [name, armorType] of Object.entries(CHAR_ARMOR_TYPE)) {
        const char = await Character.findOne({ where: { name }, include: INCLUDE });
        if (!char) { console.log(`No encontre a "${name}", salteo.`); continue; }

        console.log(`=== ${name} (base: ${armorType}) ===`);
        const equipment = char.equipment;

        // Si el item de ajuste de CA quedo ocupando un slot de armadura real
        // (en vez de un anillo), lo corremos primero para poder poner ahi la
        // pieza basica de verdad.
        for (const slot of ARMOR_SLOTS) {
            const occupant = equipment[slot];
            if (occupant && occupant.name === ADJUSTMENT_ITEM_NAME) {
                const freeRing = !equipment.ring_1 ? 'ring_1' : (!equipment.ring_2 ? 'ring_2' : null);
                if (freeRing) {
                    equipment[`${freeRing}_id`] = occupant.id;
                    equipment[`${slot}_id`] = null;
                    await equipment.save();
                    equipment[slot] = null;
                    equipment[freeRing] = occupant;
                    console.log(`  Ajuste de CA movido de "${slot}" a "${freeRing}" para liberar el slot de armadura.`);
                }
            }
        }

        for (const slot of ARMOR_SLOTS) {
            if (equipment[slot]) {
                console.log(`  ${slot}: ya tiene "${equipment[slot].name}", no lo toco.`);
                continue;
            }
            const piece = buildArmorPiece({
                name: NAME_BY_SLOT_TYPE[armorType][slot],
                slot,
                armor_type: armorType,
                rarity: 'Común',
            });
            const item = await Item.create(piece);
            equipment[`${slot}_id`] = item.id;
            await equipment.save();
            console.log(`  ${slot}: creado y equipado "${item.name}" (ca_value=${item.ca_value}).`);
        }

        // Reajustar el placeholder para que la CA total siga en el oficial.
        const fresh = await Character.findOne({ where: { name }, include: INCLUDE });
        const current = StatEngine.calculate(fresh);
        const target = OFFICIAL_AC[name];

        // Buscar el item de ajuste de ESTE personaje entre lo que tiene
        // equipado (cada PJ tiene su propia instancia con el mismo nombre).
        let adjItem = null;
        for (const col of ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2']) {
            const equipped = fresh.equipment[col];
            if (equipped && equipped.name === ADJUSTMENT_ITEM_NAME) { adjItem = equipped; break; }
        }

        if (adjItem) {
            // CA sin el aporte del ajuste (para recalcular su valor limpio).
            const currentAdjBonus = adjItem.stat_bonuses?.ac || 0;
            const acWithoutAdj = current.ac - currentAdjBonus;
            const newAdjBonus = target - acWithoutAdj;
            adjItem.stat_bonuses = { ac: newAdjBonus };
            await adjItem.save();
            const finalChar = await Character.findOne({ where: { name }, include: INCLUDE });
            const finalStats = StatEngine.calculate(finalChar);
            console.log(`  Ajuste recalculado: ${currentAdjBonus} -> ${newAdjBonus}. CA final: ${finalStats.ac} (objetivo ${target}).`);
        } else {
            console.log(`  No tiene item de ajuste equipado; CA actual: ${current.ac} (objetivo ${target}).`);
        }
        console.log();
    }
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('ERROR completando slots de armadura:', err);
        process.exit(1);
    });
