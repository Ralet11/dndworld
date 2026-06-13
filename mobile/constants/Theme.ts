/**
 * Ember / Campfire — Sistema de diseño único de DnD World.
 *
 * Fuente única de verdad para color, espaciado, radios, tipografía y glows.
 * REGLA: las pantallas consumen estos tokens; nada de hex sueltos.
 *
 * Atmósfera: dark fantasy cálido — carbón/teal oscuro, brillos ámbar-fuego,
 * marcos de bronce, texto pergamino. Glows por rareza para items y equipo.
 */

export const COLORS = {
    // --- Base (carbón / teal oscuro) ---
    background: '#0F1518',      // fondo más profundo de la app
    surface: '#16211F',         // tarjetas / paneles
    surfaceHighlight: '#1E2A28', // panel elevado / item hover
    surfaceRaised: '#243330',   // modales / capas superiores
    border: '#2A332F',          // borde sutil por defecto

    // --- Marcos de bronce ---
    bronze: '#8A6A3B',
    bronzeLight: '#C8A36A',
    bronzeDark: '#5A4424',

    // --- Texto (pergamino cálido) ---
    textPrimary: '#EDE6D8',
    textSecondary: '#A89F8E',
    textMuted: '#6B6557',

    // --- Acento ember / fuego ---
    ember: '#FF7A1A',           // fuego primario (CTA, activos)
    amber: '#F59E0B',           // ámbar (heroico / legendario)
    emberSoft: '#FFB169',       // brillo claro

    // --- Semántico ---
    success: '#5BA86B',
    warning: '#F59E0B',
    danger: '#C2452F',          // rojo ember (HP bajo, crítico)

    // --- Compat (claves heredadas por pantallas actuales; remapeadas a Ember) ---
    gold: '#C8A36A',            // antes oro → bronce claro
    red: '#C2452F',
    blue: '#3E84D6',
    purple: '#9B5DE5',
    pink: '#E06A9A',
    error: '#C2452F',

    // --- Utilitarios ---
    transparent: 'transparent',
    overlay: 'rgba(8, 12, 13, 0.82)',
    scrim: 'rgba(0, 0, 0, 0.5)',
};

/**
 * Colores por rareza. Las claves coinciden con el ENUM del modelo Item
 * ('Común', 'Poco Común', 'Raro', 'Muy Raro', 'Legendario') y también
 * exponen alias en inglés para componentes genéricos.
 */
export const RARITY = {
    'Común': '#9AA0A6',
    'Poco Común': '#4FA85E',
    'Raro': '#3E84D6',
    'Muy Raro': '#9B5DE5',
    'Legendario': '#F59E0B',
    // alias
    common: '#9AA0A6',
    uncommon: '#4FA85E',
    rare: '#3E84D6',
    epic: '#9B5DE5',
    legendary: '#F59E0B',
} as const;

export type RarityKey = keyof typeof RARITY;

/** Devuelve el color de rareza con fallback a 'Común'. */
export const rarityColor = (rarity?: string): string =>
    (rarity && (RARITY as Record<string, string>)[rarity]) || RARITY['Común'];

// --- Escala de espaciado (múltiplos de 4) ---
export const SPACING = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
};

// --- Radios ---
export const RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
};

// --- Tipografía (System por ahora; cambiar a fuente serif display más adelante) ---
export const FONTS = {
    regular: 'System',
    bold: 'System',
};

export const TYPO = {
    display: { fontSize: 30, fontWeight: '900' as const, letterSpacing: 0.5 },
    heading: { fontSize: 22, fontWeight: '800' as const, letterSpacing: 0.3 },
    title: { fontSize: 18, fontWeight: '700' as const },
    subtitle: { fontSize: 16, fontWeight: '600' as const },
    body: { fontSize: 14, fontWeight: '400' as const },
    caption: { fontSize: 12, fontWeight: '500' as const },
    // Para labels en mayúscula con tracking (CA, INIC, secciones)
    label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const },
};

// --- Sombras y glows ---
export const SHADOWS = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    raised: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
};

/** Glow ember reutilizable (CTA / item legendario / figura del héroe). */
export const GLOWS = {
    ember: {
        shadowColor: COLORS.ember,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 8,
    },
    /** Glow tintado por color de rareza (pasar rarityColor(...) como arg). */
    rarity: (color: string) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 12,
        elevation: 6,
    }),
};

export const THEME = {
    colors: COLORS,
    rarity: RARITY,
    spacing: SPACING,
    radius: RADIUS,
    fonts: FONTS,
    typo: TYPO,
    shadows: SHADOWS,
    glows: GLOWS,
};
