import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOWS, GLOWS } from '../../constants/Theme';

interface PanelProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** 'surface' (default) o 'raised' (modales / capas superiores). */
    tone?: 'surface' | 'raised';
    /** Marco de bronce en vez del borde sutil por defecto. */
    bronze?: boolean;
    /** Glow ámbar (true) o tintado por color de rareza (string). */
    glow?: boolean | string;
    /** Padding interno. Default md. */
    padded?: boolean;
}

/**
 * Tarjeta/panel base del lenguaje Ember: superficie cálida, esquinas
 * redondeadas y borde sutil o marco de bronce. Reemplaza los Views con
 * estilos de tarjeta ad-hoc repartidos por las pantallas.
 */
export default function Panel({
    children,
    style,
    tone = 'surface',
    bronze = false,
    glow = false,
    padded = true,
}: PanelProps) {
    const glowStyle = glow
        ? typeof glow === 'string'
            ? GLOWS.rarity(glow)
            : GLOWS.ember
        : SHADOWS.card;

    return (
        <View
            style={[
                styles.base,
                tone === 'raised' && styles.raised,
                bronze ? styles.bronze : styles.bordered,
                padded && styles.padded,
                glowStyle,
                style,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
    },
    raised: {
        backgroundColor: COLORS.surfaceRaised,
        borderRadius: RADIUS.xl,
    },
    bordered: {
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    bronze: {
        borderWidth: 1.5,
        borderColor: COLORS.bronze,
    },
    padded: {
        padding: SPACING.lg,
    },
});
