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

// Character Relationships
Character.belongsTo(Class, { foreignKey: 'class_slug', targetKey: 'slug', as: 'classData' });
Character.belongsTo(Race, { foreignKey: 'race_slug', targetKey: 'slug', as: 'raceData' });

Character.hasMany(AbilityScore, { foreignKey: 'character_id', as: 'abilityScores' });
AbilityScore.belongsTo(Character, { foreignKey: 'character_id' });

Character.hasMany(Skill, { foreignKey: 'character_id', as: 'skills' });
Skill.belongsTo(Character, { foreignKey: 'character_id' });

Character.hasMany(Quest, { foreignKey: 'character_id', as: 'quests' });
Quest.belongsTo(Character, { foreignKey: 'character_id' });

// Inventory relationship
Character.belongsToMany(Item, { through: 'CharacterInventory', as: 'items', foreignKey: 'character_id' });
Item.belongsToMany(Character, { through: 'CharacterInventory', foreignKey: 'item_id' });

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

// User POI Lore Data
User.belongsToMany(PointOfInterest, { through: UserPoiData, foreignKey: 'userId', as: 'knownLocations' });
PointOfInterest.belongsToMany(User, { through: UserPoiData, foreignKey: 'poiId', as: 'knowledgeableUsers' });

User.hasMany(UserPoiData, { foreignKey: 'userId', as: 'poiData' });
UserPoiData.belongsTo(User, { foreignKey: 'userId' });

PointOfInterest.hasMany(UserPoiData, { foreignKey: 'poiId', as: 'userData' });
UserPoiData.belongsTo(PointOfInterest, { foreignKey: 'poiId' });

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
    UserPoiData
};
