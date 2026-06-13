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
    // POI padre (ciudad). null = nivel mundo. Si tiene parent_id, es un
    // sub-POI dentro del mapa de esa ciudad (NPC, misión, comercio, lugar).
    parent_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    // Imagen del MAPA de la ciudad (distinta de `image`, la miniatura).
    // Si un POI tiene map_image, se puede "entrar" a él.
    map_image: {
        type: DataTypes.STRING,
        allowNull: true,
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
    },
    // Nivel recomendado de la misión (solo para POIs type 'quest').
    // El color del marcador "!" se calcula en el cliente comparando este
    // nivel con el del jugador (amarillo / naranja / rojo).
    level: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
    }
}, {
    timestamps: true
});

module.exports = PointOfInterest;
