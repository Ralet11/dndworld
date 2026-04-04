import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sword, Crosshair } from 'lucide-react-native';

interface Attack {
    id: number;
    name: string;
    range: string;
    bonus: number;
    damage: string;
    damageType: string;
    isEquipped: boolean;
}

interface AttacksSectionProps {
    attacks: Attack[];
    onRollAttack: (attack: Attack) => void;
}

export default function AttacksSection({ attacks, onRollAttack }: AttacksSectionProps) {
    if (!attacks || attacks.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No hay ataques disponibles.</Text>
                <Text style={styles.subText}>Equip a weapon from your inventory.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {attacks.map((attack, index) => (
                <TouchableOpacity
                    key={`${attack.id}-${index}`}
                    style={styles.card}
                    onPress={() => onRollAttack(attack)}
                >
                    <View style={styles.iconContainer}>
                        {attack.range === 'Melee' ?
                            <Sword size={24} color="#F87171" /> :
                            <Crosshair size={24} color="#60A5FA" />
                        }
                    </View>

                    <View style={styles.info}>
                        <Text style={styles.name}>{attack.name}</Text>
                        <Text style={styles.details}>
                            {attack.range} • {attack.damageType}
                        </Text>
                    </View>

                    <View style={styles.stats}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>HIT</Text>
                            <Text style={styles.statValue}>+{attack.bonus}</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>DMG</Text>
                            <Text style={styles.statValue}>{attack.damage}</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: 12,
        paddingBottom: 20,
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 16,
        marginBottom: 4,
    },
    subText: {
        color: '#64748b',
        fontSize: 12,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    info: {
        flex: 1,
    },
    name: {
        color: '#f1f5f9',
        fontSize: 16,
        fontWeight: 'bold',
    },
    details: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 2,
    },
    stats: {
        flexDirection: 'row',
        gap: 8,
    },
    statBox: {
        alignItems: 'center',
        backgroundColor: '#0f172a',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        minWidth: 40,
    },
    statLabel: {
        color: '#64748b',
        fontSize: 9,
        fontWeight: 'bold',
    },
    statValue: {
        color: '#fbbf24',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
