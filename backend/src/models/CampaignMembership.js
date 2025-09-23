import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export class CampaignMembership extends Model {}

CampaignMembership.init(
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    roleInCampaign: {
      type: DataTypes.ENUM('dm', 'player'),
      allowNull: false,
      defaultValue: 'player',
      field: 'role_in_campaign',
    },
    status: {
      type: DataTypes.ENUM('invited', 'accepted'),
      allowNull: false,
      defaultValue: 'invited',
    },
  },
  {
    sequelize,
    modelName: 'CampaignMembership',
    tableName: 'campaign_memberships',
    indexes: [
      {
        unique: true,
        fields: ['campaign_id', 'user_id'],
      },
    ],
  },
)
