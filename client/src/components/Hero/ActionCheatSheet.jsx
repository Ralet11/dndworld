import { useMemo } from 'react';
import { Backpack, Footprints, Scroll, Shield, Sparkles, Sword, Target, Wind, Zap } from 'lucide-react';
import { DOTE_TREES } from './doteTrees';
import { getCharacterCustomFeatures } from './customFeatures';

const SLOT_KEYS = ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon'];
const WEAPON_SLOTS = ['primary_weapon', 'secondary_weapon'];

const SOURCE_META = {
  class: { label: 'Clase', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  archetype: { label: 'Arquetipo', color: '#A855F7', bg: 'rgba(168,85,247,0.14)' },
  race: { label: 'Raza', color: '#5BA86B', bg: 'rgba(91,168,107,0.14)' },
  talent: { label: 'Talento', color: '#3E84D6', bg: 'rgba(62,132,214,0.14)' },
  armor: { label: 'Equipo', color: '#C8A36A', bg: 'rgba(200,163,106,0.14)' },
  custom: { label: 'Custom', color: '#E06A9A', bg: 'rgba(224,106,154,0.14)' },
};

const SECTION_TONES = {
  action: { color: '#F59E0B', edge: 'rgba(245,158,11,0.26)', glow: 'rgba(245,158,11,0.08)', chip: 'rgba(245,158,11,0.12)' },
  bonus: { color: '#E06A9A', edge: 'rgba(224,106,154,0.24)', glow: 'rgba(224,106,154,0.08)', chip: 'rgba(224,106,154,0.12)' },
  reaction: { color: '#3E84D6', edge: 'rgba(62,132,214,0.24)', glow: 'rgba(62,132,214,0.08)', chip: 'rgba(62,132,214,0.12)' },
  trigger: { color: '#8B5CF6', edge: 'rgba(139,92,246,0.24)', glow: 'rgba(139,92,246,0.08)', chip: 'rgba(139,92,246,0.12)' },
  passive: { color: '#A89F8E', edge: 'rgba(168,159,142,0.2)', glow: 'rgba(168,159,142,0.06)', chip: 'rgba(168,159,142,0.12)' },
};

function cleanText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\r/g, '')
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/_/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sign(value) {
  const number = Number(value) || 0;
  return number >= 0 ? `+${number}` : `${number}`;
}

function summarize(text, max = 190) {
  const value = cleanText(text);
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
}

function buildClassList(character) {
  if (character?.classes?.length) return character.classes;
  if (character?.classData) return [{ ...character.classData, level: character.level || 1 }];
  return [];
}

function getFeatureDescription(featureName, fullDesc) {
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

  const startIndex = match.index + match[0].length;
  const remaining = fullDesc.slice(startIndex);
  const nextHeader = remaining.search(/###/);
  const desc = nextHeader !== -1 ? remaining.slice(0, nextHeader) : remaining;
  return cleanText(desc);
}

function featuresForClass(cls) {
  const feats = [];
  if (!cls?.table) return feats;

  const rows = cls.table
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
        const choice = (cls.choices || []).find((entry) => entry.feature === feature) || null;
        feats.push({ name: feature, level, choice });
      });
  });

  return feats.sort((left, right) => left.level - right.level);
}

function parseTextBlocks(text) {
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

function getEquippedItem(character, slot) {
  const equipment = character?.equipment || {};
  const inventory = character?.inventory || [];

  if (equipment[slot] && typeof equipment[slot] === 'object') return equipment[slot];

  const itemId = equipment[`${slot}_id`];
  if (!itemId) return null;

  return inventory.find((item) => item.id === itemId) || null;
}

function hasProperty(item, pattern) {
  return (item?.properties || []).some((property) => pattern.test(String(property)));
}

function isRangedWeapon(item) {
  return hasProperty(item, /munici/i);
}

function isFinesseWeapon(item) {
  return hasProperty(item, /sutil/i);
}

function isLightWeapon(item) {
  return hasProperty(item, /ligera/i);
}

function isThrownWeapon(item) {
  return hasProperty(item, /arrojad/i);
}

function isTwoHandedWeapon(item) {
  return hasProperty(item, /a dos manos/i);
}

function isReachWeapon(item) {
  return hasProperty(item, /alcance/i);
}

function versatileDamage(item) {
  const match = (item?.properties || []).join(' · ').match(/Vers[aá]til\s*\(([^)]+)\)/i);
  return match ? cleanText(match[1]) : '';
}

function rangeText(item) {
  const match = (item?.properties || []).join(' · ').match(/(Munici[oó]n|Arrojadiza)\s*\(([^)]+)\)/i);
  if (!match) return '';
  return `${cleanText(match[1])}: ${cleanText(match[2])}`;
}

function parseMagicBonus(item) {
  const text = cleanText(`${item?.name || ''}. ${item?.description || ''}`);
  const damageAndAttack = text.match(/\+(\d+)\s+al ataque y da(?:n|ñ)o/i);
  if (damageAndAttack) return Number.parseInt(damageAndAttack[1], 10) || 0;
  const generic = text.match(/\+(\d+)\b/);
  return generic ? Number.parseInt(generic[1], 10) || 0 : 0;
}

function inferActionKind(name, text, explicitType = '', fallback = 'Pasivo') {
  const value = cleanText(`${name} ${explicitType} ${text}`).toLowerCase();
  const explicit = cleanText(explicitType).toLowerCase();

  if (explicit.includes('reacc')) return 'Reaccion';
  if (explicit.includes('bonus') || explicit.includes('adicional')) return 'Bonus';
  if (explicit.includes('accion')) return 'Accion';
  if (explicit.includes('pasiv')) return 'Pasivo';

  if (/acci[oó]n adicional|bonus action|bonus/.test(value)) return 'Bonus';
  if (/reacci[oó]n/.test(value)) return 'Reaccion';
  if (/\bacci[oó]n\b/.test(value)) return 'Accion';
  if (/al impactar|al recibir|al caer|cada vez que|cuando\b|si tu tirada|si un atacante/.test(value)) return 'Disparador';
  if (/siempre|ventaja|inmune|resistencia|aumenta|gan[aá]s|aprend[eé]s|pod[eé]s usar|recuper[aá]s|ten[eé]s/.test(value)) return 'Pasivo';

  return fallback;
}

function extractResource(text) {
  if (!text) return '';

  const patterns = [
    /(\d+\/DL)/i,
    /(\d+\/turno)/i,
    /(1 vez por turno)/i,
    /(Descanso (?:Corto|Largo))/i,
    /(\d+\s*usos?)/i,
    /(\d+\s*min)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return cleanText(match[1] || match[0]);
  }

  return '';
}

function getSelectedClassOptions(character) {
  const selected = [];
  const state = character?.feature_choices || {};

  buildClassList(character).forEach((cls) => {
    (cls.choices || []).forEach((choice) => {
      const raw = state[`${cls.slug}:${choice.feature}`];
      const keys = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      keys.forEach((key) => {
        const option = choice.options?.find((entry) => entry.key === key);
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

function buildStyleState(character) {
  const options = getSelectedClassOptions(character);
  const names = options.map((entry) => cleanText(entry.option.name).toLowerCase());
  const keys = options.map((entry) => cleanText(entry.option.key).toLowerCase());

  return {
    archery: names.some((name) => name.includes('arquer')) || keys.includes('archery'),
    dueling: names.some((name) => name.includes('duelo')) || keys.includes('dueling'),
    twoWeapon: names.some((name) => name.includes('dos armas')) || keys.includes('two-weapon'),
    thrownWeapon: names.some((name) => name.includes('arrojadizas')) || keys.includes('thrown-weapon'),
  };
}

function isWeaponProficient(item, classList) {
  if (!item?.damage) return false;
  const category = cleanText(item.weapon_category).toLowerCase();
  const light = isLightWeapon(item);
  const finesse = isFinesseWeapon(item);

  return classList.some((cls) => {
    const prof = cleanText(cls.prof_weapons).toLowerCase();
    if (!prof) return false;
    if (prof.includes('armas simples y marciales')) return true;
    if (prof.includes('armas simples') && category === 'simple') return true;
    if (prof.includes('armas marciales') && category === 'marcial') return true;
    if (prof.includes('sutil o ligera') && (finesse || light)) return true;
    return false;
  });
}

function countExtraAttacks(character) {
  const names = buildClassList(character)
    .flatMap((cls) => featuresForClass(cls))
    .map((feature) => cleanText(feature.name).toLowerCase());

  return names.filter((name) => name === 'ataque adicional').length;
}

function buildWeaponCard(item, slot, character, styleState, weaponCount) {
  if (!item?.damage) return null;

  const classList = buildClassList(character);
  const proficiencyBonus = character?.proficiencyBonus || 2;
  const mods = character?.modifiers || {};
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
  const nickMastery = cleanText(item.mastery?.key).toLowerCase() === 'nick';

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
        ? `Ataque extra de Ligera como parte de tu accion de Atacar. Dano: ${item.damage}${extraLightAttackDamage ? ` ${sign(extraLightAttackDamage)}` : ''}.`
        : `Si pegas con otra arma Ligera, podes hacer un ataque extra con esta como accion bonus. Dano: ${item.damage}${extraLightAttackDamage ? ` ${sign(extraLightAttackDamage)}` : ''}.`)
      : '',
    notes: [
      versatile ? `Versatil: ${versatile} a dos manos.` : '',
      rangeText(item),
      thrown ? 'Sirve para ataque arrojadizo.' : '',
      magicBonus ? `Bono magico: +${magicBonus} al ataque y dano.` : '',
      proficient ? 'Competente: suma competencia.' : 'Sin competencia: no suma competencia.',
      archeryBonus ? 'Tiro Certero: +2 a ataques a distancia.' : '',
      styleState.dueling && !ranged && !isTwoHandedWeapon(item) && weaponCount === 1 ? 'Duelo: +2 al dano con una sola arma cuerpo a cuerpo.' : '',
      styleState.thrownWeapon && thrown ? 'Armas Arrojadizas: +2 al dano arrojadizo.' : '',
    ].filter(Boolean),
  };
}

function buildAttackCards(character) {
  const styleState = buildStyleState(character);
  const equippedWeapons = WEAPON_SLOTS
    .map((slot) => ({ slot, item: getEquippedItem(character, slot) }))
    .filter(({ item }) => item?.damage);

  const weaponCount = equippedWeapons.length;

  const cards = equippedWeapons
    .map(({ slot, item }) => buildWeaponCard(item, slot, character, styleState, weaponCount))
    .filter(Boolean);

  if (cards.length > 0) return cards;

  const mods = character?.modifiers || {};
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

function buildGenericActions(character, attackCards, attacksPerAction) {
  const speed = character?.speed ?? 30;
  const dodge = character?.dodge;
  const hasSpells = (character?.spells_known || []).length > 0 || (character?.spells_prepared || []).length > 0;
  const cardsBySlot = Object.fromEntries(attackCards.map((card) => [card.slot, card]));
  const primaryCard = cardsBySlot.primary_weapon || attackCards[0];
  const secondaryCard = cardsBySlot.secondary_weapon || null;
  const dualWieldBonus = primaryCard && secondaryCard && primaryCard.bonusAttackEligible && secondaryCard.bonusAttackEligible;

  const actions = [
    {
      id: 'action-attack',
      name: 'Atacar',
      desc: `Con la accion de Atacar haces ${attacksPerAction} ataque(s). Tu mejor linea actual es ${primaryCard.name} ${primaryCard.toHit} para ${primaryCard.damageText}.`,
      sourceType: 'class',
      sourceLabel: 'Basico de turno',
      resource: attacksPerAction > 1 ? `${attacksPerAction} ataques` : '',
    },
    {
      id: 'action-dash',
      name: 'Correr',
      desc: `Doblas tu movimiento este turno. Con tu velocidad actual eso te lleva a ${speed * 2} ft.`,
      sourceType: 'class',
      sourceLabel: 'Basico de turno',
      resource: `${speed * 2} ft`,
    },
    {
      id: 'action-disengage',
      name: 'Destrabarse',
      desc: 'Te moves sin provocar ataques de oportunidad durante el resto del turno.',
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
      sourceType: 'class',
      sourceLabel: 'Basico de turno',
      resource: dodge?.die ? `1d${dodge.die}` : '',
    },
    {
      id: 'action-hide',
      name: 'Esconderse / Ayudar / Usar objeto',
      desc: 'Siempre podes invertir tu accion en utilidad tactica: esconderte, ayudar, estabilizar, interactuar o usar equipo.',
      sourceType: 'class',
      sourceLabel: 'Basico de turno',
      resource: '',
    },
  ];

  if (hasSpells) {
    actions.push({
      id: 'action-spell',
      name: 'Lanzar conjuro',
      desc: 'Tenes magia disponible. Si el conjuro usa accion, compite contra tu accion de Atacar este turno.',
      sourceType: 'class',
      sourceLabel: 'Magia',
      resource: '',
    });
  }

  const bonus = [];
  if (dualWieldBonus && secondaryCard?.bonusAttackText && !secondaryCard.nickMastery) {
    bonus.push({
      id: 'bonus-offhand',
      name: `Ataque bonus con ${secondaryCard.name}`,
      desc: secondaryCard.bonusAttackText,
      sourceType: 'class',
      sourceLabel: 'Ligera',
      resource: 'Accion bonus',
    });
  }

  const reactions = [];
  const opportunityWeapon = attackCards.find((card) => card.type !== 'A distancia') || null;
  if (opportunityWeapon) {
    reactions.push({
      id: 'reaction-opportunity',
      name: 'Ataque de oportunidad',
      desc: `Si una criatura sale de tu alcance, reaccion para atacar con ${opportunityWeapon.name}: ${opportunityWeapon.toHit} para ${opportunityWeapon.damageText}.`,
      sourceType: 'class',
      sourceLabel: 'Basico de combate',
      resource: 'Reaccion',
    });
  }

  return { actions, bonus, reactions };
}

function buildRaceEntries(character) {
  const raceData = character?.raceData;
  const sourceName = raceData?.name || character?.race;

  return parseTextBlocks(raceData?.traits || raceData?.desc)
    .filter((block) => block.title || block.desc)
    .map((block, index) => ({
      id: `race-${index}`,
      name: block.title || `Rasgo de ${sourceName || 'raza'}`,
      desc: block.desc || block.title,
      kind: inferActionKind(block.title, block.desc || block.title, '', 'Pasivo'),
      sourceType: 'race',
      sourceLabel: sourceName ? `${SOURCE_META.race.label} - ${sourceName}` : SOURCE_META.race.label,
      resource: extractResource(block.desc),
    }));
}

function buildClassEntries(character) {
  const state = character?.feature_choices || {};

  return buildClassList(character).flatMap((cls) => {
    return featuresForClass(cls).flatMap((feature) => {
      const selected = state[`${cls.slug}:${feature.name}`];
      const keys = Array.isArray(selected) ? selected : (selected ? [selected] : []);
      const selectedOptions = keys
        .map((key) => feature.choice?.options?.find((option) => option.key === key))
        .filter(Boolean);

      if (selectedOptions.length > 0) {
        return selectedOptions.map((option) => ({
          id: `class-${cls.slug}-${feature.name}-${option.key}`,
          name: option.name,
          desc: option.desc || getFeatureDescription(feature.name, cls.desc || ''),
          kind: inferActionKind(option.name, option.desc || '', '', 'Pasivo'),
          sourceType: 'class',
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
        sourceType: 'class',
        sourceLabel: `${SOURCE_META.class.label} - ${cls.name}`,
        resource: extractResource(desc),
      }] : [];
    });
  });
}

function buildArchetypeEntries(character) {
  const archetypeSlug = character?.archetype_slug;
  if (!archetypeSlug) return [];

  return buildClassList(character).flatMap((cls) => {
    let archetypes = cls?.archetypes;
    if (!archetypes) return [];

    if (typeof archetypes === 'string') {
      try {
        archetypes = JSON.parse(archetypes);
      } catch {
        return [];
      }
    }

    const archetype = (archetypes || []).find((entry) => entry.slug === archetypeSlug || entry.name === archetypeSlug);
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
          sourceType: 'archetype',
          sourceLabel: `${SOURCE_META.archetype.label} - ${archetype.name}`,
          resource: extractResource(block.desc || ''),
        };
      })
      .filter(Boolean);
  });
}

function buildTalentEntries(character) {
  const choices = character?.talent_choices || {};

  return DOTE_TREES.flatMap((tree) => {
    const selected = choices[tree.key] || {};

    return Object.entries(selected)
      .map(([threshold, optionKey]) => {
        const tier = tree.tiers.find((entry) => String(entry.th) === String(threshold));
        const option = tier?.[optionKey];
        if (!option) return null;

        return {
          id: `talent-${tree.key}-${threshold}-${optionKey}`,
          name: option.name,
          desc: option.desc,
          kind: inferActionKind(option.name, option.desc, '', 'Pasivo'),
          sourceType: 'talent',
          sourceLabel: `${SOURCE_META.talent.label} - ${tree.name}`,
          resource: extractResource(option.desc),
        };
      })
      .filter(Boolean);
  });
}

function buildEquipmentEntries(character) {
  return SLOT_KEYS
    .map((slot) => ({ slot, item: getEquippedItem(character, slot) }))
    .flatMap(({ slot, item }) => {
      if (!item?.ability?.nombre && !item?.ability?.descripcion) return [];

      return [{
        id: `equip-${slot}-${item.id}`,
        name: item.ability.nombre || item.name,
        desc: item.ability.descripcion || item.description || '',
        kind: inferActionKind(item.ability.nombre || item.name, item.ability.descripcion || item.description || '', item.ability.tipo, 'Pasivo'),
        sourceType: 'armor',
        sourceLabel: `${SOURCE_META.armor.label} - ${item.name}`,
        resource: extractResource(item.ability.descripcion || ''),
      }];
    });
}

function buildCustomEntries(character) {
  return getCharacterCustomFeatures(character)
    .map((feature, index) => ({
      id: `custom-${index}`,
      name: feature.name,
      desc: feature.description,
      kind: inferActionKind(feature.name, feature.description, feature.kind || '', 'Utilidad'),
      sourceType: 'custom',
      sourceLabel: SOURCE_META.custom.label,
      resource: feature.resource || extractResource(feature.description),
    }));
}

function dedupeEntries(entries) {
  const seen = new Set();

  return entries.filter((entry) => {
    const key = `${entry.kind}|${entry.name}|${entry.sourceLabel}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildDynamicSections(character) {
  const entries = dedupeEntries([
    ...buildClassEntries(character),
    ...buildArchetypeEntries(character),
    ...buildRaceEntries(character),
    ...buildTalentEntries(character),
    ...buildEquipmentEntries(character),
    ...buildCustomEntries(character),
  ]).map((entry) => ({
    ...entry,
    shortDesc: summarize(entry.desc),
  }));

  return {
    actions: entries.filter((entry) => entry.kind === 'Accion'),
    bonus: entries.filter((entry) => entry.kind === 'Bonus'),
    reactions: entries.filter((entry) => entry.kind === 'Reaccion'),
    triggers: entries.filter((entry) => entry.kind === 'Disparador'),
    passives: entries.filter((entry) => entry.kind === 'Pasivo' || entry.kind === 'Utilidad'),
  };
}

function EntryBadge({ entry }) {
  const source = SOURCE_META[entry.sourceType] || SOURCE_META.custom;
  return (
    <span style={{ ...styles.sourceBadge, color: source.color, background: source.bg }}>
      {entry.sourceLabel}
    </span>
  );
}

function DynamicEntry({ entry }) {
  return (
    <div style={styles.dynamicCard}>
      <div style={styles.dynamicHeader}>
        <p style={styles.dynamicTitle}>{entry.name}</p>
        {entry.resource ? <span style={styles.resourceBadge}>{entry.resource}</span> : null}
      </div>
      <EntryBadge entry={entry} />
      <p style={styles.dynamicDesc}>{entry.shortDesc}</p>
    </div>
  );
}

function WeaponCard({ card }) {
  const featured = card.slot === 'primary_weapon' || card.slot === 'unarmed';
  return (
    <div style={{
      ...styles.weaponCard,
      ...(featured ? styles.weaponCardFeatured : null),
    }}>
      <div style={styles.weaponHeader}>
        <div>
          <p style={{
            ...styles.weaponSlot,
            ...(featured ? styles.weaponSlotFeatured : null),
          }}>{card.slotLabel}</p>
          <p style={styles.weaponName}>{card.name}</p>
        </div>
        <div style={styles.weaponPillGroup}>
          <span style={styles.weaponTypePill}>{card.type}</span>
          <span style={styles.weaponTypePill}>{card.category}</span>
        </div>
      </div>

      <div style={styles.weaponStats}>
        <div style={styles.weaponStatBox}>
          <span style={styles.weaponStatLabel}>Ataque</span>
          <span style={styles.weaponStatValue}>{card.toHit}</span>
        </div>
        <div style={styles.weaponStatBox}>
          <span style={styles.weaponStatLabel}>Dano</span>
          <span style={styles.weaponStatValue}>{card.damageText}</span>
        </div>
        <div style={styles.weaponStatBox}>
          <span style={styles.weaponStatLabel}>Atributo</span>
          <span style={styles.weaponStatValue}>{card.abilityKey}</span>
        </div>
      </div>

      {card.range ? <p style={styles.weaponLine}>{card.range}</p> : null}
      {card.versatile ? <p style={styles.weaponLine}>Versatil a dos manos: {card.versatile}</p> : null}
      {card.bonusAttackText ? <p style={styles.weaponAccent}>{card.bonusAttackText}</p> : null}
      {card.mastery?.name ? <p style={styles.weaponLine}><strong>Maestria:</strong> {card.mastery.name}. {cleanText(card.mastery.desc)}</p> : null}
      {card.ability?.nombre ? <p style={styles.weaponLine}><strong>Habilidad:</strong> {card.ability.nombre}. {cleanText(card.ability.descripcion)}</p> : null}

      <div style={styles.noteList}>
        {card.notes.map((note) => <span key={note} style={styles.noteChip}>{note}</span>)}
      </div>
    </div>
  );
}

function EconomySection({ icon, title, items, empty, tone = 'passive', featured = false, hideWhenEmpty = false }) {
  if (hideWhenEmpty && (!items || items.length === 0)) return null;
  const palette = SECTION_TONES[tone] || SECTION_TONES.passive;

  return (
    <div style={{
      ...styles.sectionCard,
      borderColor: palette.edge,
      background: `linear-gradient(180deg, ${palette.glow} 0%, rgba(22,33,31,0.96) 42%, #16211F 100%)`,
      ...(featured ? styles.sectionCardFeatured : null),
    }}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitleWrap}>
          <span style={{ ...styles.sectionIconTile, color: palette.color, background: palette.chip }}>
            {icon}
          </span>
          <div style={styles.sectionHeadingBlock}>
            <span style={{ ...styles.sectionEyebrow, color: palette.color }}>turno</span>
            <span style={styles.sectionTitle}>{title}</span>
          </div>
        </div>
        <span style={{ ...styles.sectionCount, color: palette.color, borderColor: palette.edge, background: palette.chip }}>{items.length}</span>
      </div>

      {items.length > 0 ? (
        <div style={styles.dynamicList}>
          {items.map((entry) => <DynamicEntry key={entry.id} entry={entry} />)}
        </div>
      ) : (
        <p style={styles.emptyLine}>{empty}</p>
      )}
    </div>
  );
}

export default function ActionCheatSheet({ character, compact = false }) {
  const attackCards = useMemo(() => buildAttackCards(character), [character]);
  const attacksPerAction = useMemo(() => 1 + countExtraAttacks(character), [character]);
  const dynamicSections = useMemo(() => buildDynamicSections(character), [character]);
  const genericSections = useMemo(() => buildGenericActions(character, attackCards, attacksPerAction), [character, attackCards, attacksPerAction]);

  const actions = [...genericSections.actions, ...dynamicSections.actions];
  const bonus = [...genericSections.bonus, ...dynamicSections.bonus];
  const reactions = [...genericSections.reactions, ...dynamicSections.reactions];
  const hasSupportSections = dynamicSections.triggers.length > 0 || dynamicSections.passives.length > 0;
  const containerStyle = compact ? { ...styles.container, marginTop: 0, gap: 10 } : styles.container;
  const heroPanelStyle = compact ? { ...styles.heroPanel, padding: 14, gap: 10 } : styles.heroPanel;
  const heroTitleStyle = compact ? { ...styles.heroTitle, fontSize: 20 } : styles.heroTitle;
  const summaryBadgeStyle = compact ? { ...styles.summaryBadge, padding: '3px 8px', fontSize: 10 } : styles.summaryBadge;
  const combatSummaryStyle = compact ? { ...styles.combatSummary, gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))', gap: 8 } : styles.combatSummary;
  const summaryChipStyle = compact ? { ...styles.summaryChip, minHeight: 56, padding: '10px 12px' } : styles.summaryChip;
  const summaryValueStyle = compact ? { ...styles.summaryValue, fontSize: 18 } : styles.summaryValue;
  const flowBarStyle = compact ? { ...styles.flowBar, gap: 6 } : styles.flowBar;
  const flowChipStyle = compact ? { ...styles.flowChip, padding: '6px 8px', fontSize: 10 } : styles.flowChip;
  const attackSectionStyle = compact ? { ...styles.attackSectionCard, padding: 14, gap: 10 } : styles.attackSectionCard;
  const weaponGridStyle = compact ? { ...styles.weaponGrid, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 } : styles.weaponGrid;
  const economyGridStyle = compact ? { ...styles.economyGrid, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 } : styles.economyGrid;
  const supportGridStyle = compact ? { ...styles.supportGrid, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 } : styles.supportGrid;

  return (
    <div style={containerStyle}>
      <div style={styles.shell}>
        <div style={heroPanelStyle}>
          <div style={styles.titleRow}>
            <p className="label-caps flex items-center gap-1.5" style={{ color: '#C8A36A' }}>
              <Sword size={11} style={{ color: '#C8A36A' }} />
              Machete tactico
            </p>
            <span style={summaryBadgeStyle}>{attacksPerAction} ataque(s) por accion</span>
          </div>

          <p style={heroTitleStyle}>Resumen de turno</p>
          {!compact ? (
            <p style={styles.lead}>
              Todo lo importante para decidir rapido: con que pegas, cuanto tiras y que acciones reales tenes en combate.
            </p>
          ) : null}

          <div style={combatSummaryStyle}>
            <div style={summaryChipStyle}>
              <Shield size={14} style={{ color: '#3E84D6' }} />
              <div style={styles.summaryText}>
                <span style={summaryValueStyle}>{character?.ac ?? 10}</span>
                <span style={styles.summaryLabel}>CA</span>
              </div>
            </div>
            <div style={summaryChipStyle}>
              <Footprints size={14} style={{ color: '#EDE6D8' }} />
              <div style={styles.summaryText}>
                <span style={summaryValueStyle}>{character?.speed ?? 30}</span>
                <span style={styles.summaryLabel}>Velocidad</span>
              </div>
            </div>
            <div style={summaryChipStyle}>
              <Zap size={14} style={{ color: '#F59E0B' }} />
              <div style={styles.summaryText}>
                <span style={summaryValueStyle}>{sign(character?.initiative ?? 0)}</span>
                <span style={styles.summaryLabel}>Iniciativa</span>
              </div>
            </div>
            <div style={summaryChipStyle}>
              <Wind size={14} style={{ color: '#C8A36A' }} />
              <div style={styles.summaryText}>
                <span style={summaryValueStyle}>{character?.dodge?.die ? `1d${character.dodge.die}` : '-'}</span>
                <span style={styles.summaryLabel}>Esquive</span>
              </div>
            </div>
          </div>

          <div style={flowBarStyle}>
            <span style={{ ...flowChipStyle, ...styles.flowChipAction }}>
              <Sword size={12} />
              Accion
            </span>
            <span style={{ ...flowChipStyle, ...styles.flowChipBonus }}>
              <Sparkles size={12} />
              {bonus.length ? `${bonus.length} bonus` : 'sin bonus'}
            </span>
            <span style={{ ...flowChipStyle, ...styles.flowChipReaction }}>
              <Shield size={12} />
              {reactions.length ? `${reactions.length} reacciones` : 'reaccion base'}
            </span>
          </div>
        </div>

        <div style={attackSectionStyle}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitleWrap}>
              <span style={{ ...styles.sectionIconTile, color: '#F59E0B', background: 'rgba(245,158,11,0.12)' }}>
                <Target size={14} style={{ color: '#F59E0B' }} />
              </span>
              <div style={styles.sectionHeadingBlock}>
                <span style={{ ...styles.sectionEyebrow, color: '#F59E0B' }}>ofensiva</span>
                <span style={styles.sectionTitle}>Ataques equipados</span>
              </div>
            </div>
            <span style={{ ...styles.sectionCount, color: '#F59E0B', borderColor: 'rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.12)' }}>{attackCards.length}</span>
          </div>
          <div style={weaponGridStyle}>
            {attackCards.map((card) => <WeaponCard key={card.id} card={card} />)}
          </div>
        </div>

        <div style={economyGridStyle}>
          <EconomySection
            icon={<Sword size={14} style={{ color: '#F59E0B' }} />}
            title="Acciones en tu turno"
            items={actions}
            empty="No hay acciones especiales extra, solo las basicas del turno."
            tone="action"
            featured
          />
          <EconomySection
            icon={<Sparkles size={14} style={{ color: '#E06A9A' }} />}
            title="Acciones bonus"
            items={bonus}
            empty="No tenes una accion bonus marcada ahora mismo."
            tone="bonus"
            hideWhenEmpty
          />
          <EconomySection
            icon={<Shield size={14} style={{ color: '#3E84D6' }} />}
            title="Reacciones"
            items={reactions}
            empty="No tenes reacciones especiales aparte de las basicas."
            tone="reaction"
            hideWhenEmpty
          />
        </div>

        {hasSupportSections ? (
          <div style={supportGridStyle}>
            <EconomySection
              icon={<Zap size={14} style={{ color: '#8B5CF6' }} />}
              title="Disparadores"
              items={dynamicSections.triggers}
              empty="No hay efectos reactivos/condicionales detectados."
              tone="trigger"
              hideWhenEmpty
            />
            <EconomySection
              icon={<Scroll size={14} style={{ color: '#A89F8E' }} />}
              title="Pasivos utiles"
              items={dynamicSections.passives}
              empty="No hay pasivos especiales cargados."
              tone="passive"
              hideWhenEmpty
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginTop: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  shell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  heroPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(90,68,36,0.9)',
    background: 'linear-gradient(180deg, rgba(34,45,42,0.96) 0%, rgba(22,33,31,0.98) 100%)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  summaryBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid rgba(245,158,11,0.3)',
    background: 'rgba(245,158,11,0.14)',
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lead: {
    margin: 0,
    color: '#6B6557',
    fontSize: 12,
    lineHeight: 1.5,
  },
  heroTitle: {
    margin: 0,
    color: '#F6F0E4',
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1.05,
    letterSpacing: -0.4,
  },
  flowBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  flowChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid transparent',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  flowChipAction: {
    color: '#F59E0B',
    borderColor: 'rgba(245,158,11,0.24)',
    background: 'rgba(245,158,11,0.12)',
  },
  flowChipBonus: {
    color: '#E06A9A',
    borderColor: 'rgba(224,106,154,0.24)',
    background: 'rgba(224,106,154,0.12)',
  },
  flowChipReaction: {
    color: '#3E84D6',
    borderColor: 'rgba(62,132,214,0.24)',
    background: 'rgba(62,132,214,0.12)',
  },
  combatSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
    gap: 10,
  },
  summaryChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid rgba(42,51,47,0.92)',
    background: 'linear-gradient(180deg, rgba(18,27,26,0.96) 0%, rgba(15,21,24,0.98) 100%)',
  },
  summaryText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  summaryValue: {
    color: '#EDE6D8',
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1,
  },
  summaryLabel: {
    color: '#6B6557',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sectionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    background: 'linear-gradient(180deg, rgba(25,36,34,0.98) 0%, rgba(16,24,23,0.98) 100%)',
    border: '1px solid #2A332F',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
  },
  sectionCardFeatured: {
    boxShadow: '0 14px 32px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.03)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  sectionIconTile: {
    width: 30,
    height: 30,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionHeadingBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: '#EDE6D8',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    lineHeight: 1.2,
  },
  sectionCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(42,51,47,0.9)',
    color: '#A89F8E',
    fontSize: 11,
    fontWeight: 900,
    flexShrink: 0,
  },
  attackSectionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(245,158,11,0.18)',
    background: 'linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(26,37,35,0.98) 22%, rgba(16,24,23,0.98) 100%)',
  },
  weaponGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  },
  weaponCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    background: 'linear-gradient(180deg, rgba(32,44,41,0.98) 0%, rgba(22,33,31,0.98) 100%)',
    border: '1px solid rgba(42,51,47,0.9)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
  },
  weaponCardFeatured: {
    border: '1px solid rgba(245,158,11,0.28)',
    background: 'linear-gradient(180deg, rgba(245,158,11,0.1) 0%, rgba(33,45,42,0.98) 18%, rgba(22,33,31,0.98) 100%)',
    boxShadow: '0 16px 32px rgba(0,0,0,0.16)',
  },
  weaponHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  weaponSlot: {
    margin: 0,
    color: '#C8A36A',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  weaponSlotFeatured: {
    color: '#F7BC4D',
  },
  weaponName: {
    margin: '4px 0 0',
    color: '#EDE6D8',
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.2,
  },
  weaponPillGroup: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  weaponTypePill: {
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid rgba(42,51,47,0.9)',
    background: '#111A1C',
    color: '#A89F8E',
    fontSize: 10,
    fontWeight: 800,
  },
  weaponStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },
  weaponStatBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '10px 8px',
    borderRadius: 12,
    background: 'rgba(15,21,24,0.92)',
    border: '1px solid rgba(42,51,47,0.92)',
  },
  weaponStatLabel: {
    color: '#6B6557',
    fontSize: 9,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  weaponStatValue: {
    color: '#EDE6D8',
    fontSize: 15,
    fontWeight: 900,
    textAlign: 'center',
  },
  weaponLine: {
    margin: 0,
    color: '#A89F8E',
    fontSize: 12,
    lineHeight: 1.45,
  },
  weaponAccent: {
    margin: 0,
    color: '#F59E0B',
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 700,
  },
  noteList: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  noteChip: {
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid rgba(42,51,47,0.82)',
    background: '#10181A',
    color: '#A89F8E',
    fontSize: 10,
    fontWeight: 700,
  },
  economyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  },
  supportGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 12,
  },
  dynamicList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  dynamicCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    background: 'linear-gradient(180deg, rgba(31,43,40,0.98) 0%, rgba(22,33,31,0.98) 100%)',
    border: '1px solid rgba(42,51,47,0.9)',
  },
  dynamicHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  dynamicTitle: {
    margin: 0,
    color: '#EDE6D8',
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.25,
  },
  sourceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.06)',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  resourceBadge: {
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid rgba(200,163,106,0.2)',
    background: '#10181A',
    color: '#C8A36A',
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  dynamicDesc: {
    margin: 0,
    color: '#A89F8E',
    fontSize: 12,
    lineHeight: 1.5,
  },
  emptyLine: {
    margin: 0,
    color: '#6B6557',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
};
