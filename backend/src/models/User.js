import { DataTypes, Model } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: 'password_hash',
    },
    displayName: {
      type: DataTypes.STRING(80),
      allowNull: true,
      field: 'display_name',
    },
    role: {
      type: DataTypes.ENUM('admin', 'dm', 'player'),
      allowNull: false,
      defaultValue: 'player',
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'avatar_url',
    },
    preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  },
)
