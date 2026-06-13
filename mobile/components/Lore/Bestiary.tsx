import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, Modal, ScrollView,
} from 'react-native';
import { ArrowLeft, Search, BookMarked, Skull, X, Shield, Heart, Star } from 'lucide-react-native';
import Screen from '../UI/Screen';
import Panel from '../UI/Panel';
import PressableScale from '../UI/PressableScale';
import { COLORS, SPACING, TYPO, RADIUS, GLOWS } from '../../constants/Theme';
import socket from '../../services/socket';

interface BestiaryProps {
    onBack: () => void;
}

/**
 * Glosario de NPCs y criaturas estilo Pokédex.
 *
 * Lee el elenco del DM (Characters con is_npc=true) vía socket. El filtrado por
 * "conocimiento del grupo" se aplica si la entrada trae una marca de descubierto
 * (`is_known`); mientras esa mecánica no exista en el backend, se listan todas.
 */
export default function Bestiary({ onBack }: BestiaryProps) {
    const [creatures, setCreatures] = useState<any[]>([]);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<any | null>(null);

    useEffect(() => {
        socket.emit('get-all-npcs');
        const handle = (data: any[]) => setCreatures(data || []);
        socket.on('all-npcs', handle);
        return () => {
            socket.off('all-npcs', handle);
        };
    }, []);

    // Solo entradas conocidas por el grupo (seam para gating futuro).
    const known = useMemo(
        () => creatures.filter((c) => c.is_known !== false),
        [creatures],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return known;
        return known.filter(
            (c) =>
                c.name?.toLowerCase().includes(q) ||
                c.race?.toLowerCase().includes(q) ||
                c.class?.toLowerCase().includes(q),
        );
    }, [known, query]);

    const renderCard = ({ item, index }: { item: any; index: number }) => (
        <PressableScale style={styles.cardWrap} onPress={() => setSelected(item)}>
            <View style={styles.card}>
                <Text style={styles.dexNumber}>#{String(index + 1).padStart(3, '0')}</Text>
                <View style={styles.portraitFrame}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.portrait} />
                    ) : (
                        <Skull size={30} color={COLORS.textMuted} />
                    )}
                </View>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardType} numberOfLines={1}>{item.race || 'Criatura'}</Text>
            </View>
        </PressableScale>
    );

    return (
        <Screen edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
                    <ArrowLeft size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <BookMarked size={16} color={COLORS.amber} />
                    <Text style={styles.headerTitle}>Glosario</Text>
                </View>
                <View style={styles.counter}>
                    <Text style={styles.counterText}>{filtered.length}</Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
                <Search size={18} color={COLORS.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar criatura o NPC..."
                    placeholderTextColor={COLORS.textMuted}
                    value={query}
                    onChangeText={setQuery}
                />
                {query !== '' && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                        <X size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={filtered}
                renderItem={renderCard}
                keyExtractor={(item) => String(item.id)}
                numColumns={3}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        Aún no conoces criaturas ni NPCs. Vívelos en la aventura para registrarlos aquí.
                    </Text>
                }
            />

            <CreatureDetail creature={selected} onClose={() => setSelected(null)} />
        </Screen>
    );
}

function CreatureDetail({ creature, onClose }: { creature: any | null; onClose: () => void }) {
    return (
        <Modal visible={!!creature} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <Panel tone="raised" bronze style={styles.modalCard} padded={false}>
                    {creature && (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.modalHero}>
                                {creature.image_url ? (
                                    <Image source={{ uri: creature.image_url }} style={styles.modalImage} />
                                ) : (
                                    <View style={styles.modalImagePlaceholder}>
                                        <Skull size={60} color={COLORS.textMuted} />
                                    </View>
                                )}
                                <TouchableOpacity style={styles.modalClose} onPress={onClose}>
                                    <X size={22} color={COLORS.textPrimary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalBody}>
                                <Text style={styles.modalName}>{creature.name}</Text>
                                <Text style={styles.modalType}>
                                    {[creature.race, creature.class].filter(Boolean).join(' · ') || 'Criatura'}
                                </Text>

                                <View style={styles.statRow}>
                                    <Stat icon={<Star size={16} color={COLORS.amber} />} label="Nivel" value={creature.level ?? '—'} />
                                    <Stat icon={<Heart size={16} color={COLORS.danger} />} label="PV" value={creature.hp_max ?? '—'} />
                                    <Stat icon={<Shield size={16} color={COLORS.blue} />} label="CA" value={creature.ac_base ?? '—'} />
                                </View>

                                {(creature.notes || creature.abilities_text) ? (
                                    <Text style={styles.modalDesc}>
                                        {creature.notes || creature.abilities_text}
                                    </Text>
                                ) : (
                                    <Text style={styles.modalDescMuted}>Sin información registrada todavía.</Text>
                                )}
                            </View>
                        </ScrollView>
                    )}
                </Panel>
            </View>
        </Modal>
    );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
    return (
        <View style={styles.stat}>
            {icon}
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    headerTitle: { ...TYPO.heading, color: COLORS.textPrimary },
    counter: {
        minWidth: 40,
        height: 40,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.bronzeDark,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.sm,
    },
    counterText: { ...TYPO.subtitle, color: COLORS.bronzeLight },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginHorizontal: SPACING.lg,
        paddingHorizontal: SPACING.md,
        height: 46,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    searchInput: { flex: 1, color: COLORS.textPrimary, ...TYPO.body },
    grid: { padding: SPACING.lg, paddingBottom: 120 },
    row: { gap: SPACING.md, marginBottom: SPACING.md },
    cardWrap: { flex: 1 / 3 },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.bronzeDark,
        padding: SPACING.sm,
        alignItems: 'center',
    },
    dexNumber: { ...TYPO.caption, color: COLORS.textMuted, alignSelf: 'flex-start' },
    portraitFrame: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: SPACING.xs,
        overflow: 'hidden',
    },
    portrait: { width: '100%', height: '100%' },
    cardName: { ...TYPO.caption, color: COLORS.textPrimary, fontWeight: '700' },
    cardType: { fontSize: 10, color: COLORS.textMuted },
    empty: {
        ...TYPO.body,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.xxxl,
        paddingHorizontal: SPACING.xl,
        lineHeight: 21,
    },
    // Detail modal
    modalOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
    },
    modalCard: {
        maxHeight: '85%',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        overflow: 'hidden',
    },
    modalHero: { height: 240, backgroundColor: COLORS.surfaceHighlight },
    modalImage: { width: '100%', height: '100%' },
    modalImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    modalClose: {
        position: 'absolute',
        top: SPACING.md,
        right: SPACING.md,
        width: 38,
        height: 38,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.scrim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBody: { padding: SPACING.xl },
    modalName: { ...TYPO.display, color: COLORS.textPrimary },
    modalType: { ...TYPO.subtitle, color: COLORS.bronzeLight, marginTop: 2 },
    statRow: { flexDirection: 'row', gap: SPACING.md, marginVertical: SPACING.lg },
    stat: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.md,
        gap: 2,
    },
    statValue: { ...TYPO.title, color: COLORS.textPrimary },
    statLabel: { ...TYPO.label, color: COLORS.textMuted },
    modalDesc: { ...TYPO.body, color: COLORS.textSecondary, lineHeight: 22 },
    modalDescMuted: { ...TYPO.body, color: COLORS.textMuted, fontStyle: 'italic' },
});
