const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

let client;

function getConfig() {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.AWS_REGION || 'us-east-2';
    if (!bucket) {
        const error = new Error('S3_BUCKET no está configurado en el servidor.');
        error.code = 'S3_NOT_CONFIGURED';
        throw error;
    }
    return {
        bucket,
        region,
        prefix: String(process.env.S3_PREFIX || 'production').replace(/^\/+|\/+$/g, ''),
        publicBaseUrl: String(process.env.S3_PUBLIC_BASE_URL || '').replace(/\/+$/g, ''),
    };
}

function getClient() {
    if (!client) {
        client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-2',
            endpoint: process.env.S3_ENDPOINT || undefined,
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        });
    }
    return client;
}

function safeSegment(value, fallback = 'file') {
    return String(value || fallback).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)
        .replace(/[.-]+$/g, '') || fallback;
}

function isAllowedMediaKey(key, prefix = process.env.S3_PREFIX || 'production') {
    if (typeof key !== 'string' || key.includes('\\') || key.includes('\0')) return false;
    const normalizedPrefix = String(prefix).replace(/^\/+|\/+$/g, '');
    if (!normalizedPrefix || !key.startsWith(`${normalizedPrefix}/`)) return false;
    return key.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}

function extensionFor(contentType, originalName = '') {
    const supplied = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '');
    if (supplied && supplied.length <= 8) return supplied;
    return ({
        'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
        'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav',
        'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/flac': '.flac',
    })[contentType] || '';
}

function publicUrlFor(key) {
    const { bucket, region, publicBaseUrl } = getConfig();
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return publicBaseUrl ? `${publicBaseUrl}/${encodedKey}` : `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

function createObjectKey({ folder = 'images', originalName, contentType, name }) {
    const { prefix } = getConfig();
    const ext = extensionFor(contentType, originalName);
    const base = safeSegment(name || path.basename(originalName || 'file', path.extname(originalName || '')));
    return `${prefix}/${safeSegment(folder, 'media')}/${Date.now()}-${randomUUID()}-${base}${ext}`;
}

async function uploadBuffer(buffer, { folder, originalName, contentType, name, cacheControl } = {}) {
    const { bucket } = getConfig();
    const key = createObjectKey({ folder, originalName, contentType, name });
    await getClient().send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        CacheControl: cacheControl || 'public, max-age=31536000, immutable',
    }));
    return { key, url: publicUrlFor(key), bucket };
}

async function uploadDataUri(dataUri, options = {}) {
    const match = String(dataUri || '').match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) throw new Error('El archivo generado no tiene un formato válido.');
    return uploadBuffer(Buffer.from(match[2], 'base64'), { ...options, contentType: match[1] });
}

async function uploadFile(filePath, options = {}) {
    return uploadBuffer(await fs.promises.readFile(filePath), { originalName: path.basename(filePath), ...options });
}

async function deleteObject(key) {
    if (!key) return;
    const { bucket } = getConfig();
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function getObject(key, range) {
    const { bucket } = getConfig();
    return getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range || undefined }));
}

async function headObject(key) {
    const { bucket } = getConfig();
    return getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

module.exports = {
    deleteObject,
    getConfig,
    getObject,
    headObject,
    isAllowedMediaKey,
    publicUrlFor,
    safeSegment,
    uploadBuffer,
    uploadDataUri,
    uploadFile,
};
