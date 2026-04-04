import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence,
    Easing
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const VIAL_WIDTH = 60;
const VIAL_HEIGHT = 200;

interface HealthVialProps {
    current: number;
    max: number;
}

export default function HealthVial({ current, max }: HealthVialProps) {
    const fillPercent = current / max;
    const bubbleY = useSharedValue(0);

    useEffect(() => {
        bubbleY.value = withRepeat(
            withSequence(
                withTiming(-VIAL_HEIGHT, { duration: 2000, easing: Easing.linear }),
                withTiming(0, { duration: 0 }) // Reset immediately
            ),
            -1, // Infinite repeat
            false
        );
    }, []);

    const liquidStyle = useAnimatedStyle(() => {
        return {
            height: withTiming(`${fillPercent * 100}%`, { duration: 1000 }),
        };
    });

    const bubblesStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: bubbleY.value }],
        };
    });

    return (
        <View style={styles.container}>
            {/* Glass Container */}
            <View style={styles.glassBorder}>
                <View style={styles.glassBody}>
                    {/* Background (Empty) */}
                    <View style={styles.emptySpace} />

                    {/* Liquid */}
                    <Animated.View style={[styles.liquidContainer, liquidStyle]}>
                        <LinearGradient
                            colors={['#ff4d4d', '#990000']}
                            style={styles.liquid}
                        />
                        {/* Rising Bubbles Effect */}
                        <Animated.View style={[styles.bubbles, bubblesStyle]}>
                            <View style={styles.bubble} />
                            <View style={[styles.bubble, { left: 10, top: 40, width: 4, height: 4 }]} />
                            <View style={[styles.bubble, { left: 30, top: 80, width: 6, height: 6 }]} />
                        </Animated.View>
                    </Animated.View>

                    {/* Shine/Reflection */}
                    <LinearGradient
                        colors={['rgba(255,255,255,0.4)', 'transparent']}
                        style={styles.reflection}
                    />

                    {/* Marks on the glass */}
                    <View style={styles.marks}>
                        <View style={styles.mark} />
                        <View style={[styles.mark, { top: '50%' }]} />
                        <View style={[styles.mark, { top: '75%' }]} />
                    </View>
                </View>

                {/* Cap */}
                <View style={styles.cap} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
    },
    glassBorder: {
        width: VIAL_WIDTH + 8,
        height: VIAL_HEIGHT + 8,
        borderRadius: VIAL_WIDTH / 2,
        borderWidth: 2,
        borderColor: '#444',
        padding: 4,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    glassBody: {
        width: '100%',
        height: '100%',
        borderRadius: (VIAL_WIDTH - 8) / 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    cap: {
        position: 'absolute',
        top: -12,
        width: VIAL_WIDTH + 8,
        height: 12,
        backgroundColor: '#333',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
    },
    emptySpace: {
        flex: 1,
    },
    liquidContainer: {
        width: '100%',
        position: 'absolute',
        bottom: 0,
        overflow: 'hidden',
    },
    liquid: {
        width: '100%',
        height: '100%',
    },
    reflection: {
        position: 'absolute',
        top: 0,
        left: 10,
        width: 10,
        height: '90%',
        borderRadius: 5,
    },
    bubbles: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    bubble: {
        position: 'absolute',
        width: 5,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2.5,
        left: 20,
        top: 100,
    },
    marks: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 10,
    },
    mark: {
        position: 'absolute',
        right: 5,
        top: '25%',
        width: 8,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
    }
});
