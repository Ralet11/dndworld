const { Character, Item, AbilityScore, Skill, Quest, EquipmentSlots, MapState, User } = require('../models');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
    try {
        console.log('Checking database seed data...');

        // 0. Create/Ensure Map State
        await MapState.findOrCreate({ where: { id: 1 }, defaults: { party_x: 50, party_y: 50 } });

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
            { itemName: 'Laud Runico', slot: 'primary_weapon' },
            { itemName: 'Cañamo Somnoliento', slot: 'secondary_weapon' }
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

        console.log('Database verification/seeding complete.');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

module.exports = seedDatabase;
