import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    VenetianMask, Shirt, Hand, Footprints, Layers, Shield, Sword, Gem, User,
} from 'lucide-react-native';
import RarityFrame from '../../UI/RarityFrame';
import { COLORS, SPACING, TYPO, RADIUS } from '../../../constants/Theme';

interface EquipmentDollProps {
    equipment: any;
    inventory: any[];
    /** Imagen de cuerpo entero / retrato del personaje. */
    figureUrl?: string;
    onSlotPress?: (item: any | null, slotId: string, label: string) => void;
}

type SlotDef = { id: string; label: string; icon: any };

// Columna izquierda (armadura) / derecha (accesorios y armas) — estilo referencia.
const LEFT: SlotDef[] = [
    { id: 'helmet', label: 'Cabeza', icon: VenetianMask },
    { id: 'chest', label: 'Cuerpo', icon: Shirt },
    { id: 'gloves', label: 'Manos', icon: Hand },
    { id: 'pants', label: 'Piernas', icon: Layers },
    { id: 'boots', label: 'Pies', icon: Footprints },
];
const RIGHT: SlotDef[] = [
    { id: 'shoulders', label: 'Capa', icon: Shield },
    { id: 'primary_weapon', label: 'Arma', icon: Sword },
    { id: 'secondary_weapon', label: 'Mano 2ª', icon: Shield },
    { id: 'ring_1', label: 'Anillo', icon: Gem },
    { id: 'ring_2', label: 'Anillo', icon: Gem },
];

export default function EquipmentDoll({ equipment, inventory, figureUrl, onSlotPress }: EquipmentDollProps) {
    const getItem = (slotId: string) => {
        if (!equipment) return null;
        // 1) asociación anidada (equipment.helmet) — más confiable
        if (equipment[slotId] && typeof equipment[slotId] === 'object') return equipment[slotId];
        // 2) por id contra el inventario
        const id = equipment[`${slotId}_id`];
        if (id) return (inventory || []).find((i) => i.id === id) || null;
        return null;
    };

    const renderSlot = (slot: SlotDef, align: 'left' | 'right') => {
        const item = getItem(slot.id);
        const Icon = slot.icon;
        return (
            <View key={slot.id + align} style={[styles.slotRow, align === 'right' && styles.slotRowRight]}>
                <RarityFrame
                    size={54}
                    rarity={item?.rarity}
                    empty={!item}
                    onPress={() => onSlotPress?.(item, slot.id, slot.label)}
                >
                    {item?.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.itemImg} />
                    ) : (
                        <Icon size={24} color={item ? COLORS.amber : COLORS.textMuted} />
                    )}
                </RarityFrame>
                <Text style={styles.slotLabel} numberOfLines={1}>{slot.label}</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Columna izquierda */}
            <View style={styles.column}>{LEFT.map((s) => renderSlot(s, 'left'))}</View>

            {/* Figura central */}
            <View style={styles.figureWrap}>
                <LinearGradient
                    colors={['rgba(255,122,26,0.18)', 'transparent']}
                    style={styles.figureGlow}
                />
                {figureUrl ? (
                    <View style={styles.figureBox}>
                        <Image source={{ uri: figureUrl }} style={styles.figure} resizeMode="cover" />
                    </View>
                ) : (
                    <View style={styles.figurePlaceholder}>
                        <User size={120} color={COLORS.border} strokeWidth={1} />
                    </View>
                )}
            </View>

            {/* Columna derecha */}
            <View style={styles.column}>{RIGHT.map((s) => renderSlot(s, 'right'))}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.md,
    },
    column: {
        gap: SPACING.md,
    },
    slotRow: {
        alignItems: 'center',
        width: 54,
    },
    slotRowRight: {},
    slotLabel: {
        ...TYPO.label,
        fontSize: 8,
        color: COLORS.textMuted,
        marginTop: 3,
    },
    itemImg: { width: '100%', height: '100%' },
    figureWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: SPACING.md, // aire entre la figura y las columnas
        minHeight: 300,
    },
    figureGlow: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 24,
        height: 160,
        borderRadius: 100,
    },
    // Retrato enmarcado: el ANCHO manda (evita que se desborde sobre los slots),
    // proporción 2:3, marco de bronce y un glow ember sutil para darle peso.
    figureBox: {
        width: '100%',
        maxWidth: 196,
        aspectRatio: 2 / 3,
        borderRadius: RADIUS.lg,
        borderWidth: 1.5,
        borderColor: COLORS.bronze,
        backgroundColor: COLORS.background,
        overflow: 'hidden',
        // profundidad
        shadowColor: COLORS.ember,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    figure: { width: '100%', height: '100%' },
    figurePlaceholder: {
        width: '100%',
        maxWidth: 196,
        aspectRatio: 2 / 3,
        borderRadius: RADIUS.lg,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
