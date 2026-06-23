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
    /** Multiclase: lista de clases con su nivel { …classData, level }. */
    classes?: any[];
    level?: number;
    customFeatures?: any[];
    archetype?: string; // Slug
    characterId?: number;
    /** Elecciones de rasgos guardadas: { "<slug>:<feature>": key }. */
    featureChoices?: Record<string, any>;
}

export default function FeaturesList({ abilitiesText, raceData, classData, classes, level = 1, customFeatures = [], archetype, characterId, featureChoices = {} }: FeaturesListProps) {
    const [selectedFeature, setSelectedFeature] = useState<{ name: string; desc: string; choice?: any; classSlug?: string } | null>(null);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [showArchetypeSelector, setShowArchetypeSelector] = useState(false);

    const isCol = (key: string) => collapsed[key] ?? true;
    const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !(prev[key] ?? true) }));

    // Lista de clases a mostrar (multiclase, con fallback a clase única).
    const classList: any[] = (classes && classes.length)
        ? classes
        : (classData ? [{ ...classData, level }] : []);

    const hasData = abilitiesText || raceData || classList.length > 0 || customFeatures.length > 0;

    if (!hasData) {
        return (
            <View style={styles.emptyContainer}>
                <Info size={24} color="#6B6557" />
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
                        <Text style={{ fontWeight: 'bold', color: '#F59E0B' }}>{title.trim()}{punct} </Text>
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

    // Abre el detalle de un rasgo (con su descripción y, si tiene, sus opciones).
    const openFeat = (feat: any, cls: any) => {
        setSelectedFeature({
            name: feat.name,
            desc: getFeatureDescription(feat.name, cls.desc || ''),
            choice: feat.choice || null,
            classSlug: cls.slug,
        });
    };

    // Elige (o limpia) una opción de un rasgo. La selección llega por socket.
    const chooseFeature = (classSlug: string, feature: string, key: string, multi: boolean) => {
        if (!characterId) return;
        socket.emit('choose-feature', { characterId, classSlug, feature, key, multi });
    };

    // ¿Esta opción está elegida? (lee de featureChoices, que se actualiza por socket)
    const isOptionChosen = (classSlug: string, feature: string, key: string) => {
        const v = featureChoices?.[`${classSlug}:${feature}`];
        return Array.isArray(v) ? v.includes(key) : v === key;
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

    // El arquetipo elegido, si pertenece a ESTA clase (para multiclase).
    const archetypeForClass = (cls: any) => {
        if (!cls?.archetypes || !archetype) return null;
        try {
            const archs = typeof cls.archetypes === 'string' ? JSON.parse(cls.archetypes) : cls.archetypes;
            return archs.find((a: any) => a.slug === archetype || a.name === archetype) || null;
        } catch { return null; }
    };

    // Rasgos desbloqueados por una clase hasta su nivel (parsea su tabla).
    const featuresForClass = (cls: any) => {
        const feats: any[] = [];
        if (cls?.table) {
            const rows = cls.table.split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => line.startsWith('|') && !line.includes('---'));
            const dataRows = rows.slice(1);
            dataRows.forEach((row: string) => {
                const cols = row.split('|').filter((c: string) => c.trim() !== '').map((c: string) => c.trim());
                if (cols.length < 3) return;
                const lvl = parseInt(cols[0]);
                if (lvl <= (cls.level || 0)) {
                    cols[2].split(',').map((f: string) => f.trim()).filter((f: string) => f !== '-').forEach((f: string) => {
                        const choiceDef = (cls.choices || []).find((ch: any) => ch.feature === f) || null;
                        feats.push({ name: f, level: lvl, source: cls.name || 'Clase', choice: choiceDef, classSlug: cls.slug });
                    });
                }
            });
        }
        return feats.sort((a, b) => a.level - b.level);
    };

    return (
        <View style={styles.container}>

            {/* RACIAL TRAITS */}
            {raceData && (
                <View style={styles.card}>
                    <TouchableOpacity
                        style={[styles.header, !isCol('race') && { marginBottom: 12 }]}
                        onPress={() => toggle('race')}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Dna size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                            <Text style={styles.title}>Rasgos Raciales ({raceData.name})</Text>
                        </View>
                        {isCol('race') ? <ChevronRight size={18} color="#A89F8E" /> : <ChevronDown size={18} color="#F59E0B" />}
                    </TouchableOpacity>

                    {!isCol('race') && (
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

            {/* COMPETENCIAS — un solo card, ambas clases separadas por sección */}
            {classList.length > 0 && (
                <View style={styles.card}>
                    <TouchableOpacity style={[styles.header, !isCol('competencias') && { marginBottom: 12 }]} onPress={() => toggle('competencias')} activeOpacity={0.7}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Shield size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                            <Text style={styles.title}>Competencias</Text>
                        </View>
                        {isCol('competencias') ? <ChevronRight size={18} color="#A89F8E" /> : <ChevronDown size={18} color="#F59E0B" />}
                    </TouchableOpacity>
                    {!isCol('competencias') && (
                        <View>
                            {classList.map((cls: any, ci: number) => (
                                <View key={cls.slug || ci} style={[styles.profClass, ci > 0 && styles.profClassDivider]}>
                                    <Text style={styles.profClassTitle}>{cls.name}{cls.level ? ` · Nv ${cls.level}` : ''}</Text>
                                    <View style={styles.profRow}><Text style={styles.profLabel}>Armaduras</Text><Text style={styles.profValue}>{cleanText(cls.prof_armor) || '—'}</Text></View>
                                    <View style={styles.profRow}><Text style={styles.profLabel}>Armas</Text><Text style={styles.profValue}>{cleanText(cls.prof_weapons) || '—'}</Text></View>
                                    <View style={styles.profRow}><Text style={styles.profLabel}>Salvaciones</Text><Text style={styles.profValue}>{cleanText(cls.prof_saving_throws) || '—'}</Text></View>
                                    <View style={styles.profMini}>
                                        <View style={styles.miniStat}><Text style={styles.miniLabel}>Dado de Golpe</Text><Text style={styles.miniValue}>{cls.hit_dice}</Text></View>
                                        <View style={styles.miniStat}><Text style={styles.miniLabel}>Conjuro</Text><Text style={styles.miniValue}>{cls.spellcasting_ability || 'Ninguna'}</Text></View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* HABILIDADES DE NIVEL + ARQUETIPO — por cada clase, en orden */}
            {classList.map((cls: any, ci: number) => {
                const feats = featuresForClass(cls);
                const lk = `level-${cls.slug || ci}`;
                const ak = `arch-${cls.slug || ci}`;
                const clsArch = archetypeForClass(cls);
                return (
                    <React.Fragment key={cls.slug || ci}>
                        {/* Habilidades de Nivel */}
                        {feats.length > 0 && (
                            <View style={styles.card}>
                                <TouchableOpacity style={[styles.header, !isCol(lk) && { marginBottom: 12 }]} onPress={() => toggle(lk)} activeOpacity={0.7}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Zap size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                                        <Text style={styles.title}>Habilidades · {cls.name}</Text>
                                    </View>
                                    {isCol(lk) ? <ChevronRight size={18} color="#A89F8E" /> : <ChevronDown size={18} color="#F59E0B" />}
                                </TouchableOpacity>
                                {!isCol(lk) && (
                                    <View>
                                        {feats.map((feat: any, idx: number) => {
                                            const sel = feat.choice ? featureChoices?.[`${cls.slug}:${feat.name}`] : undefined;
                                            const selName = feat.choice && sel ? feat.choice.options.find((o: any) => o.key === sel)?.name : null;
                                            return (
                                                <TouchableOpacity key={idx} style={styles.featureRow} onPress={() => openFeat(feat, cls)}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.featureName}>{feat.name}</Text>
                                                        <Text style={styles.featureSource}>Nivel {feat.level} • {feat.source}</Text>
                                                        {feat.choice ? (
                                                            <Text style={styles.choiceHint}>{selName ? `✓ ${selName}` : 'Tocá para elegir una opción'}</Text>
                                                        ) : null}
                                                    </View>
                                                    <ChevronRight size={16} color="#6B6557" />
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Arquetipo de ESTA clase (queda pegado a sus habilidades) */}
                        {clsArch && (
                            <View style={styles.card}>
                                <TouchableOpacity style={[styles.header, !isCol(ak) && { marginBottom: 12 }]} onPress={() => toggle(ak)} activeOpacity={0.7}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Zap size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                                        <Text style={styles.title}>{cls.subtypes_name || 'Arquetipo'} · {clsArch.name}</Text>
                                    </View>
                                    {isCol(ak) ? <ChevronRight size={18} color="#A89F8E" /> : <ChevronDown size={18} color="#F59E0B" />}
                                </TouchableOpacity>
                                {!isCol(ak) && <View>{renderFormattedTraits(clsArch.desc)}</View>}
                            </View>
                        )}
                    </React.Fragment>
                );
            })}

            {/* RASGOS PERSONALIZADOS (homebrew) */}
            {customFeatures && customFeatures.length > 0 && (
                <View style={styles.card}>
                    <TouchableOpacity style={[styles.header, !isCol('homebrew') && { marginBottom: 12 }]} onPress={() => toggle('homebrew')} activeOpacity={0.7}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Zap size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                            <Text style={styles.title}>Rasgos Personalizados</Text>
                        </View>
                        {isCol('homebrew') ? <ChevronRight size={18} color="#A89F8E" /> : <ChevronDown size={18} color="#F59E0B" />}
                    </TouchableOpacity>
                    {!isCol('homebrew') && (
                        <View>
                            {customFeatures.map((feat: any, idx: number) => (
                                <View key={idx} style={styles.featureRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.featureName}>{feat.name}</Text>
                                        {feat.kind ? <Text style={styles.choiceHint}>{feat.kind}</Text> : null}
                                        {(feat.description || feat.desc) ? <Text style={styles.featureSource}>{feat.description || feat.desc}</Text> : null}
                                        {feat.resource ? <Text style={styles.choiceHint}>{feat.resource}</Text> : null}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* SENDA DE ARQUETIPO — solo si aún no eligió uno y alcanzó el nivel */}
            {(!archetype && classData && level >= (CLASS_SUBCLASS_LEVELS[classData.slug?.toLowerCase()] || 3)) ? (
                <View style={[styles.card, { borderLeftColor: '#F59E0B', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(192, 132, 252, 0.3)', backgroundColor: 'transparent' }]}>
                    <View style={styles.header}>
                        <Shield size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                        <Text style={[styles.title, { color: '#F59E0B' }]}>Senda de Arquetipo</Text>
                    </View>
                    <Text style={[styles.text, { fontStyle: 'italic', color: '#A89F8E', marginBottom: 12 }]}>
                        Has alcanzado el nivel necesario para especializarte.
                    </Text>
                    <TouchableOpacity
                        style={{ backgroundColor: 'rgba(192, 132, 252, 0.2)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, alignItems: 'center' }}
                        onPress={() => setShowArchetypeSelector(true)}
                    >
                        <Text style={{ color: '#F59E0B', fontWeight: 'bold' }}>Ver Arquetipos Disponibles</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* MANUAL NOTES */}
            {abilitiesText ? (
                <View style={[styles.card, { borderLeftColor: '#E06A9A' }]}>
                    <TouchableOpacity
                        style={[styles.header, !isCol('notes') && { marginBottom: 12 }]}
                        onPress={() => toggle('notes')}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Scroll size={16} color="#E06A9A" style={{ marginRight: 8 }} />
                            <Text style={[styles.title, { color: '#E06A9A' }]}>Notas y Erudición</Text>
                        </View>
                        {isCol('notes') ? <ChevronRight size={18} color="#A89F8E" /> : <ChevronDown size={18} color="#E06A9A" />}
                    </TouchableOpacity>

                    {!isCol('notes') && (
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
                                <X size={24} color="#6B6557" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ gap: 16 }}>
                            {allArchetypes.map((arch: any, idx: number) => (
                                <View key={idx} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 16, borderWidth: 1, borderColor: '#2A332F' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={{ color: '#F59E0B', fontSize: 16, fontWeight: 'bold' }}>{arch.name}</Text>
                                        <BookOpen size={16} color="#6B6557" />
                                    </View>
                                    <Text numberOfLines={3} style={{ color: '#A89F8E', fontSize: 13, marginBottom: 12 }}>
                                        {cleanText(arch.desc)}
                                    </Text>
                                    <TouchableOpacity
                                        style={{ backgroundColor: '#F59E0B', padding: 10, borderRadius: 6, alignItems: 'center' }}
                                        onPress={() => handleSelectArchetype(arch)}
                                    >
                                        <Text style={{ color: '#EDE6D8', fontWeight: 'bold', fontSize: 13 }}>Elegir este Arquetipo</Text>
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
                                <X size={24} color="#6B6557" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 380 }}>
                            <Text style={styles.modalText}>{selectedFeature?.desc}</Text>

                            {/* Opciones elegibles del rasgo (Estilo de Combate, etc.) */}
                            {selectedFeature?.choice ? (
                                <View style={{ marginTop: 16 }}>
                                    <Text style={styles.optionsTitle}>
                                        Elegí {selectedFeature.choice.pick > 1 ? `${selectedFeature.choice.pick}` : 'una opción'}:
                                    </Text>
                                    {selectedFeature.choice.options.map((opt: any) => {
                                        const chosen = isOptionChosen(selectedFeature.classSlug!, selectedFeature.name, opt.key);
                                        return (
                                            <TouchableOpacity
                                                key={opt.key}
                                                activeOpacity={0.8}
                                                onPress={() => chooseFeature(selectedFeature.classSlug!, selectedFeature.name, opt.key, selectedFeature.choice.pick > 1)}
                                                style={[styles.optionRow, chosen && styles.optionRowChosen]}
                                            >
                                                <View style={styles.optionHead}>
                                                    <Text style={[styles.optionName, chosen && { color: '#F59E0B' }]}>{opt.name}</Text>
                                                    {chosen ? <Text style={styles.optionTag}>✓ elegido</Text> : null}
                                                </View>
                                                <Text style={styles.optionDesc}>{opt.desc}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ) : null}
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
        borderLeftColor: COLORS.bronze, // acento unificado para los 4 acordeones
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
    // Competencias — sección por clase
    profClass: {
        paddingHorizontal: 16,
        paddingBottom: 14,
    },
    profClassDivider: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 14,
    },
    profClassTitle: {
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
    },
    profRow: {
        flexDirection: 'row',
        marginBottom: 8,
        gap: 10,
    },
    profLabel: {
        width: 92,
        color: COLORS.bronzeLight,
        fontSize: 12,
        fontWeight: '700',
    },
    profValue: {
        flex: 1,
        color: COLORS.textPrimary,
        fontSize: 13,
        lineHeight: 19,
    },
    profMini: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 6,
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
        backgroundColor: '#16211F',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#2A332F',
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
        borderBottomColor: '#2A332F',
        paddingBottom: 12,
    },
    modalTitle: {
        color: '#EDE6D8',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalText: {
        color: '#A89F8E',
        fontSize: 15,
        lineHeight: 24,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 6,
        marginBottom: 8,
        borderLeftWidth: 2,
        borderLeftColor: '#F59E0B',
    },
    featureName: {
        color: '#EDE6D8',
        fontWeight: 'bold',
        fontSize: 14,
    },
    featureSource: {
        color: '#A89F8E',
        fontSize: 11,
        marginTop: 2,
    },
    choiceHint: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 3,
    },
    // Opciones elegibles dentro del modal de rasgo
    optionsTitle: {
        color: '#C8A36A',
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    optionRow: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: '#2A332F',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    optionRowChosen: {
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245,158,11,0.10)',
    },
    optionHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    optionName: {
        color: '#EDE6D8',
        fontWeight: '700',
        fontSize: 14,
        flex: 1,
    },
    optionTag: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '800',
    },
    optionDesc: {
        color: '#A89F8E',
        fontSize: 12,
        lineHeight: 18,
    },
});
