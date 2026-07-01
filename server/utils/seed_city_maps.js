const { Op } = require('sequelize');
const sequelize = require('../config/database');
const PointOfInterest = require('../models/PointOfInterest');

/**
 * URLs públicas de mapas de ciudad.
 * Cada entrada admite aliases para tolerar cambios de naming entre seeds,
 * snapshots y lore manual.
 */
const CITY_MAPS = [
    {
        titles: ['Prontera'],
        url: 'https://res.cloudinary.com/doqyrz0sg/image/upload/v1781330863/ChatGPT_Image_13_jun_2026_03_07_32_a.m._angdrx.png',
    },
    {
        titles: ['Pantano Hachoverde'],
        url: 'https://res.cloudinary.com/doqyrz0sg/image/upload/v1781332217/ChatGPT_Image_13_jun_2026_03_29_51_a.m._vtw5w6.png',
    },
    {
        titles: ['Costa sombría', 'Costa Sombria', 'Costa Oscura'],
        url: 'https://res.cloudinary.com/doqyrz0sg/image/upload/v1781329427/ChatGPT_Image_13_jun_2026_02_37_07_a.m._glhakw.png',
    },
];

async function seedCityMaps() {
    let updated = 0;

    for (const city of CITY_MAPS) {
        const titles = city.titles.filter(Boolean);
        if (!titles.length || !city.url) continue;

        const [n] = await PointOfInterest.update(
            { map_image: city.url },
            {
                where: {
                    title: { [Op.in]: titles },
                },
            }
        );

        if (n > 0) updated += n;
        else console.warn(`  No se encontró ninguna ciudad para: ${titles.join(', ')}.`);
    }

    console.log(`Mapas de ciudad actualizados en ${updated} registro(s).`);
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
