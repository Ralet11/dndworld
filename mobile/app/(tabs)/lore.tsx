import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Map as MapIcon, BookMarked, Scroll, ChevronRight, ArrowLeft } from 'lucide-react-native';
import Screen from '../../components/UI/Screen';
import PressableScale from '../../components/UI/PressableScale';
import InteractiveMap from '../../components/Atlas/InteractiveMap';
import Bestiary from '../../components/Lore/Bestiary';
import Quests from '../../components/Lore/Quests';
import { COLORS, SPACING, TYPO, RADIUS, GLOWS } from '../../constants/Theme';

type LoreView = 'menu' | 'map' | 'bestiary' | 'quests';

/**
 * Lore — hub de conocimiento del mundo.
 * Al entrar, el jugador elige Mapa o Glosario (bestiario tipo Pokédex).
 */
export default function LoreScreen() {
    const [view, setView] = useState<LoreView>('menu');

    if (view === 'map') {
        return (
            <View style={styles.full}>
                <InteractiveMap />
                <BackFab onPress={() => setView('menu')} />
            </View>
        );
    }

    if (view === 'bestiary') {
        return <Bestiary onBack={() => setView('menu')} />;
    }

    if (view === 'quests') {
        return <Quests onBack={() => setView('menu')} />;
    }

    return (
        <Screen scroll>
            <Text style={styles.kicker}>Conocimiento del mundo</Text>
            <Text style={styles.title}>Lore</Text>

            <View style={styles.cards}>
                <LoreCard
                    title="Mapa"
                    subtitle="El Atlas del mundo y sus lugares"
                    icon={<MapIcon size={30} color={COLORS.amber} />}
                    colors={['#1A2A2E', '#11191A']}
                    onPress={() => setView('map')}
                />
                <LoreCard
                    title="Glosario"
                    subtitle="NPCs y criaturas que conoces"
                    icon={<BookMarked size={30} color={COLORS.ember} />}
                    colors={['#2A1E18', '#11191A']}
                    onPress={() => setView('bestiary')}
                />
                <LoreCard
                    title="Misiones"
                    subtitle="Las misiones activas de la party"
                    icon={<Scroll size={30} color={COLORS.amber} />}
                    colors={['#1E2410', '#11191A']}
                    onPress={() => setView('quests')}
                />
            </View>
        </Screen>
    );
}

function LoreCard({
    title,
    subtitle,
    icon,
    colors,
    onPress,
}: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    colors: [string, string];
    onPress: () => void;
}) {
    return (
        <PressableScale onPress={onPress} style={styles.cardWrap}>
            <LinearGradient colors={colors} style={styles.card}>
                <View style={styles.iconBox}>{icon}</View>
                <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle}>{subtitle}</Text>
                </View>
                <ChevronRight size={22} color={COLORS.textMuted} />
            </LinearGradient>
        </PressableScale>
    );
}

function BackFab({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity style={[styles.backFab, GLOWS.ember]} onPress={onPress}>
            <ArrowLeft size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    full: { flex: 1, backgroundColor: COLORS.background },
    kicker: {
        ...TYPO.label,
        color: COLORS.bronzeLight,
        marginTop: SPACING.sm,
    },
    title: {
        ...TYPO.display,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xl,
    },
    cards: { gap: SPACING.lg },
    cardWrap: {
        borderRadius: RADIUS.lg,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.lg,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.bronzeDark,
        gap: SPACING.lg,
    },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: RADIUS.md,
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardText: { flex: 1 },
    cardTitle: { ...TYPO.title, color: COLORS.textPrimary },
    cardSubtitle: { ...TYPO.caption, color: COLORS.textSecondary, marginTop: 2 },
    backFab: {
        position: 'absolute',
        top: 48,
        left: 16,
        width: 44,
        height: 44,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surfaceRaised,
        borderWidth: 1,
        borderColor: COLORS.bronze,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
