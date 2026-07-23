/**
 * Repara la invariante: todo item equipado (EquipmentSlots) debe existir
 * tambien en el inventario (CharacterInventory), que es de donde sale la
 * lista de "items" en la ficha del personaje.
 *
 * Los scripts anteriores (set_level5_official_stats, fill_basic_armor_slots)
 * crearon items y los equiparon directo por FK, sin pasar por
 * char.addItem(...) como hace el flujo normal (assign-item). Este script
 * hace el backfill idempotente para los 4 PJ.
 */

const { Character, EquipmentSlots, Item } = require('../models');
const sequelize = require('../config/database');

const SLOT_COLUMNS = [
    'helmet_id', 'chest_id', 'shoulders_id', 'boots_id', 'pants_id', 'gloves_id',
    'ring_1_id', 'ring_2_id', 'primary_weapon_id', 'secondary_weapon_id', 'back_id',
];

async function run() {
    const CharacterInventory = sequelize.models.CharacterInventory;
    const chars = await Character.findAll({
        where: { is_npc: false },
        include: [{ model: EquipmentSlots, as: 'equipment' }],
    });

    for (const char of chars) {
        if (!char.equipment) { console.log(`${char.name}: sin EquipmentSlots, salteo.`); continue; }
        console.log(`=== ${char.name} ===`);
        for (const col of SLOT_COLUMNS) {
            const itemId = char.equipment[col];
            if (!itemId) continue;
            const [, created] = await CharacterInventory.findOrCreate({
                where: { character_id: char.id, item_id: itemId },
                defaults: { character_id: char.id, item_id: itemId, quantity: 1 },
            });
            const item = await Item.findByPk(itemId);
            console.log(`  ${col.replace('_id', '')}: "${item?.name}" ${created ? '-> agregado al inventario' : '(ya estaba en inventario)'}`);
        }
    }
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('ERROR reparando inventario:', err);
        process.exit(1);
    });
