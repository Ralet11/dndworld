import React from 'react';
import { Pressable, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

interface PressableScaleProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
    scale?: number;
}

export default function PressableScale({ children, style, onPress, scale = 0.95 }: PressableScaleProps) {
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => {
        const scaleVal = pressed.value ? scale : 1;
        return {
            transform: [{ scale: withSpring(scaleVal, { damping: 10, stiffness: 200 }) }],
        };
    });

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => (pressed.value = 1)}
            onPressOut={() => (pressed.value = 0)}
            style={style}
        >
            <Animated.View style={[{ width: '100%', height: '100%' }, animatedStyle]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}
