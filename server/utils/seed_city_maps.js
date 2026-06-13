const sequelize = require('../config/database');
const PointOfInterest = require('../models/PointOfInterest');

/**
 * Mapa de imágenes de las ciudades: { "Título exacto del POI": "URL del mapa" }.
 * Poné acá la URL de la imagen del mapa de cada ciudad (Cloudinary o cualquier
 * URL pública). Idempotente: actualiza map_image por título.
 *
 * Ejemplo:
 *   'Prontera': 'https://res.cloudinary.com/doqyrz0sg/image/upload/v.../prontera.png',
 */
const CITY_MAPS = {
    'Prontera': 'https://res.cloudinary.com/doqyrz0sg/image/upload/v1781330863/ChatGPT_Image_13_jun_2026_03_07_32_a.m._angdrx.png',
    'Pantano Hachoverde': 'https://res.cloudinary.com/doqyrz0sg/image/upload/v1781332217/ChatGPT_Image_13_jun_2026_03_29_51_a.m._vtw5w6.png',
    'Costa sombría': 'https://res.cloudinary.com/doqyrz0sg/image/upload/v1781329427/ChatGPT_Image_13_jun_2026_02_37_07_a.m._glhakw.png',
};

async function seedCityMaps() {
    const titles = Object.keys(CITY_MAPS).filter((t) => CITY_MAPS[t]);
    let updated = 0;
    for (const title of titles) {
        const [n] = await PointOfInterest.update(
            { map_image: CITY_MAPS[title] },
            { where: { title } }
        );
        if (n > 0) updated++;
        else console.warn(`  No se encontró la ciudad "${title}".`);
    }
    console.log(`Mapas de ciudad actualizados: ${updated}/${titles.length}.`);
    return updated;
}

module.exports = { seedCityMaps, CITY_MAPS };

if (require.main === module) {
    require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
    (async () => {
        try {
            await sequelize.authenticate();
            await seedCityMaps();
            process.exit(0);
        } catch (e) {
            console.error('Error:', e.message);
            process.exit(1);
        }
    })();
}
