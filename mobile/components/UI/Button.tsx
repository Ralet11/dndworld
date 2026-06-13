import React from 'react';
import { Text, StyleSheet, ActivityIndicator, View, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING, TYPO, GLOWS } from '../../constants/Theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
    title: string;
    onPress?: () => void;
    variant?: Variant;
    size?: Size;
    icon?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    full?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * Botón unificado del lenguaje Ember.
 * - primary: relleno ámbar-fuego con glow (CTA principal).
 * - secondary: contorno de bronce sobre superficie.
 * - ghost: transparente, solo texto.
 * - danger: rojo ember.
 */
export default function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    disabled = false,
    loading = false,
    full = false,
    style,
}: ButtonProps) {
    const handlePress = () => {
        if (disabled || loading) return;
        onPress?.();
        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { }
    };

    const v = VARIANTS[variant];
    const s = SIZES[size];

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.85}
            disabled={disabled || loading}
            style={[
                styles.base,
                { paddingVertical: s.py, paddingHorizontal: s.px, backgroundColor: v.bg, borderColor: v.border },
                variant === 'primary' && GLOWS.ember,
                full && styles.full,
                (disabled || loading) && styles.disabled,
                style,
            ]}
        >
            <View style={styles.row}>
                {loading ? (
                    <ActivityIndicator size="small" color={v.fg} />
                ) : (
                    <>
                        {icon}
                        <Text style={[styles.label, { color: v.fg, fontSize: s.font }, icon ? styles.labelWithIcon : null]}>
                            {title}
                        </Text>
                    </>
                )}
            </View>
        </TouchableOpacity>
    );
}

const VARIANTS: Record<Variant, { bg: string; border: string; fg: string }> = {
    primary: { bg: COLORS.ember, border: COLORS.ember, fg: '#1A0E04' },
    secondary: { bg: COLORS.surfaceHighlight, border: COLORS.bronze, fg: COLORS.bronzeLight },
    ghost: { bg: 'transparent', border: 'transparent', fg: COLORS.textSecondary },
    danger: { bg: COLORS.danger, border: COLORS.danger, fg: '#FDEDE9' },
};

const SIZES: Record<Size, { py: number; px: number; font: number }> = {
    sm: { py: SPACING.sm, px: SPACING.md, font: 13 },
    md: { py: SPACING.md, px: SPACING.lg, font: 15 },
    lg: { py: SPACING.lg, px: SPACING.xl, font: 17 },
};

const styles = StyleSheet.create({
    base: {
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    full: { width: '100%' },
    disabled: { opacity: 0.45 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    label: { ...TYPO.subtitle, fontWeight: '800' },
    labelWithIcon: { marginLeft: SPACING.sm },
});
