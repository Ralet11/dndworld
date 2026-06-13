import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Image, TextInput } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../../constants/Config';
import socket from '../../services/socket';

// XP acumulada para alcanzar cada nivel (D&D estándar). Índice = nivel - 1.
const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
const xpProgress = (level: number, xp: number) => {
    const lvl = Math.max(1, Math.min(20, level || 1));
    const cur = XP_THRESHOLDS[lvl - 1] ?? 0;
    const next = XP_THRESHOLDS[lvl] ?? cur;
    const gained = Math.max(0, (xp || 0) - cur);
    const needed = Math.max(0, next - cur);
    const isMax = lvl >= 20;
    return { gained, needed, pct: isMax ? 100 : needed > 0 ? Math.min(100, (gained / needed) * 100) : 0, isMax };
};

export default function PartyScreen() {
    const { token, user } = useAuth();
    const { isDmMode } = useGame();
    const [characters, setCharacters] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [players, setPlayers] = useState<any[]>([]);
    const [xpAmount, setXpAmount] = useState('');

    // Modo DM: traer todos los jugadores y mantenerlos en sync.
    useEffect(() => {
        if (!isDmMode) return;
        const onPlayers = (data: any[]) => setPlayers((data || []).filter((p: any) => !p.is_npc));
        socket.emit('get-players');
        socket.on('players-data', onPlayers);
        socket.on('stats-updated', onPlayers);
        return () => {
            socket.off('players-data', onPlayers);
            socket.off('stats-updated', onPlayers);
        };
    }, [isDmMode]);

    const awardXp = (ids: number[]) => {
        const amt = parseInt(xpAmount, 10);
        if (!amt || !ids.length) { Alert.alert('XP', 'Ingresá una cantidad de XP.'); return; }
        socket.emit('award-xp', { characterIds: ids, amount: amt });
    };

    const fetchCharacters = async () => {
        try {
            const res = await fetch(`${API_URL}/api/characters/available`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setCharacters(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (token && !isDmMode) fetchCharacters();
    }, [token, isDmMode]);

    const handleAssign = async (charId: number) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/characters/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ characterId: charId })
            });

            if (res.ok) {
                Alert.alert('Success', 'Character selected!');
                fetchCharacters();
            } else {
                const err = await res.json();
                Alert.alert('Error', err.message);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to assign character');
        } finally {
            setIsLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isMine = item.UserId === user?.id;

        return (
            <View style={[styles.card, isMine && styles.activeCard]}>
                <View style={styles.charInfo}>
                    <Text style={styles.charName}>{item.name}</Text>
                    <Text style={styles.charDetails}>{item.race} {item.class} (Lvl {item.level})</Text>
                </View>

                {isMine ? (
                    <View style={styles.badge}>
                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                        <Text style={styles.badgeText}>Selected</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.selectBtn}
                        onPress={() => handleAssign(item.id)}
                        disabled={isLoading}
                    >
                        <Text style={styles.btnText}>Select</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    if (isDmMode) {
        return (
            <LinearGradient colors={['#111827', '#000000']} style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>🛡️ Party Monitor</Text>
                    <Text style={styles.subtitle}>Otorgá XP a tus jugadores</Text>
                </View>

                {/* Otorgar XP */}
                <View style={styles.xpControl}>
                    <TextInput
                        style={styles.xpInput}
                        value={xpAmount}
                        onChangeText={setXpAmount}
                        placeholder="XP a otorgar"
                        placeholderTextColor="#6B7280"
                        keyboardType="number-pad"
                    />
                    <TouchableOpacity style={styles.allBtn} onPress={() => awardXp(players.map((p) => p.id))}>
                        <Text style={styles.btnText}>A todos</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={players}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => {
                        const xp = xpProgress(item.level, item.xp);
                        return (
                            <View style={styles.card}>
                                <View style={styles.charInfo}>
                                    <Text style={styles.charName}>{item.name}</Text>
                                    <Text style={styles.charDetails}>{item.race} {item.class} · Nv {item.level}</Text>
                                    <View style={styles.xpTrack}>
                                        <View style={[styles.xpFill, { width: `${xp.pct}%` }]} />
                                    </View>
                                    <Text style={styles.xpText}>{xp.isMax ? 'MÁX' : `${xp.gained}/${xp.needed} XP`}</Text>
                                </View>
                                <TouchableOpacity style={styles.selectBtn} onPress={() => awardXp([item.id])}>
                                    <Text style={styles.btnText}>+XP</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                    ListEmptyComponent={<Text style={styles.empty}>No hay jugadores en el grupo.</Text>}
                />
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#111827', '#000000']} style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Choose Your Hero</Text>
                <Text style={styles.subtitle}>Select a character to play as</Text>
            </View>

            <FlatList
                data={characters}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.list}
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60 },
    header: { paddingHorizontal: 20, marginBottom: 20 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
    subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
    list: { paddingHorizontal: 20, paddingBottom: 40 },
    card: {
        backgroundColor: '#1F2937',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#374151'
    },
    activeCard: {
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)'
    },
    charInfo: { flex: 1 },
    charName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    charDetails: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
    selectBtn: {
        backgroundColor: '#F59E0B',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8
    },
    btnText: { color: '#000', fontWeight: 'bold' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badgeText: { color: '#10B981', fontWeight: 'bold', fontSize: 14 },

    // DM: control de XP
    xpControl: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
    xpInput: {
        flex: 1,
        backgroundColor: '#1F2937',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#374151',
        color: '#fff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 16,
    },
    allBtn: {
        backgroundColor: '#A855F7',
        paddingHorizontal: 18,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    xpTrack: { height: 4, borderRadius: 999, backgroundColor: '#000', overflow: 'hidden', marginTop: 8 },
    xpFill: { height: '100%', borderRadius: 999, backgroundColor: '#A855F7' },
    xpText: { color: '#9CA3AF', fontSize: 11, marginTop: 4, fontWeight: '600' },
    empty: { color: '#9CA3AF', textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
});
