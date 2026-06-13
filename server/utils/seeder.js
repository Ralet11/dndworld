const { Character, Item, AbilityScore, Skill, Quest, EquipmentSlots, MapState, User, Class, Race } = require('../models');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
    try {
        console.log('Checking database seed data...');

        // 0. Create/Ensure Map State
        await MapState.findOrCreate({ where: { id: 1 }, defaults: { party_x: 50, party_y: 50 } });

        // 0.05 Compendio LOCAL de razas y clases (D&D 2024) — upsert por slug,
        // no destructivo. Reemplaza la dependencia de Open5e.
        const compendium2024 = require('../data/compendium2024');
        for (const c of compendium2024.classes) {
            await Class.upsert({ ...c, archetypes: JSON.stringify(c.archetypes || []) });
        }
        for (const r of compendium2024.races) {
            await Race.upsert(r);
        }
        if (compendium2024.classes.length || compendium2024.races.length) {
            console.log(`Compendio 2024: ${compendium2024.classes.length} clases, ${compendium2024.races.length} razas (upsert).`);
        }

        // 0.1 Create Users (DM and Player)
        const passwordHash = bcrypt.hashSync('password', 8);

        const [dmUser] = await User.findOrCreate({
            where: { email: 'dm@dndworld.com' },
            defaults: {
                username: 'DungeonMaster',
                password_hash: passwordHash,
                role: 'DM'
            }
        });

        const [playerUser] = await User.findOrCreate({
            where: { email: 'player@dndworld.com' },
            defaults: {
                username: 'PlayerOne',
                password_hash: passwordHash,
                role: 'PLAYER'
            }
        });

        // 1. Ensure Paleas Exists
        // 1. Ensure Paleas Exists
        const [paleas, createdPaleas] = await Character.findOrCreate({
            where: { name: 'Paleas Mucron' },
            defaults: {
                race: 'Aasimar',
                class: 'Ranger 3 / Sorcerer 1',
                level: 4,
                hp_current: 18,
                hp_max: 18,
                ac_base: 14,
                speed: 30,
                is_npc: false,
                UserId: playerUser.id // Assign to Player
            }
        });

        // Ensure association if existed but not linked
        if (paleas && !paleas.UserId) {
            paleas.UserId = playerUser.id;
            await paleas.save();
        }

        if (createdPaleas) {
            console.log('Creating Paleas Mucron stats...');
            // 2. Add Ability Scores for Paleas
            await AbilityScore.bulkCreate([
                { character_id: paleas.id, ability: 'STR', base_value: 14 },
                { character_id: paleas.id, ability: 'DEX', base_value: 13 },
                { character_id: paleas.id, ability: 'CON', base_value: 9 },
                { character_id: paleas.id, ability: 'INT', base_value: 8 },
                { character_id: paleas.id, ability: 'WIS', base_value: 15 },
                { character_id: paleas.id, ability: 'CHA', base_value: 16 }
            ]);

            // 3. Add Skills
            await Skill.bulkCreate([
                { character_id: paleas.id, name: 'Atletismo', proficiency_level: 1 },
                { character_id: paleas.id, name: 'Percepción', proficiency_level: 1 },
                { character_id: paleas.id, name: 'Supervivencia', proficiency_level: 1 }
            ]);
        }

        // 4. Ensure Compendium Items Exist
        const compendium = require('../data/compendium');

        // Add default seed items to compendium dynamically if needed or just use compendium
        // Merging specific hardcoded items user might expect if they aren't in compendium yet (checking dupes by name)
        const initialItems = [
            { name: 'Espada Corta', type: 'Arma', rarity: 'Común', weight: 2, level: 1, description: 'Una espada ligera y afilada.' },
            { name: 'Armadura de Cuero', type: 'Armadura', rarity: 'Común', weight: 10, level: 1, description: 'Protección básica pero flexible.', stat_bonuses: { ac: 11 } },
            { name: 'Escudo de Madera', type: 'Armadura', rarity: 'Común', weight: 6, level: 1, description: 'Un escudo robusto.', stat_bonuses: { ac: 2 } },
            { name: 'Amuleto del Cuervo', type: 'Objeto Mágico', rarity: 'Raro', weight: 0.2, level: 3, description: 'Un amuleto negro que parece observar.' }
        ];

        // Combine logic: Compendium + Initial. Duplicate names in compendium override initial.
        const allItems = [...compendium];

        // Add initial items only if not already in compendium (by name)
        initialItems.forEach(initItem => {
            if (!allItems.find(i => i.name === initItem.name)) {
                allItems.push(initItem);
            }
        });

        const itemMap = {};
        for (const iData of allItems) {
            const [item] = await Item.findOrCreate({
                where: { name: iData.name },
                defaults: iData
            });
            itemMap[item.name] = item;
        }

        // 5. Ensure Paleas has specific items (Check presence before adding)
        // Helper to safely assign
        const safeAssign = async (char, item, qty = 1) => {
            const has = await char.hasItem(item);
            if (!has) await char.addItem(item, { through: { quantity: qty } });
        };

        if (itemMap['Espada Corta']) await safeAssign(paleas, itemMap['Espada Corta']);
        if (itemMap['Poción de Curación']) await safeAssign(paleas, itemMap['Poción de Curación']);
        if (itemMap['Armadura de Cuero']) await safeAssign(paleas, itemMap['Armadura de Cuero']);

        // 6. Ensure Equipment Slots (Only if empty/new)
        const equipment = await EquipmentSlots.findOne({ where: { character_id: paleas.id } });
        if (!equipment) {
            await EquipmentSlots.create({
                character_id: paleas.id,
                primary_weapon_id: itemMap['Espada Corta']?.id,
                chest_id: itemMap['Armadura de Cuero']?.id
            });
        }

        // 7. Ensure Quests Exist (SKIPPED - User wants no default quests)
        // Quests will be created manually by DM via the app.

        // 8. Ensure NPC Exists
        await Character.findOrCreate({
            where: { name: 'Goblin Saboteador' },
            defaults: {
                race: 'Goblin',
                class: 'Ladrón',
                level: 2,
                hp_current: 7,
                hp_max: 7,
                ac_base: 12,
                speed: 30,
                is_npc: true,
                notes: 'Un goblin escurridizo que roba suministros.'
            }
        });

        // 9. Remove Aragorn if exists (Cleanup)
        await Character.destroy({ where: { name: 'Aragorn' } });

        // 10. Create New Characters (Zik, Lucario, Rakion)
        const newChars = [
            {
                name: 'Zik',
                race: 'Mediano',
                class: 'Pícaro',
                level: 4,
                hp_current: 10,
                hp_max: 10,
                ac_base: 12,
                speed: 30,
                stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }
            },
            {
                name: 'Lucario',
                race: 'Tiefling',
                class: 'Bardo',
                level: 4,
                hp_current: 10,
                hp_max: 10,
                ac_base: 12,
                speed: 30,
                stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }
            },
            {
                name: 'Rakion Altarion',
                race: 'Humano',
                class: 'Artificer',
                level: 4,
                hp_current: 10,
                hp_max: 10,
                ac_base: 12,
                speed: 30,
                stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }
            }
        ];

        for (const charData of newChars) {
            const [char, created] = await Character.findOrCreate({
                where: { name: charData.name },
                defaults: {
                    race: charData.race,
                    class: charData.class,
                    level: charData.level,
                    hp_current: charData.hp_current,
                    hp_max: charData.hp_max,
                    ac_base: charData.ac_base,
                    speed: charData.speed,
                    is_npc: false,
                    UserId: playerUser.id // All new chars to Player for now
                }
            });

            if (char && !char.UserId) {
                char.UserId = playerUser.id;
                await char.save();
            }

            if (created) {
                console.log(`Creating stats for ${char.name}...`);
                const stats = Object.entries(charData.stats).map(([ability, val]) => ({
                    character_id: char.id,
                    ability,
                    base_value: val
                }));
                await AbilityScore.bulkCreate(stats);

                // Init Equipment Slots
                await EquipmentSlots.create({ character_id: char.id });
            }
        }

        // 11. Create Albert Obrien (Ally for Paleas)
        const paleasRef = await Character.findOne({ where: { name: 'Paleas Mucron' } });
        if (paleasRef) {
            const [albert, createdAlbert] = await Character.findOrCreate({
                where: { name: 'Albert Obrien' },
                defaults: {
                    race: 'Humano',
                    class: 'Guerrero',
                    level: 4,
                    hp_current: 20,
                    hp_max: 20,
                    ac_base: 16, // Chainmail + Shield
                    speed: 30,
                    is_npc: true,
                    owner_id: paleasRef.id,
                    notes: 'Un leal guerrero contratado para proteger a Paleas.'
                }
            });

            if (createdAlbert) {
                console.log('Creating stats for Albert Obrien...');
                await AbilityScore.bulkCreate([
                    { character_id: albert.id, ability: 'STR', base_value: 16 },
                    { character_id: albert.id, ability: 'DEX', base_value: 12 },
                    { character_id: albert.id, ability: 'CON', base_value: 14 },
                    { character_id: albert.id, ability: 'INT', base_value: 10 },
                    { character_id: albert.id, ability: 'WIS', base_value: 12 },
                    { character_id: albert.id, ability: 'CHA', base_value: 10 }
                ]);
                await EquipmentSlots.create({ character_id: albert.id });

                // Give him a sword
                const sword = await Item.findOne({ where: { name: 'Espada Corta' } }); // Reusing sword
                if (sword) {
                    await albert.addItem(sword, { through: { quantity: 1 } });
                }
            }
        }

        // 12. Custom Items Request (Lucario, Rakion, Zik, Paleas)
        const customItems = [
            { name: 'Laud Runico', type: 'Arma', rarity: 'Raro', description: '1d4+CAR, Distancia 30 pies.', level: 4 },
            { name: 'Cañamo Somnoliento', type: 'Objeto Mágico', rarity: 'Raro', description: 'Acción: CD 15 Sabiduría o dormido. Ataca al más cercano si falla.', level: 4 },
            { name: 'Capa de Algas', type: 'Armadura', rarity: 'Raro', description: 'El usuario puede respirar bajo el agua.', level: 4 },
            { name: 'Ungüento Musgoso', type: 'Consumible', rarity: 'Poco Común', description: 'Propiedades curativas naturales.', level: 2 },
            { name: 'Escupefuego', type: 'Arma', rarity: 'Raro', description: 'Arma capaz de lanzar proyectiles de fuego.', level: 4 },
            { name: 'Ballesta', type: 'Arma', rarity: 'Común', description: '1d8+DES perforante.', level: 1 },
            { name: 'Puñales Elficos', type: 'Arma', rarity: 'Raro', description: 'Hojas ligeras y letales.', level: 4 },
            { name: 'Espada Larga', type: 'Arma', rarity: 'Común', description: 'Versátil (1d8/1d10).', level: 1 }
        ];

        const customItemMap = {};
        for (const iData of customItems) {
            const [item] = await Item.findOrCreate({ where: { name: iData.name }, defaults: iData });
            customItemMap[item.name] = item;
        }

        const assignAndEquip = async (charName, itemsToEquip) => {
            const char = await Character.findOne({ where: { name: charName } });
            if (!char) return;

            const [equipment] = await EquipmentSlots.findOrCreate({ where: { character_id: char.id } });

            for (const req of itemsToEquip) {
                const item = customItemMap[req.itemName] || itemMap[req.itemName];
                if (item) {
                    await safeAssign(char, item, req.qty || 1);
                    if (req.slot) {
                        equipment[`${req.slot}_id`] = item.id;
                    }
                }
            }
            await equipment.save();
        };

        await assignAndEquip('Lucario', [
            { itemName: 'Armadura de Cuero', slot: 'chest' },
            { itemName: 'Laud Runico', slot: 'primary_weapon' },
            { itemName: 'Cañamo Somnoliento' } // queda en inventario, no equipado (no es arma)
        ]);

        await assignAndEquip('Rakion Altarion', [
            { itemName: 'Capa de Algas', slot: 'shoulders' },
            { itemName: 'Ungüento Musgoso', qty: 3 },
            { itemName: 'Escupefuego', slot: 'primary_weapon' }
        ]);

        await assignAndEquip('Zik', [
            { itemName: 'Ballesta', slot: 'primary_weapon' },
            { itemName: 'Puñales Elficos', slot: 'secondary_weapon' }
        ]);

        await assignAndEquip('Paleas Mucron', [
            { itemName: 'Espada Larga', slot: 'primary_weapon' },
            { itemName: 'Espada Corta', slot: 'secondary_weapon' }
        ]);

        // 12.5 Sistema de Armaduras 2025 — convertir/crear piezas con CA modular.
        const { buildArmorPiece, buildShield } = require('./armorBuilder');

        const armorSpecs = [
            // Set de tela para Lucario (bardo).
            buildArmorPiece({ name: 'Capucha de Lino', slot: 'helmet', armor_type: 'tela', rarity: 'Común', weight: 1, description: 'Una capucha sencilla de lino.' }),
            buildArmorPiece({ name: 'Túnica del Bardo', slot: 'chest', armor_type: 'tela', rarity: 'Raro', weight: 3, description: 'Tela fina bordada con hilo rúnico.', talent_stats: { espiritu: 4 }, ability: { tier: 'menor', nombre: 'Ojo de águila', descripcion: '+2 a Percepción. Sin desventaja en ataques a larga distancia.', tipo: 'pasivo' } }),
            buildArmorPiece({ name: 'Guantes de Seda', slot: 'gloves', armor_type: 'tela', rarity: 'Poco Común', weight: 0.5, description: 'Guantes ligeros y precisos.', talent_stats: { espiritu: 3 } }),
            buildArmorPiece({ name: 'Botas de Tela', slot: 'boots', armor_type: 'tela', rarity: 'Común', weight: 1, description: 'Botas blandas y silenciosas.' }),
            buildArmorPiece({ name: 'Capa de Juglar', slot: 'shoulders', armor_type: 'tela', rarity: 'Poco Común', weight: 1, description: 'Una capa colorida de juglar errante.', talent_stats: { espiritu: 3 } }),
            // Piezas existentes pasadas al sistema nuevo.
            buildArmorPiece({ name: 'Armadura de Cuero', slot: 'chest', armor_type: 'cuero', rarity: 'Común', weight: 10, description: 'Protección básica pero flexible.' }),
            buildArmorPiece({ name: 'Capa de Algas', slot: 'shoulders', armor_type: 'tela', rarity: 'Raro', weight: 1, description: 'Tejida con algas vivas.', talent_stats: { espiritu: 4 }, ability: { tier: 'menor', nombre: 'Aliento del mar', descripcion: 'Podés respirar bajo el agua indefinidamente.', tipo: 'pasivo' } }),
        ];
        const shieldSpecs = [
            buildShield({ name: 'Escudo de Madera', rarity: 'Común', shield_ca: 2, weight: 6, description: 'Un escudo robusto.' }),
        ];

        const armorUpserted = {};
        for (const spec of [...armorSpecs, ...shieldSpecs]) {
            const [item, created] = await Item.findOrCreate({ where: { name: spec.name }, defaults: spec });
            if (!created) {
                // Backfill: convierte el ítem existente al sistema nuevo.
                Object.assign(item, spec);
                await item.save();
            }
            armorUpserted[spec.name] = item;
        }

        // Equipar el set de tela en Lucario (reemplaza su chest de cuero por la túnica).
        const lucarioRef = await Character.findOne({ where: { name: 'Lucario' } });
        if (lucarioRef) {
            const [eqLuc] = await EquipmentSlots.findOrCreate({ where: { character_id: lucarioRef.id } });
            const setForLucario = ['Capucha de Lino', 'Túnica del Bardo', 'Guantes de Seda', 'Botas de Tela', 'Capa de Juglar'];
            for (const nm of setForLucario) {
                const it = armorUpserted[nm];
                if (it) {
                    await safeAssign(lucarioRef, it);
                    eqLuc[`${it.slot}_id`] = it.id;
                }
            }
            await eqLuc.save();
        }

        // 12.6 Backfill de datos de arma (2024) por nombre del ítem.
        const { weaponFields } = require('../data/weapons2024');
        const WEAPON_ALIAS = {
            'Ballesta': 'Ballesta Ligera',
            'Espada': 'Espada Larga',
            'Puñales Elficos': 'Daga',
        };
        const weaponItems = await Item.findAll({ where: { type: 'Arma' } });
        for (const it of weaponItems) {
            const wf = weaponFields(WEAPON_ALIAS[it.name] || it.name);
            if (wf) { Object.assign(it, wf); await it.save(); }
        }

        // 13. Backfill de `slot` en items + limpieza de equipos inválidos.
        const { deriveSlot, resolveSlotColumn } = require('./itemSlots');

        const slotItems = await Item.findAll();
        const slotItemById = {};
        for (const it of slotItems) {
            slotItemById[it.id] = it;
            if (!it.slot) {
                it.slot = deriveSlot(it);
                await it.save();
            }
        }

        // Si algún slot de equipo tiene un item NO equipable (p. ej. el Cañamo
        // que el seed viejo metió en la mano secundaria), lo liberamos.
        const equipCols = ['helmet_id', 'chest_id', 'shoulders_id', 'boots_id', 'pants_id', 'gloves_id', 'ring_1_id', 'ring_2_id', 'primary_weapon_id', 'secondary_weapon_id'];
        const slotEquip = await EquipmentSlots.findAll();
        for (const eq of slotEquip) {
            let changed = false;
            for (const col of equipCols) {
                const itemId = eq[col];
                if (itemId && slotItemById[itemId]) {
                    const logical = slotItemById[itemId].slot || deriveSlot(slotItemById[itemId]);
                    if (resolveSlotColumn(logical, {}) === null) {
                        eq[col] = null;
                        changed = true;
                    }
                }
            }
            if (changed) await eq.save();
        }

        // 14. Oro inicial para el party demo (solo si está en 0).
        await Character.update(
            { gold: 250 },
            { where: { name: ['Lucario', 'Rakion Altarion', 'Zik', 'Paleas Mucron'], gold: 0 } }
        );

        // 15. Backfill de class_slug / race_slug → para que Rasgos cargue las
        // features por nivel de la clase y los rasgos raciales. Idempotente.
        const CLASS_SLUG = {
            'Guerrero': 'fighter', 'Mago': 'wizard', 'Clérigo': 'cleric', 'Pícaro': 'rogue',
            'Bardo': 'bard', 'Paladín': 'paladin', 'Explorador': 'ranger', 'Hechicero': 'sorcerer',
            'Druida': 'druid', 'Bárbaro': 'barbarian', 'Monje': 'monk', 'Brujo': 'warlock',
            'Ranger': 'ranger', 'Rogue': 'rogue', 'Bard': 'bard',
        };
        const RACE_SLUG = {
            'Humano': 'human', 'Elfo': 'elf', 'Enano': 'dwarf', 'Mediano': 'halfling', 'Gnomo': 'gnome',
            'Dracónido': 'dragonborn', 'Tiefling': 'tiefling', 'Semiorco': 'half-orc', 'Semielfo': 'half-elf',
            'Aasimar': 'aasimar',
        };
        // Fallback: toma el primer token reconocible (ej. "Ranger 3 / Sorcerer 1" → ranger).
        const CLASS_VALUES = new Set(Object.values(CLASS_SLUG));
        const RACE_VALUES = new Set(Object.values(RACE_SLUG));
        const tokenSlug = (str, valueSet) => {
            for (const tok of String(str || '').toLowerCase().split(/[^a-z]+/)) {
                if (tok && valueSet.has(tok)) return tok;
            }
            return null;
        };
        const allChars = await Character.findAll();
        for (const char of allChars) {
            let changed = false;
            if (!char.class_slug && char.class) {
                const s = CLASS_SLUG[char.class] || tokenSlug(char.class, CLASS_VALUES);
                if (s) { char.class_slug = s; changed = true; }
            }
            if (!char.race_slug && char.race) {
                const s = RACE_SLUG[char.race] || tokenSlug(char.race, RACE_VALUES);
                if (s) { char.race_slug = s; changed = true; }
            }
            if (changed) await char.save();
        }

        // 15.5 POIs del mapa (idempotente, upsert por título).
        try {
            const { seedPois } = require('../seed_pois');
            await seedPois();
        } catch (e) {
            console.error('Error sembrando POIs:', e.message);
        }

        // 15.51 Sub-POIs de ciudades (zonas dentro del mapa de cada ciudad).
        try {
            const { seedCitySubPois } = require('./seed_city_subpois');
            await seedCitySubPois();
        } catch (e) {
            console.error('Error sembrando sub-POIs:', e.message);
        }

        // 15.6 Conjuros (Open5e, idempotente — solo descarga si la tabla está vacía).
        try {
            const { seedSpells } = require('./seed_spells');
            await seedSpells();
        } catch (e) {
            console.error('Error sembrando conjuros:', e.message);
        }

        // 15.7 Nombres de conjuro en español (mapa estático, idempotente).
        try {
            const { seedSpellNamesEs } = require('./seed_spell_names_es');
            await seedSpellNamesEs();
        } catch (e) {
            console.error('Error traduciendo nombres de conjuro:', e.message);
        }

        // 16. Paleas: multiclase Explorador 3 / Hechicero 1 (nivel total 4),
        // según su ficha: HP 22, subclase Cazador y elecciones tomadas.
        await Character.update(
            {
                classes: [{ slug: 'ranger', level: 3 }, { slug: 'sorcerer', level: 1 }],
                level: 4,
                class_slug: 'ranger',
                hp_max: 22,
                hp_current: 22,
                archetype_slug: 'hunter',
                feature_choices: {
                    'ranger:Estilo de Combate': 'two-weapon',
                    'ranger:Presa del Cazador': 'colossus-slayer',
                },
            },
            { where: { name: 'Paleas Mucron' } }
        );

        console.log('Database verification/seeding complete.');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

module.exports = seedDatabase;
