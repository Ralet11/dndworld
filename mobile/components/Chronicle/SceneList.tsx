import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, Modal, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Map as MapIcon, ChevronRight, CheckCircle2, CircleDashed, Crown, Settings, Sun, Moon } from 'lucide-react-native';
import socket from '../../services/socket';
import { useGame } from '../../context/GameContext';

interface Scene {
    id: number;
    title: string;
    description: string;
    imageUrl: string;
    status: 'ACTIVE' | 'FINISHED' | 'ARCHIVED';
    participants: any[];
}

interface SceneListProps {
    onSelectScene: (scene: Scene) => void;
    isDm: boolean;
    onCreateScene: () => void;
}

export default function SceneList({ onSelectScene, isDm, onCreateScene }: SceneListProps) {
    const { toggleRole, isDmMode } = useGame();
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'ACTIVE' | 'FINISHED'>('ACTIVE');

    // Global State
    const [globalTime, setGlobalTime] = useState('12:00');
    const [globalLocation, setGlobalLocation] = useState('Capital');
    const [configModalVisible, setConfigModalVisible] = useState(false);

    useEffect(() => {
        fetchScenes();

        const handleScenesData = (data: Scene[]) => {
            console.log('Frontend: Received scenes:', data.length);
            setScenes(data);
            setRefreshing(false);
        };

        const handleGlobalState = (state: any) => {
            if (state) {
                if (state.global_time) setGlobalTime(state.global_time);
                if (state.global_location) setGlobalLocation(state.global_location);
            }
        };

        socket.on('scenes-data', handleScenesData);
        socket.on('global-state-data', handleGlobalState);

        // Initial fetch
        socket.emit('get-scenes');
        socket.emit('get-global-state');

        return () => {
            socket.off('scenes-data', handleScenesData);
            socket.off('global-state-data', handleGlobalState);
        };
    }, []);

    const fetchScenes = () => {
        setRefreshing(true);
        socket.emit('get-scenes');
    };

    const handleSaveGlobalState = () => {
        socket.emit('update-global-state', {
            global_time: globalTime,
            global_location: globalLocation
        });
        setConfigModalVisible(false);
    };

    const isDayTime = () => {
        try {
            const hour = parseInt(globalTime.split(':')[0], 10);
            return hour >= 6 && hour < 19;
        } catch (e) {
            return true;
        }
    };

    const filteredScenes = scenes.filter(s => s.status === filter);

    const renderItem = ({ item }: { item: Scene }) => {
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => onSelectScene(item)}
                activeOpacity={0.8}
            >
                <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/300' }} style={styles.cardImage} />
                <View style={styles.cardOverlay}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.cardContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <Text style={styles.cardDesc} numberOfLines={2}>
                                {item.description}
                            </Text>
                            <View style={styles.participants}>
                                {item.participants?.slice(0, 5).map((p, i) => (
                                    <View key={i} style={[
                                        styles.facepileContainer,
                                        {
                                            marginLeft: i > 0 ? -12 : 0,
                                            zIndex: 5 - i
                                        }
                                    ]}>
                                        <Image
                                            source={{ uri: p.image_url || 'https://via.placeholder.com/50' }}
                                            style={[
                                                styles.facepileAvatar,
                                                { borderColor: p.is_npc ? '#EF4444' : '#FFD700' }
                                            ]}
                                        />
                                    </View>
                                ))}
                                {(item.participants?.length || 0) > 5 && (
                                    <View style={[styles.facepileContainer, styles.moreBadge, { marginLeft: -12, zIndex: 0 }]}>
                                        <Text style={styles.moreText}>+{item.participants.length - 5}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <ChevronRight size={20} color="#FFD700" />
                    </View>
                    {/* Status Badge */}
                    <View style={[styles.badge, { backgroundColor: item.status === 'ACTIVE' ? '#22c55e' : '#9ca3af' }]}>
                        <Text style={styles.badgeText}>{item.status}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header / Filter */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <Text style={[styles.title, { marginBottom: 0 }]}>Crónicas</Text>
                    <TouchableOpacity
                        onPress={toggleRole}
                        style={{
                            backgroundColor: isDmMode ? '#A855F7' : '#151B2B',
                            padding: 8,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: isDmMode ? '#A855F7' : 'rgba(255, 255, 255, 0.1)'
                        }}
                    >
                        <Crown size={24} color={isDmMode ? '#fff' : '#888'} />
                    </TouchableOpacity>
                </View>

                {/* Global Status Card */}
                <View style={styles.globalCard}>
                    <View style={styles.globalIconBox}>
                        {isDayTime() ? <Sun size={24} color="#A855F7" /> : <Moon size={24} color="#60a5fa" />}
                    </View>
                    <View style={styles.globalInfo}>
                        <Text style={styles.globalLocationText} numberOfLines={1}>{globalLocation}</Text>
                        <Text style={styles.globalTimeText}>{globalTime}</Text>
                    </View>
                    {isDmMode && (
                        <TouchableOpacity onPress={() => setConfigModalVisible(true)} style={styles.globalEditBtn}>
                            <Settings size={20} color="#888" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.filters}>
                    <TouchableOpacity
                        style={[styles.filterBtn, filter === 'ACTIVE' && styles.filterBtnActive]}
                        onPress={() => setFilter('ACTIVE')}
                    >
                        <CircleDashed size={14} color={filter === 'ACTIVE' ? '#fff' : '#888'} />
                        <Text style={[styles.filterText, filter === 'ACTIVE' && styles.filterTextActive]}>Activas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterBtn, filter === 'FINISHED' && styles.filterBtnActive]}
                        onPress={() => setFilter('FINISHED')}
                    >
                        <CheckCircle2 size={14} color={filter === 'FINISHED' ? '#fff' : '#888'} />
                        <Text style={[styles.filterText, filter === 'FINISHED' && styles.filterTextActive]}>Terminadas</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={filteredScenes}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchScenes} tintColor="#fff" />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={{ backgroundColor: '#151B2B', padding: 20, borderRadius: 50, marginBottom: 20 }}>
                            <MapIcon size={48} color="#333" />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {filter === 'ACTIVE' ? 'Sin Aventuras Activas' : 'Archivos Antiguos Vacíos'}
                        </Text>
                        <Text style={styles.emptyText}>
                            {filter === 'ACTIVE'
                                ? 'El mundo está en calma... por ahora. Espera a que el DM inicie una nueva crónica.'
                                : 'No hay historias pasadas que contar.'}
                        </Text>
                    </View>
                }
            />

            {/* DM Create Button */}
            {isDm && (
                <TouchableOpacity style={styles.fab} onPress={onCreateScene}>
                    <Text style={styles.fabText}>+ Nueva Escena</Text>
                </TouchableOpacity>
            )}

            {/* Global Config Modal */}
            <Modal visible={configModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Estado del Mundo</Text>

                        <Text style={styles.inputLabel}>Ubicación Actual</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={globalLocation}
                            onChangeText={setGlobalLocation}
                            placeholder="Ej: El bosque susurrante"
                            placeholderTextColor="#666"
                        />

                        <Text style={styles.inputLabel}>Hora Global (HH:MM)</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={globalTime}
                            onChangeText={setGlobalTime}
                            placeholder="Ej: 14:30"
                            placeholderTextColor="#666"
                            keyboardType="numbers-and-punctuation"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setConfigModalVisible(false)}>
                                <Text style={styles.modalBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveGlobalState}>
                                <Text style={styles.modalSaveBtnText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0F19',
        paddingTop: 60, // Safe Area
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        fontFamily: 'serif',
        marginBottom: 15,
    },
    // Global Card Styles
    globalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151B2B',
        padding: 12,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.15)',
    },
    globalIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    globalInfo: {
        flex: 1,
    },
    globalLocationText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    globalTimeText: {
        color: '#888',
        fontSize: 14,
        marginTop: 2,
    },
    globalEditBtn: {
        padding: 8,
    },
    filters: {
        flexDirection: 'row',
        gap: 10,
    },
    filterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        gap: 6
    },
    filterBtnActive: {
        backgroundColor: '#A855F7',
        borderColor: '#A855F7',
    },
    filterText: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
    },
    filterTextActive: {
        color: '#000',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    card: {
        height: 200,
        marginBottom: 20,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#151B2B',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: 8,
    },
    cardImage: {
        ...StyleSheet.absoluteFillObject,
        resizeMode: 'cover',
    },
    cardOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginBottom: 6,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    cardDesc: {
        color: '#d1d5db',
        fontSize: 13,
        marginBottom: 10,
        lineHeight: 18,
    },
    participants: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    participantDot: {
        color: '#A855F7',
        fontSize: 10,
        marginRight: 8,
    },
    // Facepile Styles
    facepileContainer: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#0B0F19', // Separator
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
    },
    facepileAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 15,
        borderWidth: 1.5,
    },
    moreBadge: {
        backgroundColor: '#333',
        borderColor: '#0B0F19',
    },
    moreText: {
        color: '#ccc',
        fontSize: 10,
        fontWeight: 'bold',
    },
    badge: {
        position: 'absolute',
        top: 10,
        right: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    empty: {
        alignItems: 'center',
        marginTop: 50,
        opacity: 0.5,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 5,
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 20,
    },
    fab: {
        position: 'absolute',
        bottom: 100,
        right: 20,
        backgroundColor: '#A855F7',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 30,
        elevation: 5,
        shadowColor: '#A855F7',
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    fabText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(11, 15, 25, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '85%',
        backgroundColor: '#151B2B',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#333',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    inputLabel: {
        color: '#aaa',
        fontSize: 12,
        marginBottom: 5,
        marginLeft: 4,
    },
    modalInput: {
        backgroundColor: '#000',
        color: '#fff',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 15,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 10,
    },
    modalCancelBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        backgroundColor: '#333',
    },
    modalSaveBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        backgroundColor: '#FFD700',
    },
    modalBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    modalSaveBtnText: {
        color: '#000',
        fontWeight: 'bold',
    }
});
