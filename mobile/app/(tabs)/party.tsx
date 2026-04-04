import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../../constants/Config';

export default function PartyScreen() {
    const { token, user } = useAuth();
    const { isDmMode } = useGame();
    const [characters, setCharacters] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

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
            <View style={[styles.container, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 20 }}>🛡️ Party Monitor (DM View)</Text>
                <Text style={{ color: '#666', marginTop: 10 }}>Track player stats here (Coming Soon)</Text>
            </View>
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
    badgeText: { color: '#10B981', fontWeight: 'bold', fontSize: 14 }
});
