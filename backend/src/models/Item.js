import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export class Item extends Model {}

Item.init(
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
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('consumable', 'weapon', 'misc'),
      allowNull: false,
      defaultValue: 'misc',
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Item',
    tableName: 'items',
    indexes: [
      {
        fields: ['campaign_id', 'type'],
      },
      {
        fields: ['campaign_id', 'name'],
      },
    ],
  },
)
