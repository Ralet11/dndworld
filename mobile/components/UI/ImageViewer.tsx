import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, Image, TouchableOpacity, Dimensions, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    FadeIn,
    FadeOut
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');

interface ImageViewerProps {
    visible: boolean;
    imageUrl: string | null;
    onClose: () => void;
}

export default function ImageViewer({ visible, imageUrl, onClose }: ImageViewerProps) {
    const scale = useSharedValue(0.5);
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            scale.value = withSpring(1);
            opacity.value = withTiming(1);
            translateY.value = 0;
        } else {
            scale.value = 0.5;
            opacity.value = 0;
        }
    }, [visible]);

    if (!imageUrl) return null;

    const panGesture = Gesture.Pan()
        .onChange((e) => {
            translateY.value = e.translationY;
        })
        .onEnd((e) => {
            if (Math.abs(e.translationY) > 100) {
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }, { translateY: translateY.value }],
        opacity: opacity.value
    }));

    return (
        <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <TouchableOpacity style={styles.container} activeOpacity={1} onPress={onClose}>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                        >
                            <X color="#fff" size={24} />
                        </TouchableOpacity>

                        <GestureDetector gesture={panGesture}>
                            <Animated.View style={[styles.imageContainer, animatedStyle]}>
                                <TouchableOpacity activeOpacity={1}>
                                    {/* Prevent closing when clicking image itself */}
                                    <Image
                                        source={{ uri: imageUrl }}
                                        style={styles.image}
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>
                            </Animated.View>
                        </GestureDetector>

                        <View style={styles.hintContainer}>
                            <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 20 }}>Swipe down to close</Text>
                        </View>
                    </TouchableOpacity>
                </GestureHandlerRootView>
            </BlurView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageContainer: {
        width: width,
        height: height * 0.8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    closeBtn: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    hintContainer: {
        position: 'absolute',
        bottom: 50,
        alignItems: 'center',
    }
});
