import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface GlassPanelProps {
    children: React.ReactNode;
    style?: ViewStyle;
    intensity?: number;
}

export default function GlassPanel({ children, style, intensity = 20 }: GlassPanelProps) {
    return (
        <View style={[styles.container, style]}>
            <BlurView intensity={intensity} tint="dark" style={styles.blur}>
                <View style={styles.overlay}>
                    {children}
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(15, 23, 42, 0.65)', // Slate-900 with opacity
    },
    blur: {
        flex: 1,
    },
    overlay: {
        padding: 12,
        flex: 1,
    }
});
