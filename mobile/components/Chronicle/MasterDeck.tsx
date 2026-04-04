import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, Platform, Image, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { Scroll, Send, Skull, Mic, X, Image as ImageIcon, Sparkles } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import socket from '../../services/socket';

export type MasterMode = 'NARRATE' | 'NPC';

interface MasterDeckProps {
    onSend: (text: string, mode: MasterMode, image?: string | null) => void;
    replyingTo?: {
        id: string;
        author: string;
        text: string;
    } | null;
    onCancelReply?: () => void;
    onAiGenerate?: () => void;
    sceneId?: number;
}

export interface MasterDeckRef {
    focusInput: () => void;
    setMode: (mode: MasterMode) => void;
}

const MasterDeck = forwardRef<MasterDeckRef, MasterDeckProps>(({ onSend, replyingTo, onCancelReply, onAiGenerate, sceneId }, ref) => {
    const [text, setText] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [mode, setMode] = useState<MasterMode>('NARRATE');
    const inputRef = useRef<TextInput>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

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

    useImperativeHandle(ref, () => ({
        focusInput: () => {
            inputRef.current?.focus();
        },
        setMode: (newMode: MasterMode) => {
            setMode(newMode);
        }
    }));

    const Container = Platform.OS === 'ios' ? BlurView : View;
    const containerProps =
        Platform.OS === 'ios'
            ? { intensity: 80, tint: 'dark' }
            : { style: { backgroundColor: 'rgba(11, 15, 25, 0.95)' } };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleTextChange = (val: string) => {
        setText(val);
        if (sceneId) {
            socket.emit('typing-start', { sceneId, authorName: 'DM', isDm: true });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing-stop', { sceneId, authorName: 'DM' });
            }, 3000);
        }
    };

    const handleSend = () => {
        if (text.trim() || image) {
            onSend(text, mode, image);
            setText('');
            setImage(null);
            if (sceneId) socket.emit('typing-stop', { sceneId, authorName: 'DM' });
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
    };

    return (
        // @ts-ignore
        <Container {...containerProps} style={[styles.container, isKeyboardVisible && styles.containerKeyboardOpen, Platform.OS === 'android' && containerProps.style]}>

            {/* REPLY CONTEXT BANNER */}
            {replyingTo && (
                <View style={[styles.replyBanner, { borderLeftColor: mode === 'NARRATE' ? '#A855F7' : '#FF4444' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.replyAuthor}>Replying to {replyingTo.author}</Text>
                        <Text style={styles.replyText} numberOfLines={1}>{replyingTo.text}</Text>
                    </View>
                    <TouchableOpacity onPress={onCancelReply}>
                        <X size={16} color="#aaa" />
                    </TouchableOpacity>
                </View>
            )}

            {/* IMAGE PREVIEW */}
            {image && (
                <View style={styles.previewContainer}>
                    <Image source={{ uri: image }} style={styles.previewImage} />
                    <TouchableOpacity onPress={() => setImage(null)} style={styles.removePreviewBtn}>
                        <X size={12} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Mode Selector */}
            <View style={styles.modeBar}>
                <TouchableOpacity onPress={() => setMode('NARRATE')} style={[styles.modeBtn, mode === 'NARRATE' && styles.activeMode]}>
                    <Scroll size={20} color={mode === 'NARRATE' ? '#A855F7' : '#666'} />
                    {mode === 'NARRATE' && <Text style={[styles.modeText, { color: '#A855F7' }]}>Narrate</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setMode('NPC')} style={[styles.modeBtn, mode === 'NPC' && styles.activeMode]}>
                    <Skull size={20} color={mode === 'NPC' ? '#FF4444' : '#666'} />
                    {mode === 'NPC' && <Text style={[styles.modeText, { color: '#FF4444' }]}>NPC</Text>}
                </TouchableOpacity>

                <View style={{ width: 1, height: 20, backgroundColor: '#333', marginHorizontal: 8 }} />

                <TouchableOpacity
                    onPress={onAiGenerate}
                    style={[styles.modeBtn, { backgroundColor: 'rgba(56, 189, 248, 0.1)' }]}
                >
                    <Sparkles size={16} color="#38bdf8" />
                    <Text style={[styles.modeText, { color: '#38bdf8' }]}>Oracle AI</Text>
                </TouchableOpacity>
            </View>

            {/* Text Input Area */}
            <View style={styles.inputRow}>
                <TouchableOpacity onPress={pickImage} style={styles.iconBtn}>
                    <ImageIcon size={24} color="#888" />
                </TouchableOpacity>

                <TextInput
                    ref={inputRef}
                    style={[
                        styles.input,
                        mode === 'NARRATE' ? { borderColor: '#A855F7', borderWidth: 1 } : { borderColor: '#FF4444', borderWidth: 1 }
                    ]}
                    placeholder={mode === 'NARRATE' ? 'Describe what happens...' : 'Speak as an NPC...'}
                    placeholderTextColor="#666"
                    value={text}
                    onChangeText={handleTextChange}
                    multiline
                />
                <TouchableOpacity onPress={handleSend} style={[styles.sendBtn, { backgroundColor: mode === 'NARRATE' ? '#A855F7' : '#FF4444' }]}>
                    <Send size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </Container>
    );
});

export default MasterDeck;

const styles = StyleSheet.create({
    container: {
        paddingBottom: 10,
        marginBottom: 90, // Lift above absolute Tab Bar (80px) + margin
        paddingTop: 10,
        borderTopColor: 'rgba(168, 85, 247, 0.2)', // Purple hint
        borderRadius: 20,
        marginHorizontal: 10,
    },
    containerKeyboardOpen: {
        marginBottom: 0, // Let the parent KeyboardAvoidingView handle the offset entirely
    },
    // New Reply Styles
    replyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 8,
        borderLeftWidth: 3,
    },
    replyAuthor: {
        color: '#A855F7',
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    replyText: {
        color: '#ccc',
        fontSize: 12,
        fontStyle: 'italic',
    },
    // Preview Styles
    previewContainer: {
        marginLeft: 20,
        marginBottom: 10,
        flexDirection: 'row',
    },
    previewImage: {
        width: 80,
        height: 60,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#666',
    },
    removePreviewBtn: {
        position: 'absolute',
        top: -5,
        left: 70,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
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
        marginLeft: 6,
        fontSize: 12,
        fontWeight: 'bold',
    },
    inputRow: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        alignItems: 'flex-end',
    },
    iconBtn: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
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
        marginLeft: 4,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
