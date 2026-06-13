import React from 'react';
import { Pressable, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface PressableScaleProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
    scale?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable con micro-animación de escala al tocar.
 *
 * La animación se aplica directamente sobre el Pressable (no sobre una vista
 * interna con height:'100%'), para que el área táctil se dimensione igual que
 * el contenido y NO colapse cuando el hijo se mide solo (botones, tarjetas).
 */
export default function PressableScale({ children, style, onPress, scale = 0.96 }: PressableScaleProps) {
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(pressed.value ? scale : 1, { damping: 12, stiffness: 220 }) }],
    }));

    return (
        <AnimatedPressable
            onPress={onPress}
            onPressIn={() => (pressed.value = 1)}
            onPressOut={() => (pressed.value = 0)}
            style={[style, animatedStyle]}
        >
            {children}
        </AnimatedPressable>
    );
}
