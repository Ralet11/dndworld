import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Dices, X, RotateCw } from 'lucide-react-native';
import Panel from '../UI/Panel';
import { COLORS, SPACING, TYPO, RADIUS, GLOWS } from '../../constants/Theme';

export interface RollTarget {
    title: string;
    modifier: number;
}

interface RollModalProps {
    roll: RollTarget | null;
    onClose: () => void;
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const d20 = () => Math.floor(Math.random() * 20) + 1;

/**
 * Tirada de d20 + modificador. Se abre al tocar un atributo, salvación o
 * habilidad en la hoja. Resalta crítico (20) y pifia (1).
 */
export default function RollModal({ roll, onClose }: RollModalProps) {
    const [natural, setNatural] = useState<number | null>(null);

    const doRoll = () => {
        const n = d20();
        setNatural(n);
        Haptics.notificationAsync(
            n === 20 ? Haptics.NotificationFeedbackType.Success
                : n === 1 ? Haptics.NotificationFeedbackType.Error
                    : Haptics.NotificationFeedbackType.Warning,
        );
    };

    // Re-tira cada vez que cambia el objetivo.
    useEffect(() => {
        if (roll) doRoll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roll]);

    if (!roll) return null;

    const isCrit = natural === 20;
    const isFumble = natural === 1;
    const total = natural != null ? natural + roll.modifier : null;
    const resultColor = isCrit ? COLORS.success : isFumble ? COLORS.danger : COLORS.amber;

    return (
        <Modal visible={!!roll} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
                <Panel tone="raised" bronze style={styles.card} glow>
                    <View style={styles.headerRow}>
                        <View style={styles.titleWrap}>
                            <Dices size={16} color={COLORS.amber} />
                            <Text style={styles.title}>{roll.title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={8}>
                            <X size={20} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.totalRing, GLOWS.rarity(resultColor), { borderColor: resultColor }]}>
                        <Text style={[styles.total, { color: resultColor }]}>{total}</Text>
                    </View>

                    {natural != null && (
                        <Text style={styles.breakdown}>
                            d20 <Text style={styles.natural}>{natural}</Text> {sign(roll.modifier)} mod
                        </Text>
                    )}
                    {isCrit && <Text style={[styles.flair, { color: COLORS.success }]}>¡CRÍTICO!</Text>}
                    {isFumble && <Text style={[styles.flair, { color: COLORS.danger }]}>¡PIFIA!</Text>}

                    <TouchableOpacity style={styles.reroll} onPress={doRoll}>
                        <RotateCw size={16} color={COLORS.bronzeLight} />
                        <Text style={styles.rerollText}>Tirar otra vez</Text>
                    </TouchableOpacity>
                </Panel>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.overlay,
        padding: SPACING.xl,
    },
    card: { width: '78%', alignItems: 'center' },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: SPACING.lg,
    },
    titleWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
    title: { ...TYPO.subtitle, color: COLORS.textPrimary },
    totalRing: {
        width: 110,
        height: 110,
        borderRadius: RADIUS.pill,
        borderWidth: 2,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: SPACING.sm,
    },
    total: { fontSize: 48, fontWeight: '900' },
    breakdown: { ...TYPO.body, color: COLORS.textSecondary, marginTop: SPACING.md },
    natural: { color: COLORS.textPrimary, fontWeight: '800' },
    flair: { ...TYPO.label, marginTop: SPACING.xs, letterSpacing: 2 },
    reroll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginTop: SPACING.lg,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.bronze,
        backgroundColor: COLORS.surfaceHighlight,
    },
    rerollText: { ...TYPO.caption, color: COLORS.bronzeLight, fontWeight: '700' },
});
