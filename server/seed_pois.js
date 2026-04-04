const PointOfInterest = require('./models/PointOfInterest');
const sequelize = require('./config/database');

// Coordenadas refinadas visualmente basándonos en la geografía de la nueva imagen completa y las proporciones del mapa original
const MARKERS = [
    { title: 'Prontera', top: '63%', left: '18%', color: '#eab308', type: 'city' },
    { title: 'Bosque de acero', top: '52%', left: '24%', color: '#10b981', type: 'city' },
    { title: 'Herbolago', top: '60%', left: '28%', color: '#60a5fa', type: 'city' },
    { title: 'Torre Ocaso', top: '66%', left: '25%', color: '#9333ea', type: 'city' },
    { title: 'Campamento Faucepiedra', top: '70%', left: '28%', color: '#ef4444', type: 'city' },
    { title: 'Pantano Hachoverde', top: '72%', left: '15%', color: '#84cc16', type: 'city' },
    { title: 'Costa sombría', top: '62.5%', left: '8%', color: '#64748b', type: 'city' },
    { title: 'Brisamar', top: '85%', left: '25%', color: '#38bdf8', type: 'city' },
    { title: 'Ráfaga del Sur', top: '78%', left: '26%', color: '#f59e0b', type: 'city' },
    { title: 'Calaverna', top: '63%', left: '35%', color: '#a8a29e', type: 'city' },
    { title: 'Paso de Thanemor', top: '55%', left: '38%', color: '#d6d3d1', type: 'city' },
];

async function seed() {
    try {
        await sequelize.sync();

        console.log("Clearing existing POIs...");
        await PointOfInterest.destroy({ where: {} });

        console.log("Seeding perfectly adjusted POIs for new geography...");
        for (const marker of MARKERS) {
            await PointOfInterest.create(marker);
            console.log(`Added: ${marker.title}`);
        }

        console.log("Seeding complete!");
        process.exit(0);
    } catch (error) {
        console.error("Seeding error:", error);
        process.exit(1);
    }
}

seed();
