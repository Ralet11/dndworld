const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sequelize = require('../config/database');
const {
    Character, GameAsset, GameSession, GameToken, Item, Media, PointOfInterest, Scene, TimelineEvent,
} = require('../models');
const { uploadBuffer } = require('../utils/s3Storage');

const dryRun = process.argv.includes('--dry-run');
const migrated = new Map();

function isCloudinaryUrl(value) {
    return typeof value === 'string' && /^https?:\/\/res\.cloudinary\.com\//i.test(value);
}

async function migrateUrl(url) {
    if (!isCloudinaryUrl(url)) return url;
    if (migrated.has(url)) return migrated.get(url);
    if (dryRun) {
        console.log(`[dry-run] ${url}`);
        migrated.set(url, url);
        return url;
    }
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000 });
    const originalName = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'cloudinary-image');
    const stored = await uploadBuffer(Buffer.from(response.data), {
        folder: 'migrated', originalName, contentType: response.headers['content-type'] || 'image/jpeg',
    });
    migrated.set(url, stored.url);
    console.log(`${url} -> ${stored.url}`);
    return stored.url;
}

async function migrateJson(value) {
    if (isCloudinaryUrl(value)) return migrateUrl(value);
    if (Array.isArray(value)) return Promise.all(value.map(migrateJson));
    if (value && typeof value === 'object') {
        const result = {};
        for (const [key, nested] of Object.entries(value)) result[key] = await migrateJson(nested);
        return result;
    }
    return value;
}

async function migrateModel(Model, fields) {
    const records = await Model.findAll();
    let changedRecords = 0;
    for (const record of records) {
        const changes = {};
        for (const field of fields) {
            const before = record.get(field);
            const after = typeof before === 'object' && before !== null ? await migrateJson(before) : await migrateUrl(before);
            if (JSON.stringify(after) !== JSON.stringify(before)) changes[field] = after;
        }
        if (Object.keys(changes).length) {
            changedRecords += 1;
            if (!dryRun) await record.update(changes);
        }
    }
    console.log(`${Model.name}: ${changedRecords} registros actualizados`);
}

async function run() {
    await sequelize.authenticate();
    await migrateModel(Character, ['image_url', 'base_body_url', 'rendered_url']);
    await migrateModel(Item, ['image_url']);
    await migrateModel(Media, ['url']);
    await migrateModel(Scene, ['imageUrl']);
    await migrateModel(PointOfInterest, ['image', 'map_image']);
    await migrateModel(GameAsset, ['url']);
    await migrateModel(GameToken, ['image_url']);
    await migrateModel(GameSession, ['shared_url', 'narrative_panels']);
    await migrateModel(TimelineEvent, ['metadata']);
    console.log(`${dryRun ? 'Detectadas' : 'Migradas'} ${migrated.size} URLs únicas de Cloudinary.`);
}

run().then(() => sequelize.close()).catch(error => {
    console.error('Falló la migración Cloudinary → S3:', error);
    process.exitCode = 1;
    sequelize.close();
});
