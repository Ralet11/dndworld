module.exports = (sequelize, DataTypes) => sequelize.define("SessionParticipant", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sessionId: { type: DataTypes.UUID, allowNull: false },
  creatureId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID },
  characterId: { type: DataTypes.UUID },
  role: { type: DataTypes.ENUM("DM", "PLAYER"), allowNull: false, defaultValue: "PLAYER" },
  status: { type: DataTypes.STRING, defaultValue: "online" },
  userName: { type: DataTypes.STRING }
}, { tableName:"session_participants", schema:"dwd", timestamps:true });
