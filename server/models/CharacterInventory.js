const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CharacterInventory = sequelize.define('CharacterInventory', {
    character_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    item_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
}, {
    tableName: 'CharacterInventory',
});

module.exports = CharacterInventory;
