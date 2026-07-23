const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Planos de Artificiero (u otro crafteo homebrew): conocimiento, no objeto
// fisico. Mismo patron que Spell + Character.spells_known, pero en vez de
// lanzarse, se "craftea" un Item real a partir de item_template cuando el
// personaje lo fabrica en mesa.
const Blueprint = sequelize.define('Blueprint', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    slug: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    // 'arma' | 'armadura' | 'utilidad' | 'consumible' | 'otro'
    category: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Notas de crafteo (tiempo, materiales, condiciones) — libre, homebrew.
    crafting_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Plantilla del Item que se crea al craftear este plano. Mismo shape que
    // los campos de Item (type, slot, armor_type, ca_value, stat_bonuses,
    // damage, properties, etc.), para pasarla directo a Item.create().
    item_template: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
}, {
    tableName: 'blueprints',
    timestamps: true
});

module.exports = Blueprint;
