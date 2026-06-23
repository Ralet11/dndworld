/**
 * export_seed.js
 *
 * Lee el estado actual de la base de datos y genera
 * server/data/seed_snapshot.json — un snapshot portable que el seeder
 * importa automáticamente en el próximo `npm start`.
 *
 * Uso:
 *   cd server && node export_seed.js
 *
 * Qué exporta:
 *   - Characters (PJs + NPCs) con abilityScores, skills, quests,
 *     inventory y equipment (resueltos por nombre, sin IDs crudos)
 *   - Items (todos)
 *   - MapState
 *   - PointsOfInterest
 *
 * Qué NO exporta (se regeneran solos):
 *   - Users (tienen passwords — quedan en el seeder base)
 *   - Spells (3000+ registros, se descargan de Open5e)
 *   - Classes / Races (están en compendium2024.js)
 *   - TimelineEvents, Scenes, Media (datos de sesión, no de setup)
 */

const path = require('path');
const fs   = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = require('./config/database');
const {
    Character, AbilityScore, Skill, Item, Quest,
    EquipmentSlots, MapState, PointOfInterest, User,
} = require('./models');

const SLOT_KEYS = [
    'helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves',
    'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon',
];

const run = async () => {
    await sequelize.authenticate();
    console.log('✔ Conectado a la base de datos');

    // ── 1. Items ────────────────────────────────────────────────────────────────
    const allItems = await Item.findAll({ raw: true });
    console.log(`  Items: ${allItems.length}`);

    // ── 2. Characters con relaciones ────────────────────────────────────────────
    const chars = await Character.findAll({
        include: [
            { model: AbilityScore, as: 'abilityScores' },
            { model: Skill,        as: 'skills' },
            { model: Quest,        as: 'quests' },
            { model: Item,         as: 'items' },
            { model: User },
        ],
    });
    console.log(`  Personajes: ${chars.length}`);

    // ── 3. Equipment slots con nombres de items ──────────────────────────────────
    const allEquipment = await EquipmentSlots.findAll({
        include: SLOT_KEYS.map(slot => ({ model: Item, as: slot })),
    });

    const equipByCharId = {};
    for (const eq of allEquipment) {
        const slots = {};
        for (const slot of SLOT_KEYS) {
            if (eq[slot]) slots[slot] = eq[slot].name;
        }
        equipByCharId[eq.character_id] = slots;
    }

    // ── 4. Resolver owner_id → nombre del propietario ───────────────────────────
    const charById = {};
    chars.forEach(c => { charById[c.id] = c.name; });

    // ── 5. Serializar personajes ─────────────────────────────────────────────────
    const characters = chars.map(char => {
        const c = char.toJSON();
        return {
            // Identidad
            name:            c.name,
            race:            c.race,
            race_slug:       c.race_slug,
            class:           c.class,
            class_slug:      c.class_slug,
            archetype_slug:  c.archetype_slug,
            subrace:         c.subrace,
            background:      c.background,
            alignment:       c.alignment,
            origin:          c.origin,
            npc_type:        c.npc_type,
            is_npc:          c.is_npc,
            is_active:       c.is_active,

            // FK resueltas por nombre (no por ID)
            user_email:      char.User?.email   ?? null,
            owner_name:      c.owner_id ? (charById[c.owner_id] ?? null) : null,

            // Stats
            level:           c.level,
            xp:              c.xp,
            gold:            c.gold,
            hp_current:      c.hp_current,
            hp_max:          c.hp_max,
            hp_temp:         c.hp_temp,
            ac_base:         c.ac_base,
            speed:           c.speed,
            initiative_bonus: c.initiative_bonus,

            // Texto narrativo
            notes:           c.notes,
            abilities_text:  c.abilities_text,
            custom_features: c.custom_features,

            // Imágenes
            image_url:       c.image_url,
            base_body_url:   c.base_body_url,

            // Magia
            spell_slots:     c.spell_slots,
            spells_known:    c.spells_known,
            spells_prepared: c.spells_prepared,

            // Elecciones
            classes:         c.classes,
            talent_choices:  c.talent_choices,
            feature_choices: c.feature_choices,

            // ── Relaciones ──────────────────────────────────────────────────────
            abilityScores: (c.abilityScores || []).map(s => ({
                ability:    s.ability,
                base_value: s.base_value,
            })),

            skills: (c.skills || []).map(s => ({
                name:              s.name,
                proficiency_level: s.proficiency_level,
            })),

            quests: (c.quests || []).map(q => ({
                title:       q.title,
                type:        q.type,
                status:      q.status,
                npc_name:    q.npc_name,
                description: q.description,
                objectives:  q.objectives,
                rewards:     q.rewards,
            })),

            inventory: (c.items || []).map(i => ({
                item_name: i.name,
                quantity:  i.CharacterInventory?.quantity ?? 1,
            })),

            equipment: equipByCharId[c.id] ?? {},
        };
    });

    // ── 6. MapState ─────────────────────────────────────────────────────────────
    const mapStateRaw = await MapState.findByPk(1, { raw: true });

    // ── 7. Points of Interest ───────────────────────────────────────────────────
    const pois = await PointOfInterest.findAll({ raw: true });
    console.log(`  POIs: ${pois.length}`);

    // ── 8. Armar snapshot ────────────────────────────────────────────────────────
    const snapshot = {
        exported_at: new Date().toISOString(),
        items:       allItems.map(({ id, createdAt, updatedAt, created_at, updated_at, ...rest }) => rest),
        characters,
        mapState:    mapStateRaw
            ? (({ id, createdAt, updatedAt, created_at, updated_at, ...rest }) => rest)(mapStateRaw)
            : null,
        pois:        pois.map(({ id, createdAt, updatedAt, created_at, updated_at, ...rest }) => rest),
    };

    // ── 9. Escribir archivo ──────────────────────────────────────────────────────
    const outDir  = path.join(__dirname, 'data');
    const outPath = path.join(outDir, 'seed_snapshot.json');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf8');

    console.log(`\n✅ Snapshot guardado en: ${outPath}`);
    console.log(`   ${characters.length} personajes · ${allItems.length} items · ${pois.length} POIs`);
    console.log(`   Exportado: ${snapshot.exported_at}`);

    await sequelize.close();
};

run().catch(err => {
    console.error('❌ Error exportando:', err);
    process.exit(1);
});
