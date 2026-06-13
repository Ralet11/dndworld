import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TextInput, Modal, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Swords, Backpack, Sparkles, UserSquare, RefreshCw, X } from 'lucide-react-native';
import InventoryTabs from './InventoryTabs';
import EquipmentDoll from './EquipmentDoll';
import ItemCard from './ItemCard';
import ItemDetailModal from './ItemDetailModal';
import RenderProgress from './RenderProgress';
import ArmorTalents from '../ArmorTalents';
import Panel from '../../UI/Panel';
import SectionHeader from '../../UI/SectionHeader';
import Button from '../../UI/Button';
import socket from '../../../services/socket';
import { API_URL } from '../../../constants/Config';
import { COLORS, SPACING, TYPO, RADIUS } from '../../../constants/Theme';

const SLOT_KEYS = ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon'];

const ARMOR_LABEL: Record<string, string> = {
    tela: 'Tela',
    cuero: 'Cuero',
    malla: 'Malla',
};

interface InventorySectionProps {
    inventory: any[];
    equipment: any;
    characterId: number;
    /** Imagen de cuerpo entero / retrato para la figura central. */
    figureUrl?: string;
    /** Si ya hay una imagen de cuerpo entero cargada como referencia de IA. */
    hasBaseBody?: boolean;
    /** Indicaciones libres del jugador guardadas para el render de IA. */
    renderPrompt?: string;
    /** Talentos acumulados actuales (para avisar si un cambio los baja). */
    talents?: { espiritu: number; agilidad: number; aguante: number };
    /** Talentos elegidos por umbral, para detectar pérdidas. */
    talentChoices?: any;
    /** Personaje completo (para el modal de talentos). */
    character?: any;
}

export default function InventorySection({ inventory, equipment, characterId, figureUrl, hasBaseBody, renderPrompt, talents, talentChoices, character }: InventorySectionProps) {
    const [activeTab, setActiveTab] = useState<'COMBAT' | 'MAGIC' | 'CONSUMABLE'>('COMBAT');
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [syncing, setSyncing] = useState(false);
    const [uploadingBody, setUploadingBody] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stage, setStage] = useState('Iniciando…');
    const [customPrompt, setCustomPrompt] = useState(renderPrompt || '');
    const [aiModalVisible, setAiModalVisible] = useState(false);
    const [talentsModalVisible, setTalentsModalVisible] = useState(false);
    const creepRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Etapas reales del render que llegan del server (filtradas por personaje).
    useEffect(() => {
        const onProgress = (p: { characterId: number; stage: string; pct: number }) => {
            if (p.characterId !== characterId) return;
            if (p.stage) setStage(p.stage);
            // Los hitos reales tiran la barra hacia adelante (nunca hacia atrás).
            if (typeof p.pct === 'number') setProgress((cur) => Math.max(cur, p.pct));
        };
        socket.on('render-progress', onProgress);
        return () => socket.off('render-progress', onProgress);
    }, [characterId]);

    // "Creeper": mientras genera, la barra avanza sola hacia ~90% para que el
    // usuario sienta que algo pasa durante el paso largo (la imagen en sí).
    const startCreeper = () => {
        stopCreeper();
        creepRef.current = setInterval(() => {
            setProgress((p) => (p < 90 ? p + (90 - p) * 0.045 : p));
        }, 400);
    };
    const stopCreeper = () => {
        if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
    };
    useEffect(() => () => stopCreeper(), []);

    // Sube una imagen de CUERPO ENTERO que la IA usará como referencia de
    // identidad (distinta del avatar cuadrado del header).
    const handleUploadBody = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [2, 3], // retrato vertical de cuerpo entero
            quality: 0.9,
        });
        if (result.canceled) return;

        setUploadingBody(true);
        try {
            const uri = result.assets[0].uri;
            const filename = uri.split('/').pop() || 'body.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image';

            const formData = new FormData();
            // @ts-ignore — formato de archivo de React Native
            formData.append('image', { uri, name: filename, type });

            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const data = await res.json();
            if (data.url) {
                socket.emit('update-character-base-body', { characterId, imageUrl: data.url });
            } else {
                Alert.alert('Error', 'No se pudo subir la imagen.');
            }
        } catch (e) {
            Alert.alert('Error', 'Fallo de conexión al subir la imagen.');
        } finally {
            setUploadingBody(false);
        }
    };

    // Pide al server que genere (IA) el retrato del PJ con el equipo puesto.
    // El resultado llega por socket ('stats-updated') y refresca la figura sola.
    // force=true ignora el caché → sirve para "Regenerar" (otra tirada de la IA).
    const handleSync = async (force = false) => {
        setStage('Iniciando…');
        setProgress(2);
        setSyncing(true);
        startCreeper();
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/characters/${characterId}/render`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ quality: 'high', force, customPrompt }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                Alert.alert('No se pudo sincronizar', data.message || 'Error generando el retrato.');
            } else if (data.cached) {
                Alert.alert('Ya estaba al día', 'El retrato ya refleja tu equipo actual. Usá "Regenerar" para otra versión.');
            } else {
                setStage('Listo'); setProgress(100);
            }
        } catch (e) {
            Alert.alert('Error', 'Fallo de conexión al sincronizar.');
        } finally {
            stopCreeper();
            // Pequeño respiro para que se vea el 100% antes de ocultar el overlay.
            setTimeout(() => { setSyncing(false); setProgress(0); }, 500);
        }
    };

    const items = inventory || [];

    // Si cambia el inventario (p. ej. tras editar un item), re-sincroniza el
    // item abierto en el modal para que muestre los datos frescos.
    useEffect(() => {
        setSelectedItem((prev: any) => {
            if (!prev) return prev;
            const fresh = (inventory || []).find((i: any) => i.id === prev.id);
            return fresh || prev;
        });
    }, [inventory]);

    const filteredItems = useMemo(() => {
        return items.filter((item: any) => {
            if (activeTab === 'COMBAT') return item.type === 'Arma' || item.type === 'Armadura';
            if (activeTab === 'MAGIC') return item.type === 'Objeto Mágico' || item.rarity === 'Raro' || item.rarity === 'Legendario';
            if (activeTab === 'CONSUMABLE') return item.type === 'Consumible';
            return false;
        });
    }, [items, activeTab]);

    const isEquipped = (itemId: number) => {
        if (!equipment) return false;
        return SLOT_KEYS.some((s) => equipment[`${s}_id`] === itemId);
    };

    const slotForItem = (itemId: number): string | undefined =>
        SLOT_KEYS.find((s) => equipment?.[`${s}_id`] === itemId);

    // Item actualmente en un slot (asociación anidada o por *_id).
    const getItemInSlot = (slot: string) => {
        if (!equipment) return null;
        if (equipment[slot] && typeof equipment[slot] === 'object') return equipment[slot];
        const id = equipment[`${slot}_id`];
        if (id) return items.find((i: any) => i.id === id) || null;
        return null;
    };

    // Dados los talentos proyectados tras un cambio, qué umbrales elegidos se
    // perderían (su threshold queda por encima del nuevo total).
    const lostTalents = (projected: Record<string, number>) => {
        const lost: { tree: string; th: string }[] = [];
        for (const tree of ['espiritu', 'agilidad', 'aguante']) {
            const chosenMap = talentChoices?.[tree] || {};
            for (const th of Object.keys(chosenMap)) {
                if (Number(th) > (projected[tree] ?? 0)) lost.push({ tree, th });
            }
        }
        return lost;
    };

    // Ejecuta la acción; si baja talentos ya elegidos, pide confirmación.
    const confirmIfLoses = (projected: Record<string, number>, action: () => void) => {
        const lost = lostTalents(projected);
        if (lost.length === 0) { action(); return; }
        const TREE = { espiritu: 'Espíritu', agilidad: 'Agilidad', aguante: 'Aguante' } as any;
        const detail = lost.map((l) => `${TREE[l.tree]} (umbral ${l.th})`).join(', ');
        Alert.alert(
            'Perderás talentos',
            `Este cambio bajará tus puntos y perderás el acceso a: ${detail}. La elección queda guardada y reaparece si recuperás los puntos. ¿Continuar?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Continuar', style: 'destructive', onPress: action },
            ]
        );
    };

    // Equipar / desequipar (persiste en backend vía socket), con aviso de pérdida.
    const handleEquipToggle = (item: any) => {
        if (!item) return;
        const cur = talents || { espiritu: 0, agilidad: 0, aguante: 0 };

        if (isEquipped(item.id)) {
            const slot = slotForItem(item.id);
            if (!slot) return;
            const ts = item.talent_stats || {};
            const projected = {
                espiritu: (cur.espiritu || 0) - (ts.espiritu || 0),
                agilidad: (cur.agilidad || 0) - (ts.agilidad || 0),
                aguante: (cur.aguante || 0) - (ts.aguante || 0),
            };
            confirmIfLoses(projected, () => socket.emit('unequip-item', { characterId, slot }));
        } else {
            // Equipar puede REEMPLAZAR la pieza del slot → calcular el neto.
            const old = item.slot ? getItemInSlot(item.slot) : null;
            const o = old?.talent_stats || {};
            const n = item.talent_stats || {};
            const projected = {
                espiritu: (cur.espiritu || 0) - (o.espiritu || 0) + (n.espiritu || 0),
                agilidad: (cur.agilidad || 0) - (o.agilidad || 0) + (n.agilidad || 0),
                aguante: (cur.aguante || 0) - (o.aguante || 0) + (n.aguante || 0),
            };
            confirmIfLoses(projected, () => socket.emit('equip-item', { characterId, itemId: item.id }));
        }
    };

    const handleUse = (item: any) => {
        if (!item) return;
        console.log('[USE] use-item →', { characterId, itemId: item.id });
        socket.emit('use-item', { characterId, itemId: item.id });
    };

    return (
        <View style={styles.container}>
            {/* EQUIPO — figura central + slots */}
            <SectionHeader title="Equipo" icon={<Swords size={14} color={COLORS.bronzeLight} />} />
            <Panel bronze>
                <View style={styles.dollWrap}>
                    <EquipmentDoll
                        equipment={equipment}
                        inventory={items}
                        figureUrl={figureUrl}
                        onSlotPress={(item) => item && setSelectedItem(item)}
                    />
                    {syncing ? <RenderProgress stage={stage} progress={progress} /> : null}
                </View>

                {/* Acceso único al panel de retrato IA (ahorra espacio) */}
                <Button
                    title={syncing ? 'Generando retrato…' : 'Retrato IA'}
                    variant="secondary"
                    size="sm"
                    full
                    loading={syncing}
                    onPress={() => setAiModalVisible(true)}
                    icon={<Sparkles size={15} color={COLORS.bronzeLight} />}
                    style={styles.syncBtn}
                />

                {/* Defensa: CA + tipo de armadura + esquive */}
                <View style={styles.defenseRow}>
                    <View style={[styles.defenseBox, styles.defenseAc]}>
                        <Text style={styles.defenseAcVal}>{character?.ac ?? '—'}</Text>
                        <Text style={styles.defenseLabel}>Clase de Armadura</Text>
                    </View>
                    <View style={styles.defenseBox}>
                        <Text style={styles.defenseVal}>{character?.armorType ? ARMOR_LABEL[character.armorType] : 'Sin armadura'}</Text>
                        <Text style={styles.defenseLabel}>Armadura</Text>
                    </View>
                    {character?.dodge?.die ? (
                        <View style={styles.defenseBox}>
                            <Text style={styles.defenseVal}>1d{character.dodge.die}</Text>
                            <Text style={styles.defenseLabel}>Esquive</Text>
                        </View>
                    ) : null}
                </View>

                {/* Resumen de talentos + acceso al árbol */}
                <View style={styles.talentSummary}>
                    {[
                        { key: 'espiritu', label: 'Espíritu', color: COLORS.blue },
                        { key: 'agilidad', label: 'Agilidad', color: COLORS.success },
                        { key: 'aguante', label: 'Aguante', color: COLORS.danger },
                    ].map((t) => (
                        <View key={t.key} style={styles.talentChip}>
                            <Text style={[styles.talentChipVal, { color: t.color }]}>{(talents as any)?.[t.key] ?? 0}</Text>
                            <Text style={styles.talentChipLabel}>{t.label}</Text>
                        </View>
                    ))}
                </View>
                <Button
                    title="Ver talentos"
                    variant="ghost"
                    size="sm"
                    full
                    onPress={() => setTalentsModalVisible(true)}
                    icon={<Sparkles size={15} color={COLORS.textSecondary} />}
                    style={styles.syncBtnTight}
                />
            </Panel>

            {/* OBJETOS */}
            <View style={styles.inventoryBlock}>
                <SectionHeader title="Objetos" icon={<Backpack size={14} color={COLORS.bronzeLight} />} />
                <InventoryTabs activeTab={activeTab} onTabChange={setActiveTab} />

                {filteredItems.length > 0 ? (
                    filteredItems.map((item: any, idx: number) => (
                        <ItemCard
                            key={`${item.id}-${idx}`}
                            item={item}
                            isEquipped={isEquipped(item.id)}
                            onUse={() => handleUse(item)}
                            onEquip={() => handleEquipToggle(item)}
                        />
                    ))
                ) : (
                    <Text style={styles.emptyText}>No hay objetos en esta categoría.</Text>
                )}
            </View>

            <ItemDetailModal
                visible={!!selectedItem}
                item={selectedItem}
                character={character}
                onClose={() => setSelectedItem(null)}
                isEquipped={selectedItem ? isEquipped(selectedItem.id) : false}
                onEquip={() => handleEquipToggle(selectedItem)}
                onUse={() => handleUse(selectedItem)}
            />

            {/* Modal de retrato IA: indicaciones + acciones (ahorra espacio en la pantalla) */}
            <Modal visible={aiModalVisible} transparent animationType="fade" onRequestClose={() => setAiModalVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setAiModalVisible(false)}>
                    <Pressable style={styles.modalCard} onPress={() => { }}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalTitleRow}>
                                <Sparkles size={18} color={COLORS.amber} />
                                <Text style={styles.modalTitle}>Retrato IA</Text>
                            </View>
                            <Pressable onPress={() => setAiModalVisible(false)} style={styles.modalClose} hitSlop={10}>
                                <X size={20} color={COLORS.textPrimary} />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                            <Text style={styles.promptLabel}>Indicaciones para la IA (opcional)</Text>
                            <TextInput
                                style={styles.promptInput}
                                value={customPrompt}
                                onChangeText={setCustomPrompt}
                                placeholder="Ej: capa más larga, pose de perfil mirando al horizonte, expresión seria…"
                                placeholderTextColor={COLORS.textMuted}
                                multiline
                                maxLength={1000}
                                editable={!syncing}
                            />

                            <Button
                                title={uploadingBody
                                    ? 'Subiendo…'
                                    : hasBaseBody ? 'Cambiar cuerpo entero' : 'Subir cuerpo entero'}
                                variant="ghost"
                                size="sm"
                                full
                                loading={uploadingBody}
                                onPress={handleUploadBody}
                                icon={<UserSquare size={15} color={COLORS.textSecondary} />}
                                style={styles.syncBtn}
                            />
                            <Button
                                title="Sincronizar héroe"
                                variant="primary"
                                size="sm"
                                full
                                disabled={syncing}
                                onPress={() => { setAiModalVisible(false); handleSync(false); }}
                                icon={<Sparkles size={15} color="#1A0E04" />}
                                style={styles.syncBtnTight}
                            />
                            <Button
                                title="Regenerar (otra versión)"
                                variant="ghost"
                                size="sm"
                                full
                                disabled={syncing}
                                onPress={() => { setAiModalVisible(false); handleSync(true); }}
                                icon={<RefreshCw size={14} color={COLORS.textSecondary} />}
                                style={styles.syncBtnTight}
                            />
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Pantalla completa de talentos: defensa + atributos + árboles elegibles */}
            <Modal visible={talentsModalVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setTalentsModalVisible(false)}>
                <SafeAreaView style={styles.fullScreen}>
                    <View style={styles.fullHeader}>
                        <View style={styles.modalTitleRow}>
                            <Sparkles size={20} color={COLORS.amber} />
                            <Text style={styles.fullTitle}>Talentos</Text>
                        </View>
                        <Pressable onPress={() => setTalentsModalVisible(false)} style={styles.modalClose} hitSlop={10}>
                            <X size={22} color={COLORS.textPrimary} />
                        </Pressable>
                    </View>
                    <ScrollView contentContainerStyle={styles.fullContent} showsVerticalScrollIndicator={false}>
                        <ArmorTalents character={character} />
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: SPACING.md,
    },
    dollWrap: {
        position: 'relative',
    },
    promptLabel: {
        ...TYPO.label,
        color: COLORS.bronzeLight,
        marginTop: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    promptInput: {
        ...TYPO.body,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.bronze,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.md,
        minHeight: 64,
        textAlignVertical: 'top',
    },
    syncBtn: {
        marginTop: SPACING.md,
    },
    syncBtnTight: {
        marginTop: SPACING.sm,
    },
    defenseRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.lg,
    },
    defenseBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.sm,
    },
    defenseAc: { borderColor: COLORS.bronze },
    defenseAcVal: { ...TYPO.heading, color: COLORS.blue, fontWeight: '800' },
    defenseVal: { ...TYPO.subtitle, color: COLORS.textPrimary, fontWeight: '700' },
    defenseLabel: { ...TYPO.label, color: COLORS.textMuted, fontSize: 9, marginTop: 2, textAlign: 'center' },
    talentSummary: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.sm,
    },
    talentChip: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: COLORS.surfaceHighlight,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.sm,
    },
    talentChipVal: { ...TYPO.heading, fontWeight: '800' },
    talentChipLabel: { ...TYPO.label, color: COLORS.textMuted, fontSize: 9, marginTop: 1 },
    modalOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.overlay,
        padding: SPACING.xl,
    },
    modalCard: {
        width: '92%',
        maxHeight: '80%',
        backgroundColor: COLORS.surfaceRaised,
        borderWidth: 1.5,
        borderColor: COLORS.bronze,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    modalTitle: { ...TYPO.title, color: COLORS.textPrimary },
    modalClose: { padding: 4, backgroundColor: COLORS.surfaceHighlight, borderRadius: RADIUS.pill },
    // Pantalla completa de talentos
    fullScreen: { flex: 1, backgroundColor: COLORS.background },
    fullHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.bronzeDark,
    },
    fullTitle: { ...TYPO.title, color: COLORS.textPrimary, marginLeft: SPACING.sm },
    fullContent: { padding: SPACING.lg },
    inventoryBlock: {
        marginTop: SPACING.xxl,
    },
    emptyText: {
        ...TYPO.body,
        color: COLORS.textMuted,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: SPACING.xl,
    },
});
