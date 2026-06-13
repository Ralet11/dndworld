export const STANDARD_SKILLS = [
    { name: 'Acrobacias', attr: 'dex' },
    { name: 'Trato con Animales', attr: 'wis' },
    { name: 'Arcana', attr: 'int' },
    { name: 'Atletismo', attr: 'str' },
    { name: 'Engaño', attr: 'cha' },
    { name: 'Historia', attr: 'int' },
    { name: 'Perspicacia', attr: 'wis' },
    { name: 'Intimidación', attr: 'cha' },
    { name: 'Investigación', attr: 'int' },
    { name: 'Medicina', attr: 'wis' },
    { name: 'Naturaleza', attr: 'int' },
    { name: 'Percepción', attr: 'wis' },
    { name: 'Interpretación', attr: 'cha' },
    { name: 'Persuasión', attr: 'cha' },
    { name: 'Religión', attr: 'int' },
    { name: 'Juego de Manos', attr: 'dex' },
    { name: 'Sigilo', attr: 'dex' },
    { name: 'Supervivencia', attr: 'wis' },
];

export const getModifier = (score: number) => Math.floor((score - 10) / 2);

/**
 * ¿El item se puede equipar? Usa el `slot` lógico del item; si no lo tiene
 * (datos viejos), cae al tipo.
 */
export const isEquippable = (item: any): boolean => {
    const slot = item?.slot;
    if (slot) return slot !== 'none';
    return item?.type === 'Arma' || item?.type === 'Armadura';
};

// Etiqueta legible del slot donde se equipa el item.
export const SLOT_LABELS: Record<string, string> = {
    helmet: 'Cabeza',
    chest: 'Cuerpo',
    shoulders: 'Espalda',
    boots: 'Pies',
    pants: 'Piernas',
    gloves: 'Manos',
    weapon: 'Mano principal',
    main_hand: 'Mano principal',
    primary_weapon: 'Mano principal',
    off_hand: 'Mano secundaria',
    shield: 'Mano secundaria',
    secondary_weapon: 'Mano secundaria',
    ring: 'Anillo',
    ring_1: 'Anillo',
    ring_2: 'Anillo',
};

/** Devuelve la etiqueta del slot, o '' si no es equipable. */
export const slotLabel = (item: any): string => {
    const slot = item?.slot;
    if (!slot || slot === 'none') return '';
    return SLOT_LABELS[slot] || '';
};

// --- Armaduras (D&D 5e) ---
export const ARMOR_WEIGHTS = ['ligera', 'media', 'pesada'];

export const MATERIAL_WEIGHT: Record<string, string> = {
    'Acolchada': 'ligera',
    'Cuero': 'ligera',
    'Cuero tachonado': 'ligera',
    'Pieles': 'media',
    'Camisa de malla': 'media',
    'Cota de escamas': 'media',
    'Coraza': 'media',
    'Media placa': 'media',
    'Cota de anillas': 'pesada',
    'Cota de malla': 'pesada',
    'Férula / Splint': 'pesada',
    'Placas': 'pesada',
    'Escudo': 'escudo',
};

export const ARMOR_MATERIALS = Object.keys(MATERIAL_WEIGHT);

export const weightForMaterial = (material: string): string | null =>
    MATERIAL_WEIGHT[material] || null;

export const isArmor = (item: any): boolean => item?.type === 'Armadura';

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "Cuero · Ligera" para armaduras con material/categoría seteados. */
export const armorLabel = (item: any): string => {
    if (!isArmor(item)) return '';
    const parts: string[] = [];
    if (item.armor_material) parts.push(item.armor_material);
    if (item.armor_weight && item.armor_weight !== 'escudo') parts.push(cap(item.armor_weight));
    return parts.join(' · ');
};

export const CLASS_SUBCLASS_LEVELS: Record<string, number> = {
    'cleric': 1,
    'sorcerer': 1,
    'warlock': 1,
    'druid': 2,
    'wizard': 2,
    'barbarian': 3,
    'bard': 3,
    'fighter': 3,
    'monk': 3,
    'paladin': 3,
    'ranger': 3,
    'rogue': 3,
};
