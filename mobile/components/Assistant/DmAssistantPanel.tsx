import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Clock3, HeartPulse, MapPin, RotateCcw, Send, Sparkles, Users, X } from 'lucide-react-native';
import { API_URL } from '../../constants/Config';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_SUGGESTIONS = [
    'contexto',
    '5 menos de vida a Lucario',
    'cura 8 a Paleas Mucron',
    'sumale 50 xp a Zik',
    'sumale 25 oro a Rakion Altarion',
    'dale inspiracion a Lucario',
    'activa a Albert Obrien',
    'narra La niebla cubre el puerto',
    'pone la hora en 19:30',
    'pone la ubicacion en Prontera',
];

const THINKING_STEPS = [
    'Pensando...',
    'Revisando contexto e historial reciente...',
    'Decidiendo si hace falta usar tools...',
    'Ejecutando cambios en la sesion...',
    'Preparando la respuesta final...',
];

type AssistantMessage = {
    id: string;
    role: 'assistant' | 'user';
    kind: string;
    text: string;
    tool?: string;
    suggestions?: string[];
    undoAvailable?: boolean;
};

interface AssistantPanelProps {
    sceneId?: number | null;
    onClose?: () => void;
}

function serializeHistory(messages: AssistantMessage[]) {
    return messages
        .filter((msg) => msg.id !== 'welcome')
        .slice(-8)
        .map((msg) => ({
            role: msg.role,
            kind: msg.kind,
            text: msg.text,
            tool: msg.tool,
        }));
}

function ContextCard({
    icon,
    title,
    value,
    tone,
}: {
    icon: React.ReactNode;
    title: string;
    value: string;
    tone: string;
}) {
    return (
        <View style={styles.contextCard}>
            <View style={styles.contextHeader}>
                {icon}
                <Text style={[styles.contextLabel, { color: tone }]}>{title}</Text>
            </View>
            <Text style={styles.contextValue}>{value}</Text>
        </View>
    );
}

function MessageBubble({ msg, onUndo }: { msg: AssistantMessage; onUndo: () => void }) {
    const isUser = msg.role === 'user';
    const showToolLabel = !isUser && msg.tool && !String(msg.tool).startsWith('assistant.');
    const bubbleStyle = isUser
        ? styles.userBubble
        : msg.kind === 'error'
            ? styles.errorBubble
            : styles.assistantBubble;

    return (
        <View style={[styles.messageRow, isUser ? styles.messageRowRight : styles.messageRowLeft]}>
            <View style={[styles.messageBubble, bubbleStyle]}>
                {showToolLabel ? (
                    <Text style={styles.messageTool}>{msg.tool}</Text>
                ) : null}
                <Text style={styles.messageText}>{msg.text}</Text>
                {!isUser && msg.undoAvailable ? (
                    <TouchableOpacity onPress={onUndo} style={styles.undoBtn}>
                        <RotateCcw size={14} color="#F59E0B" />
                        <Text style={styles.undoText}>Deshacer</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

export default function DmAssistantPanel({ sceneId = null, onClose }: AssistantPanelProps) {
    const { token, user } = useAuth();
    const canUseAssistant = user?.role === 'DM' || user?.role === 'ADMIN';
    const [context, setContext] = useState<any>(null);
    const [messages, setMessages] = useState<AssistantMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            kind: 'help',
            text: 'Asistente del DM listo. Hablame normal: puedes describir la situacion, pedir ideas, resumir escena o hacer cambios sobre la sesion sin escribir comandos rigidos.',
            tool: 'assistant.ready',
            suggestions: DEFAULT_SUGGESTIONS,
            undoAvailable: false,
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [contextLoading, setContextLoading] = useState(true);
    const scrollRef = useRef<ScrollView>(null);

    const latestSuggestions = useMemo(() => {
        const latestAssistant = [...messages].reverse().find((msg) => msg.role === 'assistant' && msg.suggestions?.length);
        return latestAssistant?.suggestions || DEFAULT_SUGGESTIONS;
    }, [messages]);

    const fetchContext = async () => {
        if (!token) return;
        setContextLoading(true);
        try {
            const query = sceneId ? `?sceneId=${sceneId}` : '';
            const response = await fetch(`${API_URL}/api/dm-assistant/context${query}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('Context load failed');
            const data = await response.json();
            setContext(data);
        } catch (error) {
            console.error('DmAssistantPanel context error:', error);
        } finally {
            setContextLoading(false);
        }
    };

    useEffect(() => {
        fetchContext();
    }, [token, sceneId]);

    useEffect(() => {
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }, [messages, loading]);

    useEffect(() => {
        if (!loading) {
            setLoadingStep(0);
            return undefined;
        }

        setLoadingStep(0);
        const interval = setInterval(() => {
            setLoadingStep((prev) => Math.min(prev + 1, THINKING_STEPS.length - 1));
        }, 1400);

        return () => clearInterval(interval);
    }, [loading]);

    const pushAssistantReply = (reply: any) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `${Date.now()}-${Math.random()}`,
                role: 'assistant',
                kind: reply.kind,
                text: reply.text,
                tool: reply.tool,
                suggestions: reply.suggestions,
                undoAvailable: !!reply.undoAvailable,
            },
        ]);
    };

    const sendCommand = async (rawMessage: string) => {
        const message = rawMessage.trim();
        if (!message || !token || loading || !canUseAssistant) return;
        const history = serializeHistory(messages);

        setMessages((prev) => [
            ...prev,
            {
                id: `user-${Date.now()}`,
                role: 'user',
                kind: 'user',
                text: message,
                undoAvailable: false,
            },
        ]);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/dm-assistant/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ message, history, sceneId }),
            });
            const data = await response.json();
            if (!data?.reply) throw new Error('Invalid assistant response');
            pushAssistantReply(data.reply);
            if (response.ok) {
                fetchContext();
            }
        } catch (error) {
            console.error('DmAssistantPanel command error:', error);
            pushAssistantReply({
                kind: 'error',
                text: 'No pude procesar ese comando.',
                tool: 'assistant.error',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Sparkles size={22} color="#38bdf8" />
                    <View>
                        <Text style={styles.headerTitle}>Assistant</Text>
                        <Text style={styles.headerSubtitle}>
                            {user?.username ? `Operador: ${user.username}` : 'Asistente del DM'}
                        </Text>
                    </View>
                </View>
                {onClose ? (
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X size={18} color="#A89F8E" />
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.contextSection}>
                {!canUseAssistant ? (
                    <View style={styles.warningCard}>
                        <Text style={styles.warningTitle}>Acceso restringido</Text>
                        <Text style={styles.warningText}>
                            Este panel requiere una cuenta con rol DM o ADMIN.
                        </Text>
                    </View>
                ) : null}
                {contextLoading ? (
                    <View style={styles.loadingCard}>
                        <ActivityIndicator color="#38bdf8" />
                    </View>
                ) : context ? (
                    <>
                        <ContextCard
                            icon={<Clock3 size={15} color="#F59E0B" />}
                            title="Hora"
                            value={context.world?.time || '...'}
                            tone="#F59E0B"
                        />
                        <ContextCard
                            icon={<MapPin size={15} color="#5BA86B" />}
                            title="Ubicacion"
                            value={context.world?.location || '...'}
                            tone="#5BA86B"
                        />
                        <ContextCard
                            icon={<HeartPulse size={15} color="#C2452F" />}
                            title="Heridos"
                            value={context.injured?.length ? context.injured.map((char: any) => `${char.name} ${char.hp}/${char.maxHp}`).join(' | ') : 'Nadie herido'}
                            tone="#C2452F"
                        />
                        <ContextCard
                            icon={<Users size={15} color="#9B5DE5" />}
                            title="Party"
                            value={`${context.party?.length || 0} personajes cargados`}
                            tone="#9B5DE5"
                        />
                    </>
                ) : null}
            </View>

            <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
            >
                {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} onUndo={() => sendCommand('deshacer')} />
                ))}
                {loading ? (
                    <View style={[styles.messageRow, styles.messageRowLeft]}>
                        <View style={[styles.messageBubble, styles.assistantBubble]}>
                            <Text style={styles.messageTool}>Assistant</Text>
                            <View style={styles.loadingInline}>
                                <ActivityIndicator size="small" color="#67e8f9" />
                                <Text style={styles.messageText}>{THINKING_STEPS[loadingStep]}</Text>
                            </View>
                        </View>
                    </View>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
                    {latestSuggestions.map((suggestion) => (
                        <TouchableOpacity
                            key={suggestion}
                            onPress={() => sendCommand(suggestion)}
                            style={styles.suggestionChip}
                        >
                            <Text style={styles.suggestionText}>{suggestion}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.composerRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej: Lucario le metio 5 al goblin, bajale eso y luego dame una frase para narrarlo"
                        placeholderTextColor="#6B6557"
                        value={input}
                        onChangeText={setInput}
                        multiline
                        editable={canUseAssistant}
                    />
                    <TouchableOpacity
                        onPress={() => sendCommand(input)}
                        disabled={!input.trim() || loading || !canUseAssistant}
                        style={[styles.sendBtn, (!input.trim() || loading || !canUseAssistant) && styles.sendBtnDisabled]}
                    >
                        <Send size={18} color="#06131A" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F1518',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 56 : 24,
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#2A332F',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#16211F',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        color: '#EDE6D8',
        fontSize: 20,
        fontWeight: '900',
    },
    headerSubtitle: {
        color: '#A89F8E',
        fontSize: 12,
        marginTop: 2,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1E2A28',
        borderWidth: 1,
        borderColor: '#2A332F',
    },
    contextSection: {
        padding: 12,
        gap: 10,
    },
    contextCard: {
        backgroundColor: '#16211F',
        borderWidth: 1,
        borderColor: '#2A332F',
        borderRadius: 14,
        padding: 12,
    },
    contextHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    contextLabel: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    contextValue: {
        color: '#EDE6D8',
        fontSize: 13,
        fontWeight: '700',
    },
    loadingCard: {
        backgroundColor: '#16211F',
        borderWidth: 1,
        borderColor: '#2A332F',
        borderRadius: 14,
        padding: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    warningCard: {
        backgroundColor: 'rgba(194,69,47,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(194,69,47,0.35)',
        borderRadius: 14,
        padding: 14,
    },
    warningTitle: {
        color: '#F0B4AA',
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 4,
    },
    warningText: {
        color: '#E2C3BE',
        fontSize: 13,
        lineHeight: 18,
    },
    messages: {
        flex: 1,
    },
    messagesContent: {
        paddingHorizontal: 12,
        paddingBottom: 16,
        gap: 12,
    },
    messageRow: {
        flexDirection: 'row',
    },
    messageRowLeft: {
        justifyContent: 'flex-start',
    },
    messageRowRight: {
        justifyContent: 'flex-end',
    },
    messageBubble: {
        maxWidth: '88%',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 8,
    },
    userBubble: {
        backgroundColor: 'rgba(62,132,214,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(62,132,214,0.35)',
    },
    assistantBubble: {
        backgroundColor: 'rgba(56,189,248,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(56,189,248,0.25)',
    },
    errorBubble: {
        backgroundColor: 'rgba(194,69,47,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(194,69,47,0.35)',
    },
    messageTool: {
        color: '#67e8f9',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    messageText: {
        color: '#EDE6D8',
        fontSize: 14,
        lineHeight: 20,
    },
    loadingInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    undoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: 'rgba(245,158,11,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.25)',
    },
    undoText: {
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: '800',
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: '#2A332F',
        backgroundColor: '#16211F',
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    },
    suggestionsRow: {
        paddingHorizontal: 12,
        gap: 8,
        paddingBottom: 10,
    },
    suggestionChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(56,189,248,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(56,189,248,0.20)',
    },
    suggestionText: {
        color: '#8FDBF0',
        fontSize: 12,
        fontWeight: '700',
    },
    composerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        paddingHorizontal: 12,
    },
    input: {
        flex: 1,
        minHeight: 46,
        maxHeight: 110,
        borderRadius: 16,
        backgroundColor: '#0F1518',
        borderWidth: 1,
        borderColor: '#2A332F',
        color: '#EDE6D8',
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
    },
    sendBtn: {
        width: 46,
        height: 46,
        borderRadius: 16,
        backgroundColor: '#38bdf8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: {
        opacity: 0.4,
    },
});
