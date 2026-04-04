const { Character, AbilityScore, Skill, Quest, Item, EquipmentSlots } = require('./models');
const sequelize = require('./config/database');
const { Op } = require('sequelize');
const StatEngine = require('./utils/statEngine');

const getCalculatedPartyStats = async () => {
    const characters = await Character.findAll({
        where: {
            [Op.or]: [
                { is_npc: false },
                { is_active: true }
            ]
        },
        include: [
            { model: AbilityScore, as: 'abilityScores' },
            { model: Skill, as: 'skills' },
            { model: Quest, as: 'quests' },
            { model: Item, as: 'items' },
            {
                model: EquipmentSlots,
                as: 'equipment',
                include: [
                    { model: Item, as: 'helmet' },
                    { model: Item, as: 'chest' },
                    { model: Item, as: 'shoulders' },
                    { model: Item, as: 'boots' },
                    { model: Item, as: 'pants' },
                    { model: Item, as: 'gloves' },
                    { model: Item, as: 'ring_1' },
                    { model: Item, as: 'ring_2' },
                    { model: Item, as: 'primary_weapon' },
                    { model: Item, as: 'secondary_weapon' }
                ]
            }
        ]
    });

    return characters.map(char => {
        const baseStats = StatEngine.calculate(char);
        return {
            ...baseStats,
            id: char.id,
            name: char.name,
            race: char.race,
            class: char.class,
            level: char.level,
            inventory: char.items,
            quests: char.quests,
            equipment: char.equipment,
            abilities_text: char.abilities_text,
            image_url: char.image_url,
            image_scale: char.image_scale,
            image_offset_x: char.image_offset_x,
            image_offset_y: char.image_offset_y,
            UserId: char.UserId,
        };
    });
};

async function check() {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');
        const players = await getCalculatedPartyStats();
        console.log('Calculated players count:', players.length);
        console.log('First player name:', players[0]?.name);
        // console.log('Full JSON (sample):', JSON.stringify(players[0], null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Error during calculated stats:', err);
        process.exit(1);
    }
}

check();
