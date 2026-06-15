const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Character = sequelize.define('Character', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Foreign Keys for structured data
    race_slug: {
        type: DataTypes.STRING,
        allowNull: true
    },
    class_slug: {
        type: DataTypes.STRING,
        allowNull: true
    },
    archetype_slug: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Legacy / Display fields
    race: {
        type: DataTypes.STRING,
        defaultValue: 'Humano'
    },
    subrace: {
        type: DataTypes.STRING
    },
    class: {
        type: DataTypes.STRING,
        defaultValue: 'Guerrero'
    },
    background: {
        type: DataTypes.STRING
    },
    alignment: {
        type: DataTypes.STRING,
        defaultValue: 'Neutral'
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    xp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    gold: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    hp_current: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    hp_max: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    hp_temp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    ac_base: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    initiative_bonus: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    speed: {
        type: DataTypes.INTEGER,
        defaultValue: 30
    },
    inspiration: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_npc: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    npc_type: {
        type: DataTypes.ENUM('neutral', 'amigo', 'compañero', 'enemigo'),
        defaultValue: 'neutral',
        allowNull: true
    },
    origin: {
        type: DataTypes.STRING,
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT
    },
    abilities_text: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    owner_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    image_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Imagen de CUERPO ENTERO del PJ, usada como referencia de identidad para la
    // IA al renderizar el héroe con equipo. Es opcional: si falta, el renderer
    // cae a image_url (el avatar cuadrado del header).
    base_body_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Retrato generado por IA con el equipo puesto (composición de base_body_url/
    // image_url + imágenes de los ítems equipados). Se regenera con el botón
    // "Sincronizar héroe".
    rendered_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Firma del equipo con el que se generó rendered_url. Sirve para detectar si
    // el retrato quedó "desactualizado" respecto al equipo actual.
    rendered_signature: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Indicaciones libres del jugador para guiar el render de IA ("capa más
    // larga", "pose de perfil", etc.). Se guardan y se reaplican en cada render.
    render_prompt: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    image_scale: {
        type: DataTypes.FLOAT,
        defaultValue: 1.0
    },
    image_offset_x: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    image_offset_y: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // Magic System
    spell_slots: {
        type: DataTypes.JSON, // { 1: { max: 4, used: 0 }, 2: { max: 3, used: 1 } }
        defaultValue: {}
    },
    spells_known: {
        type: DataTypes.JSON, // ['magic-missile', 'fireball'] - List of slugs
        defaultValue: []
    },
    spells_prepared: {
        type: DataTypes.JSON, // ['mage-armor'] - List of slugs (Subset of known or from class list)
        defaultValue: []
    },
    // Talentos elegidos en los árboles de dote. Estructura:
    // { espiritu: { '5': 'a', '10': 'b' }, agilidad: {...}, aguante: {...} }
    talent_choices: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    // Multiclase: lista de clases con su nivel propio.
    // [{ slug: 'ranger', level: 4 }, { slug: 'sorcerer', level: 1 }]
    // Si está vacío, se usa class_slug + level (clase única, retrocompat).
    classes: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    // Elecciones de rasgos de clase con opciones (Estilo de Combate, Metamagia…).
    // Clave: "<classSlug>:<nombreRasgo>" → key elegida (o array si es multi).
    // Ej.: { "ranger:Estilo de Combate": "defense" }
    feature_choices: {
        type: DataTypes.JSON,
        defaultValue: {}
    }
});

module.exports = Character;
