import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GlassPanel from '../UI/GlassPanel';

interface AttributeHexagonProps {
    label: string;
    score: number;
    modifier: number;
}

export default function AttributeHexagon({ label, score, modifier }: AttributeHexagonProps) {
    const modColor = modifier >= 0 ? '#fff' : '#ef4444'; // White or Crimson for negative

    return (
        <GlassPanel style={styles.container}>
            <Text style={styles.label}>{label}</Text>

            <View style={styles.valueContainer}>
                <Text style={[styles.modifier, { color: modColor }]}>
                    {modifier >= 0 ? '+' : ''}{modifier}
                </Text>
            </View>

            <View style={styles.scoreBubble}>
                <Text style={styles.score}>{score}</Text>
            </View>
        </GlassPanel>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%', // Fills the wrapper provided by CharacterSheet
        aspectRatio: 1.0,
        marginVertical: 4,
        position: 'relative',
    },
    label: {
        color: '#64748b',
        fontSize: 7, // Tiny label
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 0,
    },
    valueContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -4, // Pull up closer to label
    },
    modifier: {
        fontSize: 24, // Smaller
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    scoreBubble: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: 'rgba(2, 6, 23, 0.9)',
        width: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    score: {
        color: '#94a3b8',
        fontSize: 8,
        fontWeight: 'bold',
    },
});
