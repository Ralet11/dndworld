import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown, ChevronUp, Sword, Shield, Zap } from 'lucide-react-native';
import { COLORS, rarityColor as rarityColorToken } from '../../../constants/Theme';
import { isEquippable, slotLabel, armorLabel } from '../../../utils/DndUtils';

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

    const rarityColor = rarityColorToken(item.rarity);

    return (
        <View style={[styles.card, { borderColor: expanded ? rarityColor : COLORS.border }]}>
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
                    <Text style={[styles.name, { color: isEquipped ? COLORS.amber : COLORS.textPrimary }]} numberOfLines={1}>
                        {item.name}{isEquipped ? ' (E)' : ''}
                    </Text>
                    <Text style={styles.meta} numberOfLines={2}>
                        <Text style={{ color: rarityColor, fontWeight: '700' }}>{item.rarity}</Text>
                        <Text style={styles.metaMuted}>{` · ${item.type}`}</Text>
                        {slotLabel(item) ? <Text style={styles.metaAccent}>{` · ${slotLabel(item)}`}</Text> : null}
                        {armorLabel(item) ? <Text style={styles.metaAccent}>{` · ${armorLabel(item)}`}</Text> : null}
                    </Text>
                </View>

                {item.CharacterInventory?.quantity > 1 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>x{item.CharacterInventory.quantity}</Text>
                    </View>
                )}

                {expanded ? <ChevronUp size={20} color={COLORS.textMuted} /> : <ChevronDown size={20} color={COLORS.textMuted} />}
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
                        {isEquippable(item) && onEquip && (
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
        backgroundColor: COLORS.surface,
        borderRadius: 12,
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
        backgroundColor: COLORS.surfaceHighlight,
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
        fontSize: 15,
        fontWeight: 'bold',
    },
    meta: {
        fontSize: 11,
        lineHeight: 15,
        marginTop: 2,
    },
    metaMuted: {
        color: COLORS.textMuted,
    },
    metaAccent: {
        color: COLORS.bronzeLight,
    },
    badge: {
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginRight: 12,
    },
    badgeText: {
        color: COLORS.textPrimary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    details: {
        padding: 12,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        marginTop: 0,
    },
    description: {
        color: COLORS.textSecondary,
        fontSize: 14,
        lineHeight: 20,
        marginVertical: 8,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
        backgroundColor: COLORS.surfaceHighlight,
        padding: 8,
        borderRadius: 4,
    },
    statText: {
        color: COLORS.textSecondary,
        fontSize: 13,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    actionBtn: {
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.bronze,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    actionBtnText: {
        color: COLORS.bronzeLight,
        fontWeight: 'bold',
        fontSize: 12,
    },
    unequipBtn: {
        backgroundColor: 'rgba(194, 69, 47, 0.15)',
        borderWidth: 1,
        borderColor: COLORS.danger,
    },
    unequipText: {
        color: COLORS.danger,
    }

});
