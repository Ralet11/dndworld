/**
 * Setea el estado "oficial" de nivel 5 para los 4 PJ, confirmado a mano por
 * el DM: nivel, HP (max y actual, full heal) y CA objetivo.
 *
 * La CA de un jugador no es un campo directo: sale de 10 + piezas de armadura
 * equipadas (ver statEngine.js). Como el equipo real (armadura del tiefling
 * negro, pua de brumante, etc.) todavia no esta modelado item por item, este
 * script agrega UN item de ajuste plano por personaje (stat_bonuses.ac) que
 * completa la diferencia hasta la CA objetivo, dejando el resto del equipo
 * intacto. Reemplazar por itemizacion real cuando se cargue el equipo posta.
 *
 * Pensado para correr UNA vez por entorno (no es idempotente si se vuelve a
 * correr sin ajustar TARGETS, porque sumaria otro item de ajuste).
 */

const { Character, AbilityScore, Skill, Item, EquipmentSlots } = require('../models');
const StatEngine = require('../utils/statEngine');

const TARGETS = {
    'Zik': { level: 5, hp: 19, ac: 14, slot: 'chest' },
    'Paleas Mucron': { level: 5, hp: 32, ac: 16, slot: 'ring_1' },
    'Rakion Altarion': { level: 5, hp: 30, ac: 14, slot: 'chest' },
    'Lucario': { level: 5, hp: 26, ac: 14, slot: 'ring_1' },
};

const ADJUSTMENT_ITEM_NAME = 'Ajuste de CA (nivel 5)';

async function run() {
    for (const [name, target] of Object.entries(TARGETS)) {
        const char = await Character.findOne({
            where: { name },
            include: [
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
            ],
        });
        if (!char) {
            console.log(`No encontre a "${name}", salteo.`);
            continue;
        }

        const before = StatEngine.calculate(char);
        console.log(`=== ${name} === antes: HP ${before.hp}/${before.maxHp}, CA ${before.ac}, nivel ${before.level}`);

        char.level = target.level;
        char.hp_max = target.hp;
        char.hp_current = target.hp;
        await char.save();

        const acDelta = target.ac - before.ac;
        if (acDelta !== 0) {
            const item = await Item.create({
                name: ADJUSTMENT_ITEM_NAME,
                type: 'Objeto Mágico',
                rarity: 'Común',
                slot: target.slot,
                stat_bonuses: { ac: acDelta },
                description: `Ajuste manual para llegar a CA ${target.ac} en nivel 5, mientras se carga el equipo real pieza por pieza.`,
            });

            const equipment = char.equipment || (await EquipmentSlots.findOrCreate({ where: { character_id: char.id } }))[0];
            const column = `${target.slot}_id`;
            equipment[column] = item.id;
            await equipment.save();
            console.log(`  CA: sumado ajuste de ${acDelta >= 0 ? '+' : ''}${acDelta} en slot "${target.slot}" (item id=${item.id}).`);
        } else {
            console.log('  CA ya estaba en el objetivo, no hizo falta ajuste.');
        }
    }

    console.log('--- Verificacion final ---');
    for (const name of Object.keys(TARGETS)) {
        const char = await Character.findOne({
            where: { name },
            include: [
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
            ],
        });
        const s = StatEngine.calculate(char);
        console.log(`${name}: HP ${s.hp}/${s.maxHp} | CA ${s.ac} | nivel ${s.level}`);
    }
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('ERROR seteando stats de nivel 5:', err);
        process.exit(1);
    });
