const StatEngine = require('./utils/statEngine');

const mockCharacter = {
    name: 'TestChar',
    level: 1,
    hp_current: 10,
    hp_max: 10,
    equipment: {},
    activeEffects: [],
    // Proficient in Stealth (Sigilo) and Insight (Perspicacia)
    skills: [
        { name: 'Sigilo', proficiency_level: 1 },
        { name: 'Perspicacia', proficiency_level: 1 }
    ],
    abilityScores: [
        { ability: 'STR', base_value: 10, bonus_value: 0 }, // +0
        { ability: 'DEX', base_value: 14, bonus_value: 0 }, // +2
        { ability: 'CON', base_value: 10, bonus_value: 0 }, // +0
        { ability: 'INT', base_value: 10, bonus_value: 0 }, // +0
        { ability: 'WIS', base_value: 12, bonus_value: 0 }, // +1
        { ability: 'CHA', base_value: 10, bonus_value: 0 }  // +0
    ]
};

const result = StatEngine.calculate(mockCharacter);

console.log('Total Skills:', result.skills.length);
console.log('--- Skill Sample ---');
result.skills.forEach(s => {
    console.log(`${s.name}: ${s.bonus} (Proficient: ${s.proficient})`);
});
