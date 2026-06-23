export interface CustomFeature {
    name: string;
    description: string;
    kind?: string;
    resource?: string;
}

const CUSTOM_SECTION_TITLES = new Set([
    'custom',
    'custom features',
    'custom feature',
    'rasgos custom',
    'habilidades custom',
    'rasgos personalizados',
    'habilidades personalizadas',
]);

function cleanText(text: unknown) {
    if (!text) return '';
    return String(text)
        .replace(/\r/g, '')
        .replace(/\*\*\*/g, '')
        .replace(/\*\*/g, '')
        .replace(/_/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanMultiline(text: unknown) {
    if (!text) return '';
    return String(text)
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n');
}

function normalizeText(text: unknown) {
    return cleanText(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function normalizeHeading(text: string) {
    return normalizeText(text)
        .replace(/^#+\s*/, '')
        .replace(/[:：]\s*$/, '')
        .trim();
}

function isCustomSectionHeading(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^\[\[\s*custom\s*\]\]$/i.test(trimmed)) return true;

    const headingMatch = trimmed.match(/^#{1,6}\s*(.+?)\s*$/);
    const candidate = headingMatch ? headingMatch[1] : trimmed;
    return CUSTOM_SECTION_TITLES.has(normalizeHeading(candidate));
}

function isExplicitCustomEnd(line: string) {
    return /^\[\[\s*\/custom\s*\]\]$/i.test(line.trim());
}

function isMajorHeading(line: string) {
    return /^#{1,2}\s+\S/.test(line.trim());
}

function collapseBlankLines(text: string) {
    return text
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function splitAbilitiesText(text: unknown) {
    const raw = cleanMultiline(text);
    if (!raw) return { notesText: '', customText: '' };

    const lines = raw.split('\n');
    const notesLines: string[] = [];
    const customChunks: string[] = [];
    let currentCustom: string[] = [];
    let inCustom = false;

    const flushCustom = () => {
        const chunk = collapseBlankLines(currentCustom.join('\n'));
        if (chunk) customChunks.push(chunk);
        currentCustom = [];
    };

    lines.forEach((line) => {
        if (isExplicitCustomEnd(line)) {
            flushCustom();
            inCustom = false;
            return;
        }

        if (isCustomSectionHeading(line)) {
            flushCustom();
            inCustom = true;
            return;
        }

        if (inCustom && isMajorHeading(line)) {
            flushCustom();
            inCustom = false;
            notesLines.push(line);
            return;
        }

        if (inCustom) currentCustom.push(line);
        else notesLines.push(line);
    });

    flushCustom();

    return {
        notesText: collapseBlankLines(notesLines.join('\n')),
        customText: collapseBlankLines(customChunks.join('\n\n')),
    };
}

function normalizeCustomFeature(input: any, index: number): CustomFeature | null {
    if (!input) return null;

    if (typeof input === 'string') {
        const description = cleanText(input);
        if (!description) return null;
        return {
            name: `Custom ${index + 1}`,
            description,
        };
    }

    const name = cleanText(input.name || input.title || input.label);
    const description = cleanText(input.description || input.desc || input.text || input.body);
    const kind = cleanText(input.kind || input.type || input.actionType);
    const resource = cleanText(input.resource || input.uses || input.cost);

    if (!name || !description) return null;

    return {
        name,
        description,
        kind: kind || undefined,
        resource: resource || undefined,
    };
}

function parseCustomTextSection(text: string) {
    if (!text) return [];

    const chunks = text
        .replace(/\n(?=###\s+)/g, '\n\n')
        .split(/\n\s*\n+/)
        .map((chunk) => chunk.trim())
        .filter(Boolean);

    return chunks
        .map((chunk) => {
            const lines = chunk
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);

            if (!lines.length) return null;

            let name = '';
            let descLines = [...lines];

            const headingMatch = lines[0].match(/^###\s*(.+?)\s*$/);
            if (headingMatch) {
                name = cleanText(headingMatch[1]);
                descLines = lines.slice(1);
            } else {
                const boldMatch = chunk.match(/^\s*(?:[-*]\s*)?\*\*([^*]+?)\.?\*\*\s*(.*)$/s);
                if (boldMatch) {
                    name = cleanText(boldMatch[1]);
                    descLines = cleanMultiline(boldMatch[2]).split('\n').map((line) => line.trim()).filter(Boolean);
                }
            }

            if (!name) return null;

            let kind = '';
            let resource = '';
            const cleanedLines = descLines.filter((line) => {
                const kindMatch = line.match(/^\s*(tipo|kind)\s*:\s*(.+)$/i);
                if (kindMatch) {
                    kind = cleanText(kindMatch[2]);
                    return false;
                }

                const resourceMatch = line.match(/^\s*(recurso|uso|resource)\s*:\s*(.+)$/i);
                if (resourceMatch) {
                    resource = cleanText(resourceMatch[2]);
                    return false;
                }

                return true;
            });

            const description = cleanText(cleanedLines.join(' '));
            if (!description) return null;

            return {
                name,
                description,
                kind: kind || undefined,
                resource: resource || undefined,
            };
        })
        .filter(Boolean) as CustomFeature[];
}

function dedupeFeatures(features: CustomFeature[]) {
    const seen = new Set<string>();

    return features.filter((feature) => {
        const key = `${normalizeText(feature.name)}|${normalizeText(feature.description)}`;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function getCharacterCustomFeatures(character: any): CustomFeature[] {
    const stored = Array.isArray(character?.custom_features)
        ? character.custom_features
            .map((item: any, index: number) => normalizeCustomFeature(item, index))
            .filter(Boolean) as CustomFeature[]
        : [];

    const parsed = parseCustomTextSection(splitAbilitiesText(character?.abilities_text).customText);

    return dedupeFeatures([...stored, ...parsed]);
}

export function getCharacterNotesText(text: unknown) {
    return splitAbilitiesText(text).notesText;
}
