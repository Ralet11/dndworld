import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function RegisterScreen() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { register, isLoading } = useAuth();
    const router = useRouter();

    const handleRegister = async () => {
        if (!username || !email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        try {
            await register(username, email, password);
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Registration Failed', error.message);
        }
    };

    return (
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                <View style={styles.header}>
                    <Text style={styles.title}>Join the Adventure</Text>
                    <Text style={styles.subtitle}>Create your Legend</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#a5b1c2" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            placeholderTextColor="#a5b1c2"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color="#a5b1c2" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#a5b1c2"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#a5b1c2" style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#a5b1c2"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={isLoading}>
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Register</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <Link href="/login" asChild>
                            <TouchableOpacity>
                                <Text style={styles.link}>Login</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 50,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#e056fd',
        textShadowColor: 'rgba(224, 86, 253, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    },
    subtitle: {
        fontSize: 18,
        color: '#a5b1c2',
        marginTop: 10,
        fontStyle: 'italic',
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 10,
        marginBottom: 15,
        paddingHorizontal: 15,
        height: 50,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
    },
    button: {
        backgroundColor: '#e056fd',
        borderRadius: 10,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#e056fd',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    footerText: {
        color: '#a5b1c2',
    },
    link: {
        color: '#e056fd',
        fontWeight: 'bold',
    },
});
