import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { Sparkles } from 'lucide-react-native';
import { COLORS, SPACING, TYPO, RADIUS, GLOWS } from '../../../constants/Theme';

interface RenderProgressProps {
    /** Etapa actual (texto que llega del server). */
    stage: string;
    /** Progreso 0–100. */
    progress: number;
}

/**
 * Overlay de carga sobre la figura mientras la IA arma el retrato.
 * Barra ámbar con glow + ícono pulsante, en el lenguaje visual "Ember".
 */
export default function RenderProgress({ stage, progress }: RenderProgressProps) {
    // Pulso suave del ícono.
    const pulse = useRef(new Animated.Value(0)).current;
    // Ancho de la barra, animado hacia el progreso entrante.
    const fill = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    useEffect(() => {
        Animated.timing(fill, {
            toValue: Math.max(0, Math.min(100, progress)),
            duration: 450,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
        }).start();
    }, [progress, fill]);

    const iconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
    const iconOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] });
    const width = fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

    return (
        <View style={styles.overlay} pointerEvents="none">
            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.tintLayer} />

            <View style={styles.content}>
                <Animated.View style={{ transform: [{ scale: iconScale }], opacity: iconOpacity }}>
                    <Sparkles size={34} color={COLORS.amber} />
                </Animated.View>

                <Text style={styles.stage} numberOfLines={2}>{stage || 'Generando…'}</Text>

                <View style={styles.track}>
                    <Animated.View style={[styles.fill, { width }]} />
                </View>

                <Text style={styles.pct}>{Math.round(Math.min(100, progress))}%</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    tintLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10,6,2,0.55)',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        gap: SPACING.md,
    },
    stage: {
        ...TYPO.subtitle,
        color: COLORS.textPrimary,
        textAlign: 'center',
        fontWeight: '700',
    },
    track: {
        width: 180,
        height: 8,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.bronzeDark,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.ember,
        ...GLOWS.ember,
    },
    pct: {
        ...TYPO.label,
        color: COLORS.amber,
        fontWeight: '800',
        letterSpacing: 1,
    },
});
