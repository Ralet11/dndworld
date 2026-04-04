import React, { useState, useMemo } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Shield, Zap, Target, Scroll, Sparkles, Backpack, User } from 'lucide-react-native';

import HeroStatsHeader from './HeroStatsHeader';
import AttributeHexagon from './AttributeHexagon';
import SkillsSection from './SkillsSection';
import InventorySection from './Inventory/InventorySection';
import MetricCard from './MetricCard';
import PressableScale from '../UI/PressableScale';
import FeaturesList from './FeaturesList';
import SpellsManager from './Spells/SpellsManager';
import { STANDARD_SKILLS, getModifier } from '../../utils/DndUtils';
import socket from '../../services/socket';
import { COLORS } from '../../constants/Theme';

interface CharacterSheetProps {
    character: any;
}

type TabId = 'stats' | 'social' | 'magic' | 'inventory';

const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: 'stats', label: 'Principal', icon: User },
    { id: 'inventory', label: 'Equipo', icon: Backpack },
    { id: 'social', label: 'Rasgos', icon: Scroll },
    { id: 'magic', label: 'Hechizos', icon: Sparkles },
];

export default function CharacterSheet({ character }: CharacterSheetProps) {
    const [activeTab, setActiveTab] = useState<TabId>('stats');

    if (!character) return <View />;

    // Derived stats
    const proficiency = character.proficiencyBonus || 2;
    const initiative = character.stats?.dex ? Math.floor((character.stats.dex - 10) / 2) : 0;

    // Derived Attacks
    const attacks = useMemo(() => {
        const items = character.inventory || [];
        const equipped = character.equipment || {};
        const equippedIds = Object.values(equipped);

        return items
            .filter((item: any) => item.type === 'Arma' && equippedIds.includes(item.id))
            .map((weapon: any) => ({
                id: weapon.id,
                name: weapon.name,
                range: weapon.description?.includes('Alcance') ? 'Ranged' : 'Melee',
                bonus: Math.floor(((character.stats?.str || 10) - 10) / 2) + proficiency,
                damage: weapon.damage || '1d8',
                damageType: weapon.damageType || 'Cortante',
                isEquipped: true
            }));
    }, [character.inventory, character.equipment, character.stats]);

    // Merge Skills
    const fullSkills = useMemo(() => {
        const charSkills = character.skills || [];
        return STANDARD_SKILLS.map(stdSkill => {
            const charSkill = charSkills.find((s: any) => s.name === stdSkill.name);
            const isProficient = (charSkill?.proficiency_level || 0) > 0;
            const abilityScore = character.stats?.[stdSkill.attr] || 10;
            const abilityMod = getModifier(abilityScore);
            return {
                name: stdSkill.name,
                attr: stdSkill.attr,
                bonus: abilityMod + (isProficient ? proficiency : 0),
                proficient: isProficient
            };
        });
    }, [character.skills, character.stats, proficiency]);

    // Content Renderers
    const renderStatsTab = () => (
        <View style={styles.tabContent}>
            {/* Vitals Row */}
            <View style={styles.vitalsGrid}>
                <MetricCard label="CA" value={character.ac} icon={<Shield size={14} color="#60a5fa" />} color="#60a5fa" />
                <MetricCard label="INIC" value={(initiative >= 0 ? '+' : '') + initiative} icon={<Zap size={14} color="#FACC15" />} color="#FACC15" />
                <MetricCard label="VEL" value={`${character.speed}'`} color="#fff" />
                <MetricCard label="PROF" value={`+${proficiency}`} icon={<Target size={14} color="#10B981" />} color="#10B981" />
            </View>

            {/* Attributes Section */}
            <View style={styles.attributesContainer}>
                {/* Row 1: FUE, DES, CON */}
                <View style={styles.attributeRow}>
                    <View style={styles.attributeCol}>
                        {/* Removed PressableScale wrapper for stability */}
                        <AttributeHexagon label="FUE" score={character.stats?.str || 10} modifier={getModifier(character.stats?.str || 10)} />
                    </View>
                    <View style={styles.attributeCol}>
                        <AttributeHexagon label="DES" score={character.stats?.dex || 10} modifier={getModifier(character.stats?.dex || 10)} />
                    </View>
                    <View style={styles.attributeCol}>
                        <AttributeHexagon label="CON" score={character.stats?.con || 10} modifier={getModifier(character.stats?.con || 10)} />
                    </View>
                </View>

                {/* Row 2: INT, SAB, CAR */}
                <View style={styles.attributeRow}>
                    <View style={styles.attributeCol}>
                        <AttributeHexagon label="INT" score={character.stats?.int || 10} modifier={getModifier(character.stats?.int || 10)} />
                    </View>
                    <View style={styles.attributeCol}>
                        <AttributeHexagon label="SAB" score={character.stats?.wis || 10} modifier={getModifier(character.stats?.wis || 10)} />
                    </View>
                    <View style={styles.attributeCol}>
                        <AttributeHexagon label="CAR" score={character.stats?.cha || 10} modifier={getModifier(character.stats?.cha || 10)} />
                    </View>
                </View>
            </View>

            {/* Skills Section */}
            <View style={styles.sectionContainer}>
                <SkillsSection skills={fullSkills} />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <HeroStatsHeader character={character} />

            {/* Tabs */}
            <View style={styles.tabBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
                    {TABS.map((tab) => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tabItem, activeTab === tab.id && styles.activeTabItem]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <tab.icon size={16} color={activeTab === tab.id ? '#fff' : '#64748b'} />
                            <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Main Content */}
            <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
                {activeTab === 'stats' && renderStatsTab()}
                {activeTab === 'inventory' && <InventorySection inventory={character.inventory || []} equipment={character.equipment || {}} characterId={character.id} />}
                {activeTab === 'social' && <FeaturesList
                    abilitiesText={character.abilities_text}
                    raceData={character.raceData}
                    classData={character.classData}
                    level={character.level}
                    archetype={character.archetype_slug}
                    characterId={character.id}
                />}
                {activeTab === 'magic' && <SpellsManager character={character} socket={socket} />}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    tabBar: {
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingVertical: 8,
    },
    tabScroll: {
        paddingHorizontal: 16,
        gap: 12,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    activeTabItem: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.gold,
    },
    tabLabel: {
        marginLeft: 8,
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    activeTabLabel: {
        color: COLORS.gold,
    },
    mainScroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    tabContent: {
        flex: 1,
    },
    vitalsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 12, // Explicit separation
    },
    attributesContainer: {
        marginBottom: 24,
    },
    attributeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    attributeCol: {
        width: '31%',
    },
    sectionContainer: {
        marginTop: 8,
    },
});
