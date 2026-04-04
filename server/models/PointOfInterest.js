const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PointOfInterest = sequelize.define('PointOfInterest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    top: {
        type: DataTypes.STRING,
        allowNull: false
    },
    left: {
        type: DataTypes.STRING,
        allowNull: false
    },
    color: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '#f59e0b'
    },
    image: {
        type: DataTypes.STRING,
        allowNull: true, // Will store image URL, optional
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true, // Optional lore/description (basic snippet)
    },
    dmDescription: {
        type: DataTypes.TEXT,
        allowNull: true, // Flavor text written by DM shown in italics
    },
    partyKnowledge: {
        type: DataTypes.TEXT,
        allowNull: true, // Information acquired by the entire party
    },
    type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'city'
    }
}, {
    timestamps: true
});

module.exports = PointOfInterest;
