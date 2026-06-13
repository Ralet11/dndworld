import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronRight, Sparkles, Lock } from 'lucide-react-native';
import { DOTE_TREES, DoteOption } from '../../constants/doteTrees';
import socket from '../../services/socket';
import { COLORS, SPACING, TYPO, RADIUS } from '../../constants/Theme';

interface ArmorTalentsProps {
    character: any;
}

const TREE_COLOR: Record<string, string> = {
    agilidad: COLORS.success,
    aguante: COLORS.danger,
    espiritu: COLORS.blue || COLORS.amber,
};

export default function ArmorTalents({ character }: ArmorTalentsProps) {
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));

    const talents = character?.talents ?? { espiritu: 0, agilidad: 0, aguante: 0 };
    const thresholds = character?.talentThresholds ?? { espiritu: [], agilidad: [], aguante: [] };
    const choices = character?.talent_choices ?? {};

    const choose = (tree: string, th: number, option: DoteOption) => {
        if (!character?.id) return;
        socket.emit('choose-talent', { characterId: character.id, tree, threshold: th, option });
    };

    return (
        <View style={styles.container}>
            {/* TALENTOS ACUMULADOS — tira compacta */}
            <View style={styles.summaryStrip}>
                {DOTE_TREES.map((tree) => {
                    const val = talents[tree.key] || 0;
                    const color = TREE_COLOR[tree.key];
                    return (
                        <View key={tree.key} style={styles.summaryChip}>
                            <Text style={[styles.summaryVal, { color }]}>{val}</Text>
                            <Text style={styles.summaryName}>{tree.name}</Text>
                        </View>
                    );
                })}
            </View>

            {/* ÁRBOLES DE DOTE */}
            {DOTE_TREES.map((tree) => {
                const val = talents[tree.key] || 0;
                const unlocked: number[] = thresholds[tree.key] || [];
                const color = TREE_COLOR[tree.key];
                const isOpen = !!open[tree.key];
                return (
                    <View key={tree.key} style={[styles.card, { borderLeftColor: color }]}>
                        <TouchableOpacity style={styles.header} onPress={() => toggle(tree.key)} activeOpacity={0.7}>
                            <View style={styles.headerLeft}>
                                <Text style={[styles.title, { color }]}>Árbol de {tree.name}</Text>
                                <Text style={styles.headerBadge}>{unlocked.length}/4</Text>
                            </View>
                            {isOpen ? <ChevronDown size={18} color={color} /> : <ChevronRight size={18} color={COLORS.textMuted} />}
                        </TouchableOpacity>

                        {isOpen && (
                            <View style={styles.treeBody}>
                                <Text style={styles.treeBlurb}>{tree.blurb}</Text>
                                {tree.tiers.map((tier) => {
                                    const reached = val >= tier.th;
                                    const chosen: DoteOption | undefined = choices[tree.key]?.[String(tier.th)];
                                    const opts: { key: DoteOption; dote: typeof tier.a }[] = [
                                        { key: 'a', dote: tier.a },
                                        { key: 'b', dote: tier.b },
                                        { key: 'c', dote: tier.c },
                                    ];
                                    return (
                                        <View key={tier.th} style={[styles.tier, !reached && styles.tierLocked]}>
                                            <View style={styles.tierHead}>
                                                {reached
                                                    ? <Sparkles size={13} color={color} />
                                                    : <Lock size={13} color={COLORS.textMuted} />}
                                                <Text style={[styles.tierTitle, { color: reached ? color : COLORS.textMuted }]}>
                                                    Umbral {tier.th}{reached ? (chosen ? ' · elegido' : ' · elegí uno') : ` · requiere ${tier.th} ${tree.name}`}
                                                </Text>
                                            </View>
                                            {reached && opts.map(({ key, dote }) => {
                                                const isChosen = chosen === key;
                                                return (
                                                    <TouchableOpacity
                                                        key={key}
                                                        activeOpacity={0.8}
                                                        onPress={() => choose(tree.key, tier.th, key)}
                                                        style={[styles.option, isChosen && { borderColor: color, backgroundColor: `${color}1A` }]}
                                                    >
                                                        <View style={styles.optHead}>
                                                            <Text style={[styles.optName, isChosen && { color }]}>{key.toUpperCase()} · {dote.name}</Text>
                                                            {isChosen && <Text style={[styles.optTag, { color }]}>✓ elegido</Text>}
                                                        </View>
                                                        <Text style={styles.optDesc}>{dote.desc}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                            {reached && <Text style={styles.pickHint}>Tocá para elegir (volvé a tocar para deshacer).</Text>}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: SPACING.md, paddingBottom: SPACING.xl },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderLeftWidth: 4,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.lg,
        gap: SPACING.sm,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
    headerBadge: {
        ...TYPO.label,
        color: COLORS.textMuted,
        backgroundColor: COLORS.surfaceHighlight,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 1,
        borderRadius: RADIUS.pill,
        fontSize: 10,
    },
    title: {
        ...TYPO.subtitle,
        color: COLORS.textPrimary,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginLeft: SPACING.sm,
    },
    // Talentos — tira compacta
    summaryStrip: { flexDirection: 'row', gap: SPACING.sm },
    summaryChip: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.sm,
    },
    summaryVal: { ...TYPO.subtitle, fontWeight: '800' },
    summaryName: { ...TYPO.label, color: COLORS.textMuted, fontSize: 9, marginTop: 1 },
    // Árbol
    treeBody: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.md },
    treeBlurb: { ...TYPO.caption, color: COLORS.textMuted, fontStyle: 'italic' },
    tier: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: SPACING.md,
        gap: SPACING.sm,
    },
    tierLocked: { opacity: 0.55 },
    tierHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    tierTitle: { ...TYPO.label, fontWeight: '700' },
    option: {
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: RADIUS.sm,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    optHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
    optName: { ...TYPO.body, color: COLORS.textPrimary, fontWeight: '700', flex: 1 },
    optTag: { ...TYPO.label, fontSize: 10, fontWeight: '800' },
    optDesc: { ...TYPO.caption, color: COLORS.textSecondary, lineHeight: 18 },
    pickHint: { ...TYPO.caption, color: COLORS.textMuted, fontStyle: 'italic' },
});
