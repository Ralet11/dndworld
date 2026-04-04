const { Class } = require('../models');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/database');

const run = async () => {
    await sequelize.authenticate();
    const c = await Class.findByPk('fighter');
    if (c) {
        console.log('--- DESC DATA (First 2000 chars) ---');
        console.log(c.desc.substring(0, 2000));
        console.log('------------------');
    } else {
        console.log('Fighter not found');
    }
    process.exit(0);
};

run();
