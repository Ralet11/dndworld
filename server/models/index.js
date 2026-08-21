const Character = require('./Character');
const AbilityScore = require('./AbilityScore');
const Skill = require('./Skill');
const Item = require('./Item');
const EquipmentSlots = require('./EquipmentSlots');
const Quest = require('./Quest');
const StatusEffect = require('./StatusEffect');
const Media = require('./Media');
const MapState = require('./MapState');
const TimelineEvent = require('./TimelineEvent');
const Clock = require('./Clock');
const Faction = require('./Faction');
const User = require('./User');
const PointOfInterest = require('./PointOfInterest');
const UserPoiData = require('./UserPoiData');

const Scene = require('./Scene');
const Spell = require('./Spell');
const Blueprint = require('./Blueprint');
const Class = require('./Class');
const Race = require('./Race');
const GameSession = require('./GameSession');
const GameParticipant = require('./GameParticipant');
const GameToken = require('./GameToken');
const GameAsset = require('./GameAsset');
const GameAssetFolder = require('./GameAssetFolder');
const GameRoll = require('./GameRoll');
const GameCombatAction = require('./GameCombatAction');
const NpcAction = require('./NpcAction');
const CharacterAuditLog = require('./CharacterAuditLog');
const CharacterInventory = require('./CharacterInventory');
const AudioTrack = require('./AudioTrack');
const AssistantConversation = require('./AssistantConversation');
const AssistantMessage = require('./AssistantMessage');

// Character Relationships
Character.belongsTo(Class, { foreignKey: 'class_slug', targetKey: 'slug', as: 'classData' });
Character.belongsTo(Race, { foreignKey: 'race_slug', targetKey: 'slug', as: 'raceData' });

Character.hasMany(AbilityScore, { foreignKey: 'character_id', as: 'abilityScores' });
AbilityScore.belongsTo(Character, { foreignKey: 'character_id' });

Character.hasMany(Skill, { foreignKey: 'character_id', as: 'skills' });
Skill.belongsTo(Character, { foreignKey: 'character_id' });

Character.hasMany(NpcAction, { foreignKey: 'character_id', as: 'npcActions', onDelete: 'CASCADE' });
NpcAction.belongsTo(Character, { foreignKey: 'character_id', as: 'character' });

Character.hasMany(Quest, { foreignKey: 'character_id', as: 'quests' });
Quest.belongsTo(Character, { foreignKey: 'character_id' });

// Inventory relationship
Character.belongsToMany(Item, { through: CharacterInventory, as: 'items', foreignKey: 'character_id' });
Item.belongsToMany(Character, { through: CharacterInventory, foreignKey: 'item_id' });

// Equipment relationship
Character.hasOne(EquipmentSlots, { foreignKey: 'character_id', as: 'equipment' });
EquipmentSlots.belongsTo(Character, { foreignKey: 'character_id' });

// Detailed Slot associations for EquipmentSlots
const slots = [
    'helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves',
    'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon', 'back'
];

slots.forEach(slot => {
    EquipmentSlots.belongsTo(Item, { foreignKey: `${slot}_id`, as: slot });
});

// Status Effects
Character.belongsToMany(StatusEffect, { through: 'CharacterStatus', as: 'activeEffects', foreignKey: 'character_id' });
StatusEffect.belongsToMany(Character, { through: 'CharacterStatus', foreignKey: 'effect_id' });

// Scene Relationships
Scene.hasMany(TimelineEvent, { foreignKey: 'scene_id', as: 'events' });
TimelineEvent.belongsTo(Scene, { foreignKey: 'scene_id', as: 'scene' });

// Scene Participants (Many-to-Many)
Scene.belongsToMany(Character, { through: 'SceneParticipants', as: 'participants', foreignKey: 'scene_id' });
Character.belongsToMany(Scene, { through: 'SceneParticipants', as: 'activeScenes', foreignKey: 'character_id' });

// Timeline Relationships
TimelineEvent.belongsTo(Character, { foreignKey: 'author_id', as: 'author' });
Character.hasMany(TimelineEvent, { foreignKey: 'author_id', as: 'events' });

// User Relationships
User.hasMany(Character, { foreignKey: 'UserId', as: 'characters' });
Character.belongsTo(User, { foreignKey: 'UserId' });
Character.hasMany(CharacterAuditLog, { foreignKey: 'character_id', as: 'auditLogs', onDelete: 'CASCADE' });
CharacterAuditLog.belongsTo(Character, { foreignKey: 'character_id', as: 'character' });
CharacterAuditLog.belongsTo(User, { foreignKey: 'actor_user_id', as: 'actor' });

// User POI Lore Data
User.belongsToMany(PointOfInterest, { through: UserPoiData, foreignKey: 'userId', as: 'knownLocations' });
PointOfInterest.belongsToMany(User, { through: UserPoiData, foreignKey: 'poiId', as: 'knowledgeableUsers' });

User.hasMany(UserPoiData, { foreignKey: 'userId', as: 'poiData' });
UserPoiData.belongsTo(User, { foreignKey: 'userId' });

PointOfInterest.hasMany(UserPoiData, { foreignKey: 'poiId', as: 'userData' });
UserPoiData.belongsTo(PointOfInterest, { foreignKey: 'poiId' });

// Live game session relationships
GameSession.belongsTo(User, { foreignKey: 'dm_user_id', as: 'dm' });
User.hasMany(GameSession, { foreignKey: 'dm_user_id', as: 'hostedGameSessions' });
GameSession.hasMany(GameParticipant, { foreignKey: 'session_id', as: 'participants', onDelete: 'CASCADE' });
GameParticipant.belongsTo(GameSession, { foreignKey: 'session_id', as: 'session' });
GameParticipant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
GameParticipant.belongsTo(Character, { foreignKey: 'character_id', as: 'character' });
GameSession.hasMany(GameToken, { foreignKey: 'session_id', as: 'tokens', onDelete: 'CASCADE' });
GameToken.belongsTo(GameSession, { foreignKey: 'session_id', as: 'session' });
GameToken.belongsTo(Character, { foreignKey: 'character_id', as: 'character' });
GameToken.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });
GameSession.hasMany(GameAsset, { foreignKey: 'session_id', as: 'assets', onDelete: 'SET NULL' });
GameAsset.belongsTo(GameSession, { foreignKey: 'session_id', as: 'session', onDelete: 'SET NULL' });
User.hasMany(GameAssetFolder, { foreignKey: 'owner_user_id', as: 'gameAssetFolders', onDelete: 'CASCADE' });
GameAssetFolder.belongsTo(User, { foreignKey: 'owner_user_id', as: 'owner' });
GameAssetFolder.hasMany(GameAssetFolder, { foreignKey: 'parent_id', as: 'children', onDelete: 'RESTRICT' });
GameAssetFolder.belongsTo(GameAssetFolder, { foreignKey: 'parent_id', as: 'parent', onDelete: 'RESTRICT' });
GameAssetFolder.hasMany(GameAsset, { foreignKey: 'folder_id', as: 'assets', onDelete: 'SET NULL' });
GameAsset.belongsTo(GameAssetFolder, { foreignKey: 'folder_id', as: 'folder', onDelete: 'SET NULL' });
GameSession.hasMany(GameRoll, { foreignKey: 'session_id', as: 'rolls', onDelete: 'CASCADE' });
GameRoll.belongsTo(GameSession, { foreignKey: 'session_id', as: 'session' });
GameRoll.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
GameRoll.belongsTo(Character, { foreignKey: 'character_id', as: 'character' });
GameSession.hasMany(GameCombatAction, { foreignKey: 'session_id', as: 'combatActions', onDelete: 'CASCADE' });
GameCombatAction.belongsTo(GameSession, { foreignKey: 'session_id', as: 'session' });
GameCombatAction.belongsTo(User, { foreignKey: 'actor_user_id', as: 'actor' });
GameCombatAction.belongsTo(Character, { foreignKey: 'actor_character_id', as: 'actorCharacter' });
GameSession.belongsTo(AudioTrack, { foreignKey: 'audio_track_id', as: 'audioTrack' });
AudioTrack.hasMany(GameSession, { foreignKey: 'audio_track_id', as: 'gameSessions' });
AudioTrack.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

User.hasMany(AssistantConversation, { foreignKey: 'user_id', as: 'assistantConversations', onDelete: 'CASCADE' });
AssistantConversation.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });
AssistantConversation.hasMany(AssistantMessage, { foreignKey: 'conversation_id', as: 'messages', onDelete: 'CASCADE' });
AssistantMessage.belongsTo(AssistantConversation, { foreignKey: 'conversation_id', as: 'conversation' });

module.exports = {
    Character,
    AbilityScore,
    Skill,
    Item,
    EquipmentSlots,
    Quest,
    StatusEffect,
    Media,
    MapState,
    TimelineEvent,
    Clock,
    Faction,
    User,
    Scene,
    Spell,
    Blueprint,
    Class,
    Race,
    PointOfInterest,
    UserPoiData,
    GameSession,
    GameParticipant,
    GameToken,
    GameAsset,
    GameAssetFolder,
    GameRoll,
    GameCombatAction,
    NpcAction,
    CharacterAuditLog,
    CharacterInventory,
    AudioTrack,
    AssistantConversation,
    AssistantMessage
};
