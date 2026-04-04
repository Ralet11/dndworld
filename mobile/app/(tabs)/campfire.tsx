import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Flame } from 'lucide-react-native';

export default function CampfireScreen() {
    const { logout, user } = useAuth();

    const handleLogout = () => {
        Alert.alert(
            "Cerrar Sesión",
            "¿Estás seguro de que quieres salir?",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Salir", onPress: logout, style: "destructive" }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Flame size={64} color="#FFD700" style={styles.icon} />
                <Text style={styles.title}>Campamento</Text>
                <Text style={styles.subtitle}>Descansa aventurero, {user?.username}.</Text>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <LogOut size={20} color="#ff4444" />
                <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
        justifyContent: 'space-between',
        padding: 40,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        marginBottom: 20,
    },
    title: {
        color: '#FFD700',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        color: '#888',
        fontSize: 16,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2a1a1a',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#442222',
        gap: 10,
        marginBottom: 20,
    },
    logoutText: {
        color: '#ff4444',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
