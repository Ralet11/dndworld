const test = require('node:test');
const assert = require('node:assert/strict');
const {
    customFeatureProfiles,
    combatRangePct,
    hpAfterDamage,
    hpAfterHealing,
    npcActionProfile,
    parseDiceExpression,
    resolveTargetTokens,
    spellProfile,
    weaponProfile,
} = require('../services/gameCombat');
const { initiativeBonus, initiativeEntry, orderByInitiative } = require('../services/gameInitiative');

test('initiative mixes combatants by rolled total and resolves ties consistently', () => {
    const rogue = { id: 1, is_npc: false, initiative_bonus: 1, abilityScores: [{ ability: 'DEX', base_value: 16, bonus_value: 0 }] };
    const goblin = { id: 2, is_npc: true, initiative_bonus: 4, abilityScores: [{ ability: 'DEX', base_value: 14, bonus_value: 0 }] };
    const guard = { id: 3, is_npc: true, initiative_bonus: 1, abilityScores: [{ ability: 'DEX', base_value: 12, bonus_value: 0 }] };
    assert.equal(initiativeBonus(rogue), 4);
    assert.equal(initiativeBonus(goblin), 4);
    const entries = {
        1: initiativeEntry(rogue, 12, 'player'),
        2: initiativeEntry(goblin, 12, 'npc'),
        3: initiativeEntry(guard, 18, 'npc'),
    };
    assert.deepEqual(orderByInitiative(entries), [3, 1, 2]);
});

test('initiative keeps characters without a result at the end until they roll', () => {
    const entries = {
        9: { characterId: 9, roll: 14, bonus: 2, total: 16, dexterity: 12 },
    };
    assert.deepEqual(orderByInitiative(entries, [4, 9, 7]), [9, 4, 7]);
});

test('parseDiceExpression accepts safe combat formulas', () => {
    assert.deepEqual(parseDiceExpression('2d8+3'), { quantity: 2, sides: 8, modifier: 3, formula: '2d8+3' });
    assert.deepEqual(parseDiceExpression('1d12 - 2'), { quantity: 1, sides: 12, modifier: -2, formula: '1d12-2' });
    assert.equal(parseDiceExpression('2d7'), null);
    assert.equal(parseDiceExpression('process.exit()'), null);
});

test('damage applies temporary hp and resistance before regular hp', () => {
    const character = { hp_current: 20, hp_temp: 3, damage_resistances: ['Fuego'] };
    assert.deepEqual(hpAfterDamage(character, 10, 'fuego'), {
        hp_current: 18,
        hp_temp: 0,
        amount: 5,
        absorbed: 3,
        modifier: 'resistant',
    });
});

test('healing never exceeds maximum hp', () => {
    assert.deepEqual(hpAfterHealing({ hp_current: 18, hp_max: 20, hp_temp: 2 }, 9), {
        hp_current: 20,
        hp_temp: 2,
        amount: 2,
    });
});

test('single and circular area targeting enforce relationships', () => {
    const actor = { id: 'a', character_id: 1, owner_user_id: 'u1', x: 10, y: 10, visible: true, character: { id: 1 } };
    const ally = { id: 'b', character_id: 2, owner_user_id: 'u2', x: 20, y: 20, visible: true, character: { id: 2 } };
    const enemyNear = { id: 'c', character_id: 3, owner_user_id: null, x: 52, y: 50, visible: true, character: { id: 3, npc_type: 'enemigo' } };
    const enemyFar = { id: 'd', character_id: 4, owner_user_id: null, x: 75, y: 75, visible: true, character: { id: 4, npc_type: 'enemigo' } };
    assert.deepEqual(resolveTargetTokens({ target: 'ally', range: 30 }, actor, [actor, ally, enemyNear], ['b']).map(item => item.id), ['b']);
    assert.deepEqual(resolveTargetTokens({ target: 'enemy', range: 30 }, actor, [actor, ally, enemyNear], ['b']), []);
    assert.deepEqual(resolveTargetTokens({ target: 'area-enemy', range: 120, area: { shape: 'circle', sizePct: 12 } }, actor, [actor, ally, enemyNear, enemyFar], [], { x: 50, y: 50 }).map(item => item.id), ['c']);
});

test('melee range reaches every contiguous grid square, including diagonals', () => {
    assert.equal(combatRangePct(5), 8);
    const actor = { id: 'a', character_id: 1, owner_user_id: null, x: 50, y: 50, visible: true, character: { id: 1, npc_type: 'enemigo' } };
    const diagonalAlly = { id: 'b', character_id: 2, owner_user_id: 'u2', x: 55.5, y: 55.5, visible: true, character: { id: 2 } };
    const distantAlly = { id: 'c', character_id: 3, owner_user_id: 'u3', x: 61, y: 50, visible: true, character: { id: 3 } };
    assert.deepEqual(resolveTargetTokens({ target: 'enemy', range: 5 }, actor, [actor, diagonalAlly, distantAlly], ['b']).map(item => item.id), ['b']);
    assert.deepEqual(resolveTargetTokens({ target: 'enemy', range: 5 }, actor, [actor, diagonalAlly, distantAlly], ['c']), []);
});

test('homebrew text becomes structured attacks and areas', () => {
    const character = {
        id: 5,
        level: 5,
        proficiency_bonus: 3,
        abilityScores: [
            { ability: 'STR', base_value: 9 }, { ability: 'DEX', base_value: 15 }, { ability: 'INT', base_value: 16 },
        ],
        custom_features: [
            { name: 'Gas pimienta', kind: 'Accion', resource: 'Truco gadget', description: 'Alcance 30 pies. Hacé un ataque usando INT + competencia; causa 2d12 de veneno.' },
            { name: 'Granada explosiva', kind: 'Bonus', resource: '2/Descanso Largo', description: 'Explota en un círculo de 20 pies y causa 2d8 de fuego.' },
            { name: 'Capacidad', kind: 'Pasivo', description: 'No debe ser una acción.' },
        ],
    };
    const actions = customFeatureProfiles(character);
    assert.equal(actions.length, 2);
    assert.equal(actions[0].name, 'Gas pimienta');
    assert.equal(actions[0].attackBonus, 6);
    assert.equal(actions[0].damage, '2d12');
    assert.equal(actions[0].damageType, 'veneno');
    assert.equal(actions[0].range, 30);
    assert.equal(actions[1].economy, 'bonus');
    assert.equal(actions[1].target, 'area-enemy');
    assert.equal(actions[1].range, 60);
    assert.equal(actions[1].damage, '2d8');
    assert.equal(actions[1].damageType, 'fuego');
    assert.equal(actions[1].resource.type, 'session-use');
    assert.equal(actions[1].resource.max, 2);
});

test('reaction features expose their trigger and mechanical effect', () => {
    const character = {
        id: 6,
        proficiency_bonus: 2,
        abilityScores: [{ ability: 'DEX', base_value: 16 }],
        custom_features: [
            { name: 'Esquiva asombrosa', kind: 'Reacción', description: 'Cuando un ataque te impacta, reduce el daño a la mitad.' },
            { name: 'Represión infernal', kind: 'Reacción', description: 'Después de recibir daño, el atacante recibe 2d10 de fuego.' },
        ],
    };
    const actions = customFeatureProfiles(character);
    assert.equal(actions[0].economy, 'reaction');
    assert.equal(actions[0].reactionTrigger, 'ATTACK_HIT_BEFORE_DAMAGE');
    assert.equal(actions[0].reactionEffect.type, 'HALVE_DAMAGE');
    assert.equal(actions[1].reactionTrigger, 'DAMAGE_TAKEN');
    assert.equal(actions[1].reactionEffect.type, 'COUNTER_DAMAGE');
});

test('NPC counter reactions model their save, push and condition', () => {
    const action = npcActionProfile({
        id: 44,
        name: 'Contraataque Arcano',
        action_type: 'reacción',
        save_ability: 'DEX',
        save_dc: 13,
        description: 'Cuando es alcanzado por un ataque cuerpo a cuerpo, fuerza al atacante a salvar. Si falla, es empujado 10 pies y cae derribado.',
    });
    assert.equal(action.reactionTrigger, 'DAMAGE_TAKEN');
    assert.deepEqual(action.reactionEffect, {
        type: 'FORCED_SAVE', saveAbility: 'DEX', saveDc: 13, pushFeet: 10, condition: 'Derribado', meleeOnly: true,
    });
});

test('Vorcan and Imperial actions become executable profiles', () => {
    assert.equal(npcActionProfile({ id: 1, name: 'Escudo Arcano', action_type: 'rasgo' }), null);
    const chain = npcActionProfile({ id: 2, name: 'Cadena Rota', action_type: 'acción', save_ability: 'STR', save_dc: 13, reach: '30 pies', description: 'Si falla queda apresado.' });
    assert.equal(chain.target, 'enemy');
    assert.deepEqual(chain.effect.conditions, ['Apresado']);
    const fire = npcActionProfile({ id: 3, name: 'Fuego Sectorial', action_type: 'acción', damage_dice: '2d6', damage_type: 'Fuego', save_ability: 'DEX', save_dc: 15, recharge: '5–6', description: 'Salvación para mitad.' });
    assert.equal(fire.target, 'area-enemy');
    assert.equal(fire.halfOnSave, true);
    assert.equal(fire.resource.type, 'recharge');
    const dagger = npcActionProfile({ id: 4, name: 'Daga Ígnea', action_type: 'acción', attack_bonus: 5, damage_dice: '1d4', damage_bonus: 2, damage_type: 'Perforante', description: 'Además 1d6 de fuego.' });
    assert.deepEqual(dagger.extraDamage, ['1d6']);
    assert.equal(dagger.extraDamageType, 'fuego');
});

test('party profiles preserve dual effects, weapon jams and persistent spells', () => {
    const character = {
        id: 8, level: 5, proficiency_bonus: 3,
        abilityScores: [{ ability: 'CHA', base_value: 18 }, { ability: 'DEX', base_value: 16 }],
        custom_features: [
            { name: 'Acorde radiante', kind: 'Bonus', resource: '4/Descanso Largo (MOD CAR)', description: 'Causa 1d4 + CAR de daño radiante y cura 1d8 PV a una criatura elegida que esté a 15 pies.' },
            { name: 'Escupefuego · Munición normal', kind: 'Accion', description: 'Disparo con DES + competencia. Daño: 1d8 + DES.' },
        ],
    };
    const [chord, firearm] = customFeatureProfiles(character);
    assert.equal(chord.secondaryHealing, '1d8');
    assert.equal(chord.secondaryHealingRange, 15);
    assert.equal(firearm.jamOnNaturalBelow, 7);
    const hex = spellProfile({ id: 5, slug: 'hex', name: 'Hex', level: 1, range: '90 feet', casting_time: '1 Bonus Action', desc: 'Curse a target.' }, character);
    const agathys = spellProfile({ id: 6, slug: 'armor-of-agathys', name: 'Armor of Agathys', level: 1, range: 'Self', casting_time: '1 Bonus Action', desc: 'Gain temporary hit points.' }, character);
    assert.equal(hex.effect.type, 'MARK_EXTRA_DAMAGE');
    assert.equal(agathys.effect.type, 'TEMP_HP_RETALIATION');
});

test('known utility spells do not apply their descriptive damage on cast', () => {
    const character = { level: 5, class_slug: 'warlock', proficiency_bonus: 3, abilityScores: [{ ability: 'CHA', base_value: 16 }] };
    const hex = spellProfile({ id: 1, slug: 'hex', name: 'Hex', level: 1, range: '90 feet', casting_time: '1 Bonus Action', desc: 'You deal an extra 1d6 Necrotic damage whenever you hit.' }, character);
    const armor = spellProfile({ id: 2, slug: 'armor-of-agathys', name: 'Armor of Agathys', level: 1, range: 'Self', casting_time: '1 Bonus Action', desc: 'You gain 5 Temporary Hit Points.' }, character);
    assert.equal(hex.damage, null);
    assert.equal(hex.target, 'enemy');
    assert.equal(armor.temporaryHp, 5);
    assert.equal(armor.target, 'self');
});

test('conditional follow-up damage is not applied to the initial hit', () => {
    const character = {
        id: 9,
        level: 5,
        proficiency_bonus: 3,
        abilityScores: [{ ability: 'STR', base_value: 16 }],
        custom_features: [{
            name: 'Culatazo empoderado',
            kind: 'Accion',
            description: 'Ataque con FUE + competencia. Al impactar causa 2d8 + FUE. Si el objetivo se mueve, recibe 1d8 adicional.',
        }],
    };
    const [action] = customFeatureProfiles(character);
    assert.equal(action.damage, '2d8+3');
    assert.deepEqual(action.extraDamage, []);
});

test('finesse weapons choose the best ability and shared chord uses scale from charisma', () => {
    const character = {
        id: 4,
        level: 5,
        proficiency_bonus: 3,
        abilityScores: [{ ability: 'STR', base_value: 16 }, { ability: 'DEX', base_value: 12 }, { ability: 'CHA', base_value: 18 }],
        custom_features: [
            { name: 'Acorde menor', kind: 'Bonus', resource: '0/Descanso Largo (MOD CAR)', description: 'Causa 1d4 + CAR de daño.' },
            { name: 'Acorde mayor', kind: 'Bonus', resource: '0/Descanso Largo (MOD CAR)', description: 'Causa 1d10 + CAR de daño.' },
        ],
    };
    const weapon = weaponProfile({ id: 7, name: 'Espada sutil', damage: '1d6', damage_type: 'perforante', properties: ['Sutil'] }, character, 'primary');
    assert.equal(weapon.attackBonus, 6);
    assert.equal(weapon.damage, '1d6+3');
    const chords = customFeatureProfiles(character);
    assert.equal(chords[0].resource.max, 4);
    assert.equal(chords[0].resource.key, chords[1].resource.key);
});

test('Paleas uses the correct spellcasting ability and weapon passives stay attached to attacks', () => {
    const paleas = {
        id: 31, level: 5, proficiency_bonus: 3,
        abilityScores: [{ ability: 'STR', base_value: 14 }, { ability: 'WIS', base_value: 15 }, { ability: 'CHA', base_value: 16 }],
        custom_features: [{ name: 'Hunter’s Prey — Colossus Slayer', kind: 'Accion' }],
    };
    const fireBolt = spellProfile({ id: 1, slug: 'paleas-fire-bolt', name: 'Fire Bolt', dnd_class: 'Sorcerer', level: 0, range: '120 ft.', casting_time: '1A' }, paleas);
    const mark = spellProfile({ id: 2, slug: 'paleas-hunters-mark', name: "Hunter's Mark", dnd_class: 'Ranger', level: 1, range: '90 ft.', casting_time: '1BA' }, paleas);
    const shortsword = weaponProfile({ id: 3, name: 'Shortsword +1', damage: '1d6', damage_type: 'perforante', mastery: { name: 'Vex' }, properties: ['Light'] }, paleas, 'secondary');
    assert.equal(fireBolt.attackBonus, 6);
    assert.equal(mark.effect.type, 'MARK_EXTRA_DAMAGE');
    assert.deepEqual(shortsword.conditionalExtraDamage, [{ expression: '1d8', damageType: 'perforante', when: 'target-wounded', oncePerTurn: true, source: 'Asesino de Colosos' }]);
    assert.equal(shortsword.effect.type, 'VEX_NEXT_ATTACK_ADVANTAGE');
});

test('utility spells can be used manually and retain their real resource cost', () => {
    const paleas = { id: 31, level: 5, proficiency_bonus: 3, abilityScores: [{ ability: 'WIS', base_value: 15 }, { ability: 'CHA', base_value: 16 }] };
    const detectMagic = spellProfile({ id: 11, slug: 'paleas-detect-magic', name: 'Detect Magic', dnd_class: 'Ranger', level: 1, casting_time: '1A' }, paleas);
    const light = spellProfile({ id: 12, slug: 'paleas-light', name: 'Light', dnd_class: 'Celestial Legacy', level: 0, casting_time: '1A' }, paleas);
    const daylight = spellProfile({ id: 13, slug: 'paleas-daylight', name: 'Daylight', dnd_class: 'Celestial Legacy', level: 3, casting_time: '1A', notes: '1/LR' }, paleas);
    assert.equal(detectMagic.manualResolution, true);
    assert.equal(detectMagic.target, 'self');
    assert.deepEqual(detectMagic.resource, { type: 'spell-slot', level: 1 });
    assert.equal(light.manualResolution, true);
    assert.equal(light.resource, null);
    assert.deepEqual(daylight.resource, { type: 'session-use', key: 'spell:daylight', max: 1, recovery: 'largo' });
});
