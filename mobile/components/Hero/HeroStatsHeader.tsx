import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import socket from '../../services/socket';
import { API_URL } from '../../constants/Config';

interface HeroStatsHeaderProps {
    character: any;
    onLogout?: () => void;
}

export default function HeroStatsHeader({ character, onLogout }: HeroStatsHeaderProps) {
    const insets = useSafeAreaInsets();
    const opacity = useSharedValue(0.8);
    const [isUploading, setIsUploading] = useState(false);

    // Pulse Effect for HP Bar
    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 1000 }),
                withTiming(1.0, { duration: 1000 })
            ),
            -1, // Infinite
            true // Reverse
        );
    }, []);

    const animatedGlow = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            shadowOpacity: opacity.value,
        };
    });

    // ... imports

    const getHpColor = (current: number, max: number) => {
        const pct = (current / max);
        if (pct >= 0.75) return '#22c55e'; // Green
        if (pct >= 0.25) return '#eab308'; // Yellow
        if (pct >= 0.10) return '#f97316'; // Orange
        return '#ef4444'; // Red
    };

    if (!character) return null;

    const hpPercent = Math.min(100, Math.max(0, (character.hp / character.maxHp) * 100));
    const hpColor = getHpColor(character.hp, character.maxHp);

    const pickImage = async () => {
        if (!character) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1], // Square
            quality: 0.8,
        });

        if (!result.canceled) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            const filename = uri.split('/').pop() || 'avatar.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image`;

            // @ts-ignore
            formData.append('image', {
                uri,
                name: filename,
                type,
            });

            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const data = await response.json();

            if (data.url) {
                // Emit socket event to change DB and notify room
                socket.emit('update-character-image', {
                    characterId: character.id,
                    imageUrl: data.url,
                    scale: 1,
                    offsetX: 0,
                    offsetY: 0
                });
            }
        } catch (error) {
            console.error('Frontend: Error uploading avatar:', error);
            alert('Falló la subida de imagen');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
            <View style={styles.row}>
                {/* Avatar with Gold Border */}
                <View style={styles.avatarWrapper}>
                    <TouchableOpacity onPress={pickImage} style={styles.avatarContainer} disabled={isUploading}>
                        {isUploading ? (
                            <View style={styles.placeholder}>
                                <ActivityIndicator color="#FACC15" />
                            </View>
                        ) : character.image_url ? (
                            <Image source={{ uri: character.image_url }} style={styles.avatar} />
                        ) : (
                            <View style={styles.placeholder}>
                                <User size={24} color="#64748b" />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Name, Class & HP Stacked */}
                <View style={styles.infoColumn}>
                    <View style={styles.identityRow}>
                        <Text style={styles.name} numberOfLines={1}>{character.name}</Text>
                        <Text style={styles.classText}>
                            {character.race} {character.class}
                        </Text>
                    </View>

                    {/* HP Widget - Full Width under Name */}
                    <View style={styles.hpWidget}>
                        <View style={styles.hpBarContainer}>
                            <Animated.View
                                style={[
                                    styles.hpBarFill,
                                    { width: `${hpPercent}%`, backgroundColor: hpColor, shadowColor: hpColor },
                                    animatedGlow
                                ]}
                            />
                        </View>
                        <View style={styles.hpTextOverlay}>
                            <Text style={styles.hpCurrent}>{character.hp}</Text>
                            <Text style={styles.hpMax}>/{character.maxHp}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        width: '100%',
        zIndex: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatarWrapper: {
        // Avatar remains on left
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: '#FACC15',
        overflow: 'hidden',
        backgroundColor: '#1e293b',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoColumn: {
        flex: 1,
        justifyContent: 'center',
        gap: 8,
    },
    identityRow: {
        flexDirection: 'column',
    },
    name: {
        color: '#f8fafc',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        lineHeight: 24,
    },
    classText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    hpWidget: {
        width: '100%',
        height: 18, // Taller bar to host text inside or near
        position: 'relative',
        justifyContent: 'center',
    },
    hpBarContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    hpBarFill: {
        height: '100%',
        // backgroundColor: '#EF4444', // Overridden by inline style
        borderRadius: 4,
        // shadowColor: '#EF4444', // Overridden by inline style
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 8,
        elevation: 4,
    },
    hpTextOverlay: {
        position: 'absolute',
        left: 0,
        right: 8,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 2,
    },
    hpCurrent: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    hpMax: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        fontWeight: '600',
    },
});
