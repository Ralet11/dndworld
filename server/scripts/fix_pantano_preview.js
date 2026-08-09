require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const { PointOfInterest } = require('../models');

const APPLY = process.argv.includes('--apply');

(async () => {
    const pantano = await PointOfInterest.findOne({ where: { title: 'Pantano Hachoverde' } });
    if (!pantano) throw new Error('No se encontró Pantano Hachoverde.');
    if (!pantano.map_image) throw new Error('Pantano Hachoverde no tiene un mapa interno para usar como miniatura.');

    const result = {
        mode: APPLY ? 'applied' : 'dry-run',
        id: pantano.id,
        title: pantano.title,
        before: { image: pantano.image, map_image: pantano.map_image },
        after: { image: pantano.map_image, map_image: pantano.map_image },
    };
    if (APPLY) await pantano.update({ image: pantano.map_image });
    console.log(JSON.stringify(result, null, 2));
})()
    .then(() => sequelize.close())
    .catch(async error => { console.error(error); await sequelize.close(); process.exit(1); });
