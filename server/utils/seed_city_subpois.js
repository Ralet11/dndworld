const sequelize = require('../config/database');
const PointOfInterest = require('../models/PointOfInterest');

// Color por tipo de sub-POI (coincide con los íconos del mapa).
const COLOR = { npc: '#3E84D6', quest: '#F59E0B', shop: '#5BA86B', place: '#A855F7' };

// Posiciones iniciales repartidas (el DM las reacomoda arrastrando).
const SPREAD = [
    { top: '24.00%', left: '24.00%' },
    { top: '24.00%', left: '50.00%' },
    { top: '24.00%', left: '76.00%' },
    { top: '50.00%', left: '32.00%' },
    { top: '50.00%', left: '64.00%' },
    { top: '72.00%', left: '40.00%' },
    { top: '72.00%', left: '66.00%' },
];

// Sub-POIs por ciudad. Cada entrada: { title, type, description, [level], [top], [left] }.
//  - `level` solo aplica a misiones (type 'quest'); define el color del "!".
//  - `top`/`left` opcionales: si no están, se reparten con SPREAD.
const SUBPOIS = {
    'Prontera': [
        { title: 'Universidad de Prontera', type: 'place', description: 'Talleres, claustros, profesores brillantes y tesis que deberían estar prohibidas.' },
        { title: 'Casa Fortimer', type: 'place', description: 'La herida noble de la ciudad; impecable por fuera, podrida de tensión por dentro.' },
        { title: 'Gremio de Aventureros', type: 'place', description: 'Contratos, favores, competencia y encargos maquillados.' },
        { title: 'Cuartel de la Guardia', type: 'place', description: 'Disciplina, miedo y archivos parcialmente censurados.' },
        { title: 'Mercado y callejones', type: 'shop', description: 'Humo, gritos, oportunidades, carteristas y rumores.' },
        { title: 'Nodos de La Cadena', type: 'place', description: 'Falsificadores, intermediarios y puertas que aparecen solo para quien sabe buscarlas.' },
        { title: 'Taller de Rakion', type: 'place', description: 'Refugio, laboratorio, comedor improvisado y punto de reunión de su crew.' },
        // --- Misiones (el "!" cambia de color según el nivel del jugador) ---
        { title: 'Ratas en los archivos', type: 'quest', level: 4, top: '40.00%', left: '50.00%', description: 'El Cuartel pide limpiar las alimañas que roen los archivos censurados del sótano.' },
        { title: 'El encargo de los Fortimer', type: 'quest', level: 6, top: '60.00%', left: '20.00%', description: 'La casa noble ofrece oro por un trabajo que prefieren no escribir en ningún contrato.' },
        { title: 'Romper La Cadena', type: 'quest', level: 8, top: '60.00%', left: '80.00%', description: 'Desmantelar la red de falsificadores que mueve los hilos ocultos de la ciudad.' },
    ],
};

/** Crea los sub-POIs de cada ciudad (idempotente por título + parent_id). */
async function seedCitySubPois() {
    for (const [cityTitle, subs] of Object.entries(SUBPOIS)) {
        const city = await PointOfInterest.findOne({ where: { title: cityTitle, parent_id: null } });
        if (!city) { console.warn(`  No se encontró la ciudad "${cityTitle}".`); continue; }

        let created = 0;
        for (let i = 0; i < subs.length; i++) {
            const sub = subs[i];
            const pos = SPREAD[i % SPREAD.length];
            const defaults = {
                parent_id: city.id,
                top: sub.top || pos.top,
                left: sub.left || pos.left,
                color: COLOR[sub.type] || '#A855F7',
                type: sub.type,
                description: sub.description,
                level: sub.type === 'quest' ? (sub.level || 1) : null,
            };
            const [poi, wasCreated] = await PointOfInterest.findOrCreate({
                where: { title: sub.title, parent_id: city.id },
                defaults: { title: sub.title, ...defaults },
            });
            if (wasCreated) created++;
            else {
                // Actualiza descripción/tipo/color/nivel (no toca la posición ya ajustada por el DM).
                poi.description = sub.description;
                poi.type = sub.type;
                poi.color = COLOR[sub.type] || poi.color;
                if (sub.type === 'quest') poi.level = sub.level || 1;
                await poi.save();
            }
        }
        console.log(`  ${cityTitle}: ${created} sub-POIs creados (${subs.length} totales).`);
    }
}

module.exports = { seedCitySubPois, SUBPOIS };

if (require.main === module) {
    require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
    (async () => {
        try {
            await sequelize.authenticate();
            await seedCitySubPois();
            process.exit(0);
        } catch (e) {
            console.error('Error:', e.message);
            process.exit(1);
        }
    })();
}
