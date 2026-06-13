import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import PressableScale from '../UI/PressableScale';
import { COLORS, TYPO, GLOWS } from '../../constants/Theme';

interface AttributeHexProps {
    label: string;       // FUE, DES, ...
    score: number;       // 16
    modifier: number;    // +3
    onPress?: () => void;
}

// Hexágono pointy-top dentro de un viewBox 100x112.
const HEX_POINTS = '50,3 94,28 94,84 50,109 6,84 6,28';

/**
 * Atributo como hexágono real (SVG) con glow ámbar y la puntuación en una
 * cápsula al pie. Toca para tirar una prueba (d20 + mod).
 */
export default function AttributeHex({ label, score, modifier, onPress }: AttributeHexProps) {
    const modColor = modifier >= 0 ? COLORS.textPrimary : COLORS.danger;

    return (
        <PressableScale onPress={onPress} style={styles.wrap}>
            <View style={[styles.glow, GLOWS.ember]}>
                <Svg viewBox="0 0 100 112" style={StyleSheet.absoluteFill}>
                    <Polygon
                        points={HEX_POINTS}
                        fill={COLORS.surfaceHighlight}
                        stroke={COLORS.bronze}
                        strokeWidth={2.5}
                    />
                </Svg>

                <View style={styles.content}>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={[styles.modifier, { color: modColor }]}>
                        {modifier >= 0 ? '+' : ''}{modifier}
                    </Text>
                </View>

                <View style={styles.scoreBubble}>
                    <Text style={styles.score}>{score}</Text>
                </View>
            </View>
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    wrap: {
        width: '100%',
        aspectRatio: 100 / 112,
    },
    glow: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        ...TYPO.label,
        fontSize: 9,
        color: COLORS.bronzeLight,
    },
    modifier: {
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: -1,
        marginTop: -2,
    },
    scoreBubble: {
        position: 'absolute',
        bottom: '6%',
        backgroundColor: COLORS.background,
        minWidth: 24,
        height: 22,
        paddingHorizontal: 4,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.bronze,
    },
    score: {
        color: COLORS.bronzeLight,
        fontSize: 11,
        fontWeight: '800',
    },
});
