import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const CARD_HEIGHT = 400;

interface SceneCardProps {
    item: any;
    index: number;
}

import { Platform } from 'react-native';

// ... other imports

export default function SceneCard({ item, index }: SceneCardProps) {
    const BadgeComponent = Platform.OS === 'ios' ? BlurView : View;
    const badgeProps = Platform.OS === 'ios' ? { intensity: 20, tint: 'dark' } : { style: { backgroundColor: 'rgba(0,0,0,0.5)' } };

    return (
        <Animated.View
            style={styles.container}
        >
            <View style={styles.card}>
                {/* Background Image */}
                <Image
                    source={{ uri: item.metadata?.image_url }}
                    style={styles.image}
                    resizeMode="cover"
                />

                {/* Overlay Gradient for readability */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)', '#1a1a1a']}
                    style={styles.gradient}
                />

                {/* Content */}
                <View style={styles.content}>
                    {/* @ts-ignore */}
                    <BadgeComponent {...badgeProps} style={[styles.badge, Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                        <Text style={styles.badgeText}>SCENE</Text>
                    </BadgeComponent>

                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.description}>{item.content}</Text>

                    <View style={styles.footer}>
                        <Text style={styles.timestamp}>Just now</Text>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    card: {
        width: width * 0.9,
        height: CARD_HEIGHT,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#2a2a2a',
    },
    image: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '60%',
    },
    content: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 24,
    },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    badgeText: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    title: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
        fontFamily: 'System', // Replace with custom font later
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10
    },
    description: {
        color: '#e0e0e0',
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 16,
        fontFamily: 'System',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timestamp: {
        color: '#888',
        fontSize: 12,
    }
});
