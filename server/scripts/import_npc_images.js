const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sequelize = require('../config/database');
const { Character } = require('../models');
const { cloudinary } = require('../utils/cloudinary');

const DEFAULT_MAP_PATH = path.join(__dirname, '..', 'data', 'npc-image-map.json');
const DEFAULT_IMAGES_DIR = path.join(__dirname, '..', 'data', 'npc-images');
const DEFAULT_REPORT_PATH = path.join(__dirname, '..', 'data', 'npc-image-import-report.json');

function parseArgs(argv) {
    const options = {
        map: DEFAULT_MAP_PATH,
        imagesDir: DEFAULT_IMAGES_DIR,
        report: DEFAULT_REPORT_PATH,
        dryRun: false,
        overwrite: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--dry-run') options.dryRun = true;
        else if (arg === '--overwrite') options.overwrite = true;
        else if (arg === '--map') options.map = path.resolve(argv[i + 1]);
        else if (arg === '--images-dir') options.imagesDir = path.resolve(argv[i + 1]);
        else if (arg === '--report') options.report = path.resolve(argv[i + 1]);
    }

    return options;
}

function slugify(value) {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function ensureFileExists(filePath, label) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${label} not found: ${filePath}`);
    }
}

async function uploadImage(filePath, character) {
    return cloudinary.uploader.upload(filePath, {
        folder: 'dndworld_uploads/npcs',
        public_id: `${character.id}-${slugify(character.name)}`,
        overwrite: true,
        resource_type: 'image',
    });
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    ensureFileExists(options.map, 'Map file');
    ensureFileExists(options.imagesDir, 'Images directory');

    const rawMap = JSON.parse(fs.readFileSync(options.map, 'utf8'));
    if (!Array.isArray(rawMap)) {
        throw new Error('Map file must contain a JSON array.');
    }

    await sequelize.authenticate();
    console.log(`Connected to database: ${sequelize.config.database}`);

    const report = {
        generatedAt: new Date().toISOString(),
        dryRun: options.dryRun,
        overwrite: options.overwrite,
        map: options.map,
        imagesDir: options.imagesDir,
        results: [],
    };

    for (const entry of rawMap) {
        const characterId = Number(entry.characterId);
        const fileName = entry.file;

        if (!characterId || !fileName) {
            report.results.push({
                status: 'invalid',
                characterId: entry.characterId ?? null,
                name: entry.name ?? null,
                file: fileName ?? null,
                reason: 'Missing characterId or file in mapping entry.',
            });
            continue;
        }

        const character = await Character.findByPk(characterId);
        if (!character) {
            report.results.push({
                status: 'missing-character',
                characterId,
                name: entry.name ?? null,
                file: fileName,
                reason: 'Character not found in database.',
            });
            continue;
        }

        if (!character.is_npc) {
            report.results.push({
                status: 'not-npc',
                characterId,
                name: character.name,
                file: fileName,
                reason: 'Character exists but is not marked as NPC.',
            });
            continue;
        }

        const localPath = path.join(options.imagesDir, fileName);
        if (!fs.existsSync(localPath)) {
            report.results.push({
                status: 'missing-file',
                characterId,
                name: character.name,
                file: fileName,
                reason: 'Image file was not found in images directory.',
            });
            continue;
        }

        if (character.image_url && !options.overwrite) {
            report.results.push({
                status: 'skipped-existing',
                characterId,
                name: character.name,
                file: fileName,
                imageUrl: character.image_url,
                reason: 'Character already has image_url. Use --overwrite to replace it.',
            });
            continue;
        }

        if (options.dryRun) {
            report.results.push({
                status: 'dry-run',
                characterId,
                name: character.name,
                file: fileName,
                action: character.image_url ? 'would-overwrite' : 'would-upload',
            });
            continue;
        }

        try {
            const uploaded = await uploadImage(localPath, character);
            character.image_url = uploaded.secure_url;
            await character.save();

            report.results.push({
                status: 'updated',
                characterId,
                name: character.name,
                file: fileName,
                imageUrl: uploaded.secure_url,
                publicId: uploaded.public_id,
            });

            console.log(`Updated NPC ${character.id} ${character.name}`);
        } catch (error) {
            report.results.push({
                status: 'error',
                characterId,
                name: character.name,
                file: fileName,
                reason: error.message,
            });
        }
    }

    fs.mkdirSync(path.dirname(options.report), { recursive: true });
    fs.writeFileSync(options.report, JSON.stringify(report, null, 2), 'utf8');

    const summary = report.results.reduce((acc, result) => {
        acc[result.status] = (acc[result.status] || 0) + 1;
        return acc;
    }, {});

    console.log('Summary:', summary);
    console.log(`Report written to ${options.report}`);
    await sequelize.close();
}

run().catch(async (error) => {
    console.error('NPC image import failed:', error.message);
    try {
        await sequelize.close();
    } catch (_) {
        // noop
    }
    process.exit(1);
});
