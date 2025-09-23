import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export class ScenarioImage extends Model {}

ScenarioImage.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    scenarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'scenario_id',
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
    },
  },
  {
    sequelize,
    modelName: 'ScenarioImage',
    tableName: 'scenario_images',
    indexes: [
      {
        fields: ['scenario_id', 'sort_order'],
      },
    ],
  },
)
