#!/usr/bin/env node
const path = require('node:path');
const {
    applyLoreSync,
    buildLoreSyncPlan,
    summarizeLoreSyncPlan,
} = require('../services/loreSync');

function parseArguments(argv) {
    const options = { apply: false, allowDirty: false, check: false, json: false, source: null };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--apply') options.apply = true;
        else if (argument === '--allow-dirty') options.allowDirty = true;
        else if (argument === '--check') options.check = true;
        else if (argument === '--json') options.json = true;
        else if (argument === '--source') options.source = argv[++index];
        else if (argument.startsWith('--source=')) options.source = argument.slice('--source='.length);
        else if (argument === '--help' || argument === '-h') options.help = true;
        else if (!argument.startsWith('-') && !options.source) options.source = argument;
        else throw new Error(`Argumento desconocido: ${argument}`);
    }
    if (options.apply && options.check) throw new Error('--apply y --check no pueden usarse juntos.');
    return options;
}

function usage() {
    return [
        'Sincroniza el lore seleccionado de Ecos hacia D&D World.',
        '',
        'Uso:',
        '  npm run lore:sync -- --source ../ecos_de_la_guerra',
        '  npm run lore:sync -- --source ../ecos_de_la_guerra --apply',
        '',
        'Opciones: --apply --allow-dirty --check --json',
    ].join('\n');
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        console.log(usage());
        return;
    }
    const projectRoot = path.resolve(__dirname, '..', '..');
    const sourceRoot = path.resolve(projectRoot, options.source || '../ecos_de_la_guerra');
    const serverRoot = path.join(projectRoot, 'server');
    const plan = buildLoreSyncPlan({ sourceRoot, serverRoot });
    const counts = summarizeLoreSyncPlan(plan);

    if (options.apply) applyLoreSync(plan, { allowDirty: options.allowDirty });

    const result = {
        mode: options.apply ? 'applied' : (options.check ? 'check' : 'dry-run'),
        source: sourceRoot,
        sourceRevision: plan.manifest.sourceRevision,
        sourceDirty: plan.dirtySource,
        selectionHash: plan.manifest.selectionHash,
        counts,
        oracle: plan.oracleStatus,
        manifest: plan.manifestStatus,
        hasChanges: plan.hasChanges,
    };
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
        console.log(`Lore Ecos: ${result.mode}`);
        console.log(`Fuente: ${sourceRoot}`);
        const gitLabel = result.sourceDirty === null
            ? ' (estado Git no verificable)'
            : (result.sourceDirty ? ' (con cambios sin commit)' : '');
        console.log(`Revision: ${result.sourceRevision || 'sin Git'}${gitLabel}`);
        console.log(`Archivos: +${counts.added} ~${counts.changed} =${counts.unchanged} -${counts.removed}`);
        console.log(`Oracle: ${result.oracle}; manifiesto: ${result.manifest}`);
        if (!options.apply && result.hasChanges) console.log('Vista previa solamente. Usa --apply para escribir los cambios.');
    }
    if (options.check && plan.hasChanges) process.exitCode = 1;
}

try {
    main();
} catch (error) {
    console.error(`Error de sincronizacion: ${error.message}`);
    process.exitCode = 1;
}
