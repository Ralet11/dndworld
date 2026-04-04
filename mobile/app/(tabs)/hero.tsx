import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import socket from '../../services/socket';
import CharacterSheet from '../../components/Hero/CharacterSheet';
import { Swords } from 'lucide-react-native';
import { COLORS } from '../../constants/Theme';

interface Character {
    id: number;
    name: string;
    race: string;
    class: string;
    level: number;
    UserId?: number | null;
    image_url?: string;
    // ... other props
}

export default function HeroScreen() {
    const { user } = useAuth();
    const [myCharacter, setMyCharacter] = useState<any>(null);
    const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);

    // Fetch available characters (REST)
    const fetchAvailable = async () => {
        try {
            const token = await import('@react-native-async-storage/async-storage').then(m => m.default.getItem('token'));
            const res = await fetch(`http://192.168.1.38:3001/api/characters/available`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableCharacters(data);
            }
        } catch (e) {
            console.error('Error fetching available characters:', e);
        }
    };

    // Listen for socket updates to keep myCharacter in sync
    useEffect(() => {
        if (!user) return;

        // Ask for data
        socket.emit('get-players');

        const handlePlayersData = (players: any[]) => {
            // Find my character by UserId
            // Note: Server calculates UserId. Ensure it matches user.id
            const myChar = players.find((p: any) => p.UserId === user.id);
            if (myChar) {
                setMyCharacter(myChar);
            } else {
                setMyCharacter(null);
                fetchAvailable(); // If I don't have one, refresh available list
            }
            setLoading(false);
        };

        socket.on('players-data', handlePlayersData);

        return () => {
            socket.off('players-data', handlePlayersData);
        };
    }, [user]);

    const handleAssign = async (characterId: number) => {
        setAssigning(true);
        try {
            const token = await import('@react-native-async-storage/async-storage').then(m => m.default.getItem('token'));
            const res = await fetch(`http://192.168.1.38:3001/api/characters/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ characterId })
            });

            if (res.ok) {
                // Success! Socket will update the character list and we'll get 'players-data'
                Alert.alert('Éxito', '¡Personaje asignado correctamente!');
            } else {
                const err = await res.json();
                Alert.alert('Error', err.message || 'No se pudo asignar el personaje');
            }
        } catch (e) {
            Alert.alert('Error', 'Fallo de conexión');
        } finally {
            setAssigning(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#FFD700" />
            </View>
        );
    }

    // 1. If I have a character, show sheet
    if (myCharacter) {
        return <CharacterSheet character={myCharacter} />;
    }

    // 2. If I don't, show selection list
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.selectionHeader}>
                <Swords size={48} color={COLORS.gold} />
                <Text style={styles.title}>Elige tu Héroe</Text>
                <Text style={styles.subtitle}>Selecciona un personaje para comenzar tu aventura.</Text>
            </View>

            <FlatList
                data={availableCharacters}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => Alert.alert(
                            'Confirmar',
                            `¿Quieres elegir a ${item.name}?`,
                            [
                                { text: 'Cancelar', style: 'cancel' },
                                { text: 'Elegir', onPress: () => handleAssign(item.id) }
                            ]
                        )}
                        disabled={assigning}
                    >
                        <View style={styles.cardContent}>
                            <Text style={styles.cardTitle}>{item.name}</Text>
                            <Text style={styles.cardSubtitle}>{item.race} {item.class} - Nivel {item.level}</Text>
                        </View>
                        <Text style={styles.selectBtn}>ELEGIR</Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No hay personajes disponibles. Contacta a tu DM.</Text>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    selectionHeader: {
        alignItems: 'center',
        padding: 30,
    },
    title: {
        fontSize: 28,
        color: COLORS.gold,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    listContent: {
        padding: 20,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 12, // Soft borders
        padding: 20,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: COLORS.border,
        elevation: 3,
        shadowColor: COLORS.background,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 18,
        color: COLORS.textPrimary,
        fontWeight: 'bold',
    },
    cardSubtitle: {
        fontSize: 14,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    selectBtn: {
        color: COLORS.gold,
        fontWeight: 'bold',
        fontSize: 14,
        paddingLeft: 10,
    },
    emptyText: {
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    }
});
