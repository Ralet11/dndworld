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
    // Slot lógico de equipo: helmet, chest, shoulders, boots, pants, gloves,
    // weapon, off_hand, ring, none. Si es null/none, no se puede equipar.
    slot: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Solo para armaduras: categoría (ligera/media/pesada) y material/tipo.
    armor_weight: {
        type: DataTypes.STRING,
        allowNull: true
    },
    armor_material: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Sistema de armaduras 2025 — tipo que define la CA por pieza y el esquive.
    // 'tela' (1d6) | 'cuero' (1d4) | 'malla' (sin esquive).
    armor_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // CA que aporta esta pieza (según su tipo y rareza). Tela 0.25–0.50,
    // cuero 0.50–0.75, malla 1.00–1.25. Para escudos usar stat_bonuses.ac.
    ca_value: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    // Stats de talento que alimentan los árboles de dote del personaje.
    talent_stats: {
        type: DataTypes.JSONB,
        defaultValue: {} // { espiritu, agilidad, aguante }
    },
    // Habilidad especial única de la pieza (independiente de los árboles).
    // null si no tiene. { nombre, tier: 'menor'|'mayor'|'legendaria', descripcion, tipo }.
    ability: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    // ── Solo para armas (D&D 2024) ──
    // Categoría: 'Simple' | 'Marcial'.
    weapon_category: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Daño base ('1d8') y tipo ('Cortante' | 'Perforante' | 'Contundente').
    damage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    damage_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Propiedades: ['Sutil', 'Ligera', 'Versátil (1d10)', 'Arrojadiza (6/18m)', …].
    properties: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    // Maestría del arma: { name, desc } (o null). Una sola por arma.
    mastery: {
        type: DataTypes.JSONB,
        allowNull: true
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
    // Tamaño relativo del objeto, para guiar la escala en el render de IA.
    // Valores esperados: 'Pequeño' | 'Mediano' | 'Grande' | 'Enorme'.
    size_hint: {
        type: DataTypes.STRING,
        allowNull: true
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
