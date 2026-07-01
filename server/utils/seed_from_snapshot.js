/**
 * seed_from_snapshot.js
 *
 * Importa server/data/seed_snapshot.json a la base de datos.
 * Lo llama el seeder principal si el archivo existe.
 *
 * Es portable: resuelve relaciones por nombres/titulos/emails en lugar de IDs.
 */

const path = require('path');
const fs = require('fs');
const sequelize = require('../config/database');
const {
    Character, AbilityScore, Skill, Item, Quest,
    EquipmentSlots, MapState, PointOfInterest, User,
} = require('../models');

const SNAPSHOT_PATH = path.join(__dirname, '../data/seed_snapshot.json');

const SLOT_KEYS = [
    'helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves',
    'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon',
];

const CharacterInventory = sequelize.models.CharacterInventory;

const seedFromSnapshot = async () => {
    if (!fs.existsSync(SNAPSHOT_PATH)) return;

    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    console.log(`[snapshot] Importando snapshot del ${snap.exported_at}`);

    // 1. Items
    const itemNameToId = {};
    for (const iData of (snap.items || [])) {
        const [item] = await Item.findOrCreate({
            where: { name: iData.name },
            defaults: iData,
        });
        await item.update(iData);
        itemNameToId[item.name] = item.id;
    }
    console.log(`[snapshot]   Items: ${Object.keys(itemNameToId).length}`);

    // 2. Users: email -> id
    const allUsers = await User.findAll();
    const userEmailToId = {};
    allUsers.forEach((user) => {
        userEmailToId[user.email] = user.id;
    });

    // 3. Characters
    const charNameToId = {};

    for (const cData of (snap.characters || [])) {
        const defaults = {
            race: cData.race,
            race_slug: cData.race_slug,
            class: cData.class,
            class_slug: cData.class_slug,
            archetype_slug: cData.archetype_slug,
            subrace: cData.subrace,
            background: cData.background,
            alignment: cData.alignment,
            origin: cData.origin,
            npc_type: cData.npc_type,
            is_npc: cData.is_npc,
            is_active: cData.is_active,
            level: cData.level,
            xp: cData.xp,
            gold: cData.gold,
            hp_current: cData.hp_current,
            hp_max: cData.hp_max,
            hp_temp: cData.hp_temp,
            ac_base: cData.ac_base,
            speed: cData.speed,
            initiative_bonus: cData.initiative_bonus,
            notes: cData.notes,
            abilities_text: cData.abilities_text,
            custom_features: cData.custom_features,
            image_url: cData.image_url,
            base_body_url: cData.base_body_url,
            spell_slots: cData.spell_slots,
            spells_known: cData.spells_known,
            spells_prepared: cData.spells_prepared,
            classes: cData.classes,
            talent_choices: cData.talent_choices,
            feature_choices: cData.feature_choices,
            UserId: cData.user_email ? (userEmailToId[cData.user_email] ?? null) : null,
        };

        const [char] = await Character.findOrCreate({
            where: { name: cData.name },
            defaults,
        });
        await char.update(defaults);
        charNameToId[char.name] = char.id;
    }

    // Resolver owner_name -> owner_id
    for (const cData of (snap.characters || [])) {
        if (cData.owner_name && charNameToId[cData.owner_name] && charNameToId[cData.name]) {
            await Character.update(
                { owner_id: charNameToId[cData.owner_name] },
                { where: { id: charNameToId[cData.name] } }
            );
        }
    }
    console.log(`[snapshot]   Personajes: ${Object.keys(charNameToId).length}`);

    // 3.5. Estado global del mapa
    if (snap.mapState) {
        const [mapState] = await MapState.findOrCreate({
            where: { id: 1 },
            defaults: { id: 1, ...snap.mapState },
        });
        await mapState.update(snap.mapState);
        console.log('[snapshot]   MapState: restaurado');
    }

    // 3.6. POIs
    let poiCount = 0;
    for (const poiData of (snap.pois || [])) {
        const [poi] = await PointOfInterest.findOrCreate({
            where: { title: poiData.title },
            defaults: poiData,
        });
        await poi.update(poiData);
        poiCount++;
    }
    if (poiCount) console.log(`[snapshot]   POIs: ${poiCount}`);

    // 4. Ability scores, skills, quests
    for (const cData of (snap.characters || [])) {
        const charId = charNameToId[cData.name];
        if (!charId) continue;

        for (const scoreData of (cData.abilityScores || [])) {
            const [score] = await AbilityScore.findOrCreate({
                where: { character_id: charId, ability: scoreData.ability },
                defaults: { ...scoreData, character_id: charId },
            });
            await score.update({ base_value: scoreData.base_value });
        }

        for (const skillData of (cData.skills || [])) {
            const [skill] = await Skill.findOrCreate({
                where: { character_id: charId, name: skillData.name },
                defaults: { ...skillData, character_id: charId },
            });
            await skill.update({ proficiency_level: skillData.proficiency_level });
        }

        for (const questData of (cData.quests || [])) {
            const [quest] = await Quest.findOrCreate({
                where: { character_id: charId, title: questData.title },
                defaults: { ...questData, character_id: charId },
            });
            await quest.update(questData);
        }
    }

    // 5. Inventory
    for (const cData of (snap.characters || [])) {
        const charId = charNameToId[cData.name];
        if (!charId) continue;

        for (const invData of (cData.inventory || [])) {
            const itemId = itemNameToId[invData.item_name];
            if (!itemId) continue;

            const quantity = invData.quantity ?? 1;
            if (CharacterInventory) {
                const [link] = await CharacterInventory.findOrCreate({
                    where: { character_id: charId, item_id: itemId },
                    defaults: { character_id: charId, item_id: itemId, quantity },
                });
                await link.update({ quantity });
                continue;
            }

            const char = await Character.findByPk(charId);
            const item = await Item.findByPk(itemId);
            if (!char || !item) continue;

            const has = await char.hasItem(item);
            if (!has) await char.addItem(item, { through: { quantity } });
        }
    }

    // 6. Equipment
    for (const cData of (snap.characters || [])) {
        const charId = charNameToId[cData.name];
        if (!charId || !cData.equipment || !Object.keys(cData.equipment).length) continue;

        const [eq] = await EquipmentSlots.findOrCreate({ where: { character_id: charId } });
        const updates = {};

        for (const slot of SLOT_KEYS) {
            const itemName = cData.equipment[slot];
            if (itemName && itemNameToId[itemName]) {
                updates[`${slot}_id`] = itemNameToId[itemName];
            }
        }

        if (Object.keys(updates).length) await eq.update(updates);
    }

    console.log('[snapshot] Importacion completa');
};

module.exports = seedFromSnapshot;
