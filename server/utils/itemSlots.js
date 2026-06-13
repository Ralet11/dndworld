/**
 * Lógica de slots de equipo.
 *
 * Cada item guarda un `slot` LÓGICO (helmet, chest, weapon, ring, none, ...).
 * `resolveSlotColumn` lo traduce a la columna real de equipment_slots,
 * resolviendo los slots dobles (anillos y armas) según lo que ya esté ocupado.
 */

// Deduce el slot lógico de un item a partir de su tipo y nombre.
// Se usa para hacer backfill de items que todavía no tienen slot definido.
const deriveSlot = (item) => {
    const n = (item.name || '').toLowerCase();
    const type = item.type;

    if (type === 'Consumible') return 'none';

    if (type === 'Armadura') {
        if (/casco|yelmo|capucha/.test(n)) return 'helmet';
        if (/escudo/.test(n)) return 'off_hand';
        if (/guante|manopla/.test(n)) return 'gloves';
        if (/bota|greba/.test(n)) return 'boots';
        if (/pantal|pierna/.test(n)) return 'pants';
        if (/capa|manto|hombrera|espalda/.test(n)) return 'shoulders';
        return 'chest';
    }

    if (type === 'Arma') return 'weapon';

    // Objeto Mágico / Otro: equipable solo si el nombre lo sugiere.
    if (/anillo|sortija/.test(n)) return 'ring';
    if (/capa|manto|amuleto|collar/.test(n)) return 'shoulders';
    return 'none';
};

// Traduce el slot lógico a la columna real, resolviendo dobles.
const resolveSlotColumn = (logical, equipment = {}) => {
    switch (logical) {
        case 'helmet':
        case 'chest':
        case 'shoulders':
        case 'boots':
        case 'pants':
        case 'gloves':
            return logical;
        case 'weapon':
        case 'main_hand':
            return equipment.primary_weapon_id ? 'secondary_weapon' : 'primary_weapon';
        case 'off_hand':
        case 'shield':
            return 'secondary_weapon';
        case 'ring':
            return equipment.ring_1_id ? 'ring_2' : 'ring_1';
        // Columnas directas (compatibilidad / slot explícito del cliente).
        case 'primary_weapon':
        case 'secondary_weapon':
        case 'ring_1':
        case 'ring_2':
            return logical;
        default:
            return null; // 'none' / no equipable
    }
};

// ¿El item se puede equipar?
const isEquippable = (item) => {
    const logical = item && item.slot ? item.slot : deriveSlot(item || {});
    return resolveSlotColumn(logical, {}) !== null;
};

module.exports = { deriveSlot, resolveSlotColumn, isEquippable };
