import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPO } from '../../constants/Theme';

interface SectionHeaderProps {
    title: string;
    icon?: React.ReactNode;
    /** Elemento a la derecha (botón "ver todo", contador, etc.). */
    right?: React.ReactNode;
}

/**
 * Encabezado de sección: label en mayúscula con tracking + línea de bronce.
 * Da ritmo y jerarquía consistente a todas las pantallas.
 */
export default function SectionHeader({ title, icon, right }: SectionHeaderProps) {
    return (
        <View style={styles.container}>
            <View style={styles.left}>
                {icon}
                <Text style={[styles.title, icon ? styles.titleWithIcon : null]}>{title}</Text>
                <View style={styles.line} />
            </View>
            {right}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    title: {
        ...TYPO.label,
        color: COLORS.bronzeLight,
    },
    titleWithIcon: { marginLeft: SPACING.sm },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.bronzeDark,
        marginLeft: SPACING.md,
        opacity: 0.5,
    },
});
