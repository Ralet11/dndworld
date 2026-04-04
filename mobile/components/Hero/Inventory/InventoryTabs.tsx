import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type TabType = 'COMBAT' | 'MAGIC' | 'CONSUMABLE';

interface InventoryTabsProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export default function InventoryTabs({ activeTab, onTabChange }: InventoryTabsProps) {
    const tabs: { key: TabType; label: string }[] = [
        { key: 'COMBAT', label: 'Combate' },
        { key: 'MAGIC', label: 'Magia' },
        { key: 'CONSUMABLE', label: 'Consumibles' },
    ];

    return (
        <View style={styles.container}>
            {tabs.map((tab) => (
                <TouchableOpacity
                    key={tab.key}
                    style={[
                        styles.tab,
                        activeTab === tab.key && styles.activeTab
                    ]}
                    onPress={() => onTabChange(tab.key)}
                >
                    <Text style={[
                        styles.label,
                        activeTab === tab.key && styles.activeLabel
                    ]}>
                        {tab.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: '#333',
    },
    label: {
        color: '#666',
        fontSize: 14,
        fontWeight: 'bold',
    },
    activeLabel: {
        color: '#FFD700',
    },
});
