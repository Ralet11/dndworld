import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, SectionList, TextInput, TouchableOpacity,
    Image, Modal, ScrollView,
} from 'react-native';
import {
    ArrowLeft, Search, BookMarked, Skull, X, Shield, Heart, Star,
    Swords, Users, UserCheck, Handshake, Wind, Package, ChevronRight,
} from 'lucide-react-native';
import Screen from '../UI/Screen';
import Panel from '../UI/Panel';
import PressableScale from '../UI/PressableScale';
import { COLORS, SPACING, TYPO, RADIUS } from '../../constants/Theme';
import { getModifier } from '../../utils/DndUtils';
import socket from '../../services/socket';

type NpcType = 'neutral' | 'amigo' | 'compañero' | 'enemigo';

interface BestiaryProps {
    onBack: () => void;
}

const TYPE_CONFIG: Record<NpcType, { label: string; color: string; icon: React.ReactNode; order: number }> = {
    enemigo:   { label: 'Enemigos',    color: COLORS.danger,        icon: <Swords size={13} color={COLORS.danger} />,        order: 0 },
    neutral:   { label: 'Neutrales',   color: COLORS.textSecondary, icon: <Users size={13} color={COLORS.textSecondary} />,  order: 1 },
    amigo:     { label: 'Amigos',      color: COLORS.success,       icon: <Handshake size={13} color={COLORS.success} />,    order: 2 },
    compañero: { label: 'Compañeros',  color: COLORS.amber,         icon: <UserCheck size={13} color={COLORS.amber} />,      order: 3 },
};

const ABILITIES = [
    { label: 'FUE', key: 'STR' },
    { label: 'DES', key: 'DEX' },
    { label: 'CON', key: 'CON' },
    { label: 'INT', key: 'INT' },
    { label: 'SAB', key: 'WIS' },
    { label: 'CAR', key: 'CHA' },
];

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

// ── Componente principal ───────────────────────────────────────────────────────

export default function Bestiary({ onBack }: BestiaryProps) {
    const [creatures, setCreatures] = useState<any[]>([]);
    const [query, setQuery]         = useState('');
    const [selected, setSelected]   = useState<any | null>(null);

    useEffect(() => {
        socket.emit('get-all-npcs');
        const handle = (data: any[]) => setCreatures(data || []);
        socket.on('all-npcs', handle);
        return () => { socket.off('all-npcs', handle); };
    }, []);

    const sections = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = creatures.filter(c => {
            if (c.is_known === false) return false;
            if (!q) return true;
            return (
                c.name?.toLowerCase().includes(q) ||
                c.race?.toLowerCase().includes(q) ||
                c.class?.toLowerCase().includes(q)
            );
        });

        const groups: Record<string, any[]> = {};
        filtered.forEach(c => {
            const type: NpcType = c.npc_type ?? 'neutral';
            if (!groups[type]) groups[type] = [];
            groups[type].push(c);
        });

        return (Object.keys(TYPE_CONFIG) as NpcType[])
            .sort((a, b) => TYPE_CONFIG[a].order - TYPE_CONFIG[b].order)
            .filter(type => groups[type]?.length > 0)
            .map(type => ({
                type,
                title: TYPE_CONFIG[type].label,
                color: TYPE_CONFIG[type].color,
                data: groups[type],
            }));
    }, [creatures, query]);

    const totalVisible = sections.reduce((acc, s) => acc + s.data.length, 0);

    return (
        <Screen edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
                    <ArrowLeft size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <BookMarked size={15} color={COLORS.amber} />
                    <Text style={styles.headerTitle}>Glosario</Text>
                </View>
                <View style={styles.counter}>
                    <Text style={styles.counterText}>{totalVisible}</Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
                <Search size={18} color={COLORS.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar NPC o criatura..."
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

            {/* Lista con secciones */}
            <SectionList
                sections={sections}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => (
                    <SectionHeader
                        label={section.title}
                        color={section.color}
                        count={section.data.length}
                        type={section.type}
                    />
                )}
                renderItem={({ item, section }) => (
                    <NpcRow
                        npc={item}
                        color={section.color}
                        onPress={() => setSelected(item)}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <BookMarked size={36} color={COLORS.textMuted} />
                        <Text style={styles.emptyText}>
                            Aún no hay NPCs registrados.{'\n'}Explora el mundo para conocerlos.
                        </Text>
                    </View>
                }
            />

            <NpcDetail npc={selected} onClose={() => setSelected(null)} />
        </Screen>
    );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, color, count, type }: {
    label: string; color: string; count: number; type: NpcType;
}) {
    return (
        <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: color }]} />
            <View style={styles.sectionHeaderLeft}>
                {TYPE_CONFIG[type].icon}
                <Text style={[styles.sectionTitle, { color }]}>{label}</Text>
            </View>
            <View style={styles.sectionLine} />
            <View style={[styles.sectionCount, { borderColor: color + '55', backgroundColor: color + '15' }]}>
                <Text style={[styles.sectionCountText, { color }]}>{count}</Text>
            </View>
        </View>
    );
}

// ── Fila de NPC ────────────────────────────────────────────────────────────────

function NpcRow({ npc, color, onPress }: { npc: any; color: string; onPress: () => void }) {
    return (
        <PressableScale onPress={onPress}>
            <View style={[styles.npcRow, { borderLeftColor: color, borderLeftWidth: 3 }]}>
                {/* Retrato */}
                <View style={styles.portrait}>
                    {npc.image_url
                        ? <Image source={{ uri: npc.image_url }} style={styles.portraitImg} />
                        : <Skull size={22} color={COLORS.textMuted} />
                    }
                </View>

                {/* Info */}
                <View style={styles.npcInfo}>
                    <Text style={styles.npcName} numberOfLines={1}>{npc.name}</Text>
                    {npc.origin ? (
                        <Text style={styles.npcOrigin} numberOfLines={1}>{npc.origin}</Text>
                    ) : null}
                    <Text style={styles.npcSub} numberOfLines={1}>
                        {[npc.race, npc.class].filter(Boolean).join(' · ') || 'Criatura'}
                    </Text>
                </View>

                {/* Stats rápidos */}
                <View style={styles.npcQuickStats}>
                    {npc.hp_max ? (
                        <View style={styles.quickStat}>
                            <Heart size={10} color={COLORS.danger} />
                            <Text style={styles.quickStatText}>{npc.hp_max}</Text>
                        </View>
                    ) : null}
                    {npc.ac_base ? (
                        <View style={styles.quickStat}>
                            <Shield size={10} color={COLORS.blue} />
                            <Text style={styles.quickStatText}>{npc.ac_base}</Text>
                        </View>
                    ) : null}
                </View>

                <ChevronRight size={16} color={COLORS.textMuted} />
            </View>
        </PressableScale>
    );
}

// ── Modal de detalle ───────────────────────────────────────────────────────────

function NpcDetail({ npc, onClose }: { npc: any | null; onClose: () => void }) {
    if (!npc) return null;
    const type: NpcType = npc.npc_type ?? 'neutral';
    const { color, label } = TYPE_CONFIG[type];

    return (
        <Modal visible={!!npc} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Panel tone="raised" bronze style={styles.sheet} padded={false}>
                    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

                        {/* Banner */}
                        <View style={[styles.banner, { borderBottomColor: color + '44' }]}>
                            {npc.image_url
                                ? <Image source={{ uri: npc.image_url }} style={styles.bannerImg} />
                                : (
                                    <View style={[styles.bannerPlaceholder, { backgroundColor: color + '15' }]}>
                                        <Skull size={60} color={color + '66'} />
                                    </View>
                                )
                            }
                            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                                <X size={20} color={COLORS.textPrimary} />
                            </TouchableOpacity>
                            {/* Tag de tipo sobre la imagen */}
                            <View style={[styles.typeTag, { backgroundColor: color }]}>
                                {TYPE_CONFIG[type].icon}
                                <Text style={styles.typeTagText}>{label}</Text>
                            </View>
                        </View>

                        <View style={styles.detailBody}>
                            <Text style={styles.detailName}>{npc.name}</Text>
                            {npc.origin ? (
                                <Text style={styles.detailOrigin}>{npc.origin}</Text>
                            ) : null}
                            <Text style={styles.detailSub}>
                                {[npc.race, npc.class].filter(Boolean).join(' · ') || 'Criatura'}
                            </Text>

                            {/* Métricas */}
                            <View style={styles.metricsRow}>
                                <Metric icon={<Star size={13} color={COLORS.amber} />}       label="Nivel" value={npc.level ?? '—'} />
                                <Metric icon={<Heart size={13} color={COLORS.danger} />}      label="PV"    value={npc.hp_max ?? '—'} />
                                <Metric icon={<Shield size={13} color={COLORS.blue} />}      label="CA"    value={npc.ac_base ?? '—'} />
                                <Metric icon={<Wind size={13} color={COLORS.textSecondary} />} label="Mov."  value={npc.speed ? `${npc.speed}ft` : '—'} />
                            </View>

                            {/* Atributos — solo compañero y enemigo */}
                            {(type === 'compañero' || type === 'enemigo') && (
                                <AbilityBlock scores={npc.abilityScores} color={color} />
                            )}

                            {/* Contenido específico */}
                            {type === 'compañero' && <CompanionSection npc={npc} color={color} />}
                            {type === 'enemigo'   && <EnemySection npc={npc} color={color} />}

                            {/* Notas — neutral y amigo */}
                            {(type === 'neutral' || type === 'amigo') && (
                                (npc.notes || npc.abilities_text)
                                    ? <>
                                        <Divider label="Notas" color={color} />
                                        <Text style={styles.bodyText}>{npc.notes || npc.abilities_text}</Text>
                                      </>
                                    : <Text style={styles.bodyMuted}>Sin información registrada todavía.</Text>
                            )}
                        </View>
                    </ScrollView>
                </Panel>
            </View>
        </Modal>
    );
}

// ── Bloques de contenido del detalle ──────────────────────────────────────────

function AbilityBlock({ scores, color }: { scores: any[]; color: string }) {
    const map: Record<string, number> = {};
    (scores || []).forEach(s => { map[s.ability] = s.base_value; });

    return (
        <>
            <Divider label="Atributos" color={color} />
            <View style={styles.abilityGrid}>
                {ABILITIES.map(({ label, key }) => {
                    const val = map[key] ?? 10;
                    const mod = getModifier(val);
                    return (
                        <View key={key} style={[styles.abilityCell, { borderColor: color + '33' }]}>
                            <Text style={[styles.abilityLabel, { color }]}>{label}</Text>
                            <Text style={styles.abilityVal}>{val}</Text>
                            <Text style={styles.abilityMod}>{sign(mod)}</Text>
                        </View>
                    );
                })}
            </View>
        </>
    );
}

function CompanionSection({ npc, color }: { npc: any; color: string }) {
    const weapons = (npc.items || []).filter((i: any) => i.type === 'Arma');
    const others  = (npc.items || []).filter((i: any) => i.type !== 'Arma');

    return (
        <>
            {weapons.length > 0 && (
                <>
                    <Divider label="Armas" color={color} />
                    {weapons.map((w: any) => (
                        <View key={w.id} style={styles.itemCard}>
                            <Swords size={15} color={color} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemName}>{w.name}</Text>
                                {(w.damage || w.damage_type) && (
                                    <Text style={styles.itemSub}>{[w.damage, w.damage_type].filter(Boolean).join(' ')}</Text>
                                )}
                            </View>
                        </View>
                    ))}
                </>
            )}
            {others.length > 0 && (
                <>
                    <Divider label="Objetos" color={color} />
                    {others.map((i: any) => (
                        <View key={i.id} style={styles.itemCard}>
                            <Package size={15} color={COLORS.textMuted} />
                            <Text style={styles.itemName}>{i.name}</Text>
                        </View>
                    ))}
                </>
            )}
            {npc.abilities_text ? (
                <>
                    <Divider label="Habilidades" color={color} />
                    <Text style={styles.bodyText}>{npc.abilities_text}</Text>
                </>
            ) : null}
            {npc.notes ? (
                <>
                    <Divider label="Notas" color={color} />
                    <Text style={styles.bodyText}>{npc.notes}</Text>
                </>
            ) : null}
        </>
    );
}

function EnemySection({ npc, color }: { npc: any; color: string }) {
    return (
        <>
            {npc.abilities_text ? (
                <>
                    <Divider label="Acciones" color={color} />
                    <View style={[styles.actionBlock, { borderLeftColor: color }]}>
                        <Text style={styles.bodyText}>{npc.abilities_text}</Text>
                    </View>
                </>
            ) : null}
            {npc.notes ? (
                <>
                    <Divider label="Notas del DM" color={color} />
                    <View style={[styles.actionBlock, { borderLeftColor: color }]}>
                        <Text style={styles.bodyText}>{npc.notes}</Text>
                    </View>
                </>
            ) : null}
            {!npc.abilities_text && !npc.notes && (
                <Text style={styles.bodyMuted}>Sin acciones registradas.</Text>
            )}
        </>
    );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Divider({ label, color }: { label: string; color: string }) {
    return (
        <View style={styles.dividerRow}>
            <Text style={[styles.dividerLabel, { color }]}>{label}</Text>
            <View style={[styles.dividerLine, { backgroundColor: color + '33' }]} />
        </View>
    );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
    return (
        <View style={styles.metric}>
            {icon}
            <Text style={styles.metricVal}>{value}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
        </View>
    );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    },
    iconBtn: {
        width: 40, height: 40, borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    headerTitle: { ...TYPO.heading, color: COLORS.textPrimary },
    counter: {
        minWidth: 40, height: 40, borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surfaceHighlight, borderWidth: 1, borderColor: COLORS.bronzeDark,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.sm,
    },
    counterText: { ...TYPO.subtitle, color: COLORS.bronzeLight },

    searchBar: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
        paddingHorizontal: SPACING.md, height: 44,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    },
    searchInput: { flex: 1, color: COLORS.textPrimary, ...TYPO.body },

    listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },

    // Section header
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center',
        gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.sm,
    },
    sectionDot: { width: 6, height: 6, borderRadius: 3 },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    sectionTitle: { ...TYPO.label },
    sectionLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    sectionCount: {
        minWidth: 26, height: 20, borderRadius: RADIUS.pill,
        borderWidth: 1, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 6,
    },
    sectionCountText: { fontSize: 10, fontWeight: '800' },

    // NPC row
    npcRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
        marginBottom: SPACING.sm, padding: SPACING.md, gap: SPACING.md,
    },
    portrait: {
        width: 48, height: 48, borderRadius: RADIUS.md,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    portraitImg: { width: '100%', height: '100%' },
    npcInfo: { flex: 1 },
    npcName: { ...TYPO.subtitle, color: COLORS.textPrimary },
    npcOrigin: { fontSize: 10, color: COLORS.bronzeLight, marginTop: 1 },
    npcSub: { ...TYPO.caption, color: COLORS.textSecondary, marginTop: 1 },
    npcQuickStats: { gap: 4, alignItems: 'flex-end' },
    quickStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    quickStatText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },

    emptyWrap: { alignItems: 'center', paddingTop: SPACING.xxxl, gap: SPACING.md },
    emptyText: { ...TYPO.body, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

    // Modal
    overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
    sheet: { maxHeight: '90%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, overflow: 'hidden' },

    banner: { height: 200, borderBottomWidth: 1 },
    bannerImg: { width: '100%', height: '100%' },
    bannerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    closeBtn: {
        position: 'absolute', top: SPACING.md, right: SPACING.md,
        width: 36, height: 36, borderRadius: RADIUS.pill,
        backgroundColor: COLORS.scrim, alignItems: 'center', justifyContent: 'center',
    },
    typeTag: {
        position: 'absolute', bottom: SPACING.md, left: SPACING.md,
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: SPACING.sm, paddingVertical: 5,
        borderRadius: RADIUS.pill,
    },
    typeTagText: { fontSize: 11, fontWeight: '800', color: '#fff' },

    detailBody: { padding: SPACING.xl, gap: SPACING.md },
    detailName: { ...TYPO.heading, color: COLORS.textPrimary },
    detailOrigin: { ...TYPO.caption, color: COLORS.bronzeLight, marginTop: 2 },
    detailSub: { ...TYPO.subtitle, color: COLORS.textSecondary, marginTop: 2 },

    metricsRow: { flexDirection: 'row', gap: SPACING.sm },
    metric: {
        flex: 1, alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
        paddingVertical: SPACING.sm, gap: 2,
    },
    metricVal: { ...TYPO.title, color: COLORS.textPrimary },
    metricLabel: { ...TYPO.label, color: COLORS.textMuted },

    abilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    abilityCell: {
        flex: 1, minWidth: 70, alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md, borderWidth: 1,
        paddingVertical: SPACING.sm, gap: 1,
    },
    abilityLabel: { ...TYPO.label },
    abilityVal: { ...TYPO.heading, color: COLORS.textPrimary },
    abilityMod: { ...TYPO.caption, color: COLORS.textSecondary, fontWeight: '700' },

    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    dividerLabel: { ...TYPO.label, flexShrink: 0 },
    dividerLine: { flex: 1, height: 1 },

    itemCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
        padding: SPACING.sm,
    },
    itemName: { ...TYPO.body, color: COLORS.textPrimary, fontWeight: '600' },
    itemSub: { ...TYPO.caption, color: COLORS.textSecondary },

    actionBlock: {
        borderLeftWidth: 2, paddingLeft: SPACING.md,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.sm, padding: SPACING.md,
    },
    bodyText: { ...TYPO.body, color: COLORS.textSecondary, lineHeight: 22 },
    bodyMuted: { ...TYPO.body, color: COLORS.textMuted, fontStyle: 'italic' },
});
