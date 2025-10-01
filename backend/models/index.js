const { DataTypes } = require("sequelize");
const { sequelize, ensureSchema } = require("../sequelize");
const load = (file) => require(`./${file}`)(sequelize, DataTypes);

const User = load("User");
const UserRole = load("UserRole");
const DmApplication = load("DmApplication");
const MediaAsset = load("MediaAsset");
const DmMessage = load("DmMessage");

const Race = load("Race");
const RaceTrait = load("RaceTrait");
const Class = load("Class");
const Talent = load("Talent");
const TalentEdge = load("TalentEdge");

const Ability = load("Ability");
const AbilityCost = load("AbilityCost");
const Card = load("Card");
const ClassAbility = load("ClassAbility");
const RaceAbility = load("RaceAbility");

const Creature = load("Creature");
const CreatureAttribute = load("CreatureAttribute");
const CreatureResource = load("CreatureResource");

const Character = load("Character");
const CharacterTalent = load("CharacterTalent");
const CharacterDeck = load("CharacterDeck");
const CharacterCard = load("CharacterCard");

const Item = load("Item");
const CharacterInventory = load("CharacterInventory");
const Wallet = load("Wallet");

const Npc = load("Npc");
const NpcSound = load("NpcSound");

const Campaign = load("Campaign");
const CampaignMembership = load("CampaignMembership");
const CampaignInvite = load("CampaignInvite");
const CampaignNews = load("CampaignNews");

const Session = load("Session");
const SessionParticipant = load("SessionParticipant");

const Scenario = load("Scenario");
const ScenarioLayer = load("ScenarioLayer");
const Map = load("Map");
const MapToken = load("MapToken");

const Quest = load("Quest");
const QuestStep = load("QuestStep");
const QuestReward = load("QuestReward");
const NpcQuest = load("NpcQuest");

// Associations
User.hasMany(UserRole, { foreignKey: "userId" });
UserRole.belongsTo(User, { foreignKey: "userId" });

User.hasMany(DmApplication, { foreignKey: "userId" });
DmApplication.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Campaign, { foreignKey: "ownerDmId", as: "ownedCampaigns" });
Campaign.belongsTo(User, { foreignKey: "ownerDmId", as: "ownerDM" });

Race.hasMany(RaceTrait, { foreignKey: "raceId" });
RaceTrait.belongsTo(Race, { foreignKey: "raceId" });

Class.hasMany(Talent, { foreignKey: "classId" });
Talent.belongsTo(Class, { foreignKey: "classId" });

Talent.hasMany(TalentEdge, { foreignKey: "fromTalentId", as: "edgesFrom" });
Talent.hasMany(TalentEdge, { foreignKey: "toTalentId", as: "edgesTo" });
TalentEdge.belongsTo(Talent, { foreignKey: "fromTalentId", as: "from" });
TalentEdge.belongsTo(Talent, { foreignKey: "toTalentId", as: "to" });

Ability.hasMany(AbilityCost, { foreignKey: "abilityId" });
AbilityCost.belongsTo(Ability, { foreignKey: "abilityId" });

Ability.hasMany(Card, { foreignKey: "abilityId" });
Card.belongsTo(Ability, { foreignKey: "abilityId" });

Class.belongsToMany(Ability, { through: ClassAbility, foreignKey: "classId" });
Ability.belongsToMany(Class, { through: ClassAbility, foreignKey: "abilityId" });

Race.belongsToMany(Ability, { through: RaceAbility, foreignKey: "raceId" });
Ability.belongsToMany(Race, { through: RaceAbility, foreignKey: "abilityId" });

Talent.hasMany(Card, { foreignKey: "talentId" });
Card.belongsTo(Talent, { foreignKey: "talentId" });

Creature.hasOne(CreatureAttribute, { foreignKey: "creatureId" });
CreatureAttribute.belongsTo(Creature, { foreignKey: "creatureId" });

Creature.hasMany(CreatureResource, { foreignKey: "creatureId" });
CreatureResource.belongsTo(Creature, { foreignKey: "creatureId" });

Creature.belongsTo(Race, { foreignKey: "raceId" });
Creature.belongsTo(Class, { foreignKey: "classId" });
Creature.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
Creature.belongsTo(MediaAsset, {
  as: "portrait",
  foreignKey: "portraitAssetId",
});

MediaAsset.hasMany(Creature, {
  as: "portraitCreatures",
  foreignKey: "portraitAssetId",
});

Creature.hasOne(Wallet, { foreignKey: "ownerCreatureId" });
Wallet.belongsTo(Creature, { foreignKey: "ownerCreatureId" });

Creature.hasOne(Character, { foreignKey: "id" });
Character.belongsTo(Creature, { foreignKey: "id" });

User.hasMany(Character, { foreignKey: "userId" });
Character.belongsTo(User, { foreignKey: "userId" });

Character.hasMany(CharacterTalent, { foreignKey: "characterId" });
CharacterTalent.belongsTo(Character, { foreignKey: "characterId" });
CharacterTalent.belongsTo(Talent, { foreignKey: "talentId" });

Character.hasMany(CharacterDeck, { foreignKey: "characterId" });
CharacterDeck.belongsTo(Character, { foreignKey: "characterId" });

CharacterDeck.hasMany(CharacterCard, { foreignKey: "deckId" });
CharacterCard.belongsTo(CharacterDeck, { foreignKey: "deckId" });
CharacterCard.belongsTo(Card, { foreignKey: "cardId" });

Character.hasMany(CharacterInventory, { foreignKey: "characterId" });
CharacterInventory.belongsTo(Character, { foreignKey: "characterId" });
CharacterInventory.belongsTo(Item, { foreignKey: "itemId" });

Creature.hasOne(Npc, { foreignKey: "id" });
Npc.belongsTo(Creature, { foreignKey: "id" });
Campaign.hasMany(Npc, { foreignKey: "campaignId", as: "npcs" });
Npc.belongsTo(Campaign, { foreignKey: "campaignId" });

Npc.hasMany(NpcSound, { foreignKey: "npcId" });
NpcSound.belongsTo(Npc, { foreignKey: "npcId" });

Campaign.hasMany(CampaignMembership, { foreignKey: "campaignId" });
CampaignMembership.belongsTo(Campaign, { foreignKey: "campaignId" });
User.hasMany(CampaignMembership, { foreignKey: "userId" });
CampaignMembership.belongsTo(User, { foreignKey: "userId" });
CampaignMembership.belongsTo(Character, { foreignKey: "characterId" });

Campaign.hasMany(CampaignInvite, { foreignKey: "campaignId" });
CampaignInvite.belongsTo(Campaign, { foreignKey: "campaignId" });

Campaign.hasMany(CampaignNews, { foreignKey: "campaignId" });
CampaignNews.belongsTo(Campaign, { foreignKey: "campaignId" });

Campaign.hasMany(Session, { foreignKey: "campaignId" });
Session.belongsTo(Campaign, { foreignKey: "campaignId" });

Session.belongsToMany(Creature, { through: SessionParticipant, foreignKey: "sessionId" });
Creature.belongsToMany(Session, { through: SessionParticipant, foreignKey: "creatureId" });

Session.hasOne(DmMessage, { foreignKey: "sessionId" });
DmMessage.belongsTo(Session, { foreignKey: "sessionId" });

Campaign.hasMany(Scenario, { foreignKey: "campaignId" });
Scenario.belongsTo(Campaign, { foreignKey: "campaignId" });

Scenario.hasMany(ScenarioLayer, { foreignKey: "scenarioId" });
ScenarioLayer.belongsTo(Scenario, { foreignKey: "scenarioId" });

ScenarioLayer.hasOne(Map, { foreignKey: "layerId" });
Map.belongsTo(ScenarioLayer, { foreignKey: "layerId" });

Map.hasMany(MapToken, { foreignKey: "mapId" });
MapToken.belongsTo(Map, { foreignKey: "mapId" });
MapToken.belongsTo(Creature, { foreignKey: "creatureId" });

Quest.hasMany(QuestStep, { foreignKey: "questId" });
QuestStep.belongsTo(Quest, { foreignKey: "questId" });

Quest.hasMany(QuestReward, { foreignKey: "questId" });
QuestReward.belongsTo(Quest, { foreignKey: "questId" });

Npc.belongsToMany(Quest, { through: NpcQuest, foreignKey: "npcId" });
Quest.belongsToMany(Npc, { through: NpcQuest, foreignKey: "questId" });

module.exports = {
  sequelize,
  ensureSchema,
  User, UserRole, DmApplication, MediaAsset, DmMessage,
  Race, RaceTrait, Class, Talent, TalentEdge,
  Ability, AbilityCost, Card, ClassAbility, RaceAbility,
  Creature, CreatureAttribute, CreatureResource,
  Character, CharacterTalent, CharacterDeck, CharacterCard,
  Item, CharacterInventory, Wallet,
  Npc, NpcSound,
  Campaign, CampaignMembership, CampaignInvite, CampaignNews,
  Session, SessionParticipant,
  Scenario, ScenarioLayer, Map, MapToken,
  Quest, QuestStep, QuestReward, NpcQuest
};
