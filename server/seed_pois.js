const PointOfInterest = require('./models/PointOfInterest');
const sequelize = require('./config/database');

// Puntos de interés del mapa (Westamar). Posiciones reales exportadas de la base.
// Idempotente: upsert por título (no duplica, no borra POIs agregados por el DM).
const MARKERS = [
    {
        title: 'Prontera', top: '39.18%', left: '18.41%', color: '#eab308', type: 'city',
        image: 'https://res.cloudinary.com/doqyrz0sg/image/upload/v1772053044/ChatGPT_Image_25_feb_2026_05_55_14_p.m._d9hpms.png',
        description: 'La puerta de entrada a las tierras salvajes. Un asentamiento fortificado donde los comerciantes intercambian bienes antes de adentrarse en territorios peligrosos. La Guardia Fronteriza mantiene una estricta vigilancia sobre quienes entran y salen.',
        dmDescription: 'La humedad del pantano cercano siempre hace que el aire aquí se sienta pesado. Los guardias, extenuados, suelen pedir sobornos a los viajeros poco astutos.',
        partyKnowledge: 'Sabemos que el Herrero local, "Grum", tiene una deuda pendiente con los ladrones del bosque. Su armería podría tener acceso secreto a los túneles inferiores.',
    },
    {
        title: 'Bosque de acero', top: '30.08%', left: '24.00%', color: '#10b981', type: 'city',
        image: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=600&auto=format&fit=crop',
        description: 'Llamado así no por los árboles metálicos, sino por la densidad inquebrantable de su madera oscura y las armas de los bandidos que acechan dentro. Pocos se aventuran más allá de sus linderos sin una escolta fuertemente armada.',
    },
    {
        title: 'Herbolago', top: '34.38%', left: '31.69%', color: '#60a5fa', type: 'city',
        image: 'https://images.unsplash.com/photo-1436149454131-ab10bc44c1a5?q=80&w=600&auto=format&fit=crop',
        description: 'Un apacible pueblo pesquero situado a orillas de un inmenso lago cristalino. Conocido por sus curanderos y sus festivales de linternas flotantes durante el solsticio de verano, es uno de los pocos lugares verdaderamente pacíficos en Westamar.',
    },
    {
        title: 'Torre Ocaso', top: '45.90%', left: '31.25%', color: '#9333ea', type: 'city',
        image: 'https://images.unsplash.com/photo-1605330364239-2ce1ea39add3?q=80&w=600&auto=format&fit=crop',
        description: 'Una aguja de obsidiana negra que se alza solitaria en los páramos orientales. Nadie sabe quién la construyó, pero sus ventanas a veces brillan con una luz antinatural en las noches sin luna. Los aventureros que entran rara vez regresan con su cordura intacta.',
    },
    {
        title: 'Campamento Faucepiedra', top: '51.96%', left: '36.27%', color: '#ef4444', type: 'city',
    },
    {
        title: 'Pantano Hachoverde', top: '53.32%', left: '17.01%', color: '#84cc16', type: 'city',
        image: 'https://images.unsplash.com/photo-1623916947230-01dfdc5440fd?q=80&w=600&auto=format&fit=crop',
        description: 'Una vasta extensión de aguas pútridas y flora venenosa. El aire aquí es espeso y huele a descomposición. Es el hogar de criaturas anfibias y brujas ermitañas que guardan antiguos secretos de herboristería.',
    },
    {
        title: 'Costa sombría', top: '47.62%', left: '3.49%', color: '#64748b', type: 'city',
        image: 'https://res.cloudinary.com/doqyrz0sg/image/upload/v1772053634/ChatGPT_Image_25_feb_2026_06_04_45_p.m._zsmz7x.png',
        description: 'Un puerto envuelto en niebla perpetua. Se rumorea que los contrabandistas y piratas encuentran refugio seguro aquí, lejos de la mirada del Rey. El faro antiguo rara vez se enciende, guiando solo a aquellos que conocen los verdaderos caminos del mar.',
    },
    {
        title: 'Brisamar', top: '73.57%', left: '37.53%', color: '#38bdf8', type: 'city',
    },
    {
        title: 'Ráfaga del Sur', top: '59.51%', left: '34.81%', color: '#f59e0b', type: 'city',
    },
    {
        title: 'Calaverna', top: '33.70%', left: '40.10%', color: '#a8a29e', type: 'city',
    },
    {
        title: 'Paso de Thanemor', top: '23.52%', left: '38.09%', color: '#d6d3d1', type: 'city',
    },
    {
        title: 'Arqueologos de Prontera', top: '46.77%', left: '18.01%', color: '#ef4444', type: 'camp',
    },
];

async function seedPois() {
    await sequelize.sync();
    let created = 0, updated = 0;
    for (const m of MARKERS) {
        const [poi, wasCreated] = await PointOfInterest.findOrCreate({ where: { title: m.title }, defaults: m });
        if (!wasCreated) { Object.assign(poi, m); await poi.save(); updated++; } else { created++; }
    }
    console.log(`POIs: ${created} creados, ${updated} actualizados (de ${MARKERS.length}).`);
}

module.exports = { seedPois, MARKERS };

// Permite correrlo directo: node seed_pois.js
if (require.main === module) {
    seedPois().then(() => process.exit(0)).catch((e) => { console.error('Error sembrando POIs:', e); process.exit(1); });
}
