const { Character, Item, EquipmentSlots } = require('./models');
const sequelize = require('./config/database');

const verifyData = async () => {
    try {
        await sequelize.authenticate();
        const chars = await Character.findAll({
            include: [
                { model: Item, as: 'items' },
                { model: EquipmentSlots, as: 'equipment' }
            ]
        });

        console.log('Characters found:', chars.length);
        chars.forEach(c => {
            console.log(`- ${c.name}: ${c.items.length} items en inventario`);
            if (c.equipment) {
                console.log(`  Equipamiento: Arma P: ${c.equipment.primary_weapon_id}, Arma S: ${c.equipment.secondary_weapon_id}`);
            } else {
                console.log('  Sin equipamiento registrado.');
            }
        });
    } catch (err) {
        console.error('Error verification:', err);
    } finally {
        await sequelize.close();
    }
};

verifyData();
