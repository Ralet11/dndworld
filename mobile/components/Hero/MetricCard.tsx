import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GlassPanel from '../UI/GlassPanel';

interface MetricCardProps {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    color?: string;
}

export default function MetricCard({ label, value, icon, color = '#fff' }: MetricCardProps) {
    return (
        <GlassPanel style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>{label}</Text>
                {icon && <View style={{ opacity: 0.7, transform: [{ scale: 0.8 }] }}>{icon}</View>}
            </View>
            <Text style={[styles.value, { color }]}>{value}</Text>
        </GlassPanel>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 45, // Reduced from 55
        justifyContent: 'center',
        paddingVertical: 4,
        paddingHorizontal: 6,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 0, // No margin
    },
    label: {
        color: '#94a3b8',
        fontSize: 8, // Tiny top label
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    value: {
        fontSize: 15, // Compact value
        fontWeight: '900',
        letterSpacing: -0.5,
        lineHeight: 18,
    },
});
