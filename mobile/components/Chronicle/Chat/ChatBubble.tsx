import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Cloud, Swords, CheckCircle2, XCircle, Clock, Dices, Reply } from 'lucide-react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

export type MessageMode = 'SAY' | 'THINK' | 'DO';
export type ActionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ROLL_REQUESTED' | 'ROLL_RESULT';

interface ChatBubbleProps {
    mode: MessageMode;
    text: string;
    author: string;
    isSelf: boolean;
    timestamp?: string;
    status?: ActionStatus;
    isDmView?: boolean;
    onApprove?: () => void;
    onReject?: () => void;
    onRequestRoll?: () => void;
    repliedTo?: {
        author: string;
        text: string;
    };
    rollRequest?: {
        type: 'CHECK' | 'SAVE' | 'SKILL';
        stat: string;
        mode?: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE';
    };
    rollResult?: {
        total: number;
        natural: number;
        modifier: number;
    };
    onPlayerRoll?: () => void;
    onReply?: () => void;
    color?: string; // Character specific color
    avatar?: any; // Avatar image source (url or require)
    image?: string; // Message attachment
    onImagePress?: (url: string) => void;
}

export default function ChatBubble({ mode, text, author, isSelf, status = 'APPROVED', isDmView = false, onApprove, onReject, onRequestRoll, onPlayerRoll, repliedTo, rollRequest, rollResult, onReply, color = '#FFD700', avatar, image, onImagePress }: ChatBubbleProps) {
    const swipeableRef = useRef<Swipeable>(null);

    // Animation Values
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
                easing: Easing.out(Easing.cubic),
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
                easing: Easing.out(Easing.cubic),
            })
        ]).start();
    }, []);

    const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const trans = dragX.interpolate({
            inputRange: [0, 50, 100],
            outputRange: [-20, 0, 0],
        });
        const opacity = dragX.interpolate({
            inputRange: [0, 50],
            outputRange: [0, 1],
        });

        return (
            <View style={styles.swipeActionLeft}>
                <Animated.View style={{ transform: [{ translateX: trans }], opacity: opacity }}>
                    <Reply size={20} color={color} />
                </Animated.View>
            </View>
        );
    };

    const handleSwipeOpen = () => {
        if (onReply) {
            onReply();
            swipeableRef.current?.close();
        }
    };

    const renderContent = () => {
        // DO MODE (ACTIONS)
        if (mode === 'DO') {
            const getStatusConfig = () => {
                switch (status) {
                    case 'PENDING':
                        return { color: '#c084fc', border: '#a855f7', bg: 'rgba(88, 28, 135, 0.25)', icon: <Clock size={14} color="#c084fc" />, prefix: 'intenta' };
                    case 'APPROVED':
                        return { color: '#34d399', border: '#10b981', bg: 'rgba(2, 44, 34, 0.35)', icon: <CheckCircle2 size={14} color="#34d399" />, prefix: 'ejecuta la acción y' };
                    case 'REJECTED':
                        return { color: '#f87171', border: '#ef4444', bg: 'rgba(69, 10, 10, 0.4)', icon: <XCircle size={14} color="#f87171" />, prefix: 'falla en el intento de' };
                    case 'ROLL_REQUESTED':
                    case 'ROLL_RESULT':
                        return { color: '#facc15', border: '#eab308', bg: 'rgba(66, 32, 6, 0.4)', icon: <Dices size={14} color="#facc15" />, prefix: 'intenta' };
                    default:
                        return { color, border: 'transparent', bg: `rgba(20,20,20,0.4)`, icon: null, prefix: '' };
                }
            };

            const config = getStatusConfig();

            return (
                <View style={{ marginVertical: 8 }}>
                    <View style={[styles.newActionContainer, { backgroundColor: config.bg, borderLeftWidth: 3, borderLeftColor: config.border, borderColor: 'rgba(255,255,255,0.05)' }]}>
                        <View style={styles.actionHeader}>
                            {config.icon}
                            <Text style={[styles.newActionAuthor, { color: config.color }]}>
                                {author} <Text style={styles.actionPrefix}>{config.prefix}</Text>
                            </Text>
                        </View>
                        <View style={styles.actionDivider} />
                        <Text style={[styles.newActionText, status === 'REJECTED' && { textDecorationLine: 'line-through', opacity: 0.6 }]}>
                            {text}
                        </Text>
                    </View>

                    {/* ROLL REQUESTED & RESULT */}
                    {status === 'ROLL_REQUESTED' && rollRequest && (
                        <View style={styles.challengeContainer}>
                            {isDmView || !isSelf ? (
                                <View style={[styles.waitingForRoll, { borderColor: config.color, backgroundColor: config.bg }]}>
                                    <Text style={[styles.waitingText, { color: config.color }]}>
                                        Esperando tirada de {rollRequest.stat}
                                        {/* @ts-ignore */}
                                        {rollRequest.mode === 'ADVANTAGE' ? ' (Adv)' : rollRequest.mode === 'DISADVANTAGE' ? ' (Dis)' : ''}...
                                    </Text>
                                    <Clock size={12} color={config.color} />
                                </View>
                            ) : (
                                <TouchableOpacity style={[styles.rollBtn, { backgroundColor: config.color, shadowColor: config.color }]} onPress={onPlayerRoll}>
                                    <Dices size={16} color="#000" />
                                    <Text style={styles.rollBtnText}>
                                        Tirar {rollRequest.stat}
                                        {/* @ts-ignore */}
                                        {rollRequest.mode === 'ADVANTAGE' ? ' (Adv)' : rollRequest.mode === 'DISADVANTAGE' ? ' (Desv)' : ''}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {status === 'ROLL_RESULT' && rollResult && (
                        <View style={[styles.miniResult, { borderColor: `${config.color}40`, backgroundColor: config.bg }]}>
                            <Dices size={16} color={config.color} />
                            <Text style={[styles.miniResultText, { color: config.color }]}>
                                Resultado: {rollResult.total} <Text style={styles.miniResultDetail}>({rollResult.natural}{rollResult.modifier >= 0 ? '+' : ''}{rollResult.modifier})</Text>
                            </Text>
                        </View>
                    )}

                    {/* DM CONTROLS */}
                    {isDmView && (status === 'PENDING' || status === 'ROLL_RESULT') && (
                        <View style={styles.dmControls}>
                            <TouchableOpacity onPress={onApprove} style={[styles.dmBtn, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' }]}>
                                <CheckCircle2 size={16} color="#10B981" />
                            </TouchableOpacity>

                            {status === 'PENDING' && (
                                <TouchableOpacity onPress={onRequestRoll} style={[styles.dmBtn, { backgroundColor: 'rgba(234, 179, 8, 0.2)', borderColor: '#eab308', flex: 1, justifyContent: 'center' }]}>
                                    <Dices size={16} color="#eab308" />
                                    <Text style={[styles.dmBtnText, { color: '#eab308' }]}>Pedir Tirada</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity onPress={onReject} style={[styles.dmBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' }]}>
                                <XCircle size={16} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            );
        }

        // THINK MODE
        if (mode === 'THINK') {
            return (
                <View style={[styles.container, isSelf ? styles.right : styles.left]}>
                    <View style={[styles.bubble, styles.bubbleThink, { borderColor: color }]}>
                        <View style={styles.thinkHeader}>
                            <Cloud size={12} color={color} style={{ marginRight: 4 }} />
                            <Text style={[styles.thinkLabel, { color: color }]}>Privado</Text>
                        </View>
                        <Text style={styles.textThink}>{text}</Text>
                    </View>
                </View>
            );
        }

        // SAY MODE (DEFAULT)
        return (
            <View style={[styles.container, isSelf ? styles.right : styles.left]}>
                {!isSelf && <Text style={[styles.authorName, { color: color || '#888', marginLeft: 40 }]}>{author}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                    {!isSelf && avatar && <Image source={avatar} style={[styles.avatar, { borderColor: color }]} />}
                    <View style={[
                        styles.bubble,
                        isSelf ? styles.bubbleSelf : styles.bubbleVideo,
                        { borderLeftWidth: !isSelf ? 2 : 0, borderRightWidth: isSelf ? 2 : 0, borderColor: color }
                    ]}>
                        {repliedTo && (
                            <View style={styles.replyBlock}>
                                <View style={[styles.replyLine, { backgroundColor: color }]} />
                                <View style={styles.replyContent}>
                                    <Text style={[styles.replyAuthor, { color: color }]}>{repliedTo.author}</Text>
                                    <Text style={styles.replyText} numberOfLines={1}>{repliedTo.text}</Text>
                                </View>
                            </View>
                        )}
                        {/* IMAGE ATTACHMENT */}
                        {image && (
                            <TouchableOpacity
                                onPress={() => {
                                    console.log('ChatBubble: Image pressed', image);
                                    onImagePress?.(image);
                                }}
                                activeOpacity={0.9}
                            >
                                <Image
                                    source={{ uri: image }}
                                    style={{ width: 200, height: 150, borderRadius: 8, marginBottom: 8, resizeMode: 'cover' }}
                                />
                            </TouchableOpacity>
                        )}
                        {text ? <Text style={[styles.text, isSelf ? styles.textSelf : styles.textOther]}>{text}</Text> : null}
                    </View>
                    {isSelf && avatar && <Image source={avatar} style={[styles.avatar, { borderColor: color }]} />}
                </View>
            </View>
        );
    };

    return (
        <Swipeable
            ref={swipeableRef}
            renderLeftActions={renderLeftActions}
            onSwipeableWillOpen={handleSwipeOpen}
            friction={2}
            overshootLeft={false}
        >
            return (
            <Animated.View style={{ opacity, transform: [{ translateY }] }}>
                {renderContent()}
            </Animated.View>
            );
        </Swipeable>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 4,
        maxWidth: '75%',
        paddingHorizontal: 10,
    },
    left: {
        alignSelf: 'flex-start',
    },
    right: {
        alignSelf: 'flex-end',
    },
    bubble: {
        paddingHorizontal: 12, // Compact padding
        paddingVertical: 8,
        borderRadius: 16,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginHorizontal: 8,
        borderWidth: 1.5,
        marginBottom: 2,
    },
    bubbleSelf: {
        backgroundColor: '#2e78b7', // Blue for self
        borderBottomRightRadius: 4,
    },
    bubbleVideo: {
        backgroundColor: '#333', // Dark grey for others
        borderBottomLeftRadius: 4,
    },
    bubbleThink: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: '#4a5568',
        borderStyle: 'dashed',
    },
    text: {
        fontSize: 15,
        lineHeight: 22,
    },
    textSelf: {
        color: '#fff',
    },
    textOther: {
        color: '#e0e0e0',
    },
    textThink: {
        color: '#a0aec0', // Greyish blue
        fontStyle: 'italic',
        fontSize: 14,
    },
    thinkHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    thinkLabel: {
        color: '#718096',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    authorName: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    // New Action Styles
    newActionContainer: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 8,
        minWidth: 260,
    },
    actionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
    },
    actionPrefix: {
        color: '#9ca3af',
        fontSize: 12,
        fontStyle: 'italic',
        fontWeight: 'normal',
        textTransform: 'none',
    },
    actionDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginBottom: 8,
        width: '100%',
    },
    newActionAuthor: {
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    newActionText: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
    },
    dmControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: -4,
        marginBottom: 16,
        gap: 12,
        paddingHorizontal: 20,
    },
    dmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
    },
    dmBtnText: {
        marginLeft: 6,
        fontSize: 12,
        fontWeight: 'bold',
    },
    // Persistent Reply Styles (Inside Bubble)
    replyBlock: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 4,
        marginBottom: 6,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    replyLine: {
        width: 4,
        backgroundColor: '#FFD700', // Gold accent
    },
    replyContent: {
        padding: 6,
        paddingRight: 10,
        flex: 1,
    },
    replyAuthor: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    replyText: {
        color: '#ccc',
        fontSize: 11,
        fontStyle: 'italic',
    },
    // Challenge Styles
    challengeContainer: {
        alignItems: 'center',
        marginBottom: 16,
        marginTop: -8,
    },
    waitingForRoll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    waitingText: {
        color: '#3B82F6',
        fontSize: 11,
        fontStyle: 'italic',
    },
    rollBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFD700',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
        gap: 8,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    rollBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 14,
        textTransform: 'uppercase',
    },
    // Result Styles (Minimalist)
    miniResult: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        alignSelf: 'center',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 16,
        gap: 6,
        marginTop: -8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    miniResultText: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: 'bold',
    },
    miniResultDetail: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'normal',
    },
    // Swipe Styles
    swipeActionLeft: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginVertical: 4,
    }
});
