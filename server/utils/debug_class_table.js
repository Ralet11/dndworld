const { Class } = require('../models');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/database');

const run = async () => {
    await sequelize.authenticate();
    const c = await Class.findByPk('fighter');
    if (c) {
        console.log('--- TABLE DATA ---');
        console.log(c.table);
        console.log('------------------');
    } else {
        console.log('Fighter not found');
    }
    process.exit(0);
};

run();
