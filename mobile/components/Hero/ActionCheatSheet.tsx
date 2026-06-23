import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Footprints, Scroll, Shield, Sparkles, Sword, Target, Wind, Zap } from 'lucide-react-native';

import Panel from '../UI/Panel';
import { COLORS, RADIUS, SPACING, TYPO } from '../../constants/Theme';
import { DOTE_TREES } from '../../constants/doteTrees';
import { getModifier } from '../../utils/DndUtils';
import { getCharacterCustomFeatures } from '../../utils/customFeatures';

type SourceType = 'class' | 'archetype' | 'race' | 'talent' | 'armor' | 'custom';

interface ActionCheatSheetProps {
    character: any;
}

interface CheatEntry {
    id: string;
    name: string;
    desc: string;
    shortDesc: string;
    kind: string;
    sourceType: SourceType;
    sourceLabel: string;
    resource: string;
}

interface AttackCard {
    id: string;
    slot: string;
    slotLabel: string;
    name: string;
    toHit: string;
    damage: string;
    damageBonus: number;
    damageText: string;
    versatile: string;
    range: string;
    category: string;
    type: string;
    proficient: boolean;
    abilityKey: string;
    light: boolean;
    nickMastery: boolean;
    mastery: any;
    ability: any;
    bonusAttackEligible: boolean;
    bonusAttackText: string;
    notes: string[];
}

const SLOT_KEYS = ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon'];
const WEAPON_SLOTS = ['primary_weapon', 'secondary_weapon'];

const SOURCE_META: Record<SourceType, { label: string; color: string; bg: string }> = {
    class: { label: 'Clase', color: COLORS.amber, bg: 'rgba(245,158,11,0.14)' },
    archetype: { label: 'Arquetipo', color: COLORS.purple, bg: 'rgba(155,93,229,0.14)' },
    race: { label: 'Raza', color: COLORS.success, bg: 'rgba(91,168,107,0.14)' },
    talent: { label: 'Talento', color: COLORS.blue, bg: 'rgba(62,132,214,0.14)' },
    armor: { label: 'Equipo', color: COLORS.bronzeLight, bg: 'rgba(200,163,106,0.14)' },
    custom: { label: 'Custom', color: COLORS.pink, bg: 'rgba(224,106,154,0.14)' },
};

const SECTION_TONES = {
    action: { color: COLORS.amber, edge: 'rgba(245,158,11,0.26)', bg: 'rgba(245,158,11,0.08)', chip: 'rgba(245,158,11,0.12)' },
    bonus: { color: COLORS.pink, edge: 'rgba(224,106,154,0.24)', bg: 'rgba(224,106,154,0.08)', chip: 'rgba(224,106,154,0.12)' },
    reaction: { color: COLORS.blue, edge: 'rgba(62,132,214,0.24)', bg: 'rgba(62,132,214,0.08)', chip: 'rgba(62,132,214,0.12)' },
    trigger: { color: COLORS.purple, edge: 'rgba(155,93,229,0.24)', bg: 'rgba(155,93,229,0.08)', chip: 'rgba(155,93,229,0.12)' },
    passive: { color: COLORS.textSecondary, edge: 'rgba(168,159,142,0.22)', bg: 'rgba(168,159,142,0.06)', chip: 'rgba(168,159,142,0.12)' },
};

function cleanText(text: unknown) {
    if (!text) return '';
    return String(text)
        .replace(/\r/g, '')
        .replace(/\*\*\*/g, '')
        .replace(/\*\*/g, '')
        .replace(/_/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeText(text: unknown) {
    return cleanText(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function sign(value: number) {
    const number = Number(value) || 0;
    return number >= 0 ? `+${number}` : `${number}`;
}

function summarize(text: unknown, max = 160) {
    const value = cleanText(text);
    if (value.length <= max) return value;
    return `${value.slice(0, max).trim()}...`;
}

function buildClassList(character: any) {
    if (character?.classes?.length) return character.classes;
    if (character?.classData) return [{ ...character.classData, level: character.level || 1 }];
    return [];
}

function buildModifiers(character: any) {
    if (character?.modifiers) return character.modifiers;
    return {
        str: getModifier(character?.stats?.str || 10),
        dex: getModifier(character?.stats?.dex || 10),
        con: getModifier(character?.stats?.con || 10),
        int: getModifier(character?.stats?.int || 10),
        wis: getModifier(character?.stats?.wis || 10),
        cha: getModifier(character?.stats?.cha || 10),
    };
}

function getFeatureDescription(featureName: string, fullDesc: string) {
    if (!fullDesc || !featureName) return '';
    const escaped = featureName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`###\\s*${escaped}`, 'i');
    const match = fullDesc.match(regex);

    if (!match) {
        const simpleName = featureName.split('(')[0].trim();
        if (simpleName && simpleName !== featureName) {
            return getFeatureDescription(simpleName, fullDesc);
        }
        return '';
    }

    const startIndex = (match.index || 0) + match[0].length;
    const remaining = fullDesc.slice(startIndex);
    const nextHeader = remaining.search(/###/);
    const desc = nextHeader !== -1 ? remaining.slice(0, nextHeader) : remaining;
    return cleanText(desc);
}

function featuresForClass(cls: any) {
    const feats: Array<{ name: string; level: number; choice: any }> = [];
    if (!cls?.table) return feats;

    const rows = String(cls.table)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('|') && !line.includes('---'));

    rows.slice(1).forEach((row) => {
        const cols = row.split('|').filter((col) => col.trim()).map((col) => col.trim());
        if (cols.length < 3) return;

        const level = Number.parseInt(cols[0], 10);
        if (!Number.isFinite(level) || level > (cls.level || 0)) return;

        cols[2]
            .split(',')
            .map((feature) => feature.trim())
            .filter((feature) => feature && feature !== '-')
            .forEach((feature) => {
                const choice = (cls.choices || []).find((entry: any) => entry.feature === feature) || null;
                feats.push({ name: feature, level, choice });
            });
    });

    return feats.sort((left, right) => left.level - right.level);
}

function parseTextBlocks(text: unknown) {
    if (!text) return [];

    return String(text)
        .replace(/\r/g, '')
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, index) => {
            const titled = paragraph.match(/^([_*]{1,3})(.*?)([.:])([_*]{1,3})\s*(.*)$/s);
            if (titled) {
                return {
                    key: index,
                    title: cleanText(titled[2]),
                    desc: cleanText(titled[5]),
                };
            }

            return {
                key: index,
                title: '',
                desc: cleanText(paragraph),
            };
        });
}

function getEquippedItem(character: any, slot: string) {
    const equipment = character?.equipment || {};
    const inventory = character?.inventory || [];

    if (equipment[slot] && typeof equipment[slot] === 'object') return equipment[slot];

    const itemId = equipment[`${slot}_id`];
    if (!itemId) return null;

    return inventory.find((item: any) => item.id === itemId) || null;
}

function hasProperty(item: any, terms: string[]) {
    return (item?.properties || []).some((property: any) => {
        const value = normalizeText(property);
        return terms.some((term) => value.includes(term));
    });
}

function isRangedWeapon(item: any) {
    return hasProperty(item, ['municion']);
}

function isFinesseWeapon(item: any) {
    return hasProperty(item, ['sutil']);
}

function isLightWeapon(item: any) {
    return hasProperty(item, ['ligera']);
}

function isThrownWeapon(item: any) {
    return hasProperty(item, ['arrojad']);
}

function isTwoHandedWeapon(item: any) {
    return hasProperty(item, ['a dos manos']);
}

function isReachWeapon(item: any) {
    return hasProperty(item, ['alcance']);
}

function versatileDamage(item: any) {
    const property = (item?.properties || []).find((entry: any) => normalizeText(entry).includes('versatil'));
    const match = cleanText(property).match(/\(([^)]+)\)/);
    return match ? cleanText(match[1]) : '';
}

function rangeText(item: any) {
    const property = (item?.properties || []).find((entry: any) => {
        const value = normalizeText(entry);
        return value.includes('municion') || value.includes('arrojadiza');
    });
    return property ? cleanText(property) : '';
}

function parseMagicBonus(item: any) {
    const text = normalizeText(`${item?.name || ''}. ${item?.description || ''}`);
    const damageAndAttack = text.match(/\+(\d+)\s+al ataque y dano/i);
    if (damageAndAttack) return Number.parseInt(damageAndAttack[1], 10) || 0;
    const generic = text.match(/\+(\d+)\b/);
    return generic ? Number.parseInt(generic[1], 10) || 0 : 0;
}

function inferActionKind(name: string, text: string, explicitType = '', fallback = 'Pasivo') {
    const value = normalizeText(`${name} ${explicitType} ${text}`);
    const explicit = normalizeText(explicitType);

    if (explicit.includes('reacc')) return 'Reaccion';
    if (explicit.includes('bonus') || explicit.includes('adicional')) return 'Bonus';
    if (explicit.includes('accion')) return 'Accion';
    if (explicit.includes('pasiv')) return 'Pasivo';

    if (value.includes('accion adicional') || value.includes('bonus action') || value.includes('bonus')) return 'Bonus';
    if (value.includes('reaccion')) return 'Reaccion';
    if (value.includes('accion')) return 'Accion';
    if (
        value.includes('al impactar') ||
        value.includes('al recibir') ||
        value.includes('al caer') ||
        value.includes('cada vez que') ||
        value.includes('cuando ') ||
        value.includes('si tu tirada') ||
        value.includes('si un atacante')
    ) {
        return 'Disparador';
    }
    if (
        value.includes('siempre') ||
        value.includes('ventaja') ||
        value.includes('inmune') ||
        value.includes('resistencia') ||
        value.includes('aumenta') ||
        value.includes('ganas') ||
        value.includes('aprendes') ||
        value.includes('podes usar') ||
        value.includes('recuperas') ||
        value.includes('tenes')
    ) {
        return 'Pasivo';
    }

    return fallback;
}

function extractResource(text: unknown) {
    const value = cleanText(text);
    if (!value) return '';

    const patterns = [
        /(\d+\/DL)/i,
        /(\d+\/turno)/i,
        /(1 vez por turno)/i,
        /(Descanso (?:Corto|Largo))/i,
        /(\d+\s*usos?)/i,
        /(\d+\s*min)/i,
    ];

    for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match) return cleanText(match[1] || match[0]);
    }

    return '';
}

function getSelectedClassOptions(character: any) {
    const selected: any[] = [];
    const state = character?.feature_choices || {};

    buildClassList(character).forEach((cls: any) => {
        (cls.choices || []).forEach((choice: any) => {
            const raw = state[`${cls.slug}:${choice.feature}`];
            const keys = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            keys.forEach((key) => {
                const option = choice.options?.find((entry: any) => entry.key === key);
                if (option) {
                    selected.push({
                        className: cls.name,
                        classSlug: cls.slug,
                        feature: choice.feature,
                        option,
                    });
                }
            });
        });
    });

    return selected;
}

function buildStyleState(character: any) {
    const options = getSelectedClassOptions(character);
    const names = options.map((entry) => normalizeText(entry.option.name));
    const keys = options.map((entry) => normalizeText(entry.option.key));

    return {
        archery: names.some((name) => name.includes('arquer')) || keys.includes('archery'),
        dueling: names.some((name) => name.includes('duelo')) || keys.includes('dueling'),
        twoWeapon: names.some((name) => name.includes('dos armas')) || keys.includes('two-weapon'),
        thrownWeapon: names.some((name) => name.includes('arrojadizas')) || keys.includes('thrown-weapon'),
    };
}

function isWeaponProficient(item: any, classList: any[]) {
    if (!item?.damage) return false;
    const category = normalizeText(item.weapon_category);
    const light = isLightWeapon(item);
    const finesse = isFinesseWeapon(item);

    return classList.some((cls) => {
        const prof = normalizeText(cls.prof_weapons);
        if (!prof) return false;
        if (prof.includes('armas simples y marciales')) return true;
        if (prof.includes('armas simples') && category === 'simple') return true;
        if (prof.includes('armas marciales') && category === 'marcial') return true;
        if (prof.includes('sutil o ligera') && (finesse || light)) return true;
        return false;
    });
}

function countExtraAttacks(character: any) {
    const names = buildClassList(character)
        .flatMap((cls: any) => featuresForClass(cls))
        .map((feature: any) => normalizeText(feature.name));

    return names.filter((name: string) => name === 'ataque adicional').length;
}

function buildWeaponCard(item: any, slot: string, character: any, styleState: any, weaponCount: number): AttackCard | null {
    if (!item?.damage) return null;

    const classList = buildClassList(character);
    const proficiencyBonus = character?.proficiencyBonus || 2;
    const mods = buildModifiers(character);
    const ranged = isRangedWeapon(item);
    const finesse = isFinesseWeapon(item);
    const thrown = isThrownWeapon(item);
    const light = isLightWeapon(item);
    const reach = isReachWeapon(item);
    const versatile = versatileDamage(item);
    const magicBonus = parseMagicBonus(item);

    let abilityKey = 'str';
    let abilityMod = mods.str || 0;
    if (ranged) {
        abilityKey = 'dex';
        abilityMod = mods.dex || 0;
    } else if (finesse) {
        abilityKey = (mods.dex || 0) >= (mods.str || 0) ? 'dex' : 'str';
        abilityMod = Math.max(mods.str || 0, mods.dex || 0);
    }

    const proficient = isWeaponProficient(item, classList);
    const archeryBonus = styleState.archery && ranged ? 2 : 0;
    const attackBonus = abilityMod + (proficient ? proficiencyBonus : 0) + magicBonus + archeryBonus;

    let damageBonus = abilityMod + magicBonus;
    if (styleState.thrownWeapon && thrown) damageBonus += 2;
    if (styleState.dueling && !ranged && !isTwoHandedWeapon(item) && weaponCount === 1) damageBonus += 2;

    const extraLightAttackDamage = (styleState.twoWeapon ? abilityMod : 0) + magicBonus + (styleState.thrownWeapon && thrown ? 2 : 0);
    const nickMastery = normalizeText(item.mastery?.key) === 'nick';

    return {
        id: `${slot}-${item.id}`,
        slot,
        slotLabel: slot === 'primary_weapon' ? 'Mano principal' : 'Mano secundaria',
        name: item.name,
        toHit: sign(attackBonus),
        damage: item.damage,
        damageBonus,
        damageText: damageBonus ? `${item.damage} ${sign(damageBonus)}` : item.damage,
        versatile,
        range: rangeText(item),
        category: item.weapon_category || 'Arma',
        type: ranged ? 'A distancia' : (reach ? 'Cuerpo a cuerpo / alcance' : 'Cuerpo a cuerpo'),
        proficient,
        abilityKey: abilityKey.toUpperCase(),
        light,
        nickMastery,
        mastery: item.mastery || null,
        ability: item.ability || null,
        bonusAttackEligible: light,
        bonusAttackText: light
            ? (nickMastery
                ? `Ataque extra de Ligera dentro de la accion de Atacar. Dano: ${item.damage}${extraLightAttackDamage ? ` ${sign(extraLightAttackDamage)}` : ''}.`
                : `Si pegas con otra arma Ligera, podes atacar con esta como accion bonus. Dano: ${item.damage}${extraLightAttackDamage ? ` ${sign(extraLightAttackDamage)}` : ''}.`)
            : '',
        notes: [
            versatile ? `Versatil: ${versatile} a dos manos.` : '',
            rangeText(item),
            thrown ? 'Sirve para ataque arrojadizo.' : '',
            magicBonus ? `Bono magico: +${magicBonus} al ataque y dano.` : '',
            proficient ? 'Competente: suma competencia.' : 'Sin competencia: no suma competencia.',
            archeryBonus ? 'Tiro Certero: +2 a distancia.' : '',
            styleState.dueling && !ranged && !isTwoHandedWeapon(item) && weaponCount === 1 ? 'Duelo: +2 al dano con una sola arma.' : '',
            styleState.thrownWeapon && thrown ? 'Armas Arrojadizas: +2 al dano arrojadizo.' : '',
        ].filter(Boolean),
    };
}

function buildAttackCards(character: any) {
    const styleState = buildStyleState(character);
    const equippedWeapons = WEAPON_SLOTS
        .map((slot) => ({ slot, item: getEquippedItem(character, slot) }))
        .filter(({ item }) => item?.damage);

    const weaponCount = equippedWeapons.length;

    const cards = equippedWeapons
        .map(({ slot, item }) => buildWeaponCard(item, slot, character, styleState, weaponCount))
        .filter(Boolean) as AttackCard[];

    if (cards.length > 0) return cards;

    const mods = buildModifiers(character);
    const proficiencyBonus = character?.proficiencyBonus || 2;
    return [{
        id: 'unarmed',
        slot: 'unarmed',
        slotLabel: 'Sin arma',
        name: 'Golpe desarmado',
        toHit: sign((mods.str || 0) + proficiencyBonus),
        damage: '1',
        damageBonus: mods.str || 0,
        damageText: `1 ${sign(mods.str || 0)}`,
        versatile: '',
        range: '',
        category: 'Basico',
        type: 'Cuerpo a cuerpo',
        proficient: true,
        abilityKey: 'STR',
        light: false,
        nickMastery: false,
        mastery: null,
        ability: null,
        bonusAttackEligible: false,
        bonusAttackText: '',
        notes: ['Ataque basico si estas sin armas equipadas.'],
    }];
}

function buildGenericActions(character: any, attackCards: AttackCard[], attacksPerAction: number) {
    const speed = character?.speed ?? 30;
    const dodge = character?.dodge;
    const hasSpells = (character?.spells_known || []).length > 0 || (character?.spells_prepared || []).length > 0;
    const cardsBySlot = Object.fromEntries(attackCards.map((card) => [card.slot, card]));
    const primaryCard = cardsBySlot.primary_weapon || attackCards[0];
    const secondaryCard = cardsBySlot.secondary_weapon || null;
    const dualWieldBonus = !!(primaryCard && secondaryCard && primaryCard.bonusAttackEligible && secondaryCard.bonusAttackEligible);

    const actions: CheatEntry[] = [
        {
            id: 'action-attack',
            name: 'Atacar',
            desc: `Con la accion de Atacar haces ${attacksPerAction} ataque(s). Tu mejor linea actual es ${primaryCard.name} ${primaryCard.toHit} para ${primaryCard.damageText}.`,
            shortDesc: '',
            kind: 'Accion',
            sourceType: 'class',
            sourceLabel: 'Basico de turno',
            resource: attacksPerAction > 1 ? `${attacksPerAction} ataques` : '',
        },
        {
            id: 'action-dash',
            name: 'Correr',
            desc: `Doblas tu movimiento este turno. Con tu velocidad actual llegas a ${speed * 2} ft.`,
            shortDesc: '',
            kind: 'Accion',
            sourceType: 'class',
            sourceLabel: 'Basico de turno',
            resource: `${speed * 2} ft`,
        },
        {
            id: 'action-disengage',
            name: 'Destrabarse',
            desc: 'Te mueves sin provocar ataques de oportunidad durante el resto del turno.',
            shortDesc: '',
            kind: 'Accion',
            sourceType: 'class',
            sourceLabel: 'Basico de turno',
            resource: '',
        },
        {
            id: 'action-dodge',
            name: 'Esquivar',
            desc: dodge?.die
                ? `Los ataques contra vos tienen desventaja hasta tu proximo turno. Tu armadura ademas te da esquive 1d${dodge.die}.`
                : 'Los ataques contra vos tienen desventaja hasta tu proximo turno.',
            shortDesc: '',
            kind: 'Accion',
            sourceType: 'class',
            sourceLabel: 'Basico de turno',
            resource: dodge?.die ? `1d${dodge.die}` : '',
        },
        {
            id: 'action-utility',
            name: 'Esconderse / Ayudar / Usar objeto',
            desc: 'Siempre podes gastar tu accion en utilidad tactica: esconderte, ayudar, estabilizar o usar equipo.',
            shortDesc: '',
            kind: 'Accion',
            sourceType: 'class',
            sourceLabel: 'Basico de turno',
            resource: '',
        },
    ];

    if (hasSpells) {
        actions.push({
            id: 'action-spell',
            name: 'Lanzar conjuro',
            desc: 'Tienes magia disponible. Si el conjuro usa accion, compite contra tu accion de Atacar este turno.',
            shortDesc: '',
            kind: 'Accion',
            sourceType: 'class',
            sourceLabel: 'Magia',
            resource: '',
        });
    }

    const bonus: CheatEntry[] = [];
    if (dualWieldBonus && secondaryCard?.bonusAttackText && !secondaryCard.nickMastery) {
        bonus.push({
            id: 'bonus-offhand',
            name: `Ataque bonus con ${secondaryCard.name}`,
            desc: secondaryCard.bonusAttackText,
            shortDesc: '',
            kind: 'Bonus',
            sourceType: 'class',
            sourceLabel: 'Ligera',
            resource: 'Accion bonus',
        });
    }

    const reactions: CheatEntry[] = [];
    const opportunityWeapon = attackCards.find((card) => card.type !== 'A distancia') || null;
    if (opportunityWeapon) {
        reactions.push({
            id: 'reaction-opportunity',
            name: 'Ataque de oportunidad',
            desc: `Si una criatura sale de tu alcance, reaccion para atacar con ${opportunityWeapon.name}: ${opportunityWeapon.toHit} para ${opportunityWeapon.damageText}.`,
            shortDesc: '',
            kind: 'Reaccion',
            sourceType: 'class',
            sourceLabel: 'Basico de combate',
            resource: 'Reaccion',
        });
    }

    return {
        actions: actions.map((entry) => ({ ...entry, shortDesc: summarize(entry.desc) })),
        bonus: bonus.map((entry) => ({ ...entry, shortDesc: summarize(entry.desc) })),
        reactions: reactions.map((entry) => ({ ...entry, shortDesc: summarize(entry.desc) })),
    };
}

function buildRaceEntries(character: any) {
    const raceData = character?.raceData;
    const sourceName = raceData?.name || character?.race;

    return parseTextBlocks(raceData?.traits || raceData?.desc)
        .filter((block) => block.title || block.desc)
        .map((block, index) => ({
            id: `race-${index}`,
            name: block.title || `Rasgo de ${sourceName || 'raza'}`,
            desc: block.desc || block.title,
            kind: inferActionKind(block.title, block.desc || block.title, '', 'Pasivo'),
            sourceType: 'race' as SourceType,
            sourceLabel: sourceName ? `${SOURCE_META.race.label} - ${sourceName}` : SOURCE_META.race.label,
            resource: extractResource(block.desc),
        }));
}

function buildClassEntries(character: any) {
    const state = character?.feature_choices || {};

    return buildClassList(character).flatMap((cls: any) => {
        return featuresForClass(cls).flatMap((feature) => {
            const selected = state[`${cls.slug}:${feature.name}`];
            const keys = Array.isArray(selected) ? selected : (selected ? [selected] : []);
            const selectedOptions = keys
                .map((key) => feature.choice?.options?.find((option: any) => option.key === key))
                .filter(Boolean);

            if (selectedOptions.length > 0) {
                return selectedOptions.map((option: any) => ({
                    id: `class-${cls.slug}-${feature.name}-${option.key}`,
                    name: option.name,
                    desc: option.desc || getFeatureDescription(feature.name, cls.desc || ''),
                    kind: inferActionKind(option.name, option.desc || '', '', 'Pasivo'),
                    sourceType: 'class' as SourceType,
                    sourceLabel: `${SOURCE_META.class.label} - ${cls.name}`,
                    resource: extractResource(option.desc || ''),
                }));
            }

            const desc = getFeatureDescription(feature.name, cls.desc || '');
            return desc ? [{
                id: `class-${cls.slug}-${feature.name}`,
                name: feature.name,
                desc,
                kind: inferActionKind(feature.name, desc, '', 'Pasivo'),
                sourceType: 'class' as SourceType,
                sourceLabel: `${SOURCE_META.class.label} - ${cls.name}`,
                resource: extractResource(desc),
            }] : [];
        });
    });
}

function buildArchetypeEntries(character: any) {
    const archetypeSlug = character?.archetype_slug;
    if (!archetypeSlug) return [];

    return buildClassList(character).flatMap((cls: any) => {
        let archetypes = cls?.archetypes;
        if (!archetypes) return [];

        if (typeof archetypes === 'string') {
            try {
                archetypes = JSON.parse(archetypes);
            } catch {
                return [];
            }
        }

        const archetype = (archetypes || []).find((entry: any) => entry.slug === archetypeSlug || entry.name === archetypeSlug);
        if (!archetype?.desc) return [];

        return parseTextBlocks(archetype.desc)
            .map((block, index) => {
                const levelMatch = cleanText(block.title).match(/nivel\s*(\d+)/i);
                const requiredLevel = levelMatch ? Number.parseInt(levelMatch[1], 10) : null;
                if (requiredLevel && requiredLevel > (cls.level || 0)) return null;

                return {
                    id: `arch-${cls.slug}-${index}`,
                    name: cleanText(block.title.replace(/\(\s*Nivel\s*\d+\s*\)/ig, '')) || archetype.name,
                    desc: block.desc || block.title,
                    kind: inferActionKind(block.title, block.desc || block.title, '', 'Pasivo'),
                    sourceType: 'archetype' as SourceType,
                    sourceLabel: `${SOURCE_META.archetype.label} - ${archetype.name}`,
                    resource: extractResource(block.desc || ''),
                };
            })
            .filter(Boolean);
    });
}

function buildTalentEntries(character: any) {
    const choices = character?.talent_choices || {};

    return DOTE_TREES.flatMap((tree) => {
        const selected = choices[tree.key] || {};

        return Object.entries(selected as Record<string, string>)
            .map(([threshold, optionKey]) => {
                const tier = tree.tiers.find((entry) => String(entry.th) === String(threshold));
                const option = tier?.[optionKey as 'a' | 'b' | 'c'];
                if (!option) return null;

                return {
                    id: `talent-${tree.key}-${threshold}-${optionKey}`,
                    name: option.name,
                    desc: option.desc,
                    kind: inferActionKind(option.name, option.desc, '', 'Pasivo'),
                    sourceType: 'talent' as SourceType,
                    sourceLabel: `${SOURCE_META.talent.label} - ${tree.name}`,
                    resource: extractResource(option.desc),
                };
            })
            .filter(Boolean);
    });
}

function buildEquipmentEntries(character: any) {
    return SLOT_KEYS
        .map((slot) => ({ slot, item: getEquippedItem(character, slot) }))
        .flatMap(({ slot, item }) => {
            if (!item?.ability?.nombre && !item?.ability?.descripcion) return [];

            return [{
                id: `equip-${slot}-${item.id}`,
                name: item.ability.nombre || item.name,
                desc: item.ability.descripcion || item.description || '',
                kind: inferActionKind(item.ability.nombre || item.name, item.ability.descripcion || item.description || '', item.ability.tipo, 'Pasivo'),
                sourceType: 'armor' as SourceType,
                sourceLabel: `${SOURCE_META.armor.label} - ${item.name}`,
                resource: extractResource(item.ability.descripcion || ''),
            }];
        });
}

function buildCustomEntries(character: any) {
    return getCharacterCustomFeatures(character).map((feature, index) => ({
            id: `custom-${index}`,
            name: feature.name,
            desc: feature.description,
            kind: inferActionKind(feature.name, feature.description, feature.kind || '', 'Utilidad'),
            sourceType: 'custom' as SourceType,
            sourceLabel: SOURCE_META.custom.label,
            resource: feature.resource || extractResource(feature.description),
        }));
}

function dedupeEntries(entries: any[]) {
    const seen = new Set();

    return entries.filter((entry) => {
        const key = `${entry.kind}|${entry.name}|${entry.sourceLabel}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function buildDynamicSections(character: any) {
    const entries = dedupeEntries([
        ...buildClassEntries(character),
        ...buildArchetypeEntries(character),
        ...buildRaceEntries(character),
        ...buildTalentEntries(character),
        ...buildEquipmentEntries(character),
        ...buildCustomEntries(character),
    ]).map((entry: any) => ({
        ...entry,
        shortDesc: summarize(entry.desc),
    })) as CheatEntry[];

    return {
        actions: entries.filter((entry) => entry.kind === 'Accion'),
        bonus: entries.filter((entry) => entry.kind === 'Bonus'),
        reactions: entries.filter((entry) => entry.kind === 'Reaccion'),
        triggers: entries.filter((entry) => entry.kind === 'Disparador'),
        passives: entries.filter((entry) => entry.kind === 'Pasivo' || entry.kind === 'Utilidad'),
    };
}

function SummaryChip({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
    return (
        <View style={styles.summaryChip}>
            {icon}
            <View style={styles.summaryText}>
                <Text style={styles.summaryValue}>{value}</Text>
                <Text style={styles.summaryLabel}>{label}</Text>
            </View>
        </View>
    );
}

function EntryBadge({ entry }: { entry: CheatEntry }) {
    const source = SOURCE_META[entry.sourceType] || SOURCE_META.custom;
    return (
        <View style={[styles.sourceBadge, { backgroundColor: source.bg }]}>
            <Text style={[styles.sourceBadgeText, { color: source.color }]}>{entry.sourceLabel}</Text>
        </View>
    );
}

function DynamicEntry({ entry }: { entry: CheatEntry }) {
    return (
        <View style={styles.dynamicCard}>
            <View style={styles.dynamicHeader}>
                <Text style={styles.dynamicTitle}>{entry.name}</Text>
                {entry.resource ? (
                    <View style={styles.resourceBadge}>
                        <Text style={styles.resourceBadgeText}>{entry.resource}</Text>
                    </View>
                ) : null}
            </View>
            <EntryBadge entry={entry} />
            <Text style={styles.dynamicDesc}>{entry.shortDesc}</Text>
        </View>
    );
}

function WeaponCardView({ card }: { card: AttackCard }) {
    const featured = card.slot === 'primary_weapon' || card.slot === 'unarmed';

    return (
        <View style={[styles.weaponCard, featured ? styles.weaponCardFeatured : null]}>
            <View style={styles.weaponHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.weaponSlot, featured ? styles.weaponSlotFeatured : null]}>{card.slotLabel}</Text>
                    <Text style={styles.weaponName}>{card.name}</Text>
                </View>
                <View style={styles.weaponPillGroup}>
                    <View style={styles.weaponPill}><Text style={styles.weaponPillText}>{card.type}</Text></View>
                    <View style={styles.weaponPill}><Text style={styles.weaponPillText}>{card.category}</Text></View>
                </View>
            </View>

            <View style={styles.weaponStats}>
                <View style={styles.weaponStatBox}>
                    <Text style={styles.weaponStatLabel}>Ataque</Text>
                    <Text style={styles.weaponStatValue}>{card.toHit}</Text>
                </View>
                <View style={styles.weaponStatBox}>
                    <Text style={styles.weaponStatLabel}>Dano</Text>
                    <Text style={styles.weaponStatValue}>{card.damageText}</Text>
                </View>
                <View style={styles.weaponStatBox}>
                    <Text style={styles.weaponStatLabel}>Atributo</Text>
                    <Text style={styles.weaponStatValue}>{card.abilityKey}</Text>
                </View>
            </View>

            {card.range ? <Text style={styles.weaponLine}>{card.range}</Text> : null}
            {card.versatile ? <Text style={styles.weaponLine}>Versatil a dos manos: {card.versatile}</Text> : null}
            {card.bonusAttackText ? <Text style={styles.weaponAccent}>{card.bonusAttackText}</Text> : null}
            {card.mastery?.name ? <Text style={styles.weaponLine}>Maestria: {card.mastery.name}. {cleanText(card.mastery.desc)}</Text> : null}
            {card.ability?.nombre ? <Text style={styles.weaponLine}>Habilidad: {card.ability.nombre}. {cleanText(card.ability.descripcion)}</Text> : null}

            <View style={styles.noteList}>
                {card.notes.map((note) => (
                    <View key={note} style={styles.noteChip}>
                        <Text style={styles.noteChipText}>{note}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

function EconomySection({
    icon,
    title,
    items,
    tone,
}: {
    icon: React.ReactNode;
    title: string;
    items: CheatEntry[];
    tone: keyof typeof SECTION_TONES;
}) {
    if (!items.length) return null;
    const palette = SECTION_TONES[tone];

    return (
        <Panel
            padded={false}
            style={[
                styles.sectionCard,
                {
                    borderColor: palette.edge,
                    backgroundColor: palette.bg,
                },
            ]}
        >
            <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleWrap}>
                    <View style={[styles.sectionIconTile, { backgroundColor: palette.chip }]}>{icon}</View>
                    <View style={styles.sectionHeadingBlock}>
                        <Text style={[styles.sectionEyebrow, { color: palette.color }]}>turno</Text>
                        <Text style={styles.sectionTitle}>{title}</Text>
                    </View>
                </View>
                <View style={[styles.sectionCount, { backgroundColor: palette.chip, borderColor: palette.edge }]}>
                    <Text style={[styles.sectionCountText, { color: palette.color }]}>{items.length}</Text>
                </View>
            </View>

            <View style={styles.dynamicList}>
                {items.map((entry) => <DynamicEntry key={entry.id} entry={entry} />)}
            </View>
        </Panel>
    );
}

export default function ActionCheatSheet({ character }: ActionCheatSheetProps) {
    const attackCards = useMemo(() => buildAttackCards(character), [character]);
    const attacksPerAction = useMemo(() => 1 + countExtraAttacks(character), [character]);
    const dynamicSections = useMemo(() => buildDynamicSections(character), [character]);
    const genericSections = useMemo(() => buildGenericActions(character, attackCards, attacksPerAction), [character, attackCards, attacksPerAction]);

    const actions = [...genericSections.actions, ...dynamicSections.actions];
    const bonus = [...genericSections.bonus, ...dynamicSections.bonus];
    const reactions = [...genericSections.reactions, ...dynamicSections.reactions];

    return (
        <View style={styles.container}>
            <Panel bronze style={styles.heroPanel}>
                <View style={styles.heroTop}>
                    <View style={styles.kickerRow}>
                        <Sword size={12} color={COLORS.bronzeLight} />
                        <Text style={styles.kicker}>Machete tactico</Text>
                    </View>
                    <View style={styles.summaryBadge}>
                        <Text style={styles.summaryBadgeText}>{attacksPerAction} ataque(s) por accion</Text>
                    </View>
                </View>

                <Text style={styles.heroTitle}>Resumen de turno</Text>
                <Text style={styles.heroLead}>
                    Todo lo importante para decidir rapido: con que pegas, cuanto tiras y que acciones reales tienes en combate.
                </Text>

                <View style={styles.combatSummary}>
                    <SummaryChip icon={<Shield size={14} color={COLORS.blue} />} value={character?.ac ?? 10} label="CA" />
                    <SummaryChip icon={<Footprints size={14} color={COLORS.textPrimary} />} value={character?.speed ?? 30} label="Velocidad" />
                    <SummaryChip icon={<Zap size={14} color={COLORS.amber} />} value={sign(character?.initiative ?? 0)} label="Iniciativa" />
                    <SummaryChip icon={<Wind size={14} color={COLORS.bronzeLight} />} value={character?.dodge?.die ? `1d${character.dodge.die}` : '-'} label="Esquive" />
                </View>

                <View style={styles.flowBar}>
                    <View style={[styles.flowChip, { backgroundColor: SECTION_TONES.action.chip, borderColor: SECTION_TONES.action.edge }]}>
                        <Sword size={12} color={COLORS.amber} />
                        <Text style={[styles.flowChipText, { color: COLORS.amber }]}>Accion</Text>
                    </View>
                    {bonus.length ? (
                        <View style={[styles.flowChip, { backgroundColor: SECTION_TONES.bonus.chip, borderColor: SECTION_TONES.bonus.edge }]}>
                            <Sparkles size={12} color={COLORS.pink} />
                            <Text style={[styles.flowChipText, { color: COLORS.pink }]}>{bonus.length} bonus</Text>
                        </View>
                    ) : null}
                    {reactions.length ? (
                        <View style={[styles.flowChip, { backgroundColor: SECTION_TONES.reaction.chip, borderColor: SECTION_TONES.reaction.edge }]}>
                            <Shield size={12} color={COLORS.blue} />
                            <Text style={[styles.flowChipText, { color: COLORS.blue }]}>{reactions.length} reaccion(es)</Text>
                        </View>
                    ) : null}
                </View>
            </Panel>

            <Panel padded={false} style={styles.attackSection}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleWrap}>
                        <View style={[styles.sectionIconTile, { backgroundColor: SECTION_TONES.action.chip }]}>
                            <Target size={14} color={COLORS.amber} />
                        </View>
                        <View style={styles.sectionHeadingBlock}>
                            <Text style={[styles.sectionEyebrow, { color: COLORS.amber }]}>ofensiva</Text>
                            <Text style={styles.sectionTitle}>Ataques equipados</Text>
                        </View>
                    </View>
                    <View style={[styles.sectionCount, { backgroundColor: SECTION_TONES.action.chip, borderColor: SECTION_TONES.action.edge }]}>
                        <Text style={[styles.sectionCountText, { color: COLORS.amber }]}>{attackCards.length}</Text>
                    </View>
                </View>

                <View style={styles.weaponGrid}>
                    {attackCards.map((card) => <WeaponCardView key={card.id} card={card} />)}
                </View>
            </Panel>

            <EconomySection icon={<Sword size={14} color={COLORS.amber} />} title="Acciones en tu turno" items={actions} tone="action" />
            <EconomySection icon={<Sparkles size={14} color={COLORS.pink} />} title="Acciones bonus" items={bonus} tone="bonus" />
            <EconomySection icon={<Shield size={14} color={COLORS.blue} />} title="Reacciones" items={reactions} tone="reaction" />
            <EconomySection icon={<Zap size={14} color={COLORS.purple} />} title="Disparadores" items={dynamicSections.triggers} tone="trigger" />
            <EconomySection icon={<Scroll size={14} color={COLORS.textSecondary} />} title="Pasivos utiles" items={dynamicSections.passives} tone="passive" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: SPACING.md,
    },
    heroPanel: {
        gap: SPACING.md,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: SPACING.md,
        flexWrap: 'wrap',
    },
    kickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    kicker: {
        ...TYPO.label,
        color: COLORS.bronzeLight,
    },
    summaryBadge: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 5,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.3)',
        backgroundColor: 'rgba(245,158,11,0.14)',
    },
    summaryBadgeText: {
        ...TYPO.label,
        color: COLORS.amber,
        letterSpacing: 0.8,
    },
    heroTitle: {
        ...TYPO.heading,
        color: COLORS.textPrimary,
    },
    heroLead: {
        ...TYPO.caption,
        color: COLORS.textMuted,
        lineHeight: 18,
    },
    combatSummary: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    summaryChip: {
        minWidth: '47%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    summaryText: {
        gap: 2,
    },
    summaryValue: {
        color: COLORS.textPrimary,
        fontSize: 18,
        fontWeight: '900',
        lineHeight: 20,
    },
    summaryLabel: {
        ...TYPO.label,
        fontSize: 9,
        color: COLORS.textMuted,
    },
    flowBar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    flowChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
    },
    flowChipText: {
        ...TYPO.label,
        fontSize: 10,
    },
    attackSection: {
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.18)',
        backgroundColor: 'rgba(245,158,11,0.06)',
        gap: SPACING.md,
    },
    sectionCard: {
        padding: SPACING.lg,
        gap: SPACING.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: SPACING.md,
    },
    sectionTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        flex: 1,
    },
    sectionIconTile: {
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeadingBlock: {
        gap: 2,
        flex: 1,
    },
    sectionEyebrow: {
        ...TYPO.label,
        fontSize: 9,
    },
    sectionTitle: {
        ...TYPO.label,
        fontSize: 12,
        color: COLORS.textPrimary,
        letterSpacing: 0.8,
    },
    sectionCount: {
        minWidth: 24,
        height: 24,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    sectionCountText: {
        fontSize: 11,
        fontWeight: '900',
    },
    weaponGrid: {
        gap: SPACING.sm,
    },
    weaponCard: {
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surfaceHighlight,
        gap: SPACING.sm,
    },
    weaponCardFeatured: {
        borderColor: 'rgba(245,158,11,0.26)',
        backgroundColor: 'rgba(245,158,11,0.08)',
    },
    weaponHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: SPACING.sm,
    },
    weaponSlot: {
        ...TYPO.label,
        fontSize: 9,
        color: COLORS.bronzeLight,
    },
    weaponSlotFeatured: {
        color: COLORS.amber,
    },
    weaponName: {
        ...TYPO.title,
        color: COLORS.textPrimary,
    },
    weaponPillGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: SPACING.xs,
    },
    weaponPill: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    weaponPillText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textSecondary,
    },
    weaponStats: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    weaponStatBox: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.xs,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    weaponStatLabel: {
        ...TYPO.label,
        fontSize: 8,
        color: COLORS.textMuted,
    },
    weaponStatValue: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '900',
        textAlign: 'center',
    },
    weaponLine: {
        ...TYPO.caption,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    weaponAccent: {
        ...TYPO.caption,
        color: COLORS.amber,
        lineHeight: 18,
        fontWeight: '700',
    },
    noteList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.xs,
    },
    noteChip: {
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
    },
    noteChipText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    dynamicList: {
        gap: SPACING.sm,
    },
    dynamicCard: {
        gap: SPACING.sm,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surfaceHighlight,
    },
    dynamicHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: SPACING.sm,
    },
    dynamicTitle: {
        ...TYPO.body,
        color: COLORS.textPrimary,
        fontWeight: '700',
        flex: 1,
    },
    resourceBadge: {
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: 'rgba(200,163,106,0.24)',
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
    },
    resourceBadgeText: {
        ...TYPO.label,
        fontSize: 9,
        color: COLORS.bronzeLight,
    },
    sourceBadge: {
        alignSelf: 'flex-start',
        borderRadius: RADIUS.pill,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
    },
    sourceBadgeText: {
        ...TYPO.label,
        fontSize: 9,
    },
    dynamicDesc: {
        ...TYPO.caption,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
});
