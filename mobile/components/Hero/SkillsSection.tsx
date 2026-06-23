import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle, Circle, Dices } from 'lucide-react-native';
import { COLORS, SPACING, TYPO, RADIUS } from '../../constants/Theme';

interface Skill {
    name: string;
    attr: string;
    bonus: number;
    proficient: boolean;
}

interface SkillsSectionProps {
    skills: Skill[];
    onRoll?: (skill: Skill) => void;
    embedded?: boolean;
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export default function SkillsSection({ skills, onRoll, embedded = false }: SkillsSectionProps) {
    if (!skills || skills.length === 0) return null;

    // Una sola lista con TODAS las habilidades, en orden alfabético para
    // encontrarlas fácil. Las competentes quedan resaltadas (no separadas).
    const ordered = [...skills].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <View style={[styles.group, embedded && styles.groupEmbedded]}>
            {ordered.map((skill, i) => (
                <TouchableOpacity
                    key={`${skill.name}-${i}`}
                    style={[styles.row, embedded && styles.rowEmbedded, i === ordered.length - 1 && styles.lastRow]}
                    activeOpacity={0.7}
                    onPress={() => onRoll?.(skill)}
                >
                    <View style={styles.left}>
                        {skill.proficient
                            ? <CheckCircle size={16} color={COLORS.amber} />
                            : <Circle size={16} color={COLORS.textMuted} />}
                        <Text style={[styles.name, skill.proficient && styles.nameProf]} numberOfLines={1}>
                            {skill.name}
                        </Text>
                        <Text style={styles.attr}>{skill.attr?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.right}>
                        <Text style={[styles.bonus, skill.proficient && styles.bonusProf]}>{sign(skill.bonus)}</Text>
                        <Dices size={13} color={COLORS.textMuted} />
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    group: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
    },
    groupEmbedded: {
        backgroundColor: COLORS.transparent,
        borderWidth: 0,
        borderRadius: 0,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    rowEmbedded: {
        paddingHorizontal: SPACING.sm,
    },
    lastRow: { borderBottomWidth: 0 },
    left: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
    name: { ...TYPO.body, color: COLORS.textSecondary },
    nameProf: { color: COLORS.textPrimary, fontWeight: '700' },
    attr: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.5 },
    right: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    bonus: { ...TYPO.subtitle, color: COLORS.textMuted, fontFamily: 'monospace' },
    bonusProf: { color: COLORS.amber, fontWeight: '800' },
});
