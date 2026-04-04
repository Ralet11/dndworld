const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserPoiData = sequelize.define('UserPoiData', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    poiId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'PointOfInterests',
            key: 'id'
        }
    },
    specializedKnowledge: {
        type: DataTypes.TEXT,
        allowNull: true, // Written by the DM, exclusive to this character
    },
    userNotes: {
        type: DataTypes.TEXT,
        allowNull: true, // Written by the Player themselves
    }
}, {
    timestamps: true
});

module.exports = UserPoiData;
