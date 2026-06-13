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
import { MapPin, Tent, SkullIcon, Mountain, Plus, X, ServerCrash, ChevronUp, ChevronDown, Image as ImageIcon, User, ScrollText, Store, Home, ChevronLeft, Map as MapIcon, CircleAlert } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../../constants/Config';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import socket from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlassPanel from '../UI/GlassPanel';

// Color del marcador de misión "!" según el nivel relativo al jugador.
// diff = nivel de la misión − nivel del jugador.
const questColor = (questLevel?: number | null, playerLevel: number = 1) => {
    const diff = (questLevel ?? 1) - playerLevel;
    if (diff <= 1) return '#F5C518';   // amarillo: tu nivel o +1
    if (diff === 2) return '#F97316';  // naranja: +2 niveles
    return '#EF4444';                  // rojo: +3 o más
};

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
    parent_id?: number | null;
    map_image?: string | null;
    level?: number | null; // Nivel recomendado (solo POIs type 'quest')
}

// Helper to parse percentage string to number
const parsePercent = (val: string) => parseFloat(val.replace('%', ''));

// Sub-component for a single draggable marker
const DraggableMarker = ({
    marker,
    mapScale,
    isDM,
    playerLevel,
    onDragEnd,
    onSelect
}: {
    marker: POI;
    mapScale: SharedValue<number>;
    isDM: boolean;
    playerLevel: number;
    onDragEnd: (id: string, newTop: string, newLeft: string) => void;
    onSelect: (poi: POI) => void;
}) => {
    // Dynamic Icon Selection
    let IconComponent = MapPin;
    if (marker.type === 'camp') IconComponent = Tent;
    if (marker.type === 'dungeon') IconComponent = SkullIcon;
    if (marker.type === 'cave') IconComponent = Mountain;
    // Sub-POIs dentro de una ciudad
    if (marker.type === 'npc') IconComponent = User;
    if (marker.type === 'quest') IconComponent = ScrollText;
    if (marker.type === 'shop') IconComponent = Store;
    if (marker.type === 'place') IconComponent = Home;

    // Las misiones se muestran como un "!" cuyo color depende del nivel del
    // jugador respecto al de la misión (amarillo / naranja / rojo).
    const isQuest = marker.type === 'quest';
    const tint = isQuest ? questColor(marker.level, playerLevel) : marker.color;

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
                // Contra-escala: tamaño constante en pantalla sin importar el zoom
                // (estilo Google Maps / WoW), y centrado en el punto.
                { scale: 1 / mapScale.value },
                { translateX: -14 },
                { translateY: -14 },
            ],
        };
    });

    return (
        <GestureDetector gesture={markerGestures}>
            <Animated.View style={[styles.markerWrapper, animatedStyle]}>
                <View style={[styles.markerBadge, { borderColor: tint }, isDM && styles.markerBadgeDM]}>
                    {isQuest ? (
                        <Text style={[styles.markerBang, { color: tint }]}>!</Text>
                    ) : (
                        <IconComponent size={15} color={tint} />
                    )}
                </View>
                <Text style={styles.markerLabel} numberOfLines={1}>{marker.title}</Text>
            </Animated.View>
        </GestureDetector>
    );
};


export default function InteractiveMap() {
    const { isDmMode } = useGame();
    const { user } = useAuth();
    const isDM = isDmMode;
    const [markers, setMarkers] = useState<POI[]>([]);
    // Nivel del personaje del jugador, para colorear las misiones del mapa.
    const [playerLevel, setPlayerLevel] = useState(1);
    // Pila de navegación de mapas: vacía = mundo; último = ciudad actual.
    const [parentStack, setParentStack] = useState<POI[]>([]);
    const currentParent = parentStack.length ? parentStack[parentStack.length - 1] : null;
    const currentParentId = currentParent?.id ?? null;
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
    const [newPoiLevel, setNewPoiLevel] = useState('1'); // Nivel de misión (type 'quest')

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
        let color = '#F59E0B'; // Default city (yellow)
        if (newPoiType === 'camp') color = '#FF7A1A'; // Red
        if (newPoiType === 'dungeon') color = '#9B5DE5'; // Purple
        if (newPoiType === 'cave') color = '#6B6557'; // Gray
        // Sub-POIs de ciudad
        if (newPoiType === 'npc') color = '#3E84D6';   // azul
        if (newPoiType === 'quest') color = '#F59E0B'; // ámbar
        if (newPoiType === 'shop') color = '#5BA86B';  // verde
        if (newPoiType === 'place') color = '#A855F7'; // violeta

        const newMarkerData: any = {
            title: newPoiName.trim(),
            top: '50.00%',  // Creates in the exact center of map
            left: '50.00%',
            color: color,
            type: newPoiType,
            parent_id: currentParentId, // null en el mundo; id de la ciudad si estás dentro
        };
        // Las misiones llevan nivel recomendado (define el color del "!").
        if (newPoiType === 'quest') newMarkerData.level = parseInt(newPoiLevel, 10) || 1;

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
                setNewPoiLevel('1');
            } else {
                console.error("Failed to create POI");
            }
        } catch (error) {
            console.error("Creation error:", error);
        }
    };

    // Trae los POIs del nivel actual (mundo = parent_id null; ciudad = su id).
    const fetchMarkers = async (parentId: string | number | null) => {
        try {
            const q = (parentId === null || parentId === undefined) ? 'null' : parentId;
            const response = await fetch(`${API_URL}/api/pois?parent_id=${q}`);
            if (response.ok) setMarkers(await response.json());
        } catch (error) {
            console.error('Failed to fetch POIs:', error);
        }
    };

    useEffect(() => {
        fetchMarkers(currentParentId);
    }, [currentParentId]);

    // Nivel del jugador (para el color de las misiones). Mismo patrón que Hero:
    // pedimos los players y buscamos el personaje de este usuario.
    useEffect(() => {
        if (!user) return;
        socket.emit('get-players');
        const onPlayers = (players: any[]) => {
            const me = players.find((p: any) => p.UserId === user.id);
            if (me?.level) setPlayerLevel(me.level);
        };
        socket.on('players-data', onPlayers);
        socket.on('stats-updated', onPlayers);
        return () => {
            socket.off('players-data', onPlayers);
            socket.off('stats-updated', onPlayers);
        };
    }, [user]);

    // Entrar al mapa de una ciudad / salir.
    const enterPOI = (poi: POI) => {
        setSelectedPOI(null);
        setMarkers([]);
        setParentStack((s) => [...s, poi]);
    };
    const exitToWorld = () => {
        setSelectedPOI(null);
        setMarkers([]);
        setParentStack((s) => s.slice(0, -1));
    };

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

    // DM: sube/cambia la imagen del MAPA de una ciudad.
    const handleUploadCityMap = async (poi: POI) => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
        if (result.canceled) return;
        try {
            const uri = result.assets[0].uri;
            const filename = uri.split('/').pop() || 'map.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image';
            const formData = new FormData();
            // @ts-ignore — formato de archivo de React Native
            formData.append('image', { uri, name: filename, type });
            const up = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } });
            const data = await up.json();
            if (!data.url) return;
            await fetch(`${API_URL}/api/pois/${poi.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ map_image: data.url }),
            });
            setMarkers((cur) => cur.map((m) => m.id === poi.id ? { ...m, map_image: data.url } : m));
            setSelectedPOI((prev) => prev && prev.id === poi.id ? { ...prev, map_image: data.url } : prev);
        } catch (e) {
            console.error('Upload city map error:', e);
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
                    {currentParent && !currentParent.map_image ? (
                        <View style={[styles.image, styles.mapPlaceholder]}>
                            <MapIcon size={64} color="#2A3550" />
                            <Text style={styles.mapPlaceholderText}>
                                El DM aún no cargó el mapa de {currentParent.title}
                            </Text>
                        </View>
                    ) : (
                        <Animated.Image
                            // @ts-ignore - Support both {uri} and require()
                            source={currentParent?.map_image ? { uri: currentParent.map_image } : MAP_IMAGE}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    )}

                    {/* Render Overlays / Markers */}
                    {markers.map(marker => (
                        <DraggableMarker
                            key={marker.id}
                            marker={marker}
                            mapScale={scale}
                            isDM={isDM}
                            playerLevel={playerLevel}
                            onDragEnd={updateMarkerPosition}
                            onSelect={handleSelectPOI}
                        />
                    ))}


                </Animated.View>

                {/* UI Overlay (Unscaled) */}
                <View style={styles.overlay} pointerEvents="box-none">
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{currentParent ? currentParent.title : 'Atlas de Westamar'}</Text>
                        <Text style={styles.subText}>
                            {currentParent ? `Westamar › ${currentParent.title}` : 'Doble toque para hacer zoom'}
                        </Text>
                    </View>
                </View>

                {/* Botón Volver (dentro de una ciudad) */}
                {currentParent && (
                    <TouchableOpacity style={styles.backButton} onPress={exitToWorld} activeOpacity={0.8}>
                        <ChevronLeft size={20} color="#F59E0B" />
                        <Text style={styles.backText}>Volver</Text>
                    </TouchableOpacity>
                )}

                {/* DM Controls Header */}
                {isDM && (
                    <TouchableOpacity
                        style={styles.addPoiButton}
                        onPress={() => { setNewPoiType(currentParent ? 'npc' : 'city'); setCreateModalVisible(true); }}
                    >
                        <Plus size={24} color="#F59E0B" />
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
                                <X size={20} color="#A89F8E" />
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
                                    <ImageIcon size={32} color="#3A4540" />
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
                                    {selectedPOI.type === 'quest' && (
                                        <View style={[styles.poiLevelBadge, { borderColor: questColor(selectedPOI.level, playerLevel) }]}>
                                            <Text style={[styles.poiLevelText, { color: questColor(selectedPOI.level, playerLevel) }]}>
                                                Nivel {selectedPOI.level ?? 1}
                                            </Text>
                                        </View>
                                    )}
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
                                        <ChevronDown size={14} color="#F59E0B" />
                                    ) : (
                                        <ChevronUp size={14} color="#F59E0B" />
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Acciones: entrar al mapa de la ciudad / DM subir mapa */}
                            {(selectedPOI.type === 'city' || selectedPOI.map_image || isDM) && (
                                <View style={styles.poiActions}>
                                    {(selectedPOI.type === 'city' || selectedPOI.map_image) ? (
                                        <TouchableOpacity style={styles.enterButton} onPress={() => enterPOI(selectedPOI)} activeOpacity={0.85}>
                                            <MapIcon size={16} color="#0B0B0B" />
                                            <Text style={styles.enterButtonText} numberOfLines={1}>Entrar a {selectedPOI.title}</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    {isDM ? (
                                        <TouchableOpacity style={styles.mapUploadButton} onPress={() => handleUploadCityMap(selectedPOI)} activeOpacity={0.85}>
                                            <ImageIcon size={16} color="#F59E0B" />
                                            <Text style={styles.mapUploadText}>{selectedPOI.map_image ? 'Cambiar mapa' : 'Subir mapa'}</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            )}

                            {/* Expanded Content */}
                            {isCardExpanded && (
                                <View style={styles.poiContentWrapper}>
                                    {isLoadingLore ? (
                                        <View style={styles.loadingContainer}>
                                            <ActivityIndicator color="#F59E0B" />
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
                                                    placeholderTextColor="#3A4540"
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
                                <Text style={styles.modalTitle}>{currentParent ? `Nuevo en ${currentParent.title}` : 'Nueva Locación'}</Text>
                                <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.closeButton}>
                                    <X size={20} color="#A89F8E" />
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                style={styles.input}
                                placeholder="Nombre (ej. Mina Perdida)"
                                placeholderTextColor="#6B6557"
                                value={newPoiName}
                                onChangeText={setNewPoiName}
                                autoFocus
                            />

                            <Text style={styles.typeLabel}>Tipo:</Text>
                            <View style={styles.typeSelectorRow}>
                                {(currentParent
                                    ? [
                                        { key: 'npc', label: 'NPC', Icon: User, color: '#3E84D6' },
                                        { key: 'quest', label: 'Misión', Icon: CircleAlert, color: '#F5C518' },
                                        { key: 'shop', label: 'Comercio', Icon: Store, color: '#5BA86B' },
                                        { key: 'place', label: 'Lugar', Icon: Home, color: '#A855F7' },
                                    ]
                                    : [
                                        { key: 'city', label: 'Ciudad', Icon: MapPin, color: '#F59E0B' },
                                        { key: 'camp', label: 'Campa.', Icon: Tent, color: '#FF7A1A' },
                                        { key: 'dungeon', label: 'Dungeon', Icon: SkullIcon, color: '#9B5DE5' },
                                        { key: 'cave', label: 'Cueva', Icon: Mountain, color: '#A89F8E' },
                                    ]
                                ).map(({ key, label, Icon, color }) => {
                                    const sel = newPoiType === key;
                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            style={[styles.typeButton, sel && styles.typeButtonSelected]}
                                            onPress={() => setNewPoiType(key)}
                                        >
                                            <Icon size={24} color={sel ? color : '#6B6557'} />
                                            <Text style={[styles.typeText, sel && { color }]}>{label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Nivel de la misión (define el color del "!" en el mapa). */}
                            {newPoiType === 'quest' && (
                                <View style={styles.levelRow}>
                                    <Text style={styles.typeLabel}>Nivel de la misión:</Text>
                                    <TextInput
                                        style={styles.levelInput}
                                        value={newPoiLevel}
                                        onChangeText={(t) => setNewPoiLevel(t.replace(/[^0-9]/g, ''))}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        placeholder="1"
                                        placeholderTextColor="#6B6557"
                                    />
                                </View>
                            )}

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
        backgroundColor: '#0F1518', // Arcane Theme
        overflow: 'hidden',
        alignItems: 'center', // Centra el contenedor del mapa
        justifyContent: 'center',
    },
    mapContainer: {
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#16211F',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    mapPlaceholder: {
        backgroundColor: '#0B1020',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    mapPlaceholderText: {
        color: '#6B7280',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    markerWrapper: {
        // Caja fija del tamaño de la chapa: mantiene el badge anclado arriba-izq
        // para que la contra-escala lo centre exacto en el punto del mapa.
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        // zIndex must be elevated so gestures hit the marker before the map
        zIndex: 10,
    },
    markerBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(11,15,25,0.92)',
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 4,
    },
    markerBadgeDM: {
        // El DM ve el borde punteado para saber que puede arrastrarlo.
        borderStyle: 'dashed',
    },
    markerBang: {
        // El "!" de las misiones (estilo WoW). Color lo pone el nivel relativo.
        fontSize: 18,
        fontWeight: '900',
        lineHeight: 20,
        textShadowColor: 'rgba(0,0,0,0.9)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    markerLabel: {
        // Etiqueta flotante centrada bajo la chapa (sin afectar el anclaje).
        position: 'absolute',
        top: 30,
        width: 110,
        left: -41, // (28 - 110) / 2, centra el texto bajo el badge
        textAlign: 'center',
        color: '#F5EFE0',
        fontSize: 9,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
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
        color: '#F59E0B',
        fontWeight: 'bold',
        fontSize: 16,
        textTransform: 'uppercase',
    },
    subText: {
        color: '#A89F8E',
        fontSize: 10,
        marginTop: 2,
    },
    backButton: {
        position: 'absolute',
        top: 110,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(11, 15, 25, 0.9)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.5)',
    },
    backText: { color: '#F59E0B', fontWeight: '800', fontSize: 13 },
    // Acciones de la tarjeta de POI
    poiActions: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    enterButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F59E0B',
        paddingVertical: 12,
        borderRadius: 10,
    },
    enterButtonText: { color: '#0B0B0B', fontWeight: '800', fontSize: 14, flexShrink: 1 },
    mapUploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(245,158,11,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.5)',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
    },
    mapUploadText: { color: '#F59E0B', fontWeight: '700', fontSize: 13 },
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
        backgroundColor: '#16211F',
        width: '100%',
        maxWidth: 380,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#2A332F',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        color: '#EDE6D8',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    input: {
        backgroundColor: '#16211F',
        color: '#EDE6D8',
        borderWidth: 1,
        borderColor: '#2A332F',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        marginBottom: 20,
    },
    typeLabel: {
        color: '#A89F8E',
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
    levelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        marginTop: -8,
    },
    levelInput: {
        backgroundColor: '#16211F',
        color: '#EDE6D8',
        borderWidth: 1,
        borderColor: '#2A332F',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 14,
        fontSize: 16,
        width: 70,
        textAlign: 'center',
    },
    typeButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#16211F',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2A332F',
    },
    typeButtonSelected: {
        borderColor: '#9B5DE5',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
    },
    typeText: {
        color: '#6B6557',
        fontSize: 10,
        marginTop: 6,
        fontWeight: 'bold',
    },
    typeTextSelected: {
        color: '#F59E0B', // city default color matches icon
    },
    createButton: {
        backgroundColor: '#9B5DE5',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    createButtonDisabled: {
        backgroundColor: '#3A4540',
        opacity: 0.5,
    },
    createButtonText: {
        color: '#EDE6D8',
        fontWeight: 'bold',
        fontSize: 16,
    },
    modalHint: {
        color: '#6B6557',
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
        backgroundColor: '#0F1518',
    },
    poiBannerPlaceholder: {
        width: '100%',
        height: 80, // Reduced from 100 to save space
        backgroundColor: '#16211F',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#2A332F',
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
        color: '#EDE6D8',
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
        color: '#C8A36A',
        fontSize: 10,
        fontWeight: 'bold',
    },
    poiLevelBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        backgroundColor: 'rgba(0,0,0,0.25)',
        marginLeft: 6,
    },
    poiLevelText: {
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
        color: '#F59E0B',
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
        color: '#A89F8E',
        fontSize: 12, // Smaller font
        fontStyle: 'italic',
        marginBottom: 12,
        lineHeight: 18,
    },
    dmDescriptionCompact: {
        color: '#A89F8E',
        fontSize: 11,
        fontStyle: 'italic',
        marginBottom: 4,
        lineHeight: 16,
    },
    poiDescription: {
        color: '#A89F8E',
        fontSize: 13, // Smaller text to fit more
        lineHeight: 20,
    },
    loreSection: {
        marginBottom: 20,
    },
    loreSectionTitle: {
        color: '#A89F8E',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 6,
        letterSpacing: 1,
    },
    loreSectionTitleHighlight: {
        color: '#C8A36A',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 6,
        letterSpacing: 1,
    },
    loreSectionBox: {
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderLeftWidth: 2,
        borderLeftColor: '#2A332F',
        padding: 12,
        borderRadius: 4,
    },
    loreSectionBoxHighlight: {
        borderLeftColor: '#F59E0B',
        backgroundColor: 'rgba(147, 51, 234, 0.05)',
    },
    loreSectionText: {
        color: '#EDE6D8',
        fontSize: 13,
        lineHeight: 20,
    },
    notesInput: {
        backgroundColor: '#16211F',
        color: '#EDE6D8',
        borderWidth: 1,
        borderColor: '#2A332F',
        borderRadius: 8,
        padding: 12,
        fontSize: 13,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    savingText: {
        color: '#6B6557',
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
        borderColor: '#9B5DE5',
        alignItems: 'center'
    },
    editPoiContentText: {
        color: '#C8A36A',
        fontWeight: 'bold'
    }
});
