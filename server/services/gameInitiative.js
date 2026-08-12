function abilityScore(character, ability) {
    const score = (character?.abilityScores || []).find(item => item.ability === ability);
    return Number(score?.base_value || 10) + Number(score?.bonus_value || 0);
}

function dexterityModifier(character) {
    return Math.floor((abilityScore(character, 'DEX') - 10) / 2);
}

function initiativeBonus(character) {
    const configured = Number(character?.initiative_bonus);
    const extra = Number.isFinite(configured) ? configured : 0;
    return character?.is_npc ? extra : dexterityModifier(character) + extra;
}

function initiativeEntry(character, roll, source = 'automatic', bonusOverride) {
    const bonus = Number.isFinite(Number(bonusOverride)) ? Number(bonusOverride) : initiativeBonus(character);
    return {
        characterId: Number(character.id),
        roll: Number(roll),
        bonus,
        total: Number(roll) + bonus,
        dexterity: abilityScore(character, 'DEX'),
        source,
    };
}

function orderByInitiative(entries, fallbackOrder = []) {
    const valid = Object.values(entries || {})
        .filter(entry => Number.isInteger(Number(entry?.characterId)))
        .sort((left, right) => (
            Number(right.total) - Number(left.total)
            || Number(right.bonus) - Number(left.bonus)
            || Number(right.dexterity) - Number(left.dexterity)
            || Number(left.characterId) - Number(right.characterId)
        ));
    const rolledIds = valid.map(entry => Number(entry.characterId));
    const pendingIds = [...new Set((fallbackOrder || []).map(Number).filter(Number.isInteger))]
        .filter(id => !rolledIds.includes(id));
    return [...rolledIds, ...pendingIds];
}

module.exports = { abilityScore, dexterityModifier, initiativeBonus, initiativeEntry, orderByInitiative };
