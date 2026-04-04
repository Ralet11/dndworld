import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import { X, Shield, Sword, Sparkles } from 'lucide-react-native';
import GlassPanel from '../../UI/GlassPanel';
import { BlurView } from 'expo-blur';

interface ItemDetailModalProps {
    visible: boolean;
    item: any;
    onClose: () => void;
    onEquip?: () => void;
    isEquipped?: boolean;
}

export default function ItemDetailModal({ visible, item, onClose, onEquip, isEquipped }: ItemDetailModalProps) {
    if (!item) return null;

    const rarityColor = (rarity: string) => {
        switch (rarity?.toLowerCase()) {
            case 'legendario': return '#fbbf24'; // Amber
            case 'muy raro': return '#c084fc'; // Purple
            case 'raro': return '#60a5fa'; // Blue
            case 'poco común': return '#4ade80'; // Green
            default: return '#94a3b8'; // Gray
        }
    };

    const color = rarityColor(item.rarity);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} />

                <View style={styles.modalContainer}>
                    <GlassPanel style={styles.panel}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.rarity, { color }]}>{item.rarity} {item.type}</Text>
                                <Text style={styles.name}>{item.name}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Image Placeholder */}
                        {item.image_url && (
                            <View style={styles.imageContainer}>
                                <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="cover" />
                            </View>
                        )}

                        <ScrollView style={styles.scroll}>
                            {/* Stats Grid */}
                            <View style={styles.statsGrid}>
                                {item.damage && (
                                    <View style={styles.statBox}>
                                        <Sword size={16} color="#ef4444" />
                                        <Text style={styles.statText}>{item.damage} {item.damageType}</Text>
                                    </View>
                                )}
                                {item.ac && (
                                    <View style={styles.statBox}>
                                        <Shield size={16} color="#3b82f6" />
                                        <Text style={styles.statText}>{item.ac} AC</Text>
                                    </View>
                                )}
                                {item.properties && item.properties.length > 0 && (
                                    <View style={styles.statBox}>
                                        <Sparkles size={16} color="#eab308" />
                                        <Text style={styles.statText}>{item.properties.join(', ')}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Description */}
                            <Text style={styles.description}>
                                {item.description || "Sin descripción disponible."}
                            </Text>
                        </ScrollView>

                        {/* Actions */}
                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.actionBtn, isEquipped && styles.unequipBtn]}
                                onPress={() => {
                                    if (onEquip) onEquip();
                                    onClose();
                                }}
                            >
                                <Text style={styles.actionText}>
                                    {isEquipped ? 'Desequipar' : 'Equipar / Usar'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </GlassPanel>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 20,
    },
    backdrop: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
    },
    modalContainer: {
        width: '100%',
        maxHeight: '80%',
    },
    panel: {
        padding: 0,
        overflow: 'hidden',
    },
    header: {
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    rarity: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeBtn: {
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    imageContainer: {
        height: 150,
        width: '100%',
        backgroundColor: '#000',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    scroll: {
        padding: 20,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    statBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        gap: 8,
    },
    statText: {
        color: '#e2e8f0',
        fontSize: 14,
        fontWeight: '600',
    },
    description: {
        color: '#cbd5e1',
        fontSize: 16,
        lineHeight: 24,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    actionBtn: {
        backgroundColor: '#2563eb',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    unequipBtn: {
        backgroundColor: '#475569',
    },
    actionText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        textTransform: 'uppercase',
    }
});
