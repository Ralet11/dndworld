import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Alert } from 'react-native';
import { Scroll, Info, Dna, Shield, X, ChevronDown, ChevronRight, Zap, BookOpen } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { CLASS_SUBCLASS_LEVELS } from '../../utils/DndUtils';
import socket from '../../services/socket';
import { COLORS } from '../../constants/Theme';

interface FeaturesListProps {
    abilitiesText?: string;
    raceData?: any;
    classData?: any;
    level?: number;
    customFeatures?: any[];
    archetype?: string; // Slug
    characterId?: number;
}

export default function FeaturesList({ abilitiesText, raceData, classData, level = 1, customFeatures = [], archetype, characterId }: FeaturesListProps) {
    const [selectedFeature, setSelectedFeature] = useState<{ name: string; desc: string } | null>(null);
    const [collapsed, setCollapsed] = useState({ race: true, class: true, notes: true, levelFeatures: true, archetype: true });
    const [showArchetypeSelector, setShowArchetypeSelector] = useState(false);

    const toggle = (key: 'race' | 'class' | 'notes' | 'levelFeatures' | 'archetype') => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

    const hasData = abilitiesText || raceData || classData || customFeatures.length > 0;

    if (!hasData) {
        return (
            <View style={styles.emptyContainer}>
                <Info size={24} color="#64748b" />
                <Text style={styles.emptyText}>No hay información disponible.</Text>
            </View>
        );
    }

    // Helper to clean Markdown-ish text (simple)
    const cleanText = (text: string) => {
        if (!text) return '';
        return text.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/_/g, '').trim();
    };

    const cleanVision = (text: string) => {
        if (!text) return 'Normal';
        if (text.length < 30) return cleanText(text);
        // Try to find distance
        const distMatch = text.match(/(\d+)\s*(ft|pies)/i);
        if (distMatch) return `Darkvision (${distMatch[0]})`;
        if (text.toLowerCase().includes('darkvision')) return 'Darkvision';
        return 'Ver Rasgos';
    };

    const renderFormattedTraits = (text: string) => {
        if (!text) return null;
        // Split by newlines, filtering empty
        const paragraphs = text.split(/\n+/).filter(p => p.trim());

        return paragraphs.map((para, index) => {
            // Regex to find headers like _Title._ or ***Title.*** or **Title.**
            // Matches start with bold/italic markers, content, punctuation, end markers
            const match = para.match(/^([_*]{1,3})(.*?)([.:])([_*]{1,3})\s*(.*)/s);

            if (match) {
                const title = match[2];
                const punct = match[3];
                const body = match[5];
                return (
                    <Text key={index} style={[styles.text, { marginBottom: 12 }]}>
                        <Text style={{ fontWeight: 'bold', color: '#fbbf24' }}>{title.trim()}{punct} </Text>
                        {cleanText(body)}
                    </Text>
                );
            }

            return (
                <Text key={index} style={[styles.text, { marginBottom: 12 }]}>
                    {cleanText(para)}
                </Text>
            );
        });
    };

    // Extract Description from Class Markdown
    const getFeatureDescription = (featureName: string, fullDesc: string) => {
        if (!fullDesc || !featureName) return 'Descripción no disponible.';

        // Normalize
        const nameClean = featureName.trim();
        // Regex to find "### FeatureName" (case insensitive)
        const regex = new RegExp(`###\\s*${nameClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
        const match = fullDesc.match(regex);

        if (!match) {
            // Fallback: Try removing part of the name (e.g. "Action Surge (one use)" -> "Action Surge")
            const simpleName = nameClean.split('(')[0].trim();
            if (simpleName !== nameClean) {
                return getFeatureDescription(simpleName, fullDesc);
            }
            return 'Descripción no disponible en el compendio.';
        }

        const startIndex = match.index! + match[0].length;
        const remainingText = fullDesc.substring(startIndex);

        // Find next header "###"
        const nextHeaderIndex = remainingText.search(/###/);

        let desc = nextHeaderIndex !== -1 ? remainingText.substring(0, nextHeaderIndex) : remainingText;
        return cleanText(desc);
    };

    const handleFeaturePress = (featureList: string) => {
        const features = featureList.split(',').map(f => f.trim());

        if (features.length === 1) {
            const desc = getFeatureDescription(features[0], classData?.desc || '');
            setSelectedFeature({ name: features[0], desc });
        } else {
            const descriptions = features.map(f => `**${f}**\n${getFeatureDescription(f, classData?.desc || '')}`).join('\n\n');
            setSelectedFeature({ name: 'Rasgos de Nivel', desc: descriptions });
        }
    };

    const allArchetypes = useMemo(() => {
        if (!classData?.archetypes) return [];
        try {
            return typeof classData.archetypes === 'string' ? JSON.parse(classData.archetypes) : classData.archetypes;
        } catch (e) { return []; }
    }, [classData]);

    const handleSelectArchetype = (arch: any) => {
        Alert.alert(
            "Confirmar Arquetipo",
            `¿Seguro que quieres elegir "${arch.name}"? Esta es una decisión importante.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Elegir Camino",
                    onPress: () => {
                        if (characterId) {
                            socket.emit('update-character-archetype', { characterId, archetypeSlug: arch.slug });
                            setShowArchetypeSelector(false);
                        }
                    }
                }
            ]
        );
    };

    const archetypeData = useMemo(() => {
        if (!classData?.archetypes || !archetype) return null;
        try {
            const archs = typeof classData.archetypes === 'string' ? JSON.parse(classData.archetypes) : classData.archetypes;
            return archs.find((a: any) => a.slug === archetype || a.name === archetype);
        } catch (e) {
            console.log('Error parsing archetypes', e);
            return null;
        }
    }, [classData, archetype]);

    const levelFeatures = useMemo(() => {
        const feats: any[] = [];
        // Class Features
        if (classData?.table) {
            const rows = classData.table.split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => line.startsWith('|') && !line.includes('---'));
            const dataRows = rows.slice(1);

            dataRows.forEach((row: string) => {
                const cols = row.split('|').filter(c => c.trim() !== '').map(c => c.trim());
                if (cols.length < 3) return;
                const lvl = parseInt(cols[0]);
                if (lvl <= level) {
                    const cellFeats = cols[2].split(',').map(f => f.trim()).filter(f => f !== '-');
                    cellFeats.forEach(f => {
                        feats.push({ name: f, level: lvl, source: 'Clase', description: '' });
                    });
                }
            });
        }

        // Custom Features
        if (customFeatures) {
            customFeatures.forEach(f => feats.push({ ...f, source: 'Homebrew' }));
        }

        // Sort by level ascending (Level 1 first)
        return feats.sort((a, b) => a.level - b.level);
    }, [classData, customFeatures, level]);

    const renderClassTable = (tableMarkdown: string) => {
        if (!tableMarkdown) return null;

        const rows = tableMarkdown.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('|') && !line.includes('---')); // Skip separator lines

        const dataRows = rows.slice(1);

        return (
            <View style={styles.tableContainer}>
                {dataRows.map((row, index) => {
                    const cols = row.split('|').filter(c => c.trim() !== '').map(c => c.trim());
                    if (cols.length < 3) return null;

                    const lvlStr = cols[0];
                    const feats = cols[2];

                    const rowLevel = parseInt(lvlStr);

                    if (rowLevel > level) return null;

                    const isCurrentLevel = rowLevel === level;

                    return (
                        <View key={index} style={[
                            styles.tableRow,
                            isCurrentLevel && styles.currentRow,
                        ]}>
                            <View style={styles.lvlBadge}>
                                <Text style={[styles.lvlText, isCurrentLevel && styles.currentLvlText]}>{lvlStr}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.featsCol}
                                onPress={() => handleFeaturePress(feats)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.featsText, isCurrentLevel && styles.currentFeatsText, { textDecorationLine: 'underline' }]}>
                                    {feats}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </View>
        );
    };

    return (
        <View style={styles.container}>

            {/* RACIAL TRAITS */}
            {raceData && (
                <View style={styles.card}>
                    <TouchableOpacity
                        style={[styles.header, !collapsed.race && { marginBottom: 12 }]}
                        onPress={() => toggle('race')}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Dna size={16} color="#fbbf24" style={{ marginRight: 8 }} />
                            <Text style={styles.title}>Rasgos Raciales ({raceData.name})</Text>
                        </View>
                        {collapsed.race ? <ChevronRight size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#fbbf24" />}
                    </TouchableOpacity>

                    {!collapsed.race && (
                        <View>
                            <View style={{ marginBottom: 12 }}>
                                {renderFormattedTraits(raceData.traits || raceData.desc)}
                            </View>

                            <View style={styles.miniStatsRow}>
                                <View style={styles.miniStat}>
                                    <Text style={styles.miniLabel}>Velocidad</Text>
                                    <Text style={styles.miniValue}>{raceData.speed} ft</Text>
                                </View>
                                <View style={styles.miniStat}>
                                    <Text style={styles.miniLabel}>Visión</Text>
                                    <Text style={styles.miniValue}>{cleanVision(raceData.vision)}</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* CLASS PROFICIENCIES */}
            {classData && (
                <View style={styles.card}>
                    <TouchableOpacity
                        style={[styles.header, !collapsed.class && { marginBottom: 12 }]}
                        onPress={() => toggle('class')}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Shield size={16} color="#60a5fa" style={{ marginRight: 8 }} />
                            <Text style={[styles.title, { color: '#60a5fa' }]}>Competencias ({classData.name})</Text>
                        </View>
                        {collapsed.class ? <ChevronRight size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#60a5fa" />}
                    </TouchableOpacity>

                    {!collapsed.class && (
                        <View>
                            <View style={styles.subSection}>
                                <Text style={styles.subTitle}>Progresión (Toca para ver info):</Text>
                                {renderClassTable(classData.table)}
                            </View>

                            <View style={styles.subSection}>
                                <Text style={styles.subTitle}>Armaduras:</Text>
                                <Text style={styles.text}>{cleanText(classData.prof_armor)}</Text>
                            </View>
                            <View style={styles.subSection}>
                                <Text style={styles.subTitle}>Armas:</Text>
                                <Text style={styles.text}>{cleanText(classData.prof_weapons)}</Text>
                            </View>
                            <View style={styles.subSection}>
                                <Text style={styles.subTitle}>Salvaciones:</Text>
                                <Text style={styles.text}>{cleanText(classData.prof_saving_throws)}</Text>
                            </View>

                            <View style={styles.miniStatsRow}>
                                <View style={styles.miniStat}>
                                    <Text style={styles.miniLabel}>Hit Dice</Text>
                                    <Text style={styles.miniValue}>{classData.hit_dice}</Text>
                                </View>
                                <View style={styles.miniStat}>
                                    <Text style={styles.miniLabel}>Spellcasting</Text>
                                    <Text style={styles.miniValue}>{classData.spellcasting_ability || 'Ninguna'}</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* LEVEL FEATURES */}
            {(levelFeatures.length > 0) && (
                <View style={[styles.card, { borderLeftColor: '#FACC15' }]}>
                    <TouchableOpacity
                        style={[styles.header, !collapsed.levelFeatures && { marginBottom: 12 }]}
                        onPress={() => toggle('levelFeatures')}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Zap size={16} color="#FACC15" style={{ marginRight: 8 }} />
                            <Text style={[styles.title, { color: '#FACC15' }]}>Habilidades de Nivel</Text>
                        </View>
                        {collapsed.levelFeatures ? <ChevronRight size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#FACC15" />}
                    </TouchableOpacity>

                    {!collapsed.levelFeatures && (
                        <View>
                            {levelFeatures.map((feat, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={styles.featureRow}
                                    onPress={() => handleFeaturePress(feat.name)}
                                >
                                    <View>
                                        <Text style={styles.featureName}>{feat.name}</Text>
                                        <Text style={styles.featureSource}>Nivel {feat.level} • {feat.source}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* ARCHETYPE FEATURES */}
            {archetypeData ? (
                <View style={[styles.card, { borderLeftColor: '#c084fc' }]}>
                    <TouchableOpacity
                        style={[styles.header, !collapsed.archetype && { marginBottom: 12 }]}
                        onPress={() => toggle('archetype')}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Zap size={16} color="#c084fc" style={{ marginRight: 8 }} />
                            <Text style={[styles.title, { color: '#c084fc' }]}>Arquetipo ({archetypeData.name})</Text>
                        </View>
                        {collapsed.archetype ? <ChevronRight size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#c084fc" />}
                    </TouchableOpacity>

                    {!collapsed.archetype && (
                        <View>
                            {renderFormattedTraits(archetypeData.desc)}
                        </View>
                    )}
                </View>
            ) : (classData && level >= (CLASS_SUBCLASS_LEVELS[classData.slug?.toLowerCase()] || 3)) ? (
                <View style={[styles.card, { borderLeftColor: '#c084fc', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(192, 132, 252, 0.3)', backgroundColor: 'transparent' }]}>
                    <View style={styles.header}>
                        <Shield size={16} color="#c084fc" style={{ marginRight: 8 }} />
                        <Text style={[styles.title, { color: '#c084fc' }]}>Senda de Arquetipo</Text>
                    </View>
                    <Text style={[styles.text, { fontStyle: 'italic', color: '#94a3b8', marginBottom: 12 }]}>
                        Has alcanzado el nivel necesario para especializarte.
                    </Text>
                    <TouchableOpacity
                        style={{ backgroundColor: 'rgba(192, 132, 252, 0.2)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' }}
                        onPress={() => setShowArchetypeSelector(true)}
                    >
                        <Text style={{ color: '#c084fc', fontWeight: 'bold' }}>Ver Arquetipos Disponibles</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* MANUAL NOTES */}
            {abilitiesText ? (
                <View style={[styles.card, { borderLeftColor: '#f472b6' }]}>
                    <TouchableOpacity
                        style={[styles.header, !collapsed.notes && { marginBottom: 12 }]}
                        onPress={() => toggle('notes')}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Scroll size={16} color="#f472b6" style={{ marginRight: 8 }} />
                            <Text style={[styles.title, { color: '#f472b6' }]}>Notas y Erudición</Text>
                        </View>
                        {collapsed.notes ? <ChevronRight size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#f472b6" />}
                    </TouchableOpacity>

                    {!collapsed.notes && (
                        <Text style={styles.text}>{abilitiesText}</Text>
                    )}
                </View>
            ) : null}

            {/* ARCHETYPE SELECTOR MODAL */}
            <Modal
                visible={showArchetypeSelector}
                transparent
                animationType="slide"
                onRequestClose={() => setShowArchetypeSelector(false)}
            >
                <BlurView intensity={40} tint="dark" style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Elige tu Arquetipo</Text>
                            <TouchableOpacity onPress={() => setShowArchetypeSelector(false)}>
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ gap: 16 }}>
                            {allArchetypes.map((arch: any, idx: number) => (
                                <View key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#334155' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={{ color: '#c084fc', fontSize: 16, fontWeight: 'bold' }}>{arch.name}</Text>
                                        <BookOpen size={16} color="#64748b" />
                                    </View>
                                    <Text numberOfLines={3} style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 12 }}>
                                        {cleanText(arch.desc)}
                                    </Text>
                                    <TouchableOpacity
                                        style={{ backgroundColor: '#c084fc', padding: 10, borderRadius: 6, alignItems: 'center' }}
                                        onPress={() => handleSelectArchetype(arch)}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Elegir este Arquetipo</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </BlurView>
            </Modal>

            {/* FEATURE DETAIL MODAL */}
            <Modal
                visible={!!selectedFeature}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedFeature(null)}
            >
                <BlurView intensity={20} tint="dark" style={styles.modalOverlay}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setSelectedFeature(null)} />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedFeature?.name}</Text>
                            <TouchableOpacity onPress={() => setSelectedFeature(null)}>
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 300 }}>
                            <Text style={styles.modalText}>{selectedFeature?.desc}</Text>
                        </ScrollView>
                    </View>
                </BlurView>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
        gap: 16,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 12, // User requested "Bordes suaves" (soft borders)
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderLeftWidth: 4,
        elevation: 2,
        shadowColor: COLORS.background,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.02)', // Subtle highlight
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: COLORS.textPrimary,
    },
    text: {
        fontSize: 14,
        lineHeight: 22,
        color: COLORS.textPrimary,
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    subSection: {
        marginBottom: 12,
    },
    subTitle: {
        color: COLORS.textSecondary,
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    miniStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
    },
    miniStat: {
        flex: 1,
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    miniLabel: {
        color: COLORS.textSecondary,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 4,
    },
    miniValue: {
        color: COLORS.textPrimary,
        fontSize: 13,
        fontWeight: 'bold',
    },
    // Table
    tableContainer: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        overflow: 'hidden',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.surfaceHighlight, // Alternating logic might overwrite this
    },
    currentRow: {
        backgroundColor: 'rgba(250, 204, 21, 0.08)',
    },
    lvlBadge: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
    },
    lvlText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    currentLvlText: {
        color: COLORS.textPrimary,
    },
    featsCol: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    featsText: {
        color: COLORS.textSecondary,
        fontSize: 13,
    },
    currentFeatsText: {
        color: COLORS.textPrimary,
    },
    tableCell: {
        flex: 1,
        padding: 8,
        fontSize: 12,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    tableHeaderCell: {
        color: COLORS.gold,
        fontWeight: 'bold',
        backgroundColor: COLORS.background,
    },
    // Features List
    featureRow: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    featureName: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    featureSource: {
        color: COLORS.textMuted,
        fontSize: 12,
        fontStyle: 'italic',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#334155',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
        paddingBottom: 12,
    },
    modalTitle: {
        color: '#f1f5f9',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalText: {
        color: '#cbd5e1',
        fontSize: 15,
        lineHeight: 24,
    },
    featureRow: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 6,
        marginBottom: 8,
        borderLeftWidth: 2,
        borderLeftColor: '#FACC15',
    },
    featureName: {
        color: '#f1f5f9',
        fontWeight: 'bold',
        fontSize: 14,
    },
    featureSource: {
        color: '#94a3b8',
        fontSize: 11,
        marginTop: 2,
    },
});
