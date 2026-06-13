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

        // 3. Sistema de armaduras 2025 — CA modular por pieza (NO suma DES; la
        // Destreza alimenta el pool de esquive, no la CA).
        const equippedItems = this.getEquippedItems(equipment);
        const armor = this.computeArmor(character, equipment, mods.dex || 0);
        let effectiveAC = armor.ac;
        const talents = armor.talents;

        // 4. Process Status Effects (Buffs/Debuffs)
        // Nota: el bonus de CA de los efectos ya se aplicó en computeArmor; acá
        // solo procesamos el resto (p. ej. velocidad) para no duplicar.
        activeEffects.forEach(effect => {
            if (effect.stat_changes) {
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
            // Sistema de armaduras 2025
            armorType: armor.armorType,         // 'tela'|'cuero'|'malla'|null
            dodge: armor.dodge,                 // { die: 6|4|null, pool }
            talents,                            // { espiritu, agilidad, aguante }
            talentThresholds: armor.talentThresholds, // dotes desbloqueados por árbol
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

    /**
     * Sistema de armaduras 2025 — calcula CA modular, categoría/dado de esquive
     * y stats de talento acumulados a partir del equipo.
     *
     * CA = base(10) + Σ(ca_value de piezas de armadura) + Σ(stat_bonuses.ac, p.ej. escudos)
     *      + bonus de efectos de estado, redondeado hacia abajo.
     * Tipo de esquive = la pieza MÁS PESADA equipada (malla > cuero > tela).
     */
    static computeArmor(character, equipment, dexMod) {
        const ARMOR_SLOTS = ['helmet', 'chest', 'gloves', 'pants', 'boots', 'shoulders'];
        const TYPE_RANK = { tela: 1, cuero: 2, malla: 3 };
        const DODGE_DIE = { tela: 6, cuero: 4, malla: null };
        const THRESHOLDS = [5, 10, 15, 20];

        // Jugadores: base fija 10 (CA_BASE del sistema modular). NPCs/monstruos:
        // usan su ac_base como CA plana (no usan armadura modular).
        const base = character.is_npc ? (character.ac_base || 10) : 10;
        const talents = { espiritu: 0, agilidad: 0, aguante: 0 };

        // 1) CA de piezas de armadura + tipo más pesado.
        let caFromArmor = 0;
        let heaviest = null;
        for (const slot of ARMOR_SLOTS) {
            const item = equipment[slot];
            if (!item) continue;
            if (typeof item.ca_value === 'number') caFromArmor += item.ca_value;
            const t = item.armor_type;
            if (t && (!heaviest || TYPE_RANK[t] > TYPE_RANK[heaviest])) heaviest = t;
        }

        // 2) CA plana de cualquier ítem equipado (escudos, anillos mágicos…).
        let caFlat = 0;
        const all = this.getEquippedItems(equipment);
        all.forEach((item) => {
            if (item.stat_bonuses && item.stat_bonuses.ac) caFlat += item.stat_bonuses.ac;
            if (item.talent_stats) {
                talents.espiritu += item.talent_stats.espiritu || 0;
                talents.agilidad += item.talent_stats.agilidad || 0;
                talents.aguante += item.talent_stats.aguante || 0;
            }
        });

        // 3) Bonus de CA por efectos de estado activos.
        let caEffects = 0;
        (character.activeEffects || []).forEach((e) => {
            if (e.stat_changes && e.stat_changes.ac) caEffects += e.stat_changes.ac;
        });

        const ac = Math.floor(base + caFromArmor + caFlat + caEffects);

        // 4) Esquive según el tipo más pesado (malla = sin esquive).
        const die = heaviest ? DODGE_DIE[heaviest] : null;
        const dodge = { die, pool: die ? Math.max(0, dexMod) : 0 };

        // 5) Umbrales de dote desbloqueados por cada árbol.
        const talentThresholds = {
            espiritu: THRESHOLDS.filter((t) => talents.espiritu >= t),
            agilidad: THRESHOLDS.filter((t) => talents.agilidad >= t),
            aguante: THRESHOLDS.filter((t) => talents.aguante >= t),
        };

        return { ac, armorType: heaviest, dodge, talents, talentThresholds };
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
