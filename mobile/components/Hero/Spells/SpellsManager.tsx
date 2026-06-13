import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, FlatList, Modal, Image, ActivityIndicator, SectionList, Alert } from 'react-native';
import { Sparkles, Search, BookOpen, Plus, Minus, Check, X, Flame, Scroll as ScrollIcon, ChevronDown, ChevronRight, Languages } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { COLORS } from '../../../constants/Theme';

interface SpellsManagerProps {
    character: any;
    socket: any;
}

type SpellCastingType = 'wizard' | 'divine' | 'known';

const getSpellCastingType = (classSlug: string): SpellCastingType => {
    const slug = classSlug?.toLowerCase() || '';
    if (slug.includes('wizard') || slug.includes('mago')) return 'wizard';
    if (slug.includes('cleric') || slug.includes('druid') || slug.includes('paladin') || slug.includes('clerigo')) return 'divine';
    return 'known';
};

export default function SpellsManager({ character, socket }: SpellsManagerProps) {
    const casterType = useMemo(() => getSpellCastingType(character.class_slug || character.class), [character.class_slug, character.class]);

    // Tabs depend on caster type
    // Wizard: library (all), book (known), prepared
    // Divine: library (all), prepared
    // Known: library (all), known

    // Simplified logic for UI state:
    // 'library': The full class list
    // 'book': Known spells (Wizard/Known)
    // 'prepared': Prepared spells (Wizard/Divine)
    const [activeTab, setActiveTab] = useState<string>('book'); // Default start

    const [classSpells, setClassSpells] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSpell, setSelectedSpell] = useState<any>(null);
    const [showTrans, setShowTrans] = useState(false);
    const [translating, setTranslating] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [isSwitchingTab, setIsSwitchingTab] = useState(false);

    // Initial Tab Selection based on type
    useEffect(() => {
        if (casterType === 'divine') setActiveTab('prepared');
        else setActiveTab('book');
    }, [casterType]);

    const handleTabChange = (tab: string) => {
        if (tab === activeTab) return;
        setIsSwitchingTab(true);
        // Defer update to allow UI to show loading state
        setTimeout(() => {
            setActiveTab(tab);
            setIsSwitchingTab(false);
        }, 10);
    };


    const [slots, setSlots] = useState<any>(character.spell_slots || {});

    useEffect(() => {
        if (character.spell_slots) setSlots(character.spell_slots);
    }, [character.spell_slots]);

    useEffect(() => {
        setIsFetching(true);
        // Multiclase: combinar la lista de conjuros de TODAS las clases.
        const slugs = (character.classes && character.classes.length)
            ? character.classes.map((c: any) => c.slug)
            : (character.class_slug ? [character.class_slug] : (character.class ? [character.class] : []));
        if (slugs.length) {
            socket.emit('get-class-spells', { class_names: slugs });
        }

        const handleSpells = (spells: any[]) => {
            const sorted = spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
            setClassSpells(sorted);
            setIsFetching(false);
        };

        socket.on('class-spells-result', handleSpells);
        return () => {
            socket.off('class-spells-result', handleSpells);
        };
    }, [character.class, character.class_slug, character.classes]);



    // Detail Fetch
    useEffect(() => {
        const handleDetail = (fullSpell: any) => {
            if (activeSpellRef.current && activeSpellRef.current.slug === fullSpell.slug) {
                setSelectedSpell(fullSpell);
            }
        };
        socket.on('spell-details-result', handleDetail);
        return () => {
            socket.off('spell-details-result', handleDetail);
        };
    }, []);

    // Traducción (cacheada): respuesta de la IA / del caché del server.
    useEffect(() => {
        const onTranslated = ({ slug, translation }: any) => {
            if (activeSpellRef.current?.slug === slug) {
                setSelectedSpell((prev: any) => (prev && prev.slug === slug ? { ...prev, translation } : prev));
                setShowTrans(true);
            }
            setTranslating(false);
        };
        const onError = ({ message }: any) => {
            setTranslating(false);
            if (message) Alert.alert('No se pudo traducir', message);
        };
        socket.on('spell-translated', onTranslated);
        socket.on('spell-translate-error', onError);
        return () => {
            socket.off('spell-translated', onTranslated);
            socket.off('spell-translate-error', onError);
        };
    }, []);

    // Helper ref to avoid race conditions with selected spell
    const activeSpellRef = React.useRef<any>(null);

    const openSpellDetail = (spell: any) => {
        setSelectedSpell(spell); // Set initial data (name, level, etc.)
        activeSpellRef.current = spell;
        setShowTrans(false);
        setTranslating(false);
        if (!spell.desc) {
            socket.emit('get-spell-details', { slug: spell.slug });
        }
    };

    // Botón traducir: si ya tiene traducción COMPLETA (con descripción), alterna;
    // si solo tiene el nombre (o nada), pide la traducción completa a la IA.
    const handleTranslate = () => {
        if (!selectedSpell) return;
        if (selectedSpell.translation?.desc) { setShowTrans((s) => !s); return; }
        setTranslating(true);
        socket.emit('translate-spell', { slug: selectedSpell.slug });
    };

    // Nombre: siempre en español si está traducido. Descripción: solo al togglear.
    const trName = selectedSpell?.translation?.name || selectedSpell?.name;
    const trDesc = (showTrans && selectedSpell?.translation?.desc) ? selectedSpell.translation.desc : selectedSpell?.desc;
    const trHL = (showTrans && selectedSpell?.translation?.higher_level) ? selectedSpell.translation.higher_level : selectedSpell?.higher_level;

    // Lists
    const mySpellsSlugs = useMemo(() => character.spells_known || [], [character.spells_known]);
    const preparedSlugs = useMemo(() => character.spells_prepared || [], [character.spells_prepared]);

    // Actions
    const toggleKnown = (slug: string) => {
        const current = [...mySpellsSlugs];
        let next;
        if (current.includes(slug)) next = current.filter(s => s !== slug);
        else next = [...current, slug];
        updateChar('spells_known', next);
    };

    const togglePrepared = (slug: string) => {
        const current = [...preparedSlugs];
        let next;
        if (current.includes(slug)) next = current.filter(s => s !== slug);
        else next = [...current, slug];
        updateChar('spells_prepared', next);
    };

    const updateChar = (field: string, value: any) => {
        socket.emit('update-character-full', {
            characterId: character.id,
            diff: { [field]: value }
        });
    };

    const updateSlots = (level: number, change: number) => {
        const current = { ...slots };
        if (!current[level]) current[level] = { max: 0, used: 0 };
        const newUsed = Math.max(0, (current[level].used || 0) + change);
        current[level] = { ...current[level], used: newUsed };
        setSlots(current);
        updateChar('spell_slots', current);
    };

    // --- RENDERERS ---

    const renderSlotTracker = () => (
        <View style={styles.slotsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => {
                    const slotData = slots[lvl] || { used: 0 };
                    return (
                        <View key={lvl} style={styles.slotBadge}>
                            <Text style={styles.slotLevel}>Lvl {lvl}</Text>
                            <View style={styles.slotControls}>
                                <TouchableOpacity onPress={() => updateSlots(lvl, -1)}>
                                    <Minus size={14} color="#A89F8E" />
                                </TouchableOpacity>
                                <Text style={[styles.slotVal, slotData.used > 0 && { color: '#E06A9A' }]}>
                                    {slotData.used}
                                </Text>
                                <TouchableOpacity onPress={() => updateSlots(lvl, 1)}>
                                    <Plus size={14} color="#A89F8E" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );

    const [collapsedGroups, setCollapsedGroups] = useState<Record<number, boolean>>({});

    const toggleGroup = (lvl: number) => {
        setCollapsedGroups(prev => ({ ...prev, [lvl]: !prev[lvl] }));
    };

    const groupedSpells = useMemo(() => {
        // 1. Filter
        const filtered = classSpells.filter(s => {
            const isKnown = mySpellsSlugs.includes(s.slug);
            const isPrepared = preparedSlugs.includes(s.slug);

            // Tab Filters
            if (activeTab === 'book' && !isKnown) return false;
            if (activeTab === 'prepared' && !isPrepared) return false;

            // Search Filter (bilingüe: nombre en inglés o traducción cacheada)
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const enName = (s.name || '').toLowerCase();
                const esName = (s.translation?.name || '').toLowerCase();
                if (!enName.includes(q) && !esName.includes(q)) return false;
            }

            return true;
        });

        // 2. Group by Level
        const groups: Record<number, any[]> = {};
        filtered.forEach(s => {
            if (!groups[s.level]) groups[s.level] = [];
            groups[s.level].push(s);
        });
        return groups;
    }, [classSpells, activeTab, searchQuery, mySpellsSlugs, preparedSlugs]);

    const renderTabs = () => {
        return (
            <View style={styles.tabs}>
                {/* 1. KNOWN / SPELLBOOK (Wizard / Known) - LEFT */}
                {casterType !== 'divine' && (
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'book' && styles.activeTab]}
                        onPress={() => handleTabChange('book')}
                    >
                        <BookOpen size={16} color={activeTab === 'book' ? '#E06A9A' : '#A89F8E'} />
                        <Text style={[styles.tabText, activeTab === 'book' && styles.activeTabText]}>
                            {casterType === 'wizard' ? 'Libro' : 'Conocidos'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* 2. PREPARED (Wizard / Divine) - CENTER/LEFT */}
                {casterType !== 'known' && (
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'prepared' && styles.activeTab]}
                        onPress={() => handleTabChange('prepared')}
                    >
                        <Flame size={16} color={activeTab === 'prepared' ? '#E06A9A' : '#A89F8E'} />
                        <Text style={[styles.tabText, activeTab === 'prepared' && styles.activeTabText]}>Preparados</Text>
                    </TouchableOpacity>
                )}

                {/* 3. LIBRARY (ALL CLASS SPELLS) - RIGHT */}
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'library' && styles.activeTab]}
                    onPress={() => handleTabChange('library')}
                >
                    <Search size={16} color={activeTab === 'library' ? '#E06A9A' : '#A89F8E'} />
                    <Text style={[styles.tabText, activeTab === 'library' && styles.activeTabText]}>
                        {casterType === 'wizard' ? 'Arcanos' : casterType === 'divine' ? 'Divinos' : 'Clase'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderSpellRow = (item: any) => {
        const isKnown = mySpellsSlugs.includes(item.slug);
        const isPrepared = preparedSlugs.includes(item.slug);

        // --- BUTTON ACTIONS ---
        let ActionButton;

        if (casterType === 'known') {
            // ... (Same logic as before) ...
            if (activeTab === 'library') {
                ActionButton = (
                    <TouchableOpacity
                        style={[styles.actionBtn, isKnown ? styles.btnKnown : styles.btnAdd]}
                        onPress={() => toggleKnown(item.slug)}
                    >
                        {isKnown ? <Check size={16} color="#EDE6D8" /> : <Plus size={16} color="#A89F8E" />}
                    </TouchableOpacity>
                );
            } else {
                ActionButton = (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => toggleKnown(item.slug)}>
                        <X size={16} color="#C2452F" />
                    </TouchableOpacity>
                );
            }
        }
        else if (casterType === 'divine') {
            if (activeTab === 'library') {
                ActionButton = (
                    <TouchableOpacity
                        style={[styles.actionBtn, isPrepared ? styles.btnPrepared : styles.btnAdd]}
                        onPress={() => togglePrepared(item.slug)}
                    >
                        {isPrepared ? <Flame size={16} color="#EDE6D8" /> : <Plus size={16} color="#A89F8E" />}
                    </TouchableOpacity>
                );
            } else {
                ActionButton = (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => togglePrepared(item.slug)}>
                        <X size={16} color="#F59E0B" />
                    </TouchableOpacity>
                );
            }
        }
        else if (casterType === 'wizard') {
            if (activeTab === 'library') {
                ActionButton = (
                    <TouchableOpacity
                        style={[styles.actionBtn, isKnown ? styles.btnKnown : styles.btnAdd]}
                        onPress={() => toggleKnown(item.slug)}
                    >
                        {isKnown ? <ScrollIcon size={16} color="#EDE6D8" /> : <Plus size={16} color="#A89F8E" />}
                    </TouchableOpacity>
                );
            } else if (activeTab === 'book') {
                ActionButton = (
                    <TouchableOpacity
                        style={[styles.actionBtn, isPrepared ? styles.btnPrepared : styles.btnAdd]}
                        onPress={() => togglePrepared(item.slug)}
                    >
                        {isPrepared ? <Flame size={16} color="#000" /> : <Flame size={16} color="#A89F8E" />}
                    </TouchableOpacity>
                );
            } else {
                ActionButton = (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => togglePrepared(item.slug)}>
                        <X size={16} color="#F59E0B" />
                    </TouchableOpacity>
                );
            }
        }

        return (
            <TouchableOpacity
                key={item.slug}
                style={[styles.spellRow, (isKnown || isPrepared) && styles.spellRowActive]}
                onPress={() => openSpellDetail(item)}
            >
                <View style={styles.spellInfo}>
                    <Text style={[
                        styles.spellName,
                        (activeTab === 'library' && (isKnown || isPrepared)) && styles.spellNameKnown
                    ]}>
                        {item.translation?.name || item.name}
                    </Text>
                    <Text style={styles.spellSchool}>
                        {item.school} {item.ritual === 'yes' ? '• Ritual' : ''} {item.concentration === 'yes' ? '• Conc.' : ''}
                    </Text>

                    <View style={styles.spellStatsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>TIEMPO</Text>
                            <Text style={styles.statValue} numberOfLines={1}>{item.casting_time}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>ALCANCE</Text>
                            <Text style={styles.statValue} numberOfLines={1}>{item.range}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>DURACIÓN</Text>
                            <Text style={styles.statValue} numberOfLines={1}>{item.duration}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.spellActions}>
                    {ActionButton}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.topSection}>
                <Text style={styles.headerTitle}>Gestión de Magia ({casterType.toUpperCase()})</Text>
                {renderSlotTracker()}
            </View>

            {renderTabs()}

            <View style={styles.searchBar}>
                <Search size={16} color="#6B6557" />
                <TextInput
                    style={styles.input}
                    placeholder="Buscar hechizo..."
                    placeholderTextColor="#6B6557"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {(isFetching || isSwitchingTab) ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.blue} />
                    <Text style={styles.loadingText}>
                        {isFetching ? 'Cargando grimorio...' : 'Cargando hechizos...'}
                    </Text>
                </View>
            ) : (
                <View style={{ paddingBottom: 40, paddingHorizontal: 10 }}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => {
                        const spells = groupedSpells[lvl] || [];
                        const count = spells.length;
                        if (count === 0) return null;

                        const isCollapsed = collapsedGroups[lvl];

                        return (
                            <View key={lvl} style={[styles.levelGroup, !isCollapsed && styles.levelGroupOpen]}>
                                <TouchableOpacity
                                    onPress={() => toggleGroup(lvl)}
                                    style={styles.groupHeader}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.groupHeaderLeft}>
                                        {isCollapsed
                                            ? <ChevronRight size={18} color={COLORS.textMuted} />
                                            : <ChevronDown size={18} color={COLORS.blue} />}
                                        <Text style={[styles.groupTitle, !isCollapsed && { color: COLORS.blue }]}>
                                            {lvl === 0 ? 'Trucos' : `Nivel ${lvl}`}
                                        </Text>
                                    </View>
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{count}</Text>
                                    </View>
                                </TouchableOpacity>

                                {!isCollapsed && (
                                    <View style={styles.groupBody}>
                                        {spells.map(spell => (
                                            <View key={spell.slug}>{renderSpellRow(spell)}</View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })}

                    {Object.values(groupedSpells).every(g => !g || g.length === 0) && (
                        <Text style={styles.emptyList}>
                            {activeTab === 'library' ? 'No se encontraron hechizos.' :
                                activeTab === 'book' ? 'Grimorio vacío.' : 'Ningún hechizo preparado.'}
                        </Text>
                    )}
                </View>
            )}

            {/* Detail Modal */}
            <Modal
                visible={!!selectedSpell}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedSpell(null)}
            >
                <BlurView intensity={40} tint="dark" style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>{trName}</Text>
                                <Text style={styles.modalSubtitle}>
                                    {selectedSpell?.level === 0 ? 'Truco' : `Nivel ${selectedSpell?.level}`} • {selectedSpell?.school}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedSpell(null)} style={styles.closeBtn}>
                                <X size={24} color="#A89F8E" />
                            </TouchableOpacity>
                        </View>

                        {/* Botón traducir al español (con caché) */}
                        <TouchableOpacity
                            onPress={handleTranslate}
                            disabled={translating}
                            style={styles.translateBtn}
                            activeOpacity={0.8}
                        >
                            {translating ? (
                                <ActivityIndicator size="small" color={COLORS.amber} />
                            ) : (
                                <Languages size={15} color={COLORS.amber} />
                            )}
                            <Text style={styles.translateBtnText}>
                                {translating
                                    ? 'Traduciendo…'
                                    : selectedSpell?.translation?.desc
                                        ? (showTrans ? 'Ver original (inglés)' : 'Ver en español')
                                        : 'Traducir al español'}
                            </Text>
                        </TouchableOpacity>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.statsGrid}>
                                <View style={styles.statBox}>
                                    <Text style={styles.statBoxLabel}>TIEMPO</Text>
                                    <Text style={styles.statBoxValue}>{selectedSpell?.casting_time}</Text>
                                </View>
                                <View style={styles.statBox}>
                                    <Text style={styles.statBoxLabel}>ALCANCE</Text>
                                    <Text style={styles.statBoxValue}>{selectedSpell?.range}</Text>
                                </View>
                                <View style={styles.statBox}>
                                    <Text style={styles.statBoxLabel}>DURACIÓN</Text>
                                    <Text style={styles.statBoxValue}>{selectedSpell?.duration}</Text>
                                </View>
                                <View style={styles.statBox}>
                                    <Text style={styles.statBoxLabel}>COMPONENTES</Text>
                                    <Text style={styles.statBoxValue}>{selectedSpell?.components}</Text>
                                </View>
                            </View>

                            {selectedSpell?.material && (
                                <Text style={styles.materialText}>
                                    <Text style={{ fontWeight: 'bold' }}>Material: </Text>
                                    {selectedSpell.material}
                                </Text>
                            )}

                            <View style={styles.divider} />

                            {trDesc ? (
                                <Text style={styles.modalDesc}>{trDesc}</Text>
                            ) : (
                                <Text style={[styles.modalDesc, { fontStyle: 'italic', opacity: 0.7 }]}>Cargando descripción detallada...</Text>
                            )}

                            {trHL ? (
                                <View style={styles.higherLevelBox}>
                                    <Text style={styles.hlTitle}>A Niveles Superiores</Text>
                                    <Text style={styles.hlText}>{trHL}</Text>
                                </View>
                            ) : null}

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </BlurView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    topSection: {
        padding: 16,
        backgroundColor: COLORS.surface,
    },
    headerTitle: {
        color: COLORS.textPrimary,
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        textTransform: 'capitalize',
    },
    slotsContainer: {
        height: 60,
    },
    slotBadge: {
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 8,
        padding: 8,
        width: 70,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    slotLevel: {
        color: COLORS.textMuted,
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    slotControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    slotVal: {
        color: COLORS.textPrimary,
        fontSize: 16,
        fontWeight: 'bold',
        minWidth: 14,
        textAlign: 'center',
    },
    tabs: {
        flexDirection: 'row',
        padding: 4,
        backgroundColor: COLORS.surface,
        gap: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
        borderRadius: 4,
    },
    activeTab: {
        backgroundColor: COLORS.surfaceHighlight,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.blue,
    },
    tabText: {
        color: COLORS.textMuted,
        fontWeight: 'bold',
    },
    activeTabText: {
        color: COLORS.blue,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        margin: 16,
        paddingHorizontal: 12,
        borderRadius: 8,
        height: 40,
        gap: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    input: {
        flex: 1,
        color: COLORS.textPrimary,
    },
    emptyList: {
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: 40,
        fontStyle: 'italic',
    },
    spellRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    spellRowActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    spellInfo: {
        flex: 1,
    },
    spellName: {
        color: COLORS.textPrimary,
        fontSize: 15,
        fontWeight: 'bold',
    },
    spellNameKnown: {
        color: COLORS.blue,
    },
    spellMeta: {
        color: COLORS.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    spellActions: {
        marginLeft: 12,
    },
    actionBtn: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: COLORS.surfaceHighlight,
    },
    btnKnown: {
        backgroundColor: COLORS.blue,
    },
    btnAdd: {
        // default
    },
    btnPrepared: {
        backgroundColor: COLORS.gold,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: '80%',
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        color: COLORS.textPrimary,
        fontSize: 22,
        fontWeight: 'bold',
        fontFamily: 'serif',
    },
    modalSubtitle: {
        color: COLORS.blue,
        fontSize: 14,
        marginTop: 4,
        fontWeight: '600',
    },
    closeBtn: {
        padding: 8,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 20,
    },
    translateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.bronze,
        backgroundColor: COLORS.surfaceHighlight,
        marginBottom: 16,
    },
    translateBtnText: {
        color: COLORS.amber,
        fontSize: 13,
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    statBox: {
        width: '48%',
        backgroundColor: COLORS.surfaceHighlight,
        padding: 10,
        borderRadius: 8,
    },
    statBoxLabel: {
        color: COLORS.textMuted,
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    statBoxValue: {
        color: COLORS.textPrimary,
        fontSize: 13,
        fontWeight: '500',
    },
    materialText: {
        color: COLORS.textMuted,
        fontSize: 13,
        fontStyle: 'italic',
        marginBottom: 10,
        lineHeight: 20,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginBottom: 16,
        marginTop: 8,
    },
    higherLevelBox: {
        marginTop: 20,
        padding: 16,
        backgroundColor: 'rgba(58, 90, 140, 0.1)', // Blue tint
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.blue,
    },
    hlTitle: {
        color: COLORS.blue,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    hlText: {
        color: COLORS.textSecondary, // Was c7d2fe
        fontSize: 14,
        lineHeight: 21,
    },
    modalDesc: {
        color: COLORS.textPrimary,
        fontSize: 15,
        lineHeight: 23,
        marginBottom: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40,
    },
    loadingText: {
        color: COLORS.textMuted,
        marginTop: 12,
        fontSize: 14,
    },
    spellSchool: {
        color: COLORS.textMuted,
        fontSize: 12,
        marginBottom: 8,
        fontStyle: 'italic',
    },
    spellStatsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statItem: {
        flex: 1,
    },
    statLabel: {
        color: COLORS.textMuted,
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    statValue: {
        color: COLORS.textSecondary,
        fontSize: 11,
    },
    levelGroup: {
        marginBottom: 10,
        marginHorizontal: 12,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.border,
    },
    levelGroupOpen: {
        borderLeftColor: COLORS.blue, // se ilumina al abrir
        borderColor: 'rgba(62,132,214,0.35)',
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    groupHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    groupTitle: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    groupBody: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    badge: {
        minWidth: 26,
        height: 22,
        paddingHorizontal: 7,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(62,132,214,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(62,132,214,0.35)',
    },
    badgeText: {
        color: COLORS.blue,
        fontSize: 12,
        fontWeight: '800',
    },
    statBox: {
        width: '48%',
        backgroundColor: '#16211F',
        padding: 10,
        borderRadius: 8,
    },
    statBoxLabel: {
        color: '#6B6557',
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    statBoxValue: {
        color: '#A89F8E',
        fontSize: 13,
        fontWeight: '500',
    },
    materialText: {
        color: '#A89F8E',
        fontSize: 13,
        fontStyle: 'italic',
        marginBottom: 10,
        lineHeight: 20,
    },
    divider: {
        height: 1,
        backgroundColor: '#2A332F',
        marginBottom: 16,
        marginTop: 8,
    },
});
