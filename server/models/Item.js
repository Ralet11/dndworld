const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Item = sequelize.define('Item', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('Arma', 'Armadura', 'Consumible', 'Objeto Mágico', 'Otro'),
        defaultValue: 'Otro'
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    rarity: {
        type: DataTypes.ENUM('Común', 'Poco Común', 'Raro', 'Muy Raro', 'Legendario'),
        defaultValue: 'Común'
    },
    weight: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    description: {
        type: DataTypes.TEXT
    },
    image_url: {
        type: DataTypes.STRING
    },
    stat_bonuses: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    use_effects: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
});

module.exports = Item;
