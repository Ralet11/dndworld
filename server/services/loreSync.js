const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.resumen']);
const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MANIFEST_VERSION = 1;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

function toPosix(value) {
    return String(value || '').replace(/\\/g, '/');
}

function sha256(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function isInside(root, candidate) {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function walkFiles(root) {
    if (!fs.existsSync(root)) return [];
    const result = [];
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true })
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            const absolute = path.join(current, entry.name);
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) pending.push(absolute);
            if (entry.isFile()) result.push(absolute);
        }
    }
    return result.sort((a, b) => toPosix(a).localeCompare(toPosix(b)));
}

function isSelectedText(relativePath) {
    const normalized = toPosix(relativePath);
    const extension = path.extname(normalized).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension)) return false;
    if (normalized === 'campaign/maestro.md') return true;
    if (normalized === 'campaign/chronology.txt') return true;
    if (normalized === 'campaign/resumen_campana.resumen') return true;
    return [
        'campaign/sessions/',
        'campaign/characters/',
        'campaign/npcs/',
        'campaign/cities/',
    ].some((prefix) => normalized.startsWith(prefix));
}

function referencedMediaPaths(sourceRoot, textFiles) {
    const references = new Set();
    const markdownMedia = /!\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\)/g;
    const plainMedia = /(?:^|[\s`"'(])([^\s`"')]+\.(?:png|jpe?g|webp|gif))(?:$|[\s`"'),])/gim;

    for (const absolute of textFiles) {
        const content = fs.readFileSync(absolute, 'utf8');
        const candidates = [];
        for (const expression of [markdownMedia, plainMedia]) {
            expression.lastIndex = 0;
            let match;
            while ((match = expression.exec(content))) candidates.push(match[1] || match[2]);
        }
        for (const rawReference of candidates) {
            let reference = rawReference.split('#')[0].split('?')[0];
            try {
                reference = decodeURIComponent(reference);
            } catch (_error) {
                continue;
            }
            if (/^(?:https?:|data:)/i.test(reference)) continue;
            const resolved = path.resolve(path.dirname(absolute), reference);
            if (!isInside(sourceRoot, resolved)) continue;
            const relative = toPosix(path.relative(sourceRoot, resolved));
            if (!relative.startsWith('campaign/')) continue;
            if (!MEDIA_EXTENSIONS.has(path.extname(relative).toLowerCase())) continue;
            if (!fs.existsSync(resolved) || !fs.lstatSync(resolved).isFile()) continue;
            references.add(relative);
        }
    }
    return [...references].sort();
}

function readGitState(sourceRoot) {
    try {
        const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: sourceRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        const status = execFileSync('git', ['status', '--porcelain'], {
            cwd: sourceRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        return { revision, dirty: Boolean(status), available: true };
    } catch (_error) {
        return { revision: null, dirty: null, available: false };
    }
}

function readPreviousManifest(manifestPath) {
    try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (_error) {
        return null;
    }
}

function generatedOracleContext(maestroContent, manifest) {
    const header = [
        '<!--',
        '  ARCHIVO GENERADO. No editar manualmente.',
        '  Fuente: ecos_de_la_guerra/campaign/maestro.md',
        `  Revision Ecos: ${manifest.sourceRevision || 'sin repositorio Git'}`,
        `  Huella seleccionada: ${manifest.selectionHash}`,
        '  Actualizar con: npm run lore:sync -- --source ../ecos_de_la_guerra --apply',
        '-->',
        '',
    ].join('\n');
    return Buffer.from(`${header}${maestroContent.toString('utf8').replace(/^\uFEFF/, '').trimEnd()}\n`, 'utf8');
}

function buildLoreSyncPlan({ sourceRoot, serverRoot }) {
    const resolvedSource = path.resolve(sourceRoot);
    const resolvedServer = path.resolve(serverRoot);
    const campaignRoot = path.join(resolvedSource, 'campaign');
    if (!fs.existsSync(campaignRoot) || !fs.statSync(campaignRoot).isDirectory()) {
        throw new Error(`La fuente no contiene campaign/: ${resolvedSource}`);
    }

    const allFiles = walkFiles(campaignRoot);
    const selectedText = allFiles.filter((absolute) => isSelectedText(toPosix(path.relative(resolvedSource, absolute))));
    const maestroPath = path.join(campaignRoot, 'maestro.md');
    if (!selectedText.includes(maestroPath)) {
        throw new Error('Falta campaign/maestro.md en la fuente de Ecos.');
    }

    const mediaRelative = referencedMediaPaths(resolvedSource, selectedText);
    const selected = [
        ...selectedText.map((absolute) => ({
            absolute,
            relative: toPosix(path.relative(resolvedSource, absolute)),
            category: 'lore',
            limit: MAX_TEXT_BYTES,
        })),
        ...mediaRelative.map((relative) => ({
            absolute: path.join(resolvedSource, ...relative.split('/')),
            relative,
            category: 'referenced-media',
            limit: MAX_MEDIA_BYTES,
        })),
    ].sort((a, b) => a.relative.localeCompare(b.relative));

    const mirrorRoot = path.join(resolvedServer, 'data', 'lore', 'ecos');
    const manifestPath = path.join(resolvedServer, 'data', 'lore', 'ecos-sync-manifest.json');
    const oraclePath = path.join(resolvedServer, 'data', 'lore', 'campaign-context.md');
    const files = selected.map((entry) => {
        const stat = fs.statSync(entry.absolute);
        if (stat.size > entry.limit) throw new Error(`Archivo demasiado grande para sincronizar: ${entry.relative}`);
        const content = fs.readFileSync(entry.absolute);
        const target = path.join(mirrorRoot, ...entry.relative.split('/'));
        const currentHash = fs.existsSync(target) ? sha256(fs.readFileSync(target)) : null;
        const hash = sha256(content);
        return { ...entry, content, target, bytes: stat.size, sha256: hash, status: currentHash === hash ? 'unchanged' : (currentHash ? 'changed' : 'added') };
    });

    const git = readGitState(resolvedSource);
    const selectionHash = sha256(files.map((file) => `${file.relative}:${file.sha256}`).join('\n'));
    const manifest = {
        schemaVersion: MANIFEST_VERSION,
        sourceRepository: 'ecos_de_la_guerra',
        sourceRevision: git.revision,
        sourceDirty: git.dirty,
        selectionHash,
        files: files.map(({ relative, category, bytes, sha256: hash }) => ({ source: relative, target: `ecos/${relative}`, category, bytes, sha256: hash })),
    };
    const previous = readPreviousManifest(manifestPath);
    const selectedTargets = new Set(manifest.files.map((file) => file.target));
    const removed = (previous?.files || [])
        .filter((file) => !selectedTargets.has(file.target))
        .map((file) => ({ ...file, absolute: path.join(resolvedServer, 'data', 'lore', ...toPosix(file.target).split('/')) }))
        .filter((file) => isInside(mirrorRoot, file.absolute) && fs.existsSync(file.absolute));

    const maestro = files.find((file) => file.relative === 'campaign/maestro.md');
    const oracleContent = generatedOracleContext(maestro.content, manifest);
    const oracleStatus = fs.existsSync(oraclePath) && sha256(fs.readFileSync(oraclePath)) === sha256(oracleContent) ? 'unchanged' : 'changed';
    const manifestContent = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const manifestStatus = fs.existsSync(manifestPath) && sha256(fs.readFileSync(manifestPath)) === sha256(manifestContent) ? 'unchanged' : 'changed';

    return {
        sourceRoot: resolvedSource,
        serverRoot: resolvedServer,
        mirrorRoot,
        manifestPath,
        manifest,
        manifestContent,
        manifestStatus,
        oraclePath,
        oracleContent,
        oracleStatus,
        files,
        removed,
        dirtySource: git.dirty,
        gitStateAvailable: git.available,
        hasChanges: files.some((file) => file.status !== 'unchanged') || removed.length > 0 || oracleStatus !== 'unchanged' || manifestStatus !== 'unchanged',
    };
}

function applyLoreSync(plan, { allowDirty = false } = {}) {
    if (plan.dirtySource !== false && !allowDirty) {
        const reason = plan.dirtySource
            ? 'Ecos tiene cambios sin commit.'
            : 'No se pudo verificar el estado Git de Ecos.';
        throw new Error(`${reason} Confirma primero el lore o usa --allow-dirty deliberadamente.`);
    }
    for (const file of plan.files) {
        if (file.status === 'unchanged') continue;
        fs.mkdirSync(path.dirname(file.target), { recursive: true });
        fs.writeFileSync(file.target, file.content);
    }
    for (const file of plan.removed) fs.rmSync(file.absolute, { force: true });
    fs.mkdirSync(path.dirname(plan.oraclePath), { recursive: true });
    fs.writeFileSync(plan.oraclePath, plan.oracleContent);
    fs.writeFileSync(plan.manifestPath, plan.manifestContent);
    return plan;
}

function summarizeLoreSyncPlan(plan) {
    const counts = { added: 0, changed: 0, unchanged: 0, removed: plan.removed.length };
    for (const file of plan.files) counts[file.status] += 1;
    return counts;
}

module.exports = {
    applyLoreSync,
    buildLoreSyncPlan,
    isSelectedText,
    summarizeLoreSyncPlan,
};
