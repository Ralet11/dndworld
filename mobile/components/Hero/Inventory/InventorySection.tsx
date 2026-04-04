import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import InventoryTabs from './InventoryTabs';
import EquipmentGrid from './EquipmentGrid';
import ItemCard from './ItemCard';
import ItemDetailModal from './ItemDetailModal';

interface InventorySectionProps {
    inventory: any[];
    equipment: any;
    characterId: number;
}

export default function InventorySection({ inventory, equipment, characterId }: InventorySectionProps) {
    const [equipmentOpen, setEquipmentOpen] = useState(true);
    const [inventoryOpen, setInventoryOpen] = useState(true);
    const [activeTab, setActiveTab] = useState<'COMBAT' | 'MAGIC' | 'CONSUMABLE'>('COMBAT');

    // New State for Modal
    const [selectedItem, setSelectedItem] = useState<any>(null);

    const items = inventory || [];

    // Filter Items Logic (unchanged)
    const filteredItems = useMemo(() => {
        return items.filter((item: any) => {
            if (activeTab === 'COMBAT') return item.type === 'Arma' || item.type === 'Armadura';
            if (activeTab === 'MAGIC') return item.type === 'Objeto Mágico' || item.rarity === 'Raro' || item.rarity === 'Legendario';
            if (activeTab === 'CONSUMABLE') return item.type === 'Consumible';
            return false;
        });
    }, [items, activeTab]);

    const isEquipped = (itemId: number) => {
        if (!equipment) return false;
        return Object.values(equipment).includes(itemId);
    };

    return (
        <View style={styles.container}>

            {/* EQUIPMENT SECTION */}
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.header}
                    onPress={() => setEquipmentOpen(!equipmentOpen)}
                >
                    <Text style={styles.title}>Equipo</Text>
                    {equipmentOpen ? <ChevronUp size={20} color="#666" /> : <ChevronDown size={20} color="#666" />}
                </TouchableOpacity>

                {equipmentOpen && (
                    <EquipmentGrid
                        equipment={equipment}
                        inventory={items}
                        onItemPress={(item) => setSelectedItem(item)} // Handle click on equipped items too
                    />
                )}
            </View>

            {/* INVENTORY SECTION */}
            <View style={styles.section}>
                <TouchableOpacity
                    style={styles.header}
                    onPress={() => setInventoryOpen(!inventoryOpen)}
                >
                    <Text style={styles.title}>Objetos</Text>
                    {inventoryOpen ? <ChevronUp size={20} color="#666" /> : <ChevronDown size={20} color="#666" />}
                </TouchableOpacity>

                {inventoryOpen && (
                    <View>
                        <InventoryTabs activeTab={activeTab} onTabChange={setActiveTab} />

                        {filteredItems.length > 0 ? (
                            filteredItems.map((item: any, idx: number) => (
                                <TouchableOpacity
                                    key={`${item.id}-${idx}`}
                                    onPress={() => setSelectedItem(item)}
                                    activeOpacity={0.7}
                                >
                                    <ItemCard
                                        item={item}
                                        isEquipped={isEquipped(item.id)}
                                        onUse={() => console.log('Use', item.name)}
                                        onEquip={() => console.log('Equip', item.name)}
                                    />
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>No hay objetos en esta categoría.</Text>
                        )}
                    </View>
                )}
            </View>

            {/* Detail Modal */}
            <ItemDetailModal
                visible={!!selectedItem}
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                isEquipped={selectedItem ? isEquipped(selectedItem.id) : false}
                onEquip={() => console.log('Equip via modal', selectedItem?.name)}
            />

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
    },
    section: {
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        color: '#888',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 20,
    }
});
