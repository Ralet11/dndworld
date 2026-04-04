/**
 * StatEngine - Professional D&D 5e Calculation Engine
 * Handles real-time calculation of modifiers, AC, HP, and skill checks.
 */
class StatEngine {
    /**
     * Calculates the modifier for a given ability score.
     * Standard 5e formula: floor((score - 10) / 2)
     */
    static getModifier(score) {
        return Math.floor((score - 10) / 2);
    }

    /**
     * Re-calculates full character stats based on equipment and status effects.
     */
    static calculate(character) {
        const { abilityScores = [], equipment = {}, activeEffects = [], skills = [] } = character;

        // 1. Calculate Core Attribute Modifiers
        const mods = {};
        const stats = {};
        abilityScores.forEach(as => {
            const totalScore = as.base_value + as.bonus_value;
            stats[as.ability.toLowerCase()] = totalScore;
            mods[as.ability.toLowerCase()] = this.getModifier(totalScore);
        });

        // 2. Base Calculations
        const proficiencyBonus = Math.ceil(character.level / 4) + 1;
        // Use database ac_base if available (allows DM override), otherwise 10
        let effectiveAC = (character.ac_base || 10) + (mods.dex || 0);

        // 3. Process Equipment Modifiers
        const equippedItems = this.getEquippedItems(equipment);
        equippedItems.forEach(item => {
            if (item.stat_bonuses) {
                if (item.stat_bonuses.ac) effectiveAC += item.stat_bonuses.ac;
            }
        });

        // 4. Process Status Effects (Buffs/Debuffs)
        activeEffects.forEach(effect => {
            if (effect.stat_changes) {
                if (effect.stat_changes.ac) effectiveAC += effect.stat_changes.ac;
                if (effect.stat_changes.speed) character.speed += effect.stat_changes.speed;
            }
        });

        // 5. Saving Throws (Simplified Class Logic for prototype)
        // In a full DB, we'd have a 'proficiencies' relation.
        const savingThrows = {
            str: { mod: mods.str, proficient: false },
            dex: { mod: mods.dex, proficient: character.class === 'Ranger' || character.class === 'Rogue' },
            con: { mod: mods.con, proficient: character.class === 'Fighter' || character.class === 'Barbarian' },
            int: { mod: mods.int, proficient: character.class === 'Wizard' },
            wis: { mod: mods.wis, proficient: character.class === 'Cleric' || character.class === 'Druid' },
            cha: { mod: mods.cha, proficient: character.class === 'Bard' || character.class === 'Paladin' }
        };

        // Apply proficiency to saves
        Object.keys(savingThrows).forEach(key => {
            if (savingThrows[key].proficient) {
                savingThrows[key].mod += proficiencyBonus;
            }
        });

        // 6. Skills & Passive Perception
        const masterSkillList = [
            { name: 'Acrobacia', attr: 'dex' },
            { name: 'Arcanos', attr: 'int' },
            { name: 'Atletismo', attr: 'str' },
            { name: 'Engaño', attr: 'cha' },
            { name: 'Historia', attr: 'int' },
            { name: 'Interpretación', attr: 'cha' },
            { name: 'Intimidación', attr: 'cha' },
            { name: 'Investigación', attr: 'int' },
            { name: 'Juego de Manos', attr: 'dex' },
            { name: 'Medicina', attr: 'wis' },
            { name: 'Naturaleza', attr: 'int' },
            { name: 'Percepción', attr: 'wis' },
            { name: 'Perspicacia', attr: 'wis' },
            { name: 'Persuasión', attr: 'cha' },
            { name: 'Religión', attr: 'int' },
            { name: 'Sigilo', attr: 'dex' },
            { name: 'Supervivencia', attr: 'wis' },
            { name: 'Trato con Animales', attr: 'wis' }
        ];

        const skillList = masterSkillList.map(template => {
            // Find if character has this skill proficient
            const charSkill = skills.find(s => s.name === template.name);
            const isProficient = charSkill ? charSkill.proficiency_level > 0 : false;
            const proficiencyLevel = isProficient ? charSkill.proficiency_level : 0;

            // Calculate bonus
            const attrMod = mods[template.attr] || 0;
            const totalBonus = attrMod + (proficiencyLevel * proficiencyBonus);

            return {
                name: template.name,
                attr: template.attr,
                bonus: totalBonus,
                proficient: isProficient
            };
        });

        // Ensure we sort them alphabetically for the UI
        skillList.sort((a, b) => a.name.localeCompare(b.name));

        const perceptionSkill = skillList.find(s => s.name === 'Percepción');
        const passivePerception = 10 + (perceptionSkill ? perceptionSkill.bonus : (mods.wis || 0));

        // 7. Finalize Stats for the UI
        return {
            name: character.name,
            level: character.level,
            hp: character.hp_current,
            maxHp: character.hp_max,
            ac: effectiveAC,
            proficiencyBonus,
            initiative: mods.dex, // Dex mod is base initiative
            speed: character.speed || 30,
            passivePerception,
            stats, // Raw scores
            modifiers: mods, // +3, -1, etc.
            savingThrows,
            skills: skillList
        };
    }

    static getEquippedItems(equipment) {
        const items = [];
        const fields = ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon', 'back'];
        fields.forEach(field => {
            if (equipment[field]) items.push(equipment[field]);
        });
        return items;
    }

    // Deprecated: Logic moved to inside calculate() for holistic view
    static calculateSkillBonus(skill, mods, profBonus) {
        return 0;
    }
}

module.exports = StatEngine;
