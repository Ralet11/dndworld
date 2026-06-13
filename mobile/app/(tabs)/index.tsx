import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Scroll, Hammer } from 'lucide-react-native';
import Screen from '../../components/UI/Screen';
import { COLORS, SPACING, TYPO, RADIUS, GLOWS } from '../../constants/Theme';

/**
 * Chronicles — el chat narrativo por escenas.
 * Fuera de scope del MVP de fin de semana: placeholder "En construcción".
 * El código del chat (SceneList / SceneChat / decks) sigue en components/Chronicle.
 */
export default function ChronicleScreen() {
    return (
        <Screen>
            <View style={styles.center}>
                <View style={[styles.iconRing, GLOWS.ember]}>
                    <Scroll size={44} color={COLORS.amber} />
                </View>

                <Text style={styles.title}>Chronicles</Text>
                <Text style={styles.subtitle}>La crónica de la aventura</Text>

                <View style={styles.badge}>
                    <Hammer size={14} color={COLORS.bronzeLight} />
                    <Text style={styles.badgeText}>En construcción</Text>
                </View>

                <Text style={styles.blurb}>
                    Aquí vivirá el relato de la mesa: escenas, diálogo y tiradas en tiempo real.
                    Estamos forjándolo. Por ahora, explora tu héroe, el equipo y el mundo.
                </Text>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xxl,
    },
    iconRing: {
        width: 96,
        height: 96,
        borderRadius: RADIUS.pill,
        borderWidth: 1.5,
        borderColor: COLORS.bronze,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
    },
    title: {
        ...TYPO.display,
        color: COLORS.textPrimary,
    },
    subtitle: {
        ...TYPO.body,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.surfaceHighlight,
        borderColor: COLORS.bronzeDark,
        borderWidth: 1,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.pill,
        marginTop: SPACING.xl,
    },
    badgeText: {
        ...TYPO.label,
        color: COLORS.bronzeLight,
    },
    blurb: {
        ...TYPO.body,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 21,
        marginTop: SPACING.xl,
    },
});
