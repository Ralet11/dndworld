import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Platform, Keyboard, Modal, FlatList, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { MessageCircle, Cloud, Swords, Send, FlaskConical, Dices, Lock, X } from 'lucide-react-native';
import { MessageMode } from './Chat/ChatBubble';

import socket from '../../services/socket';

interface InputDeckProps {
    onSend: (text: string, mode: MessageMode) => void;
    isActionBlocked?: boolean;
    isSilenced?: boolean;
    replyingTo?: { id: string; author: string; text: string } | null;
    onCancelReply?: () => void;
    bannerColor?: string;
    sceneId?: number;
    authorName?: string;
    hp?: number;
    maxHp?: number;
    inventory?: any[];
    onConsumeItem?: (item: any) => void;
}

export default function InputDeck({
    onSend,
    isActionBlocked = false,
    isSilenced = false,
    replyingTo,
    onCancelReply,
    bannerColor = '#3b82f6',
    sceneId,
    authorName = 'Unknown',
    hp = 0,
    maxHp = 0,
    inventory = [],
    onConsumeItem
}: InputDeckProps) {
    const [text, setText] = useState('');
    const [mode, setMode] = useState<MessageMode>('SAY');
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [itemSelectorVisible, setItemSelectorVisible] = useState(false);

    const consumables = inventory.filter(item => item.Item && item.Item.type === 'Consumible' && item.quantity > 0);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    const Container = Platform.OS === 'ios' ? BlurView : View;
    const containerProps =
        Platform.OS === 'ios'
            ? { intensity: 80, tint: 'dark' }
            : { style: { backgroundColor: 'rgba(11, 15, 25, 0.95)' } };

    const handleTextChange = (val: string) => {
        setText(val);
        if (sceneId && !isSilenced) {
            socket.emit('typing-start', { sceneId, authorName, isDm: false });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing-stop', { sceneId, authorName });
            }, 3000);
        }
    };

    const handleSend = () => {
        if (text.trim() && !isSilenced) {
            onSend(text.trim(), mode);
            setText('');
            if (sceneId) socket.emit('typing-stop', { sceneId, authorName });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (mode === 'DO') setMode('SAY'); // Auto-reset
        }
    };

    return (
        // @ts-ignore
        <Container {...containerProps} style={[styles.container, isKeyboardVisible && styles.containerKeyboardOpen, Platform.OS === 'android' && containerProps.style]}>
            {/* Context Banner (Reply) */}
            {replyingTo && (
                <View style={[styles.contextBanner, { backgroundColor: `${bannerColor}15`, borderLeftColor: bannerColor }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.contextLabel, { color: bannerColor }]}>Replying to {replyingTo.author}</Text>
                        <Text style={styles.contextText} numberOfLines={1}>{replyingTo.text}</Text>
                    </View>
                    <TouchableOpacity onPress={onCancelReply} style={{ padding: 4 }}>
                        <X size={14} color="#aaa" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Mode Selector */}
            <View style={styles.modeBar}>
                <TouchableOpacity onPress={() => setMode('SAY')} style={[styles.modeBtn, mode === 'SAY' && styles.activeMode]}>
                    <MessageCircle size={20} color={mode === 'SAY' ? '#fff' : '#666'} />
                    {mode === 'SAY' && <Text style={styles.modeText}>Say</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('THINK')} style={[styles.modeBtn, mode === 'THINK' && styles.activeMode]}>
                    <Cloud size={20} color={mode === 'THINK' ? '#a0aec0' : '#666'} />
                    {mode === 'THINK' && <Text style={styles.modeText}>Think</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => !isActionBlocked && setMode('DO')}
                    style={[styles.modeBtn, mode === 'DO' && styles.activeMode, isActionBlocked && { opacity: 0.5 }]}
                    disabled={isActionBlocked}
                >
                    {isActionBlocked ? <Lock size={16} color="#666" style={{ marginRight: 4 }} /> : <Swords size={20} color={mode === 'DO' ? '#a855f7' : '#666'} />}
                    {mode === 'DO' && <Text style={styles.modeText}>Do</Text>}
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* Tools */}
                <TouchableOpacity style={styles.toolBtn}>
                    <Dices size={20} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolBtn} onPress={() => setItemSelectorVisible(true)}>
                    <FlaskConical size={20} color="#666" />
                </TouchableOpacity>

                {/* HP Indicator */}
                <View style={{ flex: 1 }} />
                <View style={styles.hpIndicator}>
                    <Text style={styles.hpText}>HP</Text>
                    <Text style={[styles.hpValue, hp <= (maxHp / 4) ? { color: '#ef4444' } : { color: '#fff' }]}>
                        {hp}/{maxHp}
                    </Text>
                </View>
            </View>

            {/* Text Input Area */}
            <View style={[styles.inputRow, isSilenced && { opacity: 0.5 }]}>
                <TextInput
                    style={styles.input}
                    placeholder={isSilenced ? 'El DM ha silenciado la sala...' : mode === 'SAY' ? 'Say something...' : mode === 'THINK' ? 'What are you thinking?' : 'Describe your action...'}
                    placeholderTextColor="#666"
                    value={text}
                    onChangeText={handleTextChange}
                    editable={!isSilenced}
                    multiline
                />
                <TouchableOpacity onPress={handleSend} style={[styles.sendBtn, isSilenced && { backgroundColor: '#555' }]} disabled={isSilenced || !text.trim()}>
                    {isSilenced ? <Lock size={20} color="#999" /> : <Send size={20} color="#fff" />}
                </TouchableOpacity>
            </View>

            {/* Consumables Modal */}
            <Modal visible={itemSelectorVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <FlaskConical size={20} color="#38bdf8" style={{ marginRight: 8 }} />
                                <Text style={styles.modalTitle}>Consumibles</Text>
                            </View>
                            <TouchableOpacity onPress={() => setItemSelectorVisible(false)} style={styles.closeBtn}>
                                <X size={24} color="#aaa" />
                            </TouchableOpacity>
                        </View>

                        {consumables.length > 0 ? (
                            <FlatList
                                data={consumables}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.itemCard}
                                        onPress={() => {
                                            setItemSelectorVisible(false);
                                            if (onConsumeItem) onConsumeItem(item.Item);
                                        }}
                                    >
                                        <Image source={{ uri: item.Item.image_url || 'https://via.placeholder.com/100' }} style={styles.itemImage} />
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.itemName}>{item.Item.name}</Text>
                                            <Text style={styles.itemDesc} numberOfLines={2}>{item.Item.description}</Text>
                                        </View>
                                        <View style={styles.itemQuantity}>
                                            <Text style={styles.quantityText}>x{item.quantity}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            />
                        ) : (
                            <Text style={styles.emptyText}>No tienes objetos consumibles en tu inventario.</Text>
                        )}
                    </View>
                </View>
            </Modal>
        </Container>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 10,
        marginBottom: 85, // Lift above absolute Tab Bar (80px)
        paddingTop: 10,
        borderTopColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20, // Rounded corners since it's floating now
        marginHorizontal: 10, // Slight side margin for floating look
    },
    containerKeyboardOpen: {
        marginBottom: 0, // Let the parent KeyboardAvoidingView handle the padding
    },
    // New styles
    contextBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 15,
        marginBottom: 8,
        padding: 8,
        borderRadius: 8,
        borderLeftWidth: 3,
    },
    contextLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    contextText: {
        color: '#ccc',
        fontSize: 11,
        fontStyle: 'italic',
    },
    modeBar: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        marginBottom: 10,
        alignItems: 'center',
    },
    modeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 15,
        marginRight: 8,
    },
    activeMode: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    modeText: {
        color: '#fff',
        marginLeft: 6,
        fontSize: 12,
        fontWeight: 'bold',
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: '#333',
        marginHorizontal: 8,
    },
    toolBtn: {
        padding: 6,
        marginLeft: 4,
    },
    hpIndicator: {
        flexDirection: 'row',
        alignItems: 'baseline',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    hpText: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: 'bold',
        marginRight: 4,
    },
    hpValue: {
        fontSize: 12,
        fontWeight: '900',
    },
    inputRow: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        color: '#fff',
        maxHeight: 100,
        minHeight: 40,
        marginRight: 10,
    },
    sendBtn: {
        backgroundColor: '#2e78b7',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#151B2B',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '60%',
        minHeight: '40%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeBtn: {
        padding: 4,
    },
    itemCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        alignItems: 'center',
    },
    itemImage: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#333',
        marginRight: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    itemDesc: {
        color: '#aaa',
        fontSize: 12,
    },
    itemQuantity: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 10,
    },
    quantityText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    emptyText: {
        color: '#aaa',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    }
});
