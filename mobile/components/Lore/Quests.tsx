import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import {
    ArrowLeft, Scroll, User, Star, Coins, Package, X, CheckCircle2, Circle, ChevronRight,
} from 'lucide-react-native';
import Screen from '../UI/Screen';
import Panel from '../UI/Panel';
import PressableScale from '../UI/PressableScale';
import { COLORS, SPACING, TYPO, RADIUS } from '../../constants/Theme';
import socket from '../../services/socket';

interface Reward {
    exp?: number;
    gold?: number;
    items?: string;
    extra?: string;
}

interface Objective {
    id: number;
    text: string;
    completed: boolean;
}

interface Quest {
    id: number;
    title: string;
    type: 'Comun' | 'Epica' | 'Personal' | 'Cadena';
    status: string;
    npc_name?: string;
    description?: string;
    objectives?: Objective[];
    rewards?: Reward;
}

interface QuestsProps {
    onBack: () => void;
}

const TYPE_LABEL: Record<string, string> = {
    Comun: 'Común',
    Epica: 'Épica',
    Personal: 'Personal',
    Cadena: 'Cadena',
};

const TYPE_COLOR: Record<string, string> = {
    Comun: COLORS.textSecondary,
    Epica: COLORS.amber,
    Personal: COLORS.ember,
    Cadena: COLORS.purple,
};

export default function Quests({ onBack }: QuestsProps) {
    const [quests, setQuests] = useState<Quest[]>([]);
    const [selected, setSelected] = useState<Quest | null>(null);

    useEffect(() => {
        socket.emit('get-all-qs');
        const handle = (data: Quest[]) => setQuests(data || []);
        socket.on('all-quests', handle);
        return () => { socket.off('all-quests', handle); };
    }, []);

    const active = useMemo(() => {
        const seen = new Set<string>();
        return quests.filter(q => {
            if (q.status !== 'En Progreso') return false;
            if (seen.has(q.title)) return false;
            seen.add(q.title);
            return true;
        });
    }, [quests]);

    return (
        <Screen edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
                    <ArrowLeft size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Scroll size={15} color={COLORS.amber} />
                    <Text style={styles.headerTitle}>Misiones</Text>
                </View>
                <View style={styles.counter}>
                    <Text style={styles.counterText}>{active.length}</Text>
                </View>
            </View>

            {active.length === 0 ? (
                <View style={styles.emptyWrap}>
                    <Scroll size={40} color={COLORS.textMuted} />
                    <Text style={styles.emptyTitle}>Sin misiones activas</Text>
                    <Text style={styles.emptyCaption}>
                        El DM asignará misiones cuando llegue el momento.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={active}
                    keyExtractor={(q) => String(q.id)}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <QuestRow quest={item} onPress={() => setSelected(item)} />
                    )}
                />
            )}

            <QuestDetail quest={selected} onClose={() => setSelected(null)} />
        </Screen>
    );
}

function QuestRow({ quest, onPress }: { quest: Quest; onPress: () => void }) {
    const typeColor = TYPE_COLOR[quest.type] ?? COLORS.textSecondary;
    const exp = quest.rewards?.exp;

    return (
        <PressableScale onPress={onPress}>
            <View style={styles.row}>
                {/* Barra lateral de tipo */}
                <View style={[styles.typeBar, { backgroundColor: typeColor }]} />

                <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{quest.title}</Text>
                        <ChevronRight size={16} color={COLORS.textMuted} />
                    </View>

                    {quest.npc_name ? (
                        <View style={styles.npcRow}>
                            <User size={11} color={COLORS.bronzeLight} />
                            <Text style={styles.npcText}>{quest.npc_name}</Text>
                        </View>
                    ) : null}

                    {quest.description ? (
                        <Text style={styles.rowDesc} numberOfLines={2}>{quest.description}</Text>
                    ) : null}

                    <View style={styles.rowFooter}>
                        <View style={[styles.typePill, { borderColor: typeColor }]}>
                            <Text style={[styles.typePillText, { color: typeColor }]}>
                                {TYPE_LABEL[quest.type] ?? quest.type}
                            </Text>
                        </View>
                        <View style={styles.expPill}>
                            <Star size={11} color={COLORS.amber} />
                            <Text style={styles.expText}>
                                {exp ? `${exp} XP` : '? XP'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </PressableScale>
    );
}

function QuestDetail({ quest, onClose }: { quest: Quest | null; onClose: () => void }) {
    if (!quest) return null;
    const typeColor = TYPE_COLOR[quest.type] ?? COLORS.textSecondary;
    const rewards = quest.rewards ?? {};
    const objectives = quest.objectives ?? [];
    const done = objectives.filter(o => o.completed).length;

    return (
        <Modal visible={!!quest} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Panel tone="raised" bronze style={styles.sheet} padded={false}>
                    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                        {/* Franja de tipo */}
                        <View style={[styles.sheetBanner, { backgroundColor: typeColor + '22', borderBottomColor: typeColor + '55' }]}>
                            <View style={[styles.typeBadge, { borderColor: typeColor }]}>
                                <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                                    {TYPE_LABEL[quest.type] ?? quest.type}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                                <X size={20} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.sheetBody}>
                            {/* Título */}
                            <Text style={styles.sheetTitle}>{quest.title}</Text>

                            {/* NPC */}
                            {quest.npc_name ? (
                                <View style={styles.sheetNpcRow}>
                                    <User size={14} color={COLORS.bronzeLight} />
                                    <Text style={styles.sheetNpc}>{quest.npc_name}</Text>
                                </View>
                            ) : null}

                            {/* Descripción */}
                            {quest.description ? (
                                <>
                                    <SectionLabel label="Descripción" />
                                    <Text style={styles.sheetDesc}>{quest.description}</Text>
                                </>
                            ) : null}

                            {/* Objetivos */}
                            {objectives.length > 0 ? (
                                <>
                                    <SectionLabel label={`Objetivos ${done}/${objectives.length}`} />
                                    <View style={styles.objectivesList}>
                                        {objectives.map(obj => (
                                            <View key={obj.id} style={styles.objectiveRow}>
                                                {obj.completed
                                                    ? <CheckCircle2 size={16} color={COLORS.success} />
                                                    : <Circle size={16} color={COLORS.textMuted} />
                                                }
                                                <Text style={[
                                                    styles.objectiveText,
                                                    obj.completed && styles.objectiveDone,
                                                ]}>
                                                    {obj.text}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            ) : null}

                            {/* Recompensa */}
                            <SectionLabel label="Recompensa" />
                            <View style={styles.rewardGrid}>
                                <RewardBlock
                                    icon={<Star size={18} color={COLORS.amber} />}
                                    label="Experiencia"
                                    value={rewards.exp ? `${rewards.exp} XP` : 'Por determinar'}
                                    color={COLORS.amber}
                                />
                                {rewards.gold ? (
                                    <RewardBlock
                                        icon={<Coins size={18} color={COLORS.gold} />}
                                        label="Oro"
                                        value={`${rewards.gold} po`}
                                        color={COLORS.gold}
                                    />
                                ) : null}
                                {rewards.items ? (
                                    <RewardBlock
                                        icon={<Package size={18} color={COLORS.ember} />}
                                        label="Objetos"
                                        value={rewards.items}
                                        color={COLORS.ember}
                                    />
                                ) : null}
                                {rewards.extra ? (
                                    <RewardBlock
                                        icon={<Package size={18} color={COLORS.textSecondary} />}
                                        label="Extra"
                                        value={rewards.extra}
                                        color={COLORS.textSecondary}
                                    />
                                ) : null}
                            </View>
                        </View>
                    </ScrollView>
                </Panel>
            </View>
        </Modal>
    );
}

function SectionLabel({ label }: { label: string }) {
    return (
        <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>{label}</Text>
            <View style={styles.sectionLine} />
        </View>
    );
}

function RewardBlock({ icon, label, value, color }: {
    icon: React.ReactNode; label: string; value: string; color: string;
}) {
    return (
        <View style={[styles.rewardBlock, { borderColor: color + '44' }]}>
            {icon}
            <Text style={[styles.rewardValue, { color }]}>{value}</Text>
            <Text style={styles.rewardLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    iconBtn: {
        width: 40, height: 40,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surface,
        borderWidth: 1, borderColor: COLORS.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    headerTitle: { ...TYPO.heading, color: COLORS.textPrimary },
    counter: {
        minWidth: 40, height: 40,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1, borderColor: COLORS.bronzeDark,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: SPACING.sm,
    },
    counterText: { ...TYPO.subtitle, color: COLORS.bronzeLight },

    // Empty
    emptyWrap: {
        flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
        paddingHorizontal: SPACING.xl,
    },
    emptyTitle: { ...TYPO.subtitle, color: COLORS.textSecondary, marginTop: SPACING.md },
    emptyCaption: { ...TYPO.body, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

    // List
    list: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 120 },

    // Quest row
    row: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.bronzeDark,
        overflow: 'hidden',
    },
    typeBar: { width: 4 },
    rowBody: { flex: 1, padding: SPACING.md, gap: SPACING.xs },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
    rowTitle: { ...TYPO.subtitle, color: COLORS.textPrimary, flex: 1 },
    npcRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    npcText: { ...TYPO.caption, color: COLORS.bronzeLight, fontStyle: 'italic' },
    rowDesc: { ...TYPO.caption, color: COLORS.textSecondary, lineHeight: 18 },
    rowFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
    typePill: {
        borderWidth: 1, borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm, paddingVertical: 2,
    },
    typePillText: { fontSize: 10, fontWeight: '700' },
    expPill: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(245,158,11,0.1)',
        borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm, paddingVertical: 2,
    },
    expText: { fontSize: 10, fontWeight: '700', color: COLORS.amber },

    // Modal
    overlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
    },
    sheet: {
        maxHeight: '88%',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        overflow: 'hidden',
    },
    sheetBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
    },
    typeBadge: {
        borderWidth: 1, borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.md, paddingVertical: 4,
    },
    typeBadgeText: { ...TYPO.label },
    closeBtn: {
        width: 36, height: 36,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surface,
        borderWidth: 1, borderColor: COLORS.border,
        alignItems: 'center', justifyContent: 'center',
    },
    sheetBody: { padding: SPACING.xl, gap: SPACING.lg },
    sheetTitle: { ...TYPO.heading, color: COLORS.textPrimary, lineHeight: 30 },
    sheetNpcRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    sheetNpc: { ...TYPO.subtitle, color: COLORS.bronzeLight, fontStyle: 'italic' },
    sheetDesc: { ...TYPO.body, color: COLORS.textSecondary, lineHeight: 22 },

    // Section label
    sectionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    sectionLabel: { ...TYPO.label, color: COLORS.bronzeLight, flexShrink: 0 },
    sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.bronzeDark },

    // Objectives
    objectivesList: { gap: SPACING.sm },
    objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    objectiveText: { ...TYPO.body, color: COLORS.textSecondary, flex: 1, lineHeight: 20 },
    objectiveDone: { color: COLORS.textMuted, textDecorationLine: 'line-through' },

    // Rewards
    rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    rewardBlock: {
        flex: 1, minWidth: 120,
        alignItems: 'center', gap: 4,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.sm,
    },
    rewardValue: { ...TYPO.title, textAlign: 'center' },
    rewardLabel: { ...TYPO.label, color: COLORS.textMuted, textAlign: 'center' },
});
