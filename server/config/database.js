const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'dndworld',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'postgres',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'postgres',
        logging: false, // Set to console.log if you want to see SQL queries
        define: {
            underscored: true, // naming_convention
            timestamps: true,
        },
    }
);

module.exports = sequelize;
