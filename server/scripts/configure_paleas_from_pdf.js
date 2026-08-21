require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const {
    Character, AbilityScore, Skill, Item, EquipmentSlots, CharacterInventory,
    Spell, CharacterAuditLog,
} = require('../models');
const StatEngine = require('../utils/statEngine');
const { PALEAS_ARMOR } = require('../data/paleasEquipment');

const APPLY = process.argv.includes('--apply');
const CHARACTER_NAME = 'Paleas Mucron';
const ABILITY_SCORES = { STR: 14, DEX: 13, CON: 9, INT: 8, WIS: 15, CHA: 16 };
const SKILLS = [
    { name: 'Perspicacia', proficiency_level: 1 },
    { name: 'Investigación', proficiency_level: 2 },
    { name: 'Percepción', proficiency_level: 1 },
    { name: 'Religión', proficiency_level: 1 },
    { name: 'Sigilo', proficiency_level: 1 },
];

const PDF_FEATURES = [
    ['Core Ranger Traits', 'Pasivo', 'PHB-2024 119', 'Core Ranger Traits.'],
    ['Spellcasting (Ranger)', 'Pasivo', 'PHB-2024 119', 'Spellcasting.'],
    ['Favored Enemy', 'Bonus', 'Hunter’s Mark: 2 / Long Rest', 'You always have Hunter’s Mark prepared and can cast it without expending a spell slot 2 times per Long Rest.'],
    ['Weapon Mastery', 'Pasivo', 'PHB-2024 120', 'Greatsword (Graze) and Shortsword (Vex).'],
    ['Deft Explorer', 'Pasivo', 'PHB-2024 120', 'You gain Expertise with one of your skill proficiencies. You know two languages of your choice.'],
    ['Fighting Style', 'Pasivo', 'Fighting Style feat · br-2024', 'Two-Weapon Fighting.'],
    ['Ranger Subclass', 'Pasivo', 'Hunter', 'Hunter.'],
    ['Hunter’s Lore', 'Bonus', '1 Bonus Action · PHB-2024 127', 'When a creature is marked by your Hunter’s Mark, you know whether the creature has any Immunities, Resistances, Vulnerabilities, and if the creature has any, you know what they are.'],
    ['Hunter’s Prey — Colossus Slayer', 'Accion', '1 Action · PHB-2024 127', 'Once per turn, when you hit a creature that’s missing any of its HP with a weapon, the weapon deals an extra 1d8 damage.'],
    ['Ability Score Improvement', 'Pasivo', 'PHB-2024 120', 'Ability Score Improvement.'],
    ['Core Sorcerer Traits', 'Pasivo', 'PHB-2024 139', 'Core Sorcerer Traits.'],
    ['Spellcasting (Sorcerer)', 'Pasivo', 'PHB-2024 139', 'Spellcasting.'],
    ['Innate Sorcery', 'Bonus', '2 / Long Rest · 1 Bonus Action', 'Twice per Long Rest, you can take a Bonus Action to unleash the simmering magic within you for 1 minute.'],
    ['Healing Hands', 'Accion', '1 / Long Rest · 1 Action', 'Once per long rest as an action, touch a creature and restore 5 hit points.'],
    ['Ability Score Increase', 'Pasivo', 'DMG', 'Your Wisdom score increases by 1, and your Charisma score increases by 2.'],
    ['Size', 'Pasivo', 'DMG', 'Medium.'],
    ['Speed', 'Pasivo', 'DMG', '30 ft. (Walking).'],
    ['Darkvision', 'Pasivo', 'DMG', 'Darkvision 60 ft.'],
    ['Celestial Resistance', 'Pasivo', 'DMG', 'You have resistance to necrotic damage and radiant damage.'],
    ['Celestial Legacy', 'Pasivo', 'DMG', 'You know the light cantrip. [3rd] You can cast lesser restoration once per long rest. [5th] You can cast daylight once per long rest. CHA is your spellcasting ability.'],
    ['Savage Attacker', 'Pasivo', 'PHB-2024 201', 'Once per turn when you hit a target with a weapon, you can roll the weapon’s damage dice twice and use either roll against the target.'],
    ['Two-Weapon Fighting', 'Pasivo', 'PHB-2024 210', 'When you make an extra attack as a result of using a weapon that has the Light property, you can add your ability modifier to the damage of that attack if you aren’t already adding it to the damage.'],
    ['Greatsword (Graze)', 'Accion', '1 Action', 'Graze. If your attack roll with a Greatsword misses a creature, you can deal damage to it equal to the ability modifier used to make the attack. This damage is the same type dealt by the Greatsword, and can only be increased by increasing the ability modifier.'],
    ['Shortsword (Vex)', 'Accion', '1 Action', 'Vex. If you hit a creature with a Shortsword and deal damage to it, you have Advantage on your next attack roll against that creature before the end of your next turn.'],
].map(([name, kind, resource, description]) => ({ name, kind, resource, description }));

const healingHands = PDF_FEATURES.find(feature => feature.name === 'Healing Hands');
healingHands.combat_action = { target: 'ally', economy: 'action', healing: '5', max_uses: 1, recovery: 'largo' };

const SPELLS = [
    ['paleas-fire-bolt', 'Fire Bolt', 'Sorcerer', 0, '+6', '1A', '120 ft.', 'V,S', 'Instantaneous', 'PHB-2024 274', 'V/S'],
    ['paleas-mage-hand', 'Mage Hand', 'Sorcerer', 0, '--', '1A', '30 ft.', 'V,S', '1 minute', 'PHB-2024 293', 'D: 1m, V/S'],
    ['paleas-sorcerous-burst', 'Sorcerous Burst', 'Sorcerer', 0, '+6', '1A', '120 ft.', 'V,S', 'Instantaneous', 'PHB-2024 318', 'V/S'],
    ['paleas-thunderclap', 'Thunderclap', 'Sorcerer', 0, 'CON 14', '1A', '5 ft.', 'S', 'Instantaneous', 'EE 168', 'S'],
    ['paleas-light', 'Light', 'Celestial Legacy', 0, 'DEX 14', '1A', 'Touch/20 ft. Sphere', 'V,M', '1 hour', 'PHB 255', 'D: 1h, 20 ft. Sphere, V/M'],
    ['paleas-detect-magic', 'Detect Magic [R]', 'Ranger', 1, '--', '1A', 'Self/30 ft. Sphere', 'V,S', 'Concentration, up to 10 minutes', 'PHB-2024 262', 'D: 10m, 30 ft. Sphere, V/S'],
    ['paleas-ensnaring-strike', 'Ensnaring Strike', 'Ranger', 1, 'STR 13', '1BA', 'Self', 'V', 'Concentration, up to 1 minute', 'PHB-2024 268', 'D: 1m, V'],
    ['paleas-goodberry', 'Goodberry', 'Ranger', 1, '--', '1A', 'Self', 'V,S,M', '24 hours', 'PHB-2024 280', 'D: 24h, V/S/M'],
    ['paleas-hunters-mark', "Hunter's Mark", 'Ranger / Favored Enemy (Always Prepared)', 1, '--', '1BA', '90 ft.', 'V', 'Concentration, up to 1 hour', 'PHB-2024 287', 'Ext. D: (See Description)*, D: 1h, V'],
    ['paleas-burning-hands', 'Burning Hands', 'Sorcerer', 1, 'DEX 14', '1A', 'Self/15 ft. Cone', 'V,S', 'Instantaneous', 'PHB-2024 248', '15 ft. Cone, V/S'],
    ['paleas-magic-missile', 'Magic Missile', 'Sorcerer', 1, '--', '1A', '120 ft.', 'V,S', 'Instantaneous', 'PHB-2024 295', 'V/S'],
    ['paleas-lesser-restoration', 'Lesser Restoration', 'Celestial Legacy', 2, '--', '1A', 'Touch', 'V,S', 'Instantaneous', 'PHB 255', '1/LR, V/S'],
    ['paleas-daylight', 'Daylight', 'Celestial Legacy', 3, '--', '1A', '60 ft./60 ft. Sphere', 'V,S', '1 hour', 'PHB 230', '1/LR (Used), D: 1h, 60 ft. Sphere, V/S'],
].map(([slug, name, source, level, save, casting_time, range, components, duration, page, notes]) => ({ slug, name, source, level, save, casting_time, range, components, duration, page, notes }));

const ITEMS = [
    {
        name: 'Longsword, +1', type: 'Arma', rarity: 'Poco Común', slot: 'primary_weapon',
        weapon_category: 'Marcial', damage: '1d8', damage_type: 'Slashing', weight: 3,
        properties: ['Martial', 'Versatile'], mastery: { key: 'sap', name: 'Sap', desc: 'Sap' },
        description: '1d8+3 Slashing. Martial, Versatile, Sap.',
        use_effects: { combat_action: { attackBonus: 6, damageBonus: 1, damageType: 'Slashing' } },
    },
    {
        name: 'Shortsword, +1', type: 'Arma', rarity: 'Poco Común', slot: 'secondary_weapon',
        weapon_category: 'Marcial', damage: '1d6', damage_type: 'Piercing', weight: 2,
        properties: ['Martial', 'Finesse', 'Light'], mastery: { key: 'vex', name: 'Vex', desc: 'Vex' },
        description: '1d6+3 Piercing. Martial, Finesse, Light, Vex.',
        use_effects: { combat_action: { attackBonus: 6, damageBonus: 1, damageType: 'Piercing' } },
    },
    ...PALEAS_ARMOR,
];

const PDF_NOTES = [
    'Fuente: emiDM_158154880.pdf',
    'Experience Points: (Milestone)',
    'Hit Dice: 4d10 + 1d6',
    'Passive Perception 15 · Passive Insight 15 · Passive Investigation 15',
    'Spellcasting: Ranger / Sorcerer · Ability WIS / CHA · Save DC 13 / 14 · Attack +5 / +6',
    'Proficiencies: Light Armor, Medium Armor, Shields; Martial Weapons, Simple Weapons.',
    'Languages: Celestial, Common, Common Sign Language, Elvish, Infernal.',
    'Flaws: Once I pick a goal, I become obsessed with it to the detriment of everything else in my life. I put too much trust in those who wield power within my temple’s hierarchy. I judge others harshly, and myself even more severely.',
    `Spells exactly as listed: ${SPELLS.map(spell => `${spell.name} [${spell.source}; ${spell.save}; ${spell.casting_time}; ${spell.range}; ${spell.components}; ${spell.duration}; ${spell.page}; ${spell.notes}]`).join(' | ')}`,
].join('\n');

function spellRecord(definition) {
    const detail = `Source: ${definition.source}. Save/Atk: ${definition.save}. Notes: ${definition.notes}.`;
    return {
        slug: definition.slug, name: definition.name, desc: detail, higher_level: '', page: definition.page,
        range: definition.range, components: definition.components, material: null,
        ritual: definition.name.includes('[R]'), duration: definition.duration,
        concentration: definition.duration.startsWith('Concentration'), casting_time: definition.casting_time,
        level: definition.level, school: 'As listed in PDF', dnd_class: definition.source,
        spell_lists: definition.source.includes('Ranger') ? ['Ranger'] : definition.source.includes('Sorcerer') ? ['Sorcerer'] : [],
        document__slug: 'paleas-pdf', document__title: 'emiDM_158154880.pdf',
        translation: { name: definition.name, desc: detail, higher_level: '' },
    };
}

const INCLUDE = [
    { model: AbilityScore, as: 'abilityScores' }, { model: Skill, as: 'skills' }, { model: Item, as: 'items' },
    { model: EquipmentSlots, as: 'equipment', include: [
        { model: Item, as: 'helmet' }, { model: Item, as: 'chest' }, { model: Item, as: 'shoulders' },
        { model: Item, as: 'boots' }, { model: Item, as: 'pants' }, { model: Item, as: 'gloves' },
        { model: Item, as: 'ring_1' }, { model: Item, as: 'ring_2' },
        { model: Item, as: 'primary_weapon' }, { model: Item, as: 'secondary_weapon' },
    ] },
];

async function loadCharacter() {
    return Character.findOne({ where: { name: CHARACTER_NAME }, include: INCLUDE });
}

async function run() {
    const paleas = await loadCharacter();
    if (!paleas) throw new Error(`No se encontró ${CHARACTER_NAME}.`);
    const preview = {
        id: paleas.id, name: paleas.name,
        before: { class: paleas.class, level: paleas.level, hp: `${paleas.hp_current}/${paleas.hp_max}`, gold: paleas.gold, items: paleas.items.map(item => item.name), spells: paleas.spells_known },
        after: { class: 'Ranger 4 / Sorcerer 1', level: 5, hp: `${Math.min(paleas.hp_current, 27)}/27`, gold: 0, items: ITEMS.map(item => item.name), spells: SPELLS.map(spell => spell.name) },
    };
    if (!APPLY) return console.log(JSON.stringify({ mode: 'dry-run', ...preview }, null, 2));

    await sequelize.transaction(async transaction => {
        const itemRecords = [];
        for (const definition of ITEMS) {
            const [item] = await Item.findOrCreate({ where: { name: definition.name }, defaults: definition, transaction });
            await item.update(definition, { transaction });
            itemRecords.push(item);
        }
        for (const definition of SPELLS) {
            const values = spellRecord(definition);
            const [spell] = await Spell.findOrCreate({ where: { slug: definition.slug }, defaults: values, transaction });
            await spell.update(values, { transaction });
        }

        await paleas.update({
            race: 'Variant Aasimar', race_slug: 'aasimar', class: 'Ranger 4 / Sorcerer 1', class_slug: 'ranger',
            archetype_slug: 'hunter', classes: [{ slug: 'ranger', level: 4 }, { slug: 'sorcerer', level: 1 }],
            background: 'Acolyte', alignment: null, level: 5, xp: 0, gold: 0,
            hp_current: Math.min(paleas.hp_current, 27), hp_max: 27, hp_temp: 0,
            ac_base: 15, initiative_bonus: 1, speed: 30, size: 'Medium', proficiency_bonus: 3,
            passive_perception: 15, saving_throws: { str: true, dex: true },
            damage_resistances: ['Necrotic', 'Radiant'], damage_vulnerabilities: [], damage_immunities: [], condition_immunities: [],
            senses: ['Darkvision 60 ft.'], languages: ['Celestial', 'Common', 'Common Sign Language', 'Elvish', 'Infernal'],
            inspiration: false, notes: PDF_NOTES,
            abilities_text: PDF_FEATURES.map(feature => `${feature.name} — ${feature.resource}\n${feature.description}`).join('\n\n'),
            custom_features: PDF_FEATURES,
            spell_slots: { 1: { max: 4, used: 0 }, 2: { max: 2, used: 0 } },
            spells_known: SPELLS.map(spell => spell.slug), spells_prepared: ['paleas-hunters-mark'],
            feature_choices: { 'ranger:Estilo de Combate': 'two-weapon', 'ranger:Presa del Cazador': 'colossus-slayer' },
        }, { transaction });

        await AbilityScore.destroy({ where: { character_id: paleas.id }, transaction });
        await AbilityScore.bulkCreate(Object.entries(ABILITY_SCORES).map(([ability, base_value]) => ({ character_id: paleas.id, ability, base_value, bonus_value: 0 })), { transaction });
        await Skill.destroy({ where: { character_id: paleas.id }, transaction });
        await Skill.bulkCreate(SKILLS.map(skill => ({ ...skill, character_id: paleas.id })), { transaction });
        await CharacterInventory.destroy({ where: { character_id: paleas.id }, transaction });
        await CharacterInventory.bulkCreate(itemRecords.map(item => ({ character_id: paleas.id, item_id: item.id, quantity: 1 })), { transaction });

        const [equipment] = await EquipmentSlots.findOrCreate({ where: { character_id: paleas.id }, transaction });
        const itemByName = Object.fromEntries(itemRecords.map(item => [item.name, item]));
        const armorBySlot = Object.fromEntries(PALEAS_ARMOR.map(definition => [definition.slot, itemByName[definition.name]]));
        await equipment.update({
            helmet_id: null, gloves_id: null, ring_1_id: null, ring_2_id: null,
            shoulders_id: armorBySlot.shoulders.id, chest_id: armorBySlot.chest.id,
            pants_id: armorBySlot.pants.id, boots_id: armorBySlot.boots.id,
            primary_weapon_id: itemByName['Longsword, +1'].id,
            secondary_weapon_id: itemByName['Shortsword, +1'].id,
        }, { transaction });
        await CharacterAuditLog.create({
            character_id: paleas.id, actor_username: 'Codex / DM', actor_role: 'DM', source: 'paleas-pdf-import',
            changes: { pdf_import: { source: 'emiDM_158154880.pdf', before: preview.before, after: preview.after } },
        }, { transaction });
    });

    const updated = await loadCharacter();
    const calculated = StatEngine.calculate(updated);
    const importedSpellCount = await Spell.count({ where: { document__slug: 'paleas-pdf' } });
    if (calculated.ac !== 15 || calculated.maxHp !== 27 || calculated.level !== 5 || importedSpellCount !== SPELLS.length) {
        throw new Error(`Verificación fallida: nivel ${calculated.level}, PG ${calculated.maxHp}, CA ${calculated.ac}, conjuros ${importedSpellCount}/${SPELLS.length}.`);
    }
    console.log(JSON.stringify({
        mode: 'applied',
        character: { id: updated.id, name: updated.name, class: updated.class, level: updated.level, hp_current: updated.hp_current, hp_max: updated.hp_max, ac: calculated.ac, skills: updated.skills, items: updated.items.map(item => item.name), spells_known: updated.spells_known },
    }, null, 2));
}

run().then(() => sequelize.close()).catch(async error => { console.error(error); await sequelize.close(); process.exit(1); });
