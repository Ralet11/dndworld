const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Skill = sequelize.define('Skill', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    proficiency_level: {
        type: DataTypes.FLOAT, // 0: None, 1: Proficient, 2: Expertise, 0.5: Jack
        defaultValue: 0
    }
}, {
    timestamps: false
});

module.exports = Skill;
