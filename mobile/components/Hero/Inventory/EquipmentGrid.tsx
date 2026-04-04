import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
    VenetianMask as HelmetIcon,
    Shirt as ChestIcon,
    Footprints as BootsIcon,
    Hand as GlovesIcon,
    Sword as WeaponIcon,
    Shield as ShieldIcon,
    Shield as OffHandIcon,
    Gem as RingIcon
} from 'lucide-react-native';

interface EquipmentGridProps {
    equipment: any; // EquipmentSlots model
    inventory: any[]; // List of items to find item details by ID
    onSlotPress?: (slot: string) => void;
}

// Logic to map the user's 8 requested slots to backend fields
const SLOTS_CONFIG = [
    { id: 'helmet', label: 'Cabeza', icon: HelmetIcon },
    { id: 'shoulders', label: 'Espalda', icon: ShieldIcon }, // Using Shield as placeholder for Shoulders/Cloak if no specific icon
    { id: 'chest', label: 'Cuerpo', icon: ChestIcon },
    { id: 'gloves', label: 'Manos', icon: GlovesIcon },
    { id: 'pants', label: 'Pantalones', icon: BootsIcon }, // Reuse Boots or similar? Or maybe split icons.
    { id: 'boots', label: 'Pies', icon: BootsIcon },
    { id: 'primary_weapon', label: 'Arma 1', icon: WeaponIcon },
    { id: 'secondary_weapon', label: 'Arma 2', icon: OffHandIcon },
    { id: 'ring_1', label: 'Acc. 1', icon: RingIcon },
    { id: 'ring_2', label: 'Acc. 2', icon: RingIcon },
];

export default function EquipmentGrid({ equipment, inventory, onSlotPress }: EquipmentGridProps) {
    if (!equipment) return null;

    const getItemForSlot = (slotId: string) => {
        const itemId = equipment[`${slotId}_id`];
        if (!itemId) return null;
        return inventory.find(i => i.id === itemId);
    };

    return (
        <View style={styles.grid}>
            {SLOTS_CONFIG.map((slot) => {
                const item = getItemForSlot(slot.id);
                return (
                    <TouchableOpacity
                        key={slot.id}
                        style={[styles.slot, item && styles.slotEquipped]}
                        onPress={() => onSlotPress && onSlotPress(slot.id)}
                    >
                        <Text style={styles.label}>{slot.label}</Text>
                        <View style={styles.iconContainer}>
                            {item ? (
                                item.image_url ? (
                                    <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                                ) : (
                                    <slot.icon size={24} color="#FFD700" />
                                )
                            ) : (
                                <slot.icon size={24} color="#333" />
                            )}
                        </View>
                        {item && (
                            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        padding: 4,
    },
    slot: {
        width: '48%', // 2 columns
        backgroundColor: '#111',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        alignItems: 'center',
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#222',
        height: 60,
    },
    slotEquipped: {
        borderColor: '#FFD700',
        backgroundColor: '#1a1a1a',
    },
    label: {
        color: '#666',
        fontSize: 10,
        position: 'absolute',
        top: 4,
        left: 8,
    },
    iconContainer: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        marginTop: 8,
    },
    itemImage: {
        width: '100%',
        height: '100%',
        borderRadius: 6,
    },
    itemName: {
        color: '#fff',
        fontSize: 13,
        flex: 1,
        marginTop: 6,
    },
});
