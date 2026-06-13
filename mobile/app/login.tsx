import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, TYPO, GLOWS } from '../constants/Theme';

export default function LoginScreen() {
    const [email, setEmail] = useState('test1@dev.local');
    const [password, setPassword] = useState('123456');
    const { login, isLoading } = useAuth();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Completá todos los campos');
            return;
        }
        try {
            await login(email, password);
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('No se pudo entrar', error.message);
        }
    };

    return (
        <LinearGradient colors={[COLORS.background, '#11191A']} style={styles.container}>
            <LinearGradient colors={['transparent', 'rgba(255,122,26,0.08)']} style={styles.emberGlow} pointerEvents="none" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                <View style={styles.header}>
                    <Text style={styles.title}>DND World</Text>
                    <Text style={styles.subtitle}>Entra al reino</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color={COLORS.bronzeLight} style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={COLORS.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={COLORS.bronzeLight} style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Contraseña"
                            placeholderTextColor={COLORS.textMuted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
                        {isLoading ? (
                            <ActivityIndicator color="#1A0E04" />
                        ) : (
                            <Text style={styles.buttonText}>Entrar</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>¿No tenés cuenta? </Text>
                        <Link href="/register" asChild>
                            <TouchableOpacity>
                                <Text style={styles.link}>Crear una</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    emberGlow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 260 },
    keyboardView: { flex: 1, justifyContent: 'center', padding: SPACING.xl },
    header: { alignItems: 'center', marginBottom: SPACING.xxxl },
    title: {
        fontSize: 42,
        fontWeight: 'bold',
        color: COLORS.amber,
        textShadowColor: 'rgba(245, 158, 11, 0.45)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 14,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        letterSpacing: 1,
    },
    subtitle: { ...TYPO.subtitle, color: COLORS.textSecondary, marginTop: SPACING.sm, fontStyle: 'italic' },
    form: { width: '100%' },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.lg,
        height: 52,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    icon: { marginRight: SPACING.md },
    input: { flex: 1, color: COLORS.textPrimary, fontSize: 16 },
    button: {
        backgroundColor: COLORS.ember,
        borderRadius: RADIUS.md,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: SPACING.lg,
        ...GLOWS.ember,
    },
    buttonText: { color: '#1A0E04', fontSize: 18, fontWeight: '800' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
    footerText: { color: COLORS.textSecondary },
    link: { color: COLORS.amber, fontWeight: 'bold' },
});
