import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { Dices, Shield, Zap, BookOpen } from 'lucide-react-native';

export type RollType = 'CHECK' | 'SAVE' | 'SKILL';
export type RollMode = 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE';

interface RollSelectorProps {
    visible: boolean;
    onSelect: (type: RollType, stat: string, mode: RollMode) => void;
    onClose: () => void;
}

const ATTRIBUTES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const SKILLS = [
    'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
    'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
    'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
    'Sleight of Hand', 'Stealth', 'Survival'
];

export default function RollSelector({ visible, onSelect, onClose }: RollSelectorProps) {
    const [tab, setTab] = useState<RollType>('CHECK');
    const [mode, setMode] = useState<RollMode>('NORMAL');

    if (!visible) return null;

    const renderGrid = (items: string[]) => (
        <View style={styles.grid}>
            {items.map((item) => (
                <TouchableOpacity
                    key={item}
                    style={styles.gridItem}
                    onPress={() => onSelect(tab, item, mode)}
                >
                    <Text style={styles.itemText}>{item}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

                <BlurView intensity={90} tint="dark" style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Dices size={24} color="#FFD700" />
                        <Text style={styles.title}>Request Roll</Text>
                    </View>

                    {/* Mode Toggle */}
                    <View style={styles.modeContainer}>
                        <TouchableOpacity onPress={() => setMode('DISADVANTAGE')} style={[styles.modeBtn, mode === 'DISADVANTAGE' && styles.modeBtnDis]}>
                            <Text style={[styles.modeText, mode === 'DISADVANTAGE' && styles.modeTextActive]}>Disadvantage</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMode('NORMAL')} style={[styles.modeBtn, mode === 'NORMAL' && styles.modeBtnNorm]}>
                            <Text style={[styles.modeText, mode === 'NORMAL' && styles.modeTextActive]}>Normal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setMode('ADVANTAGE')} style={[styles.modeBtn, mode === 'ADVANTAGE' && styles.modeBtnAdv]}>
                            <Text style={[styles.modeText, mode === 'ADVANTAGE' && styles.modeTextActive]}>Advantage</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, tab === 'CHECK' && styles.activeTab]}
                            onPress={() => setTab('CHECK')}
                        >
                            <Zap size={16} color={tab === 'CHECK' ? '#000' : '#888'} />
                            <Text style={[styles.tabText, tab === 'CHECK' && styles.activeTabText]}>Check</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tab, tab === 'SKILL' && styles.activeTab]}
                            onPress={() => setTab('SKILL')}
                        >
                            <BookOpen size={16} color={tab === 'SKILL' ? '#000' : '#888'} />
                            <Text style={[styles.tabText, tab === 'SKILL' && styles.activeTabText]}>Skill</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tab, tab === 'SAVE' && styles.activeTab]}
                            onPress={() => setTab('SAVE')}
                        >
                            <Shield size={16} color={tab === 'SAVE' ? '#000' : '#888'} />
                            <Text style={[styles.tabText, tab === 'SAVE' && styles.activeTabText]}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 20 }}>
                        {tab === 'CHECK' && (
                            <>
                                <Text style={styles.sectionLabel}>ABILITY CHECKS</Text>
                                {renderGrid(ATTRIBUTES)}
                            </>
                        )}
                        {tab === 'SAVE' && (
                            <>
                                <Text style={styles.sectionLabel}>SAVING THROWS</Text>
                                {renderGrid(ATTRIBUTES)}
                            </>
                        )}
                        {tab === 'SKILL' && (
                            <>
                                <Text style={styles.sectionLabel}>SKILL CHECKS</Text>
                                {renderGrid(SKILLS)}
                            </>
                        )}
                    </ScrollView>
                </BlurView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        paddingTop: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '60%',
        backgroundColor: 'rgba(20,20,20,0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,215,0,0.3)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        gap: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFD700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tabs: {
        flexDirection: 'row',
        marginHorizontal: 20,
        backgroundColor: '#333',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    activeTab: {
        backgroundColor: '#FFD700',
    },
    tabText: {
        color: '#888',
        fontWeight: 'bold',
        fontSize: 12,
    },
    activeTabText: {
        color: '#000',
    },
    // Mode Toggle
    modeContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 16,
        gap: 8,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#222',
        borderWidth: 1,
        borderColor: '#333',
    },
    modeBtnNorm: {
        borderColor: '#666',
        backgroundColor: '#444',
    },
    modeBtnAdv: {
        borderColor: '#10B981', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    modeBtnDis: {
        borderColor: '#EF4444', // Red
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    modeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#666',
        textTransform: 'uppercase',
    },
    modeTextActive: {
        color: '#FFF',
    },
    content: {
        paddingHorizontal: 20,
    },
    sectionLabel: {
        color: '#666',
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 10,
        marginTop: 5,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'space-between',
    },
    gridItem: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        minWidth: '30%',
        flexGrow: 1,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    itemText: {
        color: '#ddd',
        fontSize: 13,
        fontWeight: '600',
    }
});
