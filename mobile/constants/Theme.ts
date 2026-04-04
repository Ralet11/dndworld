export const COLORS = {
    // Base
    background: '#0E0B14',
    surface: '#1A1625',
    surfaceHighlight: '#231e33',
    border: '#2A2438',

    // Text
    textPrimary: '#F2E9FF',
    textSecondary: '#B8AEC9',
    textMuted: '#64748b', // Keeping slate for very muted if needed, or replace with B8AEC9 alpha

    // Accents
    gold: '#C9A24D',
    red: '#8C2F39',
    blue: '#3A5A8C',
    purple: '#c084fc', // Keeping purple for current branding if needed, or shift to Gold/Blue
    pink: '#f472b6',

    // Semantic
    success: '#10b981',
    warning: '#f59e0b',
    error: '#8C2F39', // Using Critical Red

    // Transparent
    transparent: 'transparent',
    overlay: 'rgba(14, 11, 20, 0.8)',
};

export const FONTS = {
    regular: 'System', // Replace with custom font if we have one
    bold: 'System',
};

export const SHADOWS = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    }
};

export const THEME = {
    colors: COLORS,
    fonts: FONTS,
    shadows: SHADOWS,
};
