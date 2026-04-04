import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, FlatList, ImageBackground, KeyboardAvoidingView, Platform, Dimensions, Text, TouchableOpacity, Image, Modal, ScrollView, TextInput, ActivityIndicator, Animated, Keyboard } from 'react-native';
import { Crown, ArrowLeft, Users, Check, X, Search, UserPlus, UserMinus, Trash2, Sparkles, Volume2, VolumeX, Sun, Moon } from 'lucide-react-native';

import { BlurView } from 'expo-blur';
// Components
import OrientationHUD from './OrientationHUD';
import ChatBubble, { MessageMode } from './Chat/ChatBubble';
import InputDeck from './InputDeck';
import ImageViewer from '../UI/ImageViewer';
import SceneCard from '../SceneCard';
import MasterDeck, { MasterMode, MasterDeckRef } from './MasterDeck';
import RollSelector, { RollType, RollMode } from './DM/RollSelector';
import DiceRoller from './Player/DiceRoller';

import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import socket from '../../services/socket';
import { API_URL } from '../../constants/Config';

const { height } = Dimensions.get('window');

interface SceneChatProps {
    scene: any;
    onBack: () => void;
}

export default function SceneChat({ scene, onBack }: SceneChatProps) {
    const { userRole, toggleRole, isDmMode } = useGame();
    const { user } = useAuth();

    // State
    const [messages, setMessages] = useState<any[]>([]);
    const masterDeckRef = useRef<MasterDeckRef>(null);
    const [replyingTo, setReplyingTo] = useState<{ id: string; author: string; text: string } | null>(null);
    const [participants, setParticipants] = useState<any[]>(scene.participants || []);
    const [participantModalVisible, setParticipantModalVisible] = useState(false);
    const [availableCharacters, setAvailableCharacters] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Chat Controls State
    const [isSilenced, setIsSilenced] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [dmTyping, setDmTyping] = useState(false);

    // Global Time State
    const [globalTime, setGlobalTime] = useState('12:00');
    const [globalLocation, setGlobalLocation] = useState('...');

    // Keyboard Avoidance for scroll
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        if (Platform.OS === 'ios') return;

        const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // Roll Selector State
    const [rollModalVisible, setRollModalVisible] = useState(false);
    const [targetActionId, setTargetActionId] = useState<string | null>(null);

    const [myPlayerId, setMyPlayerId] = useState<number>(3); // Default fallback

    // Dice Roller State (Player)
    const [diceRollerVisible, setDiceRollerVisible] = useState(false);

    const [activeRollRequest, setActiveRollRequest] = useState<{ msgId: string, stat: string, type: string, mode?: string } | null>(null);

    // Image Viewer State
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // AI Oracle State
    const [oracleModalVisible, setOracleModalVisible] = useState(false);
    const [oraclePrompt, setOraclePrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // SOCKET LISTENERS
    useEffect(() => {
        // 1. Request history for THIS SCENE
        console.log('SceneChat: Requesting timeline for scene:', scene.id);
        socket.emit('get-timeline', scene.id);
        socket.emit('get-players');
        socket.emit('get-silence-state', scene.id);

        // 2. Listen for history
        const handleTimelineData = (data: any[]) => {
            console.log('SceneChat: Received timeline data:', data.length, 'messages');
            setMessages(data);
        };

        const handlePlayersData = (players: any[]) => {
            setAvailableCharacters(players);
            if (players && players.length > 0) {
                const myChar = players.find((p: any) => p.UserId == user?.id);
                if (myChar) {
                    setMyPlayerId(myChar.id);
                } else {
                    setMyPlayerId(players[0].id);
                }
            }
        };

        const handleSceneUpdated = (data: any) => {
            if (data.sceneId === scene.id) {
                setParticipants(data.participants);
            }
        };

        // 3. Listen for new messages
        const handleNewMessage = (msg: any) => {
            // Filter by scene? 
            // Ideally backend manages rooms, but for now check if msg belongs to this scene
            // Or if backend emits generically, we check `scene_id`.
            // Wait, previous TimelineEvents didn't have scene_id. New ones will.
            // If msg.scene_id matches scene.id OR is null (if global, but we want strict?)
            // Let's assume strict.
            if (msg.scene_id && msg.scene_id !== scene.id) return;

            console.log('SceneChat: Received new message:', msg.id);

            setMessages(prev => {
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
        };

        const handleMessageUpdated = (updatedMsg: any) => {
            console.log('SceneChat: Message updated:', updatedMsg.id);
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        };

        const handleSilenceChanged = ({ sceneId, isSilenced }: { sceneId: number, isSilenced: boolean }) => {
            if (sceneId === scene.id) {
                setIsSilenced(isSilenced);
            }
        };

        const handleTypingStart = ({ sceneId, authorName, isDm }: { sceneId: number, authorName: string, isDm: boolean }) => {
            if (sceneId === scene.id) {
                if (isDm) {
                    setDmTyping(true);
                } else {
                    setTypingUsers(prev => new Set(prev).add(authorName));
                }
            }
        };

        const handleTypingStop = ({ sceneId, authorName }: { sceneId: number, authorName: string }) => {
            if (sceneId === scene.id) {
                if (authorName === 'DM') {
                    setDmTyping(false);
                } else {
                    setTypingUsers(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(authorName);
                        return newSet;
                    });
                }
            }
        };

        const handleGlobalState = (state: any) => {
            if (state) {
                if (state.global_time) setGlobalTime(state.global_time);
                if (state.global_location) setGlobalLocation(state.global_location);
            }
        };

        socket.on('timeline-data', handleTimelineData);
        socket.on('players-data', handlePlayersData);
        socket.on('scene-updated', handleSceneUpdated);
        socket.on('new-message', handleNewMessage);
        socket.on('message-updated', handleMessageUpdated);
        socket.on('scene-silence-changed', handleSilenceChanged);
        socket.on('user-typing-start', handleTypingStart);
        socket.on('user-typing-stop', handleTypingStop);
        socket.on('global-state-data', handleGlobalState);

        // Initial request for global state
        socket.emit('get-global-state');

        return () => {
            socket.off('timeline-data', handleTimelineData);
            socket.off('players-data', handlePlayersData);
            socket.off('scene-updated', handleSceneUpdated);
            socket.off('new-message', handleNewMessage);
            socket.off('message-updated', handleMessageUpdated);
            socket.off('scene-silence-changed', handleSilenceChanged);
            socket.off('user-typing-start', handleTypingStart);
            socket.off('user-typing-stop', handleTypingStop);
            socket.off('global-state-data', handleGlobalState);
        };
    }, [user, scene.id]);

    useEffect(() => {
        if (participantModalVisible) {
            socket.emit('get-players');
        }
    }, [participantModalVisible]);

    const getApiUrl = () => {
        return API_URL;
    };

    const toggleSilence = () => {
        const newSilence = !isSilenced;
        setIsSilenced(newSilence);
        socket.emit('toggle-silence', { sceneId: scene.id, isSilenced: newSilence });
    };

    const toggleParticipant = (id: number) => {
        const currentIds = participants.map(p => p.id);
        const newIds = currentIds.includes(id)
            ? currentIds.filter(pid => pid !== id)
            : [...currentIds, id];

        socket.emit('update-scene-participants', {
            sceneId: scene.id,
            participants: newIds
        });
    };

    const handleDmSend = async (text: string, mode: MasterMode, image?: string | null) => {
        let finalImageUrl = image;

        if (image) {
            try {
                const formData = new FormData();
                const filename = image.split('/').pop() || 'upload.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image`;

                // @ts-ignore
                formData.append('image', {
                    uri: image,
                    name: filename,
                    type: type,
                });

                const response = await fetch(`${getApiUrl()}/api/upload`, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                const data = await response.json();
                if (data.url) finalImageUrl = data.url;
            } catch (error) {
                console.error('Frontend: Error uploading image:', error);
            }
        }

        const replyData = replyingTo ? {
            author: replyingTo.author,
            text: replyingTo.text
        } : undefined;

        const msgData = {
            text: text,
            author_id: null,
            image: finalImageUrl,
            replyTo: replyData,
            sceneId: scene.id // IMPORTANT: Send Scene ID
        };

        if (mode === 'NARRATE') {
            socket.emit('chat-message', {
                ...msgData,
                type: 'SYSTEM',
                mode: 'SAY',
            });
        } else if (mode === 'NPC') {
            socket.emit('chat-message', {
                ...msgData,
                type: 'CHAT',
                mode: 'SAY',
                author_id: null,
            });
        }
        setReplyingTo(null);
    };

    const handleApprove = (msgId: string) => {
        // Optimistic update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'APPROVED' } : m));

        socket.emit('update-message', {
            messageId: msgId,
            updates: { status: 'APPROVED' }
        });

        const targetMsg = messages.find(m => m.id === msgId);
        if (targetMsg) {
            let authorStr = 'Unknown';
            if (targetMsg.author) {
                authorStr = typeof targetMsg.author === 'string' ? targetMsg.author : targetMsg.author.name || 'Unknown';
            }

            setReplyingTo({
                id: targetMsg.id,
                author: authorStr,
                text: targetMsg.text || targetMsg.content || ''
            });
        }
        masterDeckRef.current?.setMode('NARRATE');
        setTimeout(() => masterDeckRef.current?.focusInput(), 100);
    };

    const handleReject = (msgId: string) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'REJECTED' } : m));
        socket.emit('update-message', {
            messageId: msgId,
            updates: { status: 'REJECTED' }
        });
    };

    const handleRequestRoll = (msgId: string) => {
        setTargetActionId(msgId);
        setRollModalVisible(true);
    };

    const handleSelectRoll = (type: RollType, stat: string, mode: RollMode) => {
        // Optimistic
        setMessages(prev => prev.map(m =>
            m.id === targetActionId ? {
                ...m,
                status: 'ROLL_REQUESTED',
                rollRequest: { type, stat, mode }
            } : m
        ));

        if (targetActionId) {
            socket.emit('update-message', {
                messageId: targetActionId,
                updates: {
                    status: 'ROLL_REQUESTED',
                    metadata: {
                        rollRequest: { type, stat, mode }
                    }
                }
            });
        }

        setRollModalVisible(false);
        setTargetActionId(null);
    };

    const handlePlayerRoll = (msgId: string, request: { stat: string, type: string, mode?: string }) => {
        setActiveRollRequest({ msgId, ...request });
        setDiceRollerVisible(true);
    };

    const handleRollComplete = (total: number, natural: number) => {
        if (!activeRollRequest) return;

        // Optimistic
        setMessages(prev => prev.map(m =>
            m.id === activeRollRequest.msgId ? {
                ...m,
                status: 'ROLL_RESULT',
                rollResult: { total, natural, modifier: 0 }
            } : m
        ));

        socket.emit('update-message', {
            messageId: activeRollRequest.msgId,
            updates: {
                status: 'ROLL_RESULT',
                metadata: {
                    rollResult: { total, natural, modifier: 0 }
                }
            }
        });

        setDiceRollerVisible(false);
        setActiveRollRequest(null);
    };

    const handleOracleGenerate = async () => {
        if (!oraclePrompt.trim()) return;
        setIsGenerating(true);

        try {
            const token = await import('@react-native-async-storage/async-storage').then(m => m.default.getItem('token'));
            const res = await fetch(`${getApiUrl()}/api/ai/narrate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ prompt: oraclePrompt })
            });

            if (res.ok) {
                const data = await res.json();
                setOracleModalVisible(false);
                setOraclePrompt('');
                handleDmSend(data.text, 'NARRATE');
            } else {
                alert('El Oráculo está en silencio (Error del servidor)');
            }
        } catch (e) {
            console.error('Oracle Error:', e);
            alert('Fallo de conexión con el Oráculo');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSend = (text: string, mode: MessageMode) => {
        if (!myPlayerId) return;

        socket.emit('chat-message', {
            text,
            mode,
            author_id: myPlayerId,
            image: null,
            replyTo: replyingTo ? { author: replyingTo.author, text: replyingTo.text } : undefined,
            type: 'CHAT',
            sceneId: scene.id // IMPORTANT: Send Scene ID
        });

        setReplyingTo(null);
    };

    const handleConsumeItem = (item: any) => {
        if (!myPlayerId || !item) return;

        socket.emit('chat-message', {
            text: `intenta consumir ${item.name}...`,
            mode: 'DO', // Has to be approved
            status: 'PENDING',
            author_id: myPlayerId,
            image: null,
            type: 'CHAT',
            sceneId: scene.id,
            metadata: {
                itemRequest: {
                    characterId: myPlayerId,
                    itemId: item.id
                }
            }
        });
    };

    const CHARACTER_COLORS: Record<string, string> = {
        'Valeros': '#f59e0b',
        'Seoni': '#ec4899',
        'Ezren': '#3b82f6',
        'Merisiel': '#10b981',
        'Kyra': '#facc15',
        'Harsk': '#8b5cf6',
        'DM': '#ffffff',
        'Goblin Ambush': '#ef4444',
    };

    const getCharacterColor = (author: string) => CHARACTER_COLORS[author] || '#cccccc';

    const isDayTime = () => {
        try {
            const hour = parseInt(globalTime.split(':')[0], 10);
            return hour >= 6 && hour < 19;
        } catch (e) {
            return true;
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        // SCENE CARD
        if (item.type === 'SCENE') {
            return (
                <View style={{ marginBottom: 20, marginTop: 20 }}>
                    <SceneCard item={item} index={0} />
                </View>
            );
        }

        // SYSTEM (NARRATIVE/ORACLE)
        if (item.type === 'SYSTEM') {
            const sysImage = item.metadata?.image || item.image;
            // Clean up the Oracle tag for cleaner display
            const displayText = item.content?.replace('(Oracle @ Server)', '').trim() || '';

            return (
                <View style={[styles.systemMsgContainer, { borderLeftColor: '#60a5fa', borderLeftWidth: 3, backgroundColor: 'rgba(23, 37, 84, 0.4)' }]}>
                    <View style={styles.systemMsgHeader}>
                        <Crown size={14} color="#60a5fa" />
                        <Text style={[styles.systemMsgTitle, { color: '#60a5fa' }]}>
                            DUNGEON MASTER
                        </Text>
                    </View>
                    {sysImage && (
                        <Image source={{ uri: sysImage }} style={styles.systemImage} />
                    )}
                    {displayText ? <Text style={styles.systemText}>{displayText}</Text> : null}
                </View>
            );
        }

        // CHAT
        if (item.type === 'CHAT') {
            if (item.mode === 'THINK' && !item.isSelf && !isDmMode) return null;

            const getAuthorName = (authorProp: any) => {
                if (!authorProp) return 'DM';
                if (typeof authorProp === 'string') return authorProp;
                // @ts-ignore
                return authorProp.name || 'Unknown';
            };

            const authorName = getAuthorName(item.author);

            // Safe access for metadata
            const meta = item.metadata || {};
            const messageMode = meta.mode || item.mode || 'SAY';
            const messageText = item.content || item.text || '';
            const messageImage = meta.image || item.image;
            const messageReply = meta.repliedTo || item.repliedTo;
            const rollRequestObj = meta.rollRequest || item.rollRequest;
            const rollResultObj = meta.rollResult || item.rollResult;

            const messageStatus = meta.status || item.status;

            const authorChar = availableCharacters.find(c => c.name === authorName);
            const avatarUrl = authorChar?.image_url || 'https://via.placeholder.com/150';

            return (
                <ChatBubble
                    mode={messageMode}
                    text={messageText}
                    author={authorName}
                    isSelf={isDmMode ? authorName === 'DM' : (item.author_id === myPlayerId)}
                    isDmView={isDmMode}
                    status={messageStatus}
                    repliedTo={messageReply}
                    rollRequest={rollRequestObj}
                    rollResult={rollResultObj}
                    onApprove={() => handleApprove(item.id)}
                    onReject={() => handleReject(item.id)}
                    onRequestRoll={() => handleRequestRoll(item.id)}
                    onPlayerRoll={() => rollRequestObj && handlePlayerRoll(item.id, rollRequestObj)}
                    onReply={() => setReplyingTo({ id: item.id, author: authorName, text: messageText })}
                    color={getCharacterColor(authorName)}
                    avatar={{ uri: avatarUrl }}
                    image={messageImage}
                    onImagePress={setSelectedImage}
                    timestamp={new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                />
            );
        }
        return null;
    };

    return (
        <View style={styles.container}>
            <ImageBackground source={{ uri: scene.imageUrl || 'https://via.placeholder.com/800' }} style={styles.background} blurRadius={3}>
                <View style={styles.overlay} />

                {/* Unified Solid Header */}
                <View style={styles.topBar}>
                    {/* Left: Back */}
                    <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
                        <ArrowLeft size={24} color="#fff" />
                    </TouchableOpacity>

                    {/* Center: Info */}
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{scene.title}</Text>
                        <View style={styles.headerSubInfo}>
                            {isDayTime() ? (
                                <Sun size={12} color="#A855F7" style={{ marginRight: 4 }} />
                            ) : (
                                <Moon size={12} color="#60a5fa" style={{ marginRight: 4 }} />
                            )}
                            <Text style={styles.headerSubtitle} numberOfLines={1}>
                                {globalLocation} • {globalTime}
                            </Text>
                        </View>
                    </View>

                    {/* Right: Actions */}
                    <View style={styles.headerActions}>
                        {isDmMode && (
                            <TouchableOpacity style={styles.headerBtn} onPress={() => setParticipantModalVisible(true)}>
                                <Users size={20} color="#A855F7" />
                            </TouchableOpacity>
                        )}
                        {isDmMode && (
                            <TouchableOpacity
                                onPress={toggleSilence}
                                style={[styles.headerBtn, isSilenced && { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' }]}
                            >
                                {isSilenced ? <VolumeX size={20} color="#ef4444" /> : <Volume2 size={20} color="#888" />}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onPress={toggleRole}
                            style={[styles.headerBtn, isDmMode && { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}
                        >
                            <Crown size={20} color={isDmMode ? '#A855F7' : '#888'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Chat Feed */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
                >
                    <FlatList
                        data={messages}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={[styles.listContent, { paddingTop: 120, paddingBottom: 24 }]}
                        showsVerticalScrollIndicator={false}
                    />

                    {/* Typing Indicators */}
                    {(dmTyping || typingUsers.size > 0) && (
                        <View style={styles.typingContainer}>
                            {dmTyping ? (
                                <View style={styles.dmTypingWrapper}>
                                    <Sparkles size={14} color="#A855F7" />
                                    <Text style={styles.dmTypingText}>El DM está reescribiendo el destino...</Text>
                                </View>
                            ) : (
                                <Text style={styles.playerTypingText}>
                                    {Array.from(typingUsers).join(', ')} {typingUsers.size > 1 ? 'están' : 'está'} escribiendo...
                                </Text>
                            )}
                        </View>
                    )}

                    {isDmMode ? (
                        <MasterDeck
                            ref={masterDeckRef}
                            onSend={handleDmSend}
                            replyingTo={replyingTo}
                            onCancelReply={() => setReplyingTo(null)}
                            onAiGenerate={() => setOracleModalVisible(true)}
                        />
                    ) : (
                        (() => {
                            const authorChar = availableCharacters.find(c => c.id === myPlayerId);
                            return (
                                // @ts-ignore
                                <InputDeck
                                    onSend={handleSend}
                                    isActionBlocked={messages.some(m => m.isSelf && m.mode === 'DO' && m.status === 'PENDING')}
                                    isSilenced={isSilenced}
                                    replyingTo={replyingTo}
                                    onCancelReply={() => setReplyingTo(null)}
                                    // @ts-ignore
                                    bannerColor={replyingTo ? getCharacterColor(replyingTo.author) : undefined}
                                    sceneId={scene.id}
                                    authorName={authorChar?.name || 'Unknown'}
                                    hp={authorChar?.hp || 0}
                                    maxHp={authorChar?.maxHp || 0}
                                    inventory={authorChar?.inventory || []}
                                    onConsumeItem={handleConsumeItem}
                                />
                            );
                        })()
                    )}
                </KeyboardAvoidingView>

                {/* MODALS */}
                {/* Participant Management Modal */}
                <Modal visible={participantModalVisible} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={styles.participantContent}>
                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalTitle}>Gestionar Participantes</Text>
                                    <Text style={styles.modalSubTitle}>{participants.length} personajes en esta escena</Text>
                                </View>
                                <TouchableOpacity onPress={() => setParticipantModalVisible(false)} style={styles.closeBtn}>
                                    <X size={24} color="#aaa" />
                                </TouchableOpacity>
                            </View>

                            {/* Search Bar */}
                            <View style={styles.searchContainer}>
                                <Search size={18} color="#666" style={{ marginLeft: 12 }} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Buscar por nombre..."
                                    placeholderTextColor="#666"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery !== '' && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 12 }}>
                                        <X size={16} color="#666" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
                                {availableCharacters.length > 0 ? (
                                    <View>
                                        {/* SCENE PARTICIPANTS SECTION */}
                                        <Text style={styles.sectionTitle}>EN LA ESCENA</Text>
                                        {availableCharacters
                                            .filter(char => participants.some(p => p.id === char.id))
                                            .filter(char => char.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                            .map(char => (
                                                <TouchableOpacity
                                                    key={char.id}
                                                    style={styles.charListItem}
                                                    onPress={() => toggleParticipant(char.id)}
                                                >
                                                    <View style={styles.charListLeft}>
                                                        <Image source={{ uri: char.image_url || 'https://via.placeholder.com/50' }} style={styles.charSmallAvatar} />
                                                        <Text style={[styles.charListName, { color: '#FFD700' }]}>{char.name}</Text>
                                                    </View>
                                                    <View style={[styles.actionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                                                        <Trash2 size={16} color="#EF4444" />
                                                    </View>
                                                </TouchableOpacity>
                                            ))
                                        }

                                        {/* AVAILABLE CHARACTERS SECTION */}
                                        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>DISPONIBLES</Text>
                                        {availableCharacters
                                            .filter(char => !participants.some(p => p.id === char.id))
                                            .filter(char => char.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                            .map(char => (
                                                <TouchableOpacity
                                                    key={char.id}
                                                    style={styles.charListItem}
                                                    onPress={() => toggleParticipant(char.id)}
                                                >
                                                    <View style={styles.charListLeft}>
                                                        <Image source={{ uri: char.image_url || 'https://via.placeholder.com/50' }} style={styles.charSmallAvatar} />
                                                        <Text style={styles.charListName}>{char.name}</Text>
                                                    </View>
                                                    <View style={[styles.actionIcon, { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}>
                                                        <UserPlus size={16} color="#FFD700" />
                                                    </View>
                                                </TouchableOpacity>
                                            ))
                                        }

                                        {availableCharacters.filter(char => char.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                            <Text style={styles.emptySearchText}>No se encontraron personajes con ese nombre.</Text>
                                        )}
                                    </View>
                                ) : (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <Text style={{ color: '#666', fontSize: 14 }}>No se encontraron personajes disponibles.</Text>
                                        <TouchableOpacity
                                            onPress={() => socket.emit('get-players')}
                                            style={{ marginTop: 10, padding: 8, backgroundColor: '#333', borderRadius: 8 }}
                                        >
                                            <Text style={{ color: '#FFD700' }}>Reintentar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                <RollSelector
                    visible={rollModalVisible}
                    onSelect={handleSelectRoll}
                    onClose={() => setRollModalVisible(false)}
                />

                <DiceRoller
                    visible={diceRollerVisible}
                    rollType={activeRollRequest ? `${activeRollRequest.stat} Check` : 'Roll'}
                    // @ts-ignore
                    rollMode={activeRollRequest?.mode || 'NORMAL'}
                    modifier={0}
                    onRollComplete={handleRollComplete}
                    onClose={() => setDiceRollerVisible(false)}
                />

                <ImageViewer
                    visible={!!selectedImage}
                    imageUrl={selectedImage}
                    onClose={() => setSelectedImage(null)}
                />

                <Modal visible={oracleModalVisible} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={styles.oracleContent}>
                            <View style={styles.modalHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Sparkles size={24} color="#38bdf8" />
                                    <Text style={[styles.modalTitle, { color: '#38bdf8' }]}>El Oráculo</Text>
                                </View>
                                <TouchableOpacity onPress={() => setOracleModalVisible(false)} style={styles.closeBtn}>
                                    <X size={24} color="#aaa" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.oracleDesc}>
                                Describe brevemente lo que quieres que suceda y la IA generará una narración inmersiva.
                            </Text>

                            <TextInput
                                style={styles.oracleInput}
                                placeholder="Ej: Entran a una taberna oscura y llena de humo..."
                                placeholderTextColor="#666"
                                multiline
                                numberOfLines={4}
                                value={oraclePrompt}
                                onChangeText={setOraclePrompt}
                            />

                            <TouchableOpacity
                                style={[styles.submitBtn, { backgroundColor: '#38bdf8', marginTop: 20 }]}
                                onPress={handleOracleGenerate}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <>
                                        <Sparkles size={20} color="#000" />
                                        <Text style={styles.submitText}>Generar Narración</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    background: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 50 : 35, // Reduced from 60/50
        paddingBottom: 10, // Reduced from 20
        paddingHorizontal: 16,
        zIndex: 100,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        backgroundColor: '#0a0a0a', // Solid Dark
    },
    headerBtn: {
        width: 38, // Reduced from 44
        height: 38, // Reduced from 44
        borderRadius: 19, // Adjusted for new size
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        marginLeft: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    headerInfo: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 18,
        letterSpacing: 0.5,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
    },
    headerSubInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        opacity: 0.9,
    },
    headerSubtitle: {
        color: '#e5e7eb',
        fontSize: 13,
        marginLeft: 6,
        fontWeight: '500',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 3,
    },
    headerActions: {
        flexDirection: 'row',
    },
    miniAvatar: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    manageParticipantsBtn: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255,215,0,0.2)',
        borderWidth: 1,
        borderColor: '#FFD700',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    cardBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backBtn: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    closeBtn: {
        padding: 4,
    },
    listContent: {
        paddingBottom: 20,
    },
    systemMsgContainer: {
        alignSelf: 'center',
        backgroundColor: 'rgba(20,20,20,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 12,
        marginVertical: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        width: '90%',
    },
    systemMsgHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        gap: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        paddingBottom: 6,
    },
    systemMsgTitle: {
        color: '#A855F7',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    systemText: {
        color: '#d1d5db',
        fontSize: 13,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 20,
    },
    systemImage: {
        width: 250,
        height: 180,
        borderRadius: 12,
        marginBottom: 10,
        resizeMode: 'cover',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.3)',
        alignSelf: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    participantContent: {
        width: '100%',
        backgroundColor: '#151B2B',
        borderRadius: 24,
        padding: 24,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    modalSubTitle: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0B0F19',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        height: 45,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        paddingHorizontal: 12,
        fontSize: 14,
    },
    sectionTitle: {
        color: '#444',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        marginBottom: 10,
        marginLeft: 4,
    },
    charListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0B0F19',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    oracleContent: {
        width: '90%',
        backgroundColor: '#151B2B',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#A855F7',
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    oracleDesc: {
        color: '#aaa',
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 20,
    },
    oracleInput: {
        backgroundColor: '#0B0F19',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        textAlignVertical: 'top',
        minHeight: 100,
    },
    submitBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    submitText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    },
    typingContainer: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        justifyContent: 'center',
    },
    dmTypingWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
        alignSelf: 'center',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.3)',
    },
    dmTypingText: {
        color: '#A855F7',
        fontStyle: 'italic',
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    playerTypingText: {
        color: '#9ca3af',
        fontStyle: 'italic',
        fontSize: 13,
    },
    charListLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    charSmallAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#333',
    },
    charListName: {
        color: '#eee',
        fontSize: 14,
        fontWeight: '500',
    },
    actionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptySearchText: {
        color: '#444',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 12,
        fontStyle: 'italic',
    }
});
