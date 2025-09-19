import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export class Npc extends Model {}

Npc.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    campaignId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'campaign_id',
    },
    scenarioId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'scenario_id',
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    creatureType: {
      type: DataTypes.STRING(60),
      allowNull: true,
      field: 'creature_type',
    },
    disposition: {
      type: DataTypes.ENUM('hostile', 'neutral', 'friendly', 'unknown'),
      allowNull: false,
      defaultValue: 'unknown',
    },
    statBlock: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'stat_block',
    },
    hooks: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Roleplaying cues, goals, and relationship notes',
    },
    lootProfile: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'loot_profile',
    },
    portraitUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'portrait_url',
    },
  },
  {
    sequelize,
    modelName: 'Npc',
    tableName: 'npcs',
  },
)
