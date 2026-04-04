const sequelize = require('./config/database');
const PointOfInterest = require('./models/PointOfInterest');

const poiData = {
    'Prontera': {
        image: 'https://images.unsplash.com/photo-1599388373809-77573cbd68d0?q=80&w=600&auto=format&fit=crop', // River crossing
        description: 'La puerta de entrada a las tierras salvajes. Un asentamiento fortificado donde los comerciantes intercambian bienes antes de adentrarse en territorios peligrosos. La Guardia Fronteriza mantiene una estricta vigilancia sobre quienes entran y salen.'
    },
    'Costa sombría': {
        image: 'https://images.unsplash.com/photo-1498144846853-60ca2d438ba0?q=80&w=600&auto=format&fit=crop', // Dark coast
        description: 'Un puerto envuelto en niebla perpetua. Se rumorea que los contrabandistas y piratas encuentran refugio seguro aquí, lejos de la mirada del Rey. El faro antiguo rara vez se enciende, guiando solo a aquellos que conocen los verdaderos caminos del mar.'
    },
    'Bosque de acero': {
        image: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=600&auto=format&fit=crop', // dense dark forest
        description: 'Llamado así no por los árboles metálicos, sino por la densidad inquebrantable de su madera oscura y las armas de los bandidos que acechan dentro. Pocos se aventuran más allá de sus linderos sin una escolta fuertemente armada.'
    },
    'Pantano Hachoverde': {
        image: 'https://images.unsplash.com/photo-1623916947230-01dfdc5440fd?q=80&w=600&auto=format&fit=crop', // swamp
        description: 'Una vasta extensión de aguas pútridas y flora venenosa. El aire aquí es espeso y huele a descomposición. Es el hogar de criaturas anfibias y brujas ermitañas que guardan antiguos secretos de herboristería.'
    },
    'Herbolago': {
        image: 'https://images.unsplash.com/photo-1436149454131-ab10bc44c1a5?q=80&w=600&auto=format&fit=crop', // lake
        description: 'Un apacible pueblo pesquero situado a orillas de un inmenso lago cristalino. Conocido por sus curanderos y sus festivales de linternas flotantes durante el solsticio de verano, es uno de los pocos lugares verdaderamente pacíficos en Westamar.'
    },
    'Torre Ocaso': {
        image: 'https://images.unsplash.com/photo-1605330364239-2ce1ea39add3?q=80&w=600&auto=format&fit=crop', // old tower
        description: 'Una aguja de obsidiana negra que se alza solitaria en los páramos orientales. Nadie sabe quién la construyó, pero sus ventanas a veces brillan con una luz antinatural en las noches sin luna. Los aventureros que entran rara vez regresan con su cordura intacta.'
    }
};

async function seedDetails() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        for (const [title, details] of Object.entries(poiData)) {
            const result = await PointOfInterest.update(
                { image: details.image, description: details.description },
                { where: { title: title } }
            );

            if (result[0] > 0) {
                console.log(`Updated POI: ${title}`);
            } else {
                console.log(`POI not found: ${title}`);
            }
        }

        console.log('Seeding process completed successfully!');
    } catch (error) {
        console.error('Error seeding POI details:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

seedDetails();
