const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EquipmentSlots = sequelize.define('EquipmentSlots', {
    character_id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    helmet_id: { type: DataTypes.INTEGER },
    chest_id: { type: DataTypes.INTEGER },
    shoulders_id: { type: DataTypes.INTEGER },
    boots_id: { type: DataTypes.INTEGER },
    pants_id: { type: DataTypes.INTEGER },
    gloves_id: { type: DataTypes.INTEGER },
    ring_1_id: { type: DataTypes.INTEGER },
    ring_2_id: { type: DataTypes.INTEGER },
    primary_weapon_id: { type: DataTypes.INTEGER },
    secondary_weapon_id: { type: DataTypes.INTEGER }
}, {
    timestamps: false
});

module.exports = EquipmentSlots;
