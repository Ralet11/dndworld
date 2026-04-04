import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { Dices, X } from 'lucide-react-native';

interface DiceRollerProps {
    visible: boolean;
    rollType: string; // e.g., "Dexterity Check"
    modifier?: number;
    rollMode?: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE';
    onRollComplete: (total: number, natural: number) => void;
    onClose: () => void;
}

export default function DiceRoller({ visible, rollType, modifier = 0, rollMode = 'NORMAL', onRollComplete, onClose }: DiceRollerProps) {
    const [rolling, setRolling] = useState(false);
    const [result, setResult] = useState<number | null>(null);
    const [natural, setNatural] = useState<number | null>(null);
    const [secondary, setSecondary] = useState<number | null>(null); // For Adv/Dis

    // Animations
    const shakeAnim = new Animated.Value(0);
    const scaleAnim = new Animated.Value(1);
    const textOpacity = new Animated.Value(1);

    const handleRoll = () => {
        if (rolling) return;
        setRolling(true);

        // 1. Highlight Text fade out
        Animated.timing(textOpacity, {
            toValue: 0.5,
            duration: 200,
            useNativeDriver: true,
        }).start();

        // 2. Shake Animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
            ]),
            { iterations: 10 }
        ).start();

        // 3. Resolve Roll
        setTimeout(() => {
            const die1 = Math.floor(Math.random() * 20) + 1;
            const die2 = Math.floor(Math.random() * 20) + 1;

            let keptDie = die1;

            if (rollMode === 'ADVANTAGE') {
                keptDie = Math.max(die1, die2);
                setSecondary(Math.min(die1, die2));
            } else if (rollMode === 'DISADVANTAGE') {
                keptDie = Math.min(die1, die2);
                setSecondary(Math.max(die1, die2));
            } else {
                setSecondary(null);
            }

            const totalVal = keptDie + modifier;

            setNatural(keptDie);
            setResult(totalVal);

            // Stop shake
            shakeAnim.setValue(0);

            // Pulse Effect
            Animated.sequence([
                Animated.spring(scaleAnim, { toValue: 1.5, friction: 3, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
            ]).start();

            setRolling(false);

            // Close after viewing result
            setTimeout(() => {
                onRollComplete(totalVal, keptDie);
            }, 2500); // Changed to 2.5s so user can see both dice

        }, 1000);
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <BlurView intensity={95} tint="dark" style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{rollType}</Text>
                        {!rolling && !result && (
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X size={24} color="#666" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Main Stage */}
                    <View style={styles.stage}>
                        <Animated.View
                            style={[
                                styles.diceContainer,
                                {
                                    transform: [
                                        { translateX: shakeAnim },
                                        { scale: scaleAnim }
                                    ]
                                }
                            ]}
                        >
                            <TouchableOpacity activeOpacity={0.8} onPress={handleRoll} disabled={rolling || result !== null}>
                                <View style={[styles.d20, result !== null && styles.d20Result, rolling && styles.d20Rolling]}>
                                    {result ? (
                                        <Text style={styles.resultNum}>{natural}</Text>
                                    ) : (
                                        <Dices size={80} color={rolling ? "#FFD700" : "#FFF"} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Status Text */}
                        <Animated.Text style={[styles.instruction, { opacity: textOpacity }]}>
                            {rolling ? "Rolling..." : result ? `Total: ${result}` : "Tap to Roll"}
                        </Animated.Text>

                        {result !== null && (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.modifierText}>
                                    ( {natural} {modifier >= 0 ? '+' : '-'} {Math.abs(modifier)} )
                                </Text>
                                {secondary !== null && (
                                    <Text style={[styles.modifierText, { fontSize: 12, color: '#666', marginTop: 4 }]}>
                                        {rollMode === 'ADVANTAGE' ? 'Advantage' : 'Disadvantage'}: [{natural}, {secondary}]
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                </BlurView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    container: {
        width: 320,
        height: 400,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(10,10,10,0.8)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        position: 'relative',
    },
    headerTitle: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    closeBtn: {
        position: 'absolute',
        right: 20,
        top: 18,
    },
    stage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    diceContainer: {
        marginBottom: 30,
    },
    d20: {
        width: 140,
        height: 140,
        borderRadius: 70, // Circle backup
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#444',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    d20Rolling: {
        borderColor: '#FFD700',
        backgroundColor: '#332',
    },
    d20Result: {
        borderColor: '#10B981',
        backgroundColor: '#064E3B',
    },
    resultNum: {
        color: '#fff',
        fontSize: 48,
        fontWeight: 'bold',
    },
    instruction: {
        color: '#ccc',
        fontSize: 18,
        fontWeight: '500',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    modifierText: {
        color: '#888',
        fontSize: 14,
    }
});
