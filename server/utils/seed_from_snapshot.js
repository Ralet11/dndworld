/**
 * seed_from_snapshot.js
 *
 * Importa server/data/seed_snapshot.json a la base de datos.
 * Llamado por el seeder principal si el archivo existe.
 * Es idempotente: usa findOrCreate + update para no duplicar.
 */

const path = require('path');
const fs   = require('fs');
const {
    Character, AbilityScore, Skill, Item, Quest,
    EquipmentSlots, User,
} = require('../models');

const SNAPSHOT_PATH = path.join(__dirname, '../data/seed_snapshot.json');

const SLOT_KEYS = [
    'helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves',
    'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon',
];

const seedFromSnapshot = async () => {
    if (!fs.existsSync(SNAPSHOT_PATH)) return;

    const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    console.log(`[snapshot] Importando snapshot del ${snap.exported_at}`);

    // ── 1. Items ───────────────────────────────────────────────────────────────
    const itemNameToId = {};
    for (const iData of (snap.items || [])) {
        const [item] = await Item.findOrCreate({
            where: { name: iData.name },
            defaults: iData,
        });
        // Actualiza campos que pudieron cambiar
        await item.update(iData);
        itemNameToId[item.name] = item.id;
    }
    console.log(`[snapshot]   Items: ${Object.keys(itemNameToId).length}`);

    // ── 2. Users: construir mapa email → id ────────────────────────────────────
    const allUsers = await User.findAll();
    const userEmailToId = {};
    allUsers.forEach(u => { userEmailToId[u.email] = u.id; });

    // ── 3. Characters ──────────────────────────────────────────────────────────
    const charNameToId = {};

    for (const cData of (snap.characters || [])) {
        const defaults = {
            race:            cData.race,
            race_slug:       cData.race_slug,
            class:           cData.class,
            class_slug:      cData.class_slug,
            archetype_slug:  cData.archetype_slug,
            subrace:         cData.subrace,
            background:      cData.background,
            alignment:       cData.alignment,
            origin:          cData.origin,
            npc_type:        cData.npc_type,
            is_npc:          cData.is_npc,
            is_active:       cData.is_active,
            level:           cData.level,
            xp:              cData.xp,
            gold:            cData.gold,
            hp_current:      cData.hp_current,
            hp_max:          cData.hp_max,
            hp_temp:         cData.hp_temp,
            ac_base:         cData.ac_base,
            speed:           cData.speed,
            initiative_bonus: cData.initiative_bonus,
            notes:           cData.notes,
            abilities_text:  cData.abilities_text,
            custom_features: cData.custom_features,
            image_url:       cData.image_url,
            base_body_url:   cData.base_body_url,
            spell_slots:     cData.spell_slots,
            spells_known:    cData.spells_known,
            spells_prepared: cData.spells_prepared,
            classes:         cData.classes,
            talent_choices:  cData.talent_choices,
            feature_choices: cData.feature_choices,
            UserId:          cData.user_email ? (userEmailToId[cData.user_email] ?? null) : null,
        };

        const [char] = await Character.findOrCreate({
            where: { name: cData.name },
            defaults,
        });
        await char.update(defaults);
        charNameToId[char.name] = char.id;
    }

    // Resolver owner_name → owner_id (segunda pasada, todos los chars ya existen)
    for (const cData of (snap.characters || [])) {
        if (cData.owner_name && charNameToId[cData.owner_name] && charNameToId[cData.name]) {
            await Character.update(
                { owner_id: charNameToId[cData.owner_name] },
                { where: { id: charNameToId[cData.name] } }
            );
        }
    }
    console.log(`[snapshot]   Personajes: ${Object.keys(charNameToId).length}`);

    // ── 4. AbilityScores, Skills, Quests ──────────────────────────────────────
    for (const cData of (snap.characters || [])) {
        const charId = charNameToId[cData.name];
        if (!charId) continue;

        // Ability scores: upsert por character_id + ability
        for (const s of (cData.abilityScores || [])) {
            const [score] = await AbilityScore.findOrCreate({
                where: { character_id: charId, ability: s.ability },
                defaults: { ...s, character_id: charId },
            });
            await score.update({ base_value: s.base_value });
        }

        // Skills: upsert por character_id + name
        for (const s of (cData.skills || [])) {
            const [skill] = await Skill.findOrCreate({
                where: { character_id: charId, name: s.name },
                defaults: { ...s, character_id: charId },
            });
            await skill.update({ proficiency_level: s.proficiency_level });
        }

        // Quests: upsert por character_id + title
        for (const q of (cData.quests || [])) {
            const [quest] = await Quest.findOrCreate({
                where: { character_id: charId, title: q.title },
                defaults: { ...q, character_id: charId },
            });
            await quest.update(q);
        }
    }

    // ── 5. Inventory ──────────────────────────────────────────────────────────
    for (const cData of (snap.characters || [])) {
        const charId = charNameToId[cData.name];
        if (!charId) continue;
        const char = await Character.findByPk(charId);
        if (!char) continue;

        for (const inv of (cData.inventory || [])) {
            const itemId = itemNameToId[inv.item_name];
            if (!itemId) continue;
            const item = await Item.findByPk(itemId);
            if (!item) continue;
            const has = await char.hasItem(item);
            if (!has) await char.addItem(item, { through: { quantity: inv.quantity ?? 1 } });
        }
    }

    // ── 6. Equipment slots ────────────────────────────────────────────────────
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

    console.log('[snapshot] ✅ Importación completa');
};

module.exports = seedFromSnapshot;
