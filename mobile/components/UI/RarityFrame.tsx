import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from './PressableScale';
import { COLORS, RADIUS, GLOWS, rarityColor } from '../../constants/Theme';

interface RarityFrameProps {
    children?: React.ReactNode;
    /** Rareza del item ('Común'…'Legendario') o color directo. */
    rarity?: string;
    size?: number;
    /** Slot vacío (estilo apagado, sin glow). */
    empty?: boolean;
    selected?: boolean;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

/**
 * Marco cuadrado tintado por rareza con glow — la unidad visual de items y
 * slots de equipo (estilo inventario RPG de la referencia).
 */
export default function RarityFrame({
    children,
    rarity,
    size = 60,
    empty = false,
    selected = false,
    onPress,
    style,
}: RarityFrameProps) {
    const color = empty ? COLORS.border : rarityColor(rarity);

    const content = (
        <View
            style={[
                styles.frame,
                {
                    width: size,
                    height: size,
                    borderColor: selected ? COLORS.ember : color,
                    borderWidth: selected ? 2 : 1.5,
                },
                !empty && GLOWS.rarity(color),
                style,
            ]}
        >
            <LinearGradient
                colors={empty ? ['transparent', 'transparent'] : [`${color}22`, 'transparent']}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.inner}>{children}</View>
        </View>
    );

    if (onPress) {
        return (
            <PressableScale onPress={onPress} style={{ width: size, height: size }}>
                {content}
            </PressableScale>
        );
    }
    return content;
}

const styles = StyleSheet.create({
    frame: {
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.surfaceHighlight,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inner: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
