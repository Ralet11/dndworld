import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, Modal, Pressable, ScrollView, Image, View } from 'react-native';
import { X, Shield, Sword, Swords, Sparkles } from 'lucide-react-native';
import Button from '../../UI/Button';
import { isEquippable, slotLabel } from '../../../utils/DndUtils';
import { COLORS, SPACING, TYPO, RADIUS, rarityColor as rarityColorToken } from '../../../constants/Theme';

const ARMOR_TYPE_LABEL: Record<string, string> = {
    tela: 'Tela (ligera)',
    cuero: 'Cuero (media)',
    malla: 'Malla (pesada)',
};

interface ItemDetailModalProps {
    visible: boolean;
    item: any;
    onClose: () => void;
    onEquip?: () => void;
    onUse?: () => void;
    isEquipped?: boolean;
    /** Personaje (para calcular el modificador de daño según FUE/DES). */
    character?: any;
}

export default function ItemDetailModal({ visible, item, onClose, onEquip, onUse, isEquipped, character }: ItemDetailModalProps) {
    if (!item) return null;

    const color = rarityColorToken(item.rarity);
    const isGear = isEquippable(item);
    const isConsumable = item.type === 'Consumible';

    // Modificador de característica que se suma al daño del arma.
    // A distancia → DES; Sutil (finesse) → la mejor de FUE/DES; melee → FUE.
    const mods = character?.modifiers || {};
    const props: string[] = Array.isArray(item.properties) ? item.properties : [];
    const isRanged = props.some((p) => /munici/i.test(p));
    const isFinesse = props.some((p) => /sutil/i.test(p));
    let dmgMod = 0;
    if (item.damage) {
        if (isRanged) dmgMod = mods.dex || 0;
        else if (isFinesse) dmgMod = Math.max(mods.str || 0, mods.dex || 0);
        else dmgMod = mods.str || 0;
    }
    const dmgModStr = item.damage && dmgMod !== 0 ? ` ${dmgMod > 0 ? '+' : ''}${dmgMod}` : '';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            {/* Tap afuera = cerrar */}
            <Pressable style={styles.overlay} onPress={onClose}>
                {/* Tap adentro de la tarjeta NO cierra (absorbe el toque) */}
                <Pressable style={[styles.card, { borderColor: color }]} onPress={() => { }}>
                    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                        {item.image_url ? (
                            <ItemImage url={item.image_url} />
                        ) : null}

                        <View style={styles.body}>
                            <View style={styles.header}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.rarity, { color }]}>
                                        {item.rarity} · {item.type}{slotLabel(item) ? ` · ${slotLabel(item)}` : ''}
                                    </Text>
                                    <Text style={styles.name}>{item.name}</Text>
                                </View>
                                <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                                    <X size={22} color={COLORS.textPrimary} />
                                </Pressable>
                            </View>

                            {(item.damage || item.weapon_category || item.ac || item.stat_bonuses?.ac) ? (
                                <View style={styles.statsGrid}>
                                    {item.damage ? (
                                        <View style={styles.statBox}>
                                            <Sword size={16} color={COLORS.danger} />
                                            <Text style={styles.statText}>{item.damage}{dmgModStr} {item.damage_type || ''}</Text>
                                        </View>
                                    ) : null}
                                    {item.weapon_category ? (
                                        <View style={styles.statBox}>
                                            <Swords size={16} color={COLORS.bronzeLight} />
                                            <Text style={styles.statText}>{item.weapon_category}</Text>
                                        </View>
                                    ) : null}
                                    {(item.ac || item.stat_bonuses?.ac) ? (
                                        <View style={styles.statBox}>
                                            <Shield size={16} color={COLORS.blue} />
                                            <Text style={styles.statText}>+{item.ac || item.stat_bonuses?.ac} CA</Text>
                                        </View>
                                    ) : null}
                                </View>
                            ) : null}

                            {/* Propiedades del arma */}
                            {Array.isArray(item.properties) && item.properties.length > 0 ? (
                                <View style={styles.propRow}>
                                    {item.properties.map((p: string, i: number) => (
                                        <View key={i} style={styles.propChip}>
                                            <Text style={styles.propText}>{p}</Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}

                            {/* Maestría del arma */}
                            {item.mastery ? (
                                <View style={styles.masteryBox}>
                                    <View style={styles.masteryHead}>
                                        <Swords size={14} color={COLORS.bronzeLight} />
                                        <Text style={styles.masteryName}>Maestría · {item.mastery.name}</Text>
                                    </View>
                                    {item.mastery.desc ? <Text style={styles.masteryDesc}>{item.mastery.desc}</Text> : null}
                                </View>
                            ) : null}

                            <Text style={styles.description}>
                                {item.description || 'Sin descripción disponible.'}
                            </Text>

                            {/* Armadura: tipo + CA que aporta (viene con el ítem, solo lectura) */}
                            {item.armor_type ? (
                                <View style={styles.armorInfo}>
                                    <View style={styles.armorInfoBox}>
                                        <Text style={styles.armorInfoVal}>{ARMOR_TYPE_LABEL[item.armor_type] || item.armor_type}</Text>
                                        <Text style={styles.armorInfoLabel}>Tipo</Text>
                                    </View>
                                    {typeof item.ca_value === 'number' ? (
                                        <View style={styles.armorInfoBox}>
                                            <Text style={styles.armorInfoVal}>+{item.ca_value}</Text>
                                            <Text style={styles.armorInfoLabel}>CA de la pieza</Text>
                                        </View>
                                    ) : null}
                                </View>
                            ) : null}

                            {/* Talentos que otorga la pieza */}
                            {item.talent_stats && (item.talent_stats.espiritu || item.talent_stats.agilidad || item.talent_stats.aguante) ? (
                                <View style={styles.bonusRow}>
                                    {([
                                        { k: 'espiritu', label: 'Espíritu', color: COLORS.blue },
                                        { k: 'agilidad', label: 'Agilidad', color: COLORS.success },
                                        { k: 'aguante', label: 'Aguante', color: COLORS.danger },
                                    ] as const).map(({ k, label, color: c }) => (
                                        item.talent_stats[k] ? (
                                            <View key={k} style={styles.bonusChip}>
                                                <Text style={[styles.bonusVal, { color: c }]}>+{item.talent_stats[k]}</Text>
                                                <Text style={styles.bonusLabel}>{label}</Text>
                                            </View>
                                        ) : null
                                    ))}
                                </View>
                            ) : null}

                            {/* Habilidad especial */}
                            {item.ability ? (
                                <View style={styles.abilityBox}>
                                    <View style={styles.abilityHead}>
                                        <Sparkles size={14} color={COLORS.amber} />
                                        <Text style={styles.abilityName}>{item.ability.nombre}</Text>
                                        {item.ability.tier ? <Text style={styles.abilityTier}>{item.ability.tier}</Text> : null}
                                    </View>
                                    {item.ability.descripcion ? (
                                        <Text style={styles.abilityDesc}>{item.ability.descripcion}</Text>
                                    ) : null}
                                </View>
                            ) : null}

                            {isGear ? (
                                <Button
                                    title={isEquipped ? 'Desequipar' : 'Equipar'}
                                    variant={isEquipped ? 'secondary' : 'primary'}
                                    full
                                    style={styles.action}
                                    onPress={() => { onEquip?.(); onClose(); }}
                                />
                            ) : null}

                            {isConsumable ? (
                                <Button
                                    title="Usar"
                                    variant="primary"
                                    full
                                    style={styles.action}
                                    onPress={() => { onUse?.(); onClose(); }}
                                />
                            ) : null}
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

/**
 * Muestra la imagen del item completa (sin recorte), ajustando el alto a la
 * proporción real de la imagen (con un tope) para que no queden bandas feas.
 */
function ItemImage({ url }: { url: string }) {
    const [ratio, setRatio] = useState(1.5);
    useEffect(() => {
        let alive = true;
        Image.getSize(url, (w, h) => { if (alive && w && h) setRatio(w / h); }, () => { });
        return () => { alive = false; };
    }, [url]);
    return (
        <View style={styles.imageWrap}>
            <Image
                source={{ uri: url }}
                style={[styles.image, { aspectRatio: ratio }]}
                resizeMode="contain"
            />
        </View>
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
    card: {
        width: '92%',
        maxHeight: '82%',
        backgroundColor: COLORS.surfaceRaised,
        borderWidth: 1.5,
        borderRadius: RADIUS.xl,
        overflow: 'hidden',
    },
    imageWrap: {
        width: '100%',
        maxHeight: 300,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.bronzeDark,
    },
    image: { width: '100%', maxHeight: 300 },
    body: { padding: SPACING.xl },
    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.lg },
    rarity: { ...TYPO.label, marginBottom: 2 },
    name: { ...TYPO.heading, color: COLORS.textPrimary },
    closeBtn: { padding: 4, backgroundColor: COLORS.surfaceHighlight, borderRadius: RADIUS.pill },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
    statBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.surface,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    statText: { ...TYPO.caption, color: COLORS.textPrimary, fontWeight: '600' },
    description: { ...TYPO.body, color: COLORS.textSecondary, lineHeight: 22 },
    action: { marginTop: SPACING.xl },

    // Info de armadura (solo lectura — viene con el ítem)
    armorInfo: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.lg,
    },
    armorInfoBox: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
    },
    armorInfoVal: { ...TYPO.subtitle, color: COLORS.textPrimary, fontWeight: '700' },
    armorInfoLabel: { ...TYPO.label, color: COLORS.textMuted, fontSize: 10, marginTop: 2 },

    // Propiedades del arma (chips)
    propRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
    propChip: {
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.pill,
        paddingHorizontal: SPACING.md,
        paddingVertical: 4,
    },
    propText: { ...TYPO.caption, color: COLORS.textSecondary, fontWeight: '600' },

    // Maestría del arma
    masteryBox: {
        marginTop: SPACING.md,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.bronze,
        backgroundColor: COLORS.surface,
    },
    masteryHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
    masteryName: { ...TYPO.subtitle, color: COLORS.bronzeLight, fontWeight: '800' },
    masteryDesc: { ...TYPO.caption, color: COLORS.textSecondary, lineHeight: 18 },

    // Talentos que otorga
    bonusRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
    bonusChip: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.sm,
    },
    bonusVal: { ...TYPO.subtitle, fontWeight: '800' },
    bonusLabel: { ...TYPO.label, color: COLORS.textMuted, fontSize: 9, marginTop: 1 },

    // Habilidad especial
    abilityBox: {
        marginTop: SPACING.md,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.amber,
        backgroundColor: 'rgba(245,158,11,0.08)',
    },
    abilityHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
    abilityName: { ...TYPO.subtitle, color: COLORS.amber, fontWeight: '800', flex: 1 },
    abilityTier: {
        ...TYPO.label,
        fontSize: 9,
        color: COLORS.amber,
        backgroundColor: 'rgba(245,158,11,0.15)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 1,
        borderRadius: RADIUS.pill,
        textTransform: 'capitalize',
    },
    abilityDesc: { ...TYPO.caption, color: COLORS.textSecondary, lineHeight: 18 },

    // Editor de armadura
    armorEditor: {
        marginTop: SPACING.xl,
        paddingTop: SPACING.lg,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: SPACING.sm,
    },
    editorLabel: { ...TYPO.label, color: COLORS.bronzeLight },
    weightRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
    weightChip: {
        flex: 1,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
    },
    weightChipActive: { borderColor: COLORS.amber, backgroundColor: COLORS.surfaceHighlight },
    weightChipText: { ...TYPO.caption, color: COLORS.textSecondary, textTransform: 'capitalize', fontWeight: '700' },
    weightChipTextActive: { color: COLORS.amber },
    materialBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.bronze,
        backgroundColor: COLORS.surface,
    },
    materialBtnText: { ...TYPO.subtitle, color: COLORS.textPrimary },

    // Selector de material
    pickerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    pickerCard: {
        width: '85%',
        maxHeight: '70%',
        backgroundColor: COLORS.surfaceRaised,
        borderRadius: RADIUS.xl,
        borderWidth: 1.5,
        borderColor: COLORS.bronze,
        padding: SPACING.lg,
    },
    pickerTitle: { ...TYPO.title, color: COLORS.textPrimary, marginBottom: SPACING.md },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    pickerRowText: { ...TYPO.body, color: COLORS.textPrimary },
    pickerRowRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    pickerRowWeight: { ...TYPO.caption, color: COLORS.textMuted, textTransform: 'capitalize' },
});
