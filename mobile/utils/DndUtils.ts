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
