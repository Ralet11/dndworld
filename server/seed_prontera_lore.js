const sequelize = require('./config/database');
const PointOfInterest = require('./models/PointOfInterest');

async function seedPronteraLore() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const result = await PointOfInterest.update(
            {
                dmDescription: 'La humedad del pantano cercano siempre hace que el aire aquí se sienta pesado. Los guardias, extenuados, suelen pedir sobornos a los viajeros poco astutos.',
                partyKnowledge: 'Sabemos que el Herrero local, "Grum", tiene una deuda pendiente con los ladrones del bosque. Su armería podría tener acceso secreto a los túneles inferiores.'
            },
            { where: { title: 'Prontera' } }
        );

        console.log('Prontera lore seeded!');
    } catch (error) {
        console.error('Error seeding POI details:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

seedPronteraLore();
