import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown, ChevronUp, Sword, Shield, Zap } from 'lucide-react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface ItemCardProps {
    item: any;
    onEquip?: (item: any) => void;
    onUse?: (item: any) => void;
    isEquipped?: boolean;
}

export default function ItemCard({ item, onEquip, onUse, isEquipped }: ItemCardProps) {
    const [expanded, setExpanded] = useState(false);

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    // Helper to determine item category colors/icons
    const getRarityColor = (rarity: string) => {
        switch (rarity) {
            case 'Común': return '#888';
            case 'Poco Común': return '#4ade80'; // Green
            case 'Raro': return '#3b82f6'; // Blue
            case 'Muy Raro': return '#a855f7'; // Purple
            case 'Legendario': return '#f59e0b'; // Gold
            default: return '#888';
        }
    };

    const rarityColor = getRarityColor(item.rarity);

    return (
        <View style={[styles.card, { borderColor: expanded ? rarityColor : '#333' }]}>
            <TouchableOpacity style={styles.header} onPress={toggleExpand} activeOpacity={0.7}>
                <View style={styles.iconContainer}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.icon} />
                    ) : (
                        // Fallback Icons based on type
                        item.type === 'Arma' ? <Sword size={24} color={rarityColor} /> :
                            item.type === 'Armadura' ? <Shield size={24} color={rarityColor} /> :
                                <Zap size={24} color={rarityColor} />
                    )}
                </View>

                <View style={styles.info}>
                    <Text style={[styles.name, { color: isEquipped ? '#FFD700' : '#fff' }]}>
                        {item.name} {isEquipped && '(E)'}
                    </Text>
                    <Text style={[styles.type, { color: rarityColor }]}>
                        {item.type} • {item.rarity}
                    </Text>
                </View>

                {item.CharacterInventory?.quantity > 1 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>x{item.CharacterInventory.quantity}</Text>
                    </View>
                )}

                {expanded ? <ChevronUp size={20} color="#666" /> : <ChevronDown size={20} color="#666" />}
            </TouchableOpacity>

            {expanded && (
                <View style={styles.details}>
                    {item.description && (
                        <Text style={styles.description}>{item.description}</Text>
                    )}

                    {/* Stats Display */}
                    {(item.damage || item.armor_class || item.stat_bonuses) && (
                        <View style={styles.statsContainer}>
                            {/* Mock logic for display, real data usually in stat_bonuses or specific fields */}
                            {item.stat_bonuses?.ac && (
                                <Text style={styles.statText}>🛡 AC: +{item.stat_bonuses.ac}</Text>
                            )}
                            {/* If damage were a field */}
                            {item.description && item.description.includes('1d') && (
                                <Text style={styles.statText}>⚔ Daño: Ver desc.</Text>
                            )}
                        </View>
                    )}

                    {/* Actions */}
                    <View style={styles.actions}>
                        {item.type === 'Consumible' && onUse && (
                            <TouchableOpacity style={styles.actionBtn} onPress={() => onUse(item)}>
                                <Text style={styles.actionBtnText}>USAR</Text>
                            </TouchableOpacity>
                        )}
                        {(item.type === 'Arma' || item.type === 'Armadura') && onEquip && (
                            <TouchableOpacity
                                style={[styles.actionBtn, isEquipped && styles.unequipBtn]}
                                onPress={() => onEquip(item)}
                            >
                                <Text style={[styles.actionBtnText, isEquipped && styles.unequipText]}>
                                    {isEquipped ? 'DESEQUIPAR' : 'EQUIPAR'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 8,
        marginRight: 12,
    },
    icon: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    info: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    type: {
        fontSize: 12,
        marginTop: 2,
    },
    badge: {
        backgroundColor: '#333',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginRight: 12,
    },
    badgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    details: {
        padding: 12,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: '#222',
        marginTop: 0,
    },
    description: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 20,
        marginVertical: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
        backgroundColor: '#111',
        padding: 8,
        borderRadius: 4,
    },
    statText: {
        color: '#ddd',
        fontSize: 13,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    actionBtn: {
        backgroundColor: '#333',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    unequipBtn: {
        backgroundColor: '#421',
        borderWidth: 1,
        borderColor: '#622',
    },
    unequipText: {
        color: '#f88',
    }

});
