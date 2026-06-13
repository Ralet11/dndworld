import React, { useState, useMemo } from 'react';
import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Shield, Zap, Eye, Target, Footprints, Heart, Scroll, Sparkles, Backpack, User, Wind } from 'lucide-react-native';

import HeroStatsHeader from './HeroStatsHeader';
import AttributeHex from './AttributeHex';
import SkillsSection from './SkillsSection';
import InventorySection from './Inventory/InventorySection';
import FeaturesList from './FeaturesList';
import SpellsManager from './Spells/SpellsManager';
import RollModal, { RollTarget } from './RollModal';
import Panel from '../UI/Panel';
import SectionHeader from '../UI/SectionHeader';
import { STANDARD_SKILLS, getModifier } from '../../utils/DndUtils';
import socket from '../../services/socket';
import { COLORS, SPACING, TYPO, RADIUS } from '../../constants/Theme';

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

const ABILITIES: { label: string; key: string }[] = [
    { label: 'FUE', key: 'str' },
    { label: 'DES', key: 'dex' },
    { label: 'CON', key: 'con' },
    { label: 'INT', key: 'int' },
    { label: 'SAB', key: 'wis' },
    { label: 'CAR', key: 'cha' },
];

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

const hpColor = (hp: number, max: number) => {
    const pct = max > 0 ? hp / max : 0;
    if (pct >= 0.5) return COLORS.success;
    if (pct >= 0.25) return COLORS.warning;
    return COLORS.danger;
};

// XP acumulada para alcanzar cada nivel (D&D estándar). Índice = nivel - 1.
const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

// Progreso de XP dentro del nivel actual.
const xpProgress = (level: number, xp: number) => {
    const lvl = Math.max(1, Math.min(20, level || 1));
    const cur = XP_THRESHOLDS[lvl - 1] ?? 0;
    const next = XP_THRESHOLDS[lvl] ?? cur; // nivel 20 = tope
    const gained = Math.max(0, (xp || 0) - cur);
    const needed = Math.max(0, next - cur);
    const isMax = lvl >= 20;
    const pct = isMax ? 100 : needed > 0 ? Math.min(100, (gained / needed) * 100) : 0;
    return { gained, needed, pct, isMax };
};

export default function CharacterSheet({ character }: CharacterSheetProps) {
    const [activeTab, setActiveTab] = useState<TabId>('stats');
    const [rollTarget, setRollTarget] = useState<RollTarget | null>(null);

    if (!character) return <View />;

    const proficiency = character.proficiencyBonus || 2;
    const initiative = character.initiative ?? getModifier(character.stats?.dex || 10);
    const passivePerception = character.passivePerception ?? 10 + getModifier(character.stats?.wis || 10);

    const abilityMod = (key: string) => getModifier(character.stats?.[key] || 10);

    // Salvaciones: usa lo calculado por el motor, con fallback al modificador.
    const saveFor = (key: string) => {
        const st = character.savingThrows?.[key];
        return { mod: st?.mod ?? abilityMod(key), proficient: !!st?.proficient };
    };

    const fullSkills = useMemo(() => {
        const charSkills = character.skills || [];
        return STANDARD_SKILLS.map((stdSkill: any) => {
            const charSkill = charSkills.find((s: any) => s.name === stdSkill.name);
            const isProficient = (charSkill?.proficiency_level || 0) > 0;
            const mod = getModifier(character.stats?.[stdSkill.attr] || 10);
            return {
                name: stdSkill.name,
                attr: stdSkill.attr,
                bonus: mod + (isProficient ? proficiency : 0),
                proficient: isProficient,
            };
        });
    }, [character.skills, character.stats, proficiency]);

    const renderStatsTab = () => (
        <View style={styles.tabContent}>
            {/* VITALES */}
            <SectionHeader title="Vitales" icon={<Heart size={14} color={COLORS.bronzeLight} />} />

            {/* HP */}
            <Panel bronze padded style={styles.hpPanel}>
                <View style={styles.hpHeader}>
                    <View style={styles.hpLabelWrap}>
                        <Heart size={16} color={COLORS.danger} />
                        <Text style={styles.hpLabel}>Puntos de Vida</Text>
                    </View>
                    <Text style={styles.hpValue}>
                        <Text style={{ color: hpColor(character.hp, character.maxHp) }}>{character.hp}</Text>
                        <Text style={styles.hpMax}> / {character.maxHp}</Text>
                    </Text>
                </View>
                <View style={styles.hpBarTrack}>
                    <View
                        style={[
                            styles.hpBarFill,
                            {
                                width: `${Math.min(100, Math.max(0, (character.hp / character.maxHp) * 100))}%`,
                                backgroundColor: hpColor(character.hp, character.maxHp),
                            },
                        ]}
                    />
                </View>

                {/* EXP — barra fina minimalista */}
                {(() => {
                    const xp = xpProgress(character.level, character.xp);
                    return (
                        <View style={styles.xpRow}>
                            <Text style={styles.xpLabel}>EXP</Text>
                            <View style={styles.xpTrack}>
                                <View style={[styles.xpFill, { width: `${xp.pct}%` }]} />
                            </View>
                            <Text style={styles.xpValue}>
                                {xp.isMax ? 'MÁX' : `${xp.gained}/${xp.needed}`}
                            </Text>
                        </View>
                    );
                })()}
            </Panel>

            {/* Chips */}
            <View style={styles.chipRow}>
                <VitalChip icon={<Shield size={16} color={COLORS.blue} />} value={character.ac} label="CA" />
                {character.dodge?.die ? (
                    <VitalChip icon={<Wind size={16} color={COLORS.amber} />} value={`1d${character.dodge.die}`} label="Esquive" />
                ) : null}
                <VitalChip icon={<Zap size={16} color={COLORS.amber} />} value={sign(initiative)} label="Inic." />
                <VitalChip icon={<Footprints size={16} color={COLORS.textPrimary} />} value={`${character.speed}'`} label="Vel." />
                <VitalChip icon={<Eye size={16} color={COLORS.success} />} value={passivePerception} label="Perc." />
                <VitalChip icon={<Target size={16} color={COLORS.bronzeLight} />} value={`+${proficiency}`} label="Comp." />
            </View>

            {/* ATRIBUTOS */}
            <View style={styles.sectionGap}>
                <SectionHeader title="Atributos" icon={<Sparkles size={14} color={COLORS.bronzeLight} />} />
                <Text style={styles.hint}>Toca un atributo para tirar una prueba</Text>
                <View style={styles.hexGrid}>
                    {ABILITIES.map((a) => (
                        <View key={a.key} style={styles.hexCol}>
                            <AttributeHex
                                label={a.label}
                                score={character.stats?.[a.key] || 10}
                                modifier={abilityMod(a.key)}
                                onPress={() => setRollTarget({ title: `Prueba de ${a.label}`, modifier: abilityMod(a.key) })}
                            />
                        </View>
                    ))}
                </View>
            </View>

            {/* SALVACIONES */}
            <View style={styles.sectionGap}>
                <SectionHeader title="Salvaciones" icon={<Shield size={14} color={COLORS.bronzeLight} />} />
                <View style={styles.saveGrid}>
                    {ABILITIES.map((a) => {
                        const s = saveFor(a.key);
                        return (
                            <TouchableOpacity
                                key={a.key}
                                style={[styles.saveItem, s.proficient && styles.saveItemProf]}
                                activeOpacity={0.7}
                                onPress={() => setRollTarget({ title: `Salvación de ${a.label}`, modifier: s.mod })}
                            >
                                <Text style={[styles.saveLabel, s.proficient && { color: COLORS.amber }]}>{a.label}</Text>
                                <Text style={[styles.saveMod, s.proficient && { color: COLORS.amber }]}>{sign(s.mod)}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* HABILIDADES */}
            <View style={styles.sectionGap}>
                <SectionHeader title="Habilidades" icon={<Target size={14} color={COLORS.bronzeLight} />} />
                <SkillsSection
                    skills={fullSkills}
                    onRoll={(skill) => setRollTarget({ title: skill.name, modifier: skill.bonus })}
                />
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
                            <tab.icon size={16} color={activeTab === tab.id ? COLORS.textPrimary : COLORS.textMuted} />
                            <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Main Content */}
            <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
                {activeTab === 'stats' && renderStatsTab()}
                {activeTab === 'inventory' && <InventorySection inventory={character.inventory || []} equipment={character.equipment || {}} characterId={character.id} character={character} figureUrl={character.rendered_url || character.base_body_url || character.image_url} hasBaseBody={!!character.base_body_url} renderPrompt={character.render_prompt} talents={character.talents} talentChoices={character.talent_choices} />}
                {activeTab === 'social' && <FeaturesList
                    abilitiesText={character.abilities_text}
                    raceData={character.raceData}
                    classData={character.classData}
                    classes={character.classes}
                    level={character.level}
                    archetype={character.archetype_slug}
                    characterId={character.id}
                    featureChoices={character.feature_choices}
                />}
                {activeTab === 'magic' && <SpellsManager character={character} socket={socket} />}
            </ScrollView>

            <RollModal roll={rollTarget} onClose={() => setRollTarget(null)} />
        </View>
    );
}

function VitalChip({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
    return (
        <View style={styles.chip}>
            {icon}
            <Text style={styles.chipValue}>{value}</Text>
            <Text style={styles.chipLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    tabBar: {
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingVertical: 8,
    },
    tabScroll: { paddingHorizontal: SPACING.lg, gap: SPACING.md },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: SPACING.lg,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    activeTabItem: {
        backgroundColor: COLORS.surface,
        borderColor: COLORS.bronze,
    },
    tabLabel: {
        marginLeft: SPACING.sm,
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    activeTabLabel: { color: COLORS.bronzeLight },
    mainScroll: { flex: 1 },
    scrollContent: { padding: SPACING.lg, paddingBottom: 100 },
    // OJO: sin flex:1. Un hijo con flex:1 dentro de un ScrollView se clampea al
    // alto de pantalla y recorta (no scrollea) el contenido de abajo.
    tabContent: {},

    // HP
    hpPanel: { marginBottom: SPACING.lg },
    hpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    hpLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    hpLabel: { ...TYPO.label, color: COLORS.textSecondary },
    hpValue: { ...TYPO.heading },
    hpMax: { color: COLORS.textMuted, fontSize: 16, fontWeight: '700' },
    hpBarTrack: {
        height: 12,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.background,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    hpBarFill: { height: '100%', borderRadius: RADIUS.pill },

    // EXP — barra fina minimalista (violeta)
    xpRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
    xpLabel: { ...TYPO.label, fontSize: 8, color: '#A855F7', letterSpacing: 1 },
    xpTrack: {
        flex: 1,
        height: 4,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.background,
        overflow: 'hidden',
    },
    xpFill: { height: '100%', borderRadius: RADIUS.pill, backgroundColor: '#A855F7' },
    xpValue: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted },

    // Chips
    chipRow: { flexDirection: 'row', gap: SPACING.sm },
    chip: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        gap: 2,
    },
    chipValue: { ...TYPO.subtitle, color: COLORS.textPrimary, fontWeight: '800' },
    chipLabel: { ...TYPO.label, fontSize: 9, color: COLORS.textMuted },

    sectionGap: { marginTop: SPACING.xxl },
    hint: { ...TYPO.caption, color: COLORS.textMuted, marginTop: -SPACING.sm, marginBottom: SPACING.md, fontStyle: 'italic' },

    // Hexágonos
    hexGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACING.md },
    hexCol: { width: '31%' },

    // Salvaciones
    saveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    saveItem: {
        width: '31.5%',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        gap: 2,
    },
    saveItemProf: { borderColor: COLORS.bronze, backgroundColor: COLORS.surfaceHighlight },
    saveLabel: { ...TYPO.label, color: COLORS.textSecondary },
    saveMod: { ...TYPO.subtitle, color: COLORS.textPrimary, fontWeight: '800' },
});
