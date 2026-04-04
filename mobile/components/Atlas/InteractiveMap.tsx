import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Dimensions, Text, TouchableOpacity, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    withDecay,
    runOnJS,
    SharedValue
} from 'react-native-reanimated';
import { MapPin, Tent, SkullIcon, Mountain, Plus, X, ServerCrash, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react-native';
import { API_URL } from '../../constants/Config';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlassPanel from '../UI/GlassPanel';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Medidas gigantes virtuales del mapa para que se sienta como Google Maps
const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1600;

// Aquí cargamos tu mapa local exacto. DEBES guardar tu imagen en mobile/assets/westamar.jpg.png
const MAP_IMAGE = require('../../assets/westamar.jpg.png');

// Permitimos alejar la cámara bastante (0.3x) y acercarla mucho (3x)
const MIN_SCALE = Math.max(SCREEN_WIDTH / MAP_WIDTH, SCREEN_HEIGHT / MAP_HEIGHT); // Aprox 0.17 en móviles
const MAX_SCALE = 3;

// Interface for dynamic markers
export interface POI {
    id: string;
    title: string;
    top: string;
    left: string;
    color: string;
    type: string;
    image?: string;
    description?: string;
}

// Helper to parse percentage string to number
const parsePercent = (val: string) => parseFloat(val.replace('%', ''));

// Sub-component for a single draggable marker
const DraggableMarker = ({
    marker,
    mapScale,
    isDM,
    onDragEnd,
    onSelect
}: {
    marker: POI;
    mapScale: SharedValue<number>;
    isDM: boolean;
    onDragEnd: (id: string, newTop: string, newLeft: string) => void;
    onSelect: (poi: POI) => void;
}) => {
    // Dynamic Icon Selection
    let IconComponent = MapPin;
    if (marker.type === 'camp') IconComponent = Tent;
    if (marker.type === 'dungeon') IconComponent = SkullIcon;
    if (marker.type === 'cave') IconComponent = Mountain;

    // Initial positions based on percentage of MAP_WIDTH/HEIGHT
    const initialX = (parsePercent(marker.left) / 100) * MAP_WIDTH;
    const initialY = (parsePercent(marker.top) / 100) * MAP_HEIGHT;

    const translateX = useSharedValue(initialX);
    const translateY = useSharedValue(initialY);
    const savedX = useSharedValue(initialX);
    const savedY = useSharedValue(initialY);

    // Update shared values if parent marker prop changes (e.g. initial load vs socket update)
    useEffect(() => {
        const newX = (parsePercent(marker.left) / 100) * MAP_WIDTH;
        const newY = (parsePercent(marker.top) / 100) * MAP_HEIGHT;
        translateX.value = newX;
        translateY.value = newY;
        savedX.value = newX;
        savedY.value = newY;
    }, [marker.top, marker.left]);

    const panGesture = Gesture.Pan()
        .enabled(isDM) // Only enable drag if user is DM
        .onStart(() => {
            savedX.value = translateX.value;
            savedY.value = translateY.value;
        })
        .onUpdate((e) => {
            // Divide translation by mapScale so the finger perfectly tracks the pin 
            // when zoomed in, without flying away.
            translateX.value = savedX.value + (e.translationX / mapScale.value);
            translateY.value = savedY.value + (e.translationY / mapScale.value);
        })
        .onEnd(() => {
            savedX.value = translateX.value;
            savedY.value = translateY.value;

            // Calculate new percentages
            const newLeftPct = (translateX.value / MAP_WIDTH) * 100;
            const newTopPct = (translateY.value / MAP_HEIGHT) * 100;

            // Format to 2 decimal places to keep DB clean
            const finalLeft = `${newLeftPct.toFixed(2)}%`;
            const finalTop = `${newTopPct.toFixed(2)}%`;

            runOnJS(onDragEnd)(marker.id, finalTop, finalLeft);
        });

    const tapGesture = Gesture.Tap()
        .onEnd(() => {
            runOnJS(onSelect)(marker);
        });

    // We use Exclusive so that a tap doesn't trigger a microscopic drag 
    // and a drag doesn't accidentally trigger a tap.
    const markerGestures = Gesture.Exclusive(panGesture, tapGesture);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            position: 'absolute',
            left: 0,
            top: 0,
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { translateX: -12 }, // Centering offsets
                { translateY: -24 }
            ]
        };
    });

    return (
        <GestureDetector gesture={markerGestures}>
            <Animated.View style={[styles.markerWrapper, animatedStyle, isDM && styles.draggableMarker]}>
                <IconComponent size={24} color={marker.color} fill="rgba(0,0,0,0.5)" />
                {marker.type === 'city' && (
                    <Text style={styles.markerText}>{marker.title}</Text>
                )}
            </Animated.View>
        </GestureDetector>
    );
};


export default function InteractiveMap() {
    const { isDmMode } = useGame();
    const isDM = isDmMode;
    const [markers, setMarkers] = useState<POI[]>([]);
    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
    const [isCardExpanded, setIsCardExpanded] = useState(false);
    const [poiLore, setPoiLore] = useState<any>(null);
    const [isLoadingLore, setIsLoadingLore] = useState(false);
    const [myNotes, setMyNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    // Creation Modal States
    const [newPoiName, setNewPoiName] = useState('');
    const [newPoiType, setNewPoiType] = useState('city');

    // We add an optimistic update state so markers feel instantly responsive
    const updateMarkerPosition = async (id: string, newTop: string, newLeft: string) => {
        // Optimistic UI update
        setMarkers(current => current.map(m => m.id === id ? { ...m, top: newTop, left: newLeft } : m));

        try {
            const response = await fetch(`${API_URL}/api/pois/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ top: newTop, left: newLeft })
            });
            if (!response.ok) {
                console.error("Failed to save marker position on server");
                // In a robust app, you might revert the optimistic update here if it fails
            }
        } catch (error) {
            console.error("Error updating POI:", error);
        }
    };

    const handleCreatePOI = async () => {
        if (!newPoiName.trim()) return;

        // Determine color based on type
        let color = '#eab308'; // Default city (yellow)
        if (newPoiType === 'camp') color = '#ef4444'; // Red
        if (newPoiType === 'dungeon') color = '#9333ea'; // Purple
        if (newPoiType === 'cave') color = '#64748b'; // Gray

        const newMarkerData = {
            title: newPoiName.trim(),
            top: '50.00%',  // Creates in the exact center of map
            left: '50.00%',
            color: color,
            type: newPoiType,
        };

        try {
            const response = await fetch(`${API_URL}/api/pois`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMarkerData)
            });

            if (response.ok) {
                const createdMarker = await response.json();
                setMarkers(current => [...current, createdMarker]);
                setCreateModalVisible(false);
                setNewPoiName('');
                setNewPoiType('city');
            } else {
                console.error("Failed to create POI");
            }
        } catch (error) {
            console.error("Creation error:", error);
        }
    };

    useEffect(() => {
        // Fetch markers from backend
        const fetchMarkers = async () => {
            try {
                const response = await fetch(`${API_URL}/api/pois`);
                if (response.ok) {
                    const data = await response.json();
                    setMarkers(data);
                }
            } catch (error) {
                console.error('Failed to fetch POIs:', error);
            }
        };

        fetchMarkers();
    }, []);

    // Zoom and Pan States - Arrancamos a mitad de zoom para mostrar parte pero no todo
    const scale = useSharedValue(0.8);
    const savedScale = useSharedValue(0.8);

    // Centramos el mapa
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    // Focal points for zooming towards fingers
    const focalX = useSharedValue(0);
    const focalY = useSharedValue(0);

    const clamp = (val: number, min: number, max: number) => {
        'worklet';
        return Math.min(Math.max(val, min), max);
    };

    const getBoundaries = (currentScale: number) => {
        'worklet';
        const maxTx = Math.max(0, (MAP_WIDTH * currentScale - SCREEN_WIDTH) / 2);
        const maxTy = Math.max(0, (MAP_HEIGHT * currentScale - SCREEN_HEIGHT) / 2);
        return { maxTx, maxTy };
    };

    // 1. PINCH TO ZOOM
    const pinch = Gesture.Pinch()
        .onStart((e) => {
            focalX.value = e.focalX;
            focalY.value = e.focalY;
            savedScale.value = scale.value;
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
            // Calculate scale
            let newScale = savedScale.value * e.scale;
            newScale = clamp(newScale, MIN_SCALE, MAX_SCALE);
            scale.value = newScale;

            // Calculate focal translation so map zooms into where fingers are
            const focalXDiff = e.focalX - focalX.value;
            const focalYDiff = e.focalY - focalY.value;

            // Origin correction back to center
            const xOffset = (e.focalX - SCREEN_WIDTH / 2) * (1 - newScale / savedScale.value);
            const yOffset = (e.focalY - SCREEN_HEIGHT / 2) * (1 - newScale / savedScale.value);

            translateX.value = savedTranslateX.value + focalXDiff + xOffset;
            translateY.value = savedTranslateY.value + focalYDiff + yOffset;
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            // Snapping boundaries after pinch
            const { maxTx, maxTy } = getBoundaries(scale.value);
            translateX.value = withSpring(clamp(translateX.value, -maxTx, maxTx), { damping: 15 });
            translateY.value = withSpring(clamp(translateY.value, -maxTy, maxTy), { damping: 15 });

            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    // 2. PANNING
    const pan = Gesture.Pan()
        .averageTouches(true)
        .maxPointers(1) // Only pan with 1 finger (to avoid fighting Pinch)
        .onStart(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        })
        .onUpdate((e) => {
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd((e) => {
            // Friction and clamping
            const { maxTx, maxTy } = getBoundaries(scale.value);

            // Kinetic scroll using withDecay (adding +0.01 to avoid crash if min===max)
            translateX.value = withDecay({
                velocity: e.velocityX,
                clamp: [-maxTx, maxTx + 0.01],
                rubberBandEffect: true,
                rubberBandFactor: 0.6,
            });

            translateY.value = withDecay({
                velocity: e.velocityY,
                clamp: [-maxTy, maxTy + 0.01],
                rubberBandEffect: true,
                rubberBandFactor: 0.6,
            });
        });

    // 3. DOUBLE TAP TO RESET / ZOOM IN
    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd((e) => {
            if (scale.value > MIN_SCALE + 0.3) {
                // Zoom out entirely
                scale.value = withTiming(MIN_SCALE, { duration: 300 });
                translateX.value = withTiming(0, { duration: 300 });
                translateY.value = withTiming(0, { duration: 300 });
                savedScale.value = MIN_SCALE;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                // Zoom in deeply
                const TARGET_SCALE = 1.5;
                // Calculate tap offsets for zooming in
                const xOffset = (e.x - SCREEN_WIDTH / 2) * (1 - TARGET_SCALE);
                const yOffset = (e.y - SCREEN_HEIGHT / 2) * (1 - TARGET_SCALE);

                scale.value = withTiming(TARGET_SCALE, { duration: 300 });
                translateX.value = withTiming(xOffset, { duration: 300 });
                translateY.value = withTiming(yOffset, { duration: 300 });
                savedScale.value = TARGET_SCALE;
            }
        });

    const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

    // Apply transform ONLY to the map container holding everything
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    // POI Card Animated Style
    // Increased compact height slightly to ensure "Leer más" is visible under the banner
    const cardHeight = useSharedValue(220);

    useEffect(() => {
        cardHeight.value = withSpring(isCardExpanded ? 580 : 220, { damping: 20, stiffness: 150 });
    }, [isCardExpanded]);

    const cardAnimatedStyle = useAnimatedStyle(() => ({
        height: cardHeight.value,
        opacity: selectedPOI ? withTiming(1, { duration: 300 }) : withTiming(0, { duration: 200 }),
        transform: [{ translateY: selectedPOI ? withSpring(0) : withTiming(100) }]
    }));

    const handleSelectPOI = async (poi: POI) => {
        setSelectedPOI(poi);
        setIsCardExpanded(false); // Reset expansion state when changing POIs
        setPoiLore(null);
        setMyNotes('');
        setIsLoadingLore(true);

        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/pois/${poi.id}/lore`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setPoiLore(data);
                if (data.personal && data.personal.userNotes) {
                    setMyNotes(data.personal.userNotes);
                }
            } else {
                console.error("Failed to fetch POI lore");
            }
        } catch (error) {
            console.error("Error fetching POI lore:", error);
        } finally {
            setIsLoadingLore(false);
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedPOI) return;
        setIsSavingNotes(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/pois/${selectedPOI.id}/user-notes`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userNotes: myNotes })
            });

            if (!response.ok) {
                console.error("Failed to save notes");
            }
        } catch (error) {
            console.error("Error saving notes:", error);
        } finally {
            setIsSavingNotes(false);
        }
    };

    return (
        <GestureDetector gesture={composed}>
            <View style={styles.container}>
                <Animated.View style={[styles.mapContainer, animatedStyle]}>
                    <Animated.Image
                        // @ts-ignore - Support both {uri} and require()
                        source={MAP_IMAGE}
                        style={styles.image}
                        resizeMode="cover"
                    />

                    {/* Render Overlays / Markers */}
                    {markers.map(marker => (
                        <DraggableMarker
                            key={marker.id}
                            marker={marker}
                            mapScale={scale}
                            isDM={isDM}
                            onDragEnd={updateMarkerPosition}
                            onSelect={handleSelectPOI}
                        />
                    ))}


                </Animated.View>

                {/* UI Overlay (Unscaled) */}
                <View style={styles.overlay}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>Atlas de Westamar</Text>
                        <Text style={styles.subText}>Doble toque para hacer zoom</Text>
                    </View>
                </View>

                {/* DM Controls Header */}
                {isDM && (
                    <TouchableOpacity
                        style={styles.addPoiButton}
                        onPress={() => setCreateModalVisible(true)}
                    >
                        <Plus size={24} color="#A855F7" />
                    </TouchableOpacity>
                )}

                {/* Interactive POI Card (Bottom Sheet) */}
                {selectedPOI && (
                    <Animated.View style={[styles.poiCardContainer, cardAnimatedStyle]}>
                        <GlassPanel intensity={80} style={styles.poiCard}>
                            <TouchableOpacity
                                style={styles.poiCloseButton}
                                onPress={() => setSelectedPOI(null)}
                            >
                                <X size={20} color="#94a3b8" />
                            </TouchableOpacity>

                            {/* Banner Image */}
                            {selectedPOI.image ? (
                                <Animated.Image
                                    source={{ uri: selectedPOI.image }}
                                    style={styles.poiBanner}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.poiBannerPlaceholder}>
                                    <ImageIcon size={32} color="#475569" />
                                </View>
                            )}

                            {/* Card Header (Always Visible) */}
                            <TouchableOpacity
                                style={styles.poiHeader}
                                activeOpacity={0.8}
                                onPress={() => setIsCardExpanded(!isCardExpanded)}
                            >
                                <View style={styles.poiTitleRow}>
                                    <Text style={styles.poiTitle} numberOfLines={1}>{selectedPOI.title}</Text>
                                    <View style={styles.poiTypeBadge}>
                                        <Text style={styles.poiTypeText}>
                                            {selectedPOI.type.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                {/* DM Intro / Global Desc always visible in compact mode if available */}
                                {!isCardExpanded && poiLore?.global?.dmDescription && (
                                    <Text style={styles.dmDescriptionCompact} numberOfLines={2}>
                                        "{poiLore.global.dmDescription}"
                                    </Text>
                                )}

                                <View style={styles.expandRow}>
                                    <Text style={styles.expandText}>
                                        {isCardExpanded ? 'Ocultar detalles' : 'Leer la Crónica'}
                                    </Text>
                                    {isCardExpanded ? (
                                        <ChevronDown size={14} color="#A855F7" />
                                    ) : (
                                        <ChevronUp size={14} color="#A855F7" />
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Expanded Content */}
                            {isCardExpanded && (
                                <View style={styles.poiContentWrapper}>
                                    {isLoadingLore ? (
                                        <View style={styles.loadingContainer}>
                                            <ActivityIndicator color="#A855F7" />
                                        </View>
                                    ) : (
                                        <ScrollView style={styles.poiContent} contentContainerStyle={styles.poiScrollContent} indicatorStyle="white">

                                            {/* DM Intro / Global Desc */}
                                            {poiLore?.global?.dmDescription && (
                                                <Text style={styles.dmDescription}>
                                                    "{poiLore.global.dmDescription}"
                                                </Text>
                                            )}

                                            {/* General Description */}
                                            <View style={styles.loreSection}>
                                                <Text style={styles.loreSectionTitle}>Información del Lugar</Text>
                                                <View style={styles.loreSectionBox}>
                                                    <Text style={styles.poiDescription}>
                                                        {selectedPOI.description || poiLore?.global?.description || "Esta locación aún no tiene historia escrita en la crónica."}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Party Knowledge */}
                                            {poiLore?.global?.partyKnowledge && (
                                                <View style={styles.loreSection}>
                                                    <Text style={styles.loreSectionTitle}>Conocimientos de la Party</Text>
                                                    <View style={styles.loreSectionBox}>
                                                        <Text style={styles.loreSectionText}>{poiLore.global.partyKnowledge}</Text>
                                                    </View>
                                                </View>
                                            )}

                                            {/* Specific Character Knowledge */}
                                            {poiLore?.personal?.specializedKnowledge && (
                                                <View style={styles.loreSection}>
                                                    <Text style={styles.loreSectionTitleHighlight}>Información de tu PJ</Text>
                                                    <View style={[styles.loreSectionBox, styles.loreSectionBoxHighlight]}>
                                                        <Text style={styles.loreSectionText}>{poiLore.personal.specializedKnowledge}</Text>
                                                    </View>
                                                </View>
                                            )}

                                            {/* User Notes Area */}
                                            <View style={styles.loreSection}>
                                                <Text style={styles.loreSectionTitle}>Mis Notas</Text>
                                                <TextInput
                                                    style={styles.notesInput}
                                                    multiline
                                                    placeholder="Escribe tus notas privadas aquí..."
                                                    placeholderTextColor="#475569"
                                                    value={myNotes}
                                                    onChangeText={setMyNotes}
                                                    onBlur={handleSaveNotes} // Auto-save when clicking outside
                                                />
                                                {isSavingNotes && <Text style={styles.savingText}>Guardando...</Text>}
                                            </View>

                                            {isDM && (
                                                <TouchableOpacity style={styles.editPoiContentButton}>
                                                    <Text style={styles.editPoiContentText}>Editar Lore de la Locación (DM)</Text>
                                                </TouchableOpacity>
                                            )}
                                        </ScrollView>
                                    )}
                                </View>
                            )}
                        </GlassPanel>
                    </Animated.View>
                )}

                {/* POI Creation Modal */}
                <Modal visible={isCreateModalVisible} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Nueva Locación</Text>
                                <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.closeButton}>
                                    <X size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                style={styles.input}
                                placeholder="Nombre (ej. Mina Perdida)"
                                placeholderTextColor="#64748b"
                                value={newPoiName}
                                onChangeText={setNewPoiName}
                                autoFocus
                            />

                            <Text style={styles.typeLabel}>Tipo de Locación:</Text>
                            <View style={styles.typeSelectorRow}>
                                <TouchableOpacity
                                    style={[styles.typeButton, newPoiType === 'city' && styles.typeButtonSelected]}
                                    onPress={() => setNewPoiType('city')}
                                >
                                    <MapPin size={24} color={newPoiType === 'city' ? '#eab308' : '#64748b'} />
                                    <Text style={[styles.typeText, newPoiType === 'city' && styles.typeTextSelected]}>Ciudad</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.typeButton, newPoiType === 'camp' && styles.typeButtonSelected]}
                                    onPress={() => setNewPoiType('camp')}
                                >
                                    <Tent size={24} color={newPoiType === 'camp' ? '#ef4444' : '#64748b'} />
                                    <Text style={[styles.typeText, newPoiType === 'camp' && { color: '#ef4444' }]}>Campa.</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.typeButton, newPoiType === 'dungeon' && styles.typeButtonSelected]}
                                    onPress={() => setNewPoiType('dungeon')}
                                >
                                    <SkullIcon size={24} color={newPoiType === 'dungeon' ? '#9333ea' : '#64748b'} />
                                    <Text style={[styles.typeText, newPoiType === 'dungeon' && { color: '#9333ea' }]}>Dungeon</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.typeButton, newPoiType === 'cave' && styles.typeButtonSelected]}
                                    onPress={() => setNewPoiType('cave')}
                                >
                                    <Mountain size={24} color={newPoiType === 'cave' ? '#cbd5e1' : '#64748b'} />
                                    <Text style={[styles.typeText, newPoiType === 'cave' && { color: '#cbd5e1' }]}>Cueva</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.createButton, !newPoiName.trim() && styles.createButtonDisabled]}
                                onPress={handleCreatePOI}
                                disabled={!newPoiName.trim()}
                            >
                                <Text style={styles.createButtonText}>Crear en el Centro ➔</Text>
                            </TouchableOpacity>

                            <Text style={styles.modalHint}>
                                Una vez creado, podrás arrastrarlo libremente por el mapa.
                            </Text>
                        </View>
                    </View>
                </Modal>
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0B0F19', // Arcane Theme
        overflow: 'hidden',
        alignItems: 'center', // Centra el contenedor del mapa
        justifyContent: 'center',
    },
    mapContainer: {
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#151B2B',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    draggableMarker: {
        // Optional styling for DM to indicate draggability, maybe slightly larger or subtle border
    },
    markerWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        // zIndex must be elevated so gestures hit the marker before the map
        zIndex: 10,
    },
    markerText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 2,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
        textShadowColor: 'rgba(0,0,0,1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    overlay: {
        position: 'absolute',
        top: 60,
        left: 20,
    },
    badge: {
        backgroundColor: 'rgba(11, 15, 25, 0.85)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.4)',
    },
    badgeText: {
        color: '#A855F7',
        fontWeight: 'bold',
        fontSize: 16,
        textTransform: 'uppercase',
    },
    subText: {
        color: '#94a3b8',
        fontSize: 10,
        marginTop: 2,
    },
    addPoiButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 48,
        height: 48,
        backgroundColor: 'rgba(11, 15, 25, 0.85)',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.4)',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#1E293B',
        width: '100%',
        maxWidth: 380,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#334155',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    input: {
        backgroundColor: '#0F172A',
        color: '#fff',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        marginBottom: 20,
    },
    typeLabel: {
        color: '#94a3b8',
        fontSize: 14,
        marginBottom: 12,
        fontWeight: 'bold',
    },
    typeSelectorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 8,
    },
    typeButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#0F172A',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334155',
    },
    typeButtonSelected: {
        borderColor: '#9333ea',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
    },
    typeText: {
        color: '#64748b',
        fontSize: 10,
        marginTop: 6,
        fontWeight: 'bold',
    },
    typeTextSelected: {
        color: '#eab308', // city default color matches icon
    },
    createButton: {
        backgroundColor: '#9333ea',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    createButtonDisabled: {
        backgroundColor: '#475569',
        opacity: 0.5,
    },
    createButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalHint: {
        color: '#64748b',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 16,
        fontStyle: 'italic',
    },
    // POI Details Card Styles
    poiCardContainer: {
        position: 'absolute',
        bottom: 90, // Accounts for standard Expo Router bottom tab bar
        left: 16,
        right: 16,
        overflow: 'hidden',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        zIndex: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.8,
        shadowRadius: 16,
        elevation: 15,
    },
    poiCard: {
        width: '100%',
        height: '100%',
        padding: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
    },
    poiCloseButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        backgroundColor: 'rgba(11, 15, 25, 0.6)',
        padding: 6,
        borderRadius: 20,
    },
    poiBanner: {
        width: '100%',
        height: 80, // Reduced from 100 to save space
        backgroundColor: '#0B0F19',
    },
    poiBannerPlaceholder: {
        width: '100%',
        height: 80, // Reduced from 100 to save space
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    poiHeader: {
        padding: 12, // Reduced padding
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    poiTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4, // Reduced margin
    },
    poiTitle: {
        color: '#f8fafc',
        fontSize: 18, // Reduced font size
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    poiTypeBadge: {
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(147, 51, 234, 0.4)',
    },
    poiTypeText: {
        color: '#e9d5ff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    expandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Center the expand button
        paddingVertical: 4,
        marginTop: 4,
    },
    expandText: {
        color: '#A855F7',
        fontSize: 12, // Reduced font size
        marginRight: 4,
        fontWeight: '600'
    },
    poiContentWrapper: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 100,
    },
    poiContent: {
        flex: 1,
    },
    poiScrollContent: {
        padding: 12, // Reduced padding to give more room for text
        paddingBottom: 40,
    },
    dmDescription: {
        color: '#94a3b8',
        fontSize: 12, // Smaller font
        fontStyle: 'italic',
        marginBottom: 12,
        lineHeight: 18,
    },
    dmDescriptionCompact: {
        color: '#94a3b8',
        fontSize: 11,
        fontStyle: 'italic',
        marginBottom: 4,
        lineHeight: 16,
    },
    poiDescription: {
        color: '#cbd5e1',
        fontSize: 13, // Smaller text to fit more
        lineHeight: 20,
    },
    loreSection: {
        marginBottom: 20,
    },
    loreSectionTitle: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 6,
        letterSpacing: 1,
    },
    loreSectionTitleHighlight: {
        color: '#d8b4fe',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 6,
        letterSpacing: 1,
    },
    loreSectionBox: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderLeftWidth: 2,
        borderLeftColor: '#334155',
        padding: 12,
        borderRadius: 4,
    },
    loreSectionBoxHighlight: {
        borderLeftColor: '#a855f7',
        backgroundColor: 'rgba(147, 51, 234, 0.05)',
    },
    loreSectionText: {
        color: '#f8fafc',
        fontSize: 13,
        lineHeight: 20,
    },
    notesInput: {
        backgroundColor: '#0F172A',
        color: '#fff',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 8,
        padding: 12,
        fontSize: 13,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    savingText: {
        color: '#64748b',
        fontSize: 10,
        fontStyle: 'italic',
        marginTop: 4,
        textAlign: 'right',
    },
    editPoiContentButton: {
        marginTop: 12,
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#9333ea',
        alignItems: 'center'
    },
    editPoiContentText: {
        color: '#c084fc',
        fontWeight: 'bold'
    }
});
