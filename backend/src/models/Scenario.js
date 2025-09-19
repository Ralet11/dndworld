import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export class Scenario extends Model {}

Scenario.init(
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
    title: {
      type: DataTypes.STRING(140),
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    environmentTags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      field: 'environment_tags',
    },
    triggerConditions: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'trigger_conditions',
    },
    objective: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lootTable: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'loot_table',
    },
    tacticalMap: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'tactical_map',
      comment: 'Holds battle-map metadata, tokens, and fog of war settings',
    },
    mediaRefs: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'media_refs',
      comment: 'Stores URLs or asset identifiers for imagery and ambience',
    },
  },
  {
    sequelize,
    modelName: 'Scenario',
    tableName: 'scenarios',
  },
)
