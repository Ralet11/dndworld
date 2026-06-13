import React from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../constants/Theme';

interface ScreenProps {
    children: React.ReactNode;
    /** Envuelve el contenido en un ScrollView. */
    scroll?: boolean;
    /** Cabecera fija (no scrollea). */
    header?: React.ReactNode;
    contentStyle?: StyleProp<ViewStyle>;
    edges?: Edge[];
    /** Brillo ámbar ambiental tipo hoguera en la base. */
    ember?: boolean;
}

/**
 * Contenedor base de toda pantalla. Aplica el fondo Ember (gradiente cálido
 * carbón→teal) y el manejo de safe-area de forma consistente.
 */
export default function Screen({
    children,
    scroll = false,
    header,
    contentStyle,
    edges = ['top'],
    ember = true,
}: ScreenProps) {
    return (
        <View style={styles.root}>
            <LinearGradient
                colors={[COLORS.background, '#11191A', COLORS.background]}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFill}
            />
            {ember && (
                <LinearGradient
                    colors={['transparent', 'rgba(255, 122, 26, 0.06)']}
                    style={styles.emberGlow}
                    pointerEvents="none"
                />
            )}
            <SafeAreaView style={styles.safe} edges={edges}>
                {header}
                {scroll ? (
                    <ScrollView
                        style={styles.flex}
                        contentContainerStyle={[styles.scrollContent, contentStyle]}
                        showsVerticalScrollIndicator={false}
                    >
                        {children}
                    </ScrollView>
                ) : (
                    <View style={[styles.flex, contentStyle]}>{children}</View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.background },
    safe: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: { padding: SPACING.lg, paddingBottom: 110 },
    emberGlow: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 220,
    },
});
