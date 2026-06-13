import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/Theme';

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
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.bronze,
    },
    label: {
        color: COLORS.textMuted,
        fontSize: 14,
        fontWeight: 'bold',
    },
    activeLabel: {
        color: COLORS.amber,
    },
});
