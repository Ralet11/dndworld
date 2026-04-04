import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp, CheckCircle, Circle } from 'lucide-react-native';

interface Skill {
    name: string;
    attr: string;
    bonus: number;
    proficient: boolean;
}

interface SkillsSectionProps {
    skills: Skill[];
}

export default function SkillsSection({ skills }: SkillsSectionProps) {
    if (!skills || skills.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Habilidades</Text>
            </View>

            <View style={styles.list}>
                {skills.map((skill, index) => (
                    <View key={index} style={styles.row}>
                        <View style={styles.skillInfo}>
                            {skill.proficient ? (
                                <CheckCircle size={16} color="#fbbf24" style={styles.icon} />
                            ) : (
                                <Circle size={16} color="#444" style={styles.icon} />
                            )}
                            <Text style={[styles.name, skill.proficient && styles.proficientName]}>
                                {skill.name}
                            </Text>
                            <Text style={styles.attr}>({skill.attr?.toUpperCase()})</Text>
                        </View>
                        <Text style={[styles.bonus, skill.proficient && styles.proficientBonus]}>
                            {skill.bonus >= 0 ? '+' : ''}{skill.bonus}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#222',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#222',
    },
    title: {
        color: '#888',
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: 'bold',
    },
    list: {
        padding: 12,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    skillInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        marginRight: 10,
    },
    name: {
        color: '#aaa',
        fontSize: 15,
        marginRight: 6,
    },
    proficientName: {
        color: '#fff',
        fontWeight: 'bold',
    },
    attr: {
        color: '#666',
        fontSize: 12,
    },
    bonus: {
        color: '#666',
        fontSize: 15,
        fontFamily: 'monospace',
    },
    proficientBonus: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
});
