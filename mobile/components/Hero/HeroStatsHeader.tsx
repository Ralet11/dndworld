import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { User, Heart, HeartCrack, Coins } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import socket from '../../services/socket';
import { API_URL } from '../../constants/Config';
import { COLORS, SPACING, TYPO, RADIUS } from '../../constants/Theme';

interface HeroStatsHeaderProps {
    character: any;
    onLogout?: () => void;
}

export default function HeroStatsHeader({ character, onLogout }: HeroStatsHeaderProps) {
    const insets = useSafeAreaInsets();
    const [isUploading, setIsUploading] = useState(false);

    if (!character) return null;

    // Indicador de vida compacto: color por umbral + corazón roto si está crítico.
    const hpPct = character.maxHp ? character.hp / character.maxHp : 0;
    const hpColor = hpPct >= 0.5 ? COLORS.success : hpPct >= 0.25 ? COLORS.warning : COLORS.danger;
    const hpCritical = hpPct < 0.25;

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
                                <ActivityIndicator color={COLORS.amber} />
                            </View>
                        ) : character.image_url ? (
                            <Image source={{ uri: character.image_url }} style={styles.avatar} />
                        ) : (
                            <View style={styles.placeholder}>
                                <User size={24} color={COLORS.textMuted} />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Name & Class */}
                <View style={styles.infoColumn}>
                    <Text style={styles.name} numberOfLines={1}>{character.name}</Text>
                    <Text style={styles.classText}>
                        {character.race} {character.class}
                    </Text>
                </View>

                {/* HP + Oro compactos (visibles en todas las pestañas) */}
                <View style={styles.statsCol}>
                    <View style={[styles.miniChip, { borderColor: hpColor }]}>
                        {hpCritical
                            ? <HeartCrack size={13} color={hpColor} />
                            : <Heart size={13} color={hpColor} />}
                        <Text style={[styles.miniChipText, { color: hpColor }]}>
                            {character.hp}/{character.maxHp}
                        </Text>
                    </View>
                    <View style={[styles.miniChip, { borderColor: COLORS.bronze }]}>
                        <Coins size={13} color={COLORS.amber} />
                        <Text style={[styles.miniChipText, { color: COLORS.amber }]}>
                            {(character.gold ?? 0).toLocaleString('es')}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.bronzeDark,
        width: '100%',
        zIndex: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.lg,
    },
    avatarWrapper: {
        // Avatar remains on left
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        borderColor: COLORS.bronze,
        overflow: 'hidden',
        backgroundColor: COLORS.surfaceHighlight,
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
        gap: 4,
    },
    name: {
        color: COLORS.textPrimary,
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        lineHeight: 24,
    },
    classText: {
        color: COLORS.bronzeLight,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statsCol: {
        alignItems: 'flex-end',
        gap: 6,
    },
    miniChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        backgroundColor: COLORS.surfaceHighlight,
        minWidth: 64,
        justifyContent: 'center',
    },
    miniChipText: {
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});
