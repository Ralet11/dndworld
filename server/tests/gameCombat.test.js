const test = require('node:test');
const assert = require('node:assert/strict');
const {
    customFeatureProfiles,
    hpAfterDamage,
    hpAfterHealing,
    parseDiceExpression,
    resolveTargetTokens,
    spellProfile,
    weaponProfile,
} = require('../services/gameCombat');

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

test('known utility spells do not apply their descriptive damage on cast', () => {
    const character = { level: 5, class_slug: 'warlock', proficiency_bonus: 3, abilityScores: [{ ability: 'CHA', base_value: 16 }] };
    const hex = spellProfile({ id: 1, slug: 'hex', name: 'Hex', level: 1, range: '90 feet', casting_time: '1 Bonus Action', desc: 'You deal an extra 1d6 Necrotic damage whenever you hit.' }, character);
    const armor = spellProfile({ id: 2, slug: 'armor-of-agathys', name: 'Armor of Agathys', level: 1, range: 'Self', casting_time: '1 Bonus Action', desc: 'You gain 5 Temporary Hit Points.' }, character);
    assert.equal(hex.damage, null);
    assert.equal(hex.target, 'enemy');
    assert.equal(armor.temporaryHp, 5);
    assert.equal(armor.target, 'self');
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
