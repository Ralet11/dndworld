import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export class Campaign extends Model {}

Campaign.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'archived'),
      allowNull: false,
      defaultValue: 'draft',
    },
    dmId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'dm_id',
    },
    clockState: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'clock_state',
      comment: 'Stores in-game time, phase of day, and pacing metadata',
    },
    settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Campaign-level configuration such as house rules and automation toggles',
    },
  },
  {
    sequelize,
    modelName: 'Campaign',
    tableName: 'campaigns',
  },
)
