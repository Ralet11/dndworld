import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { LogOut, Flame, User, Mail, Shield } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import Screen from '../../components/UI/Screen';
import Panel from '../../components/UI/Panel';
import Button from '../../components/UI/Button';
import SectionHeader from '../../components/UI/SectionHeader';
import { COLORS, SPACING, TYPO, RADIUS, GLOWS } from '../../constants/Theme';

export default function CampfireScreen() {
    const { logout, user } = useAuth();

    const handleLogout = () => {
        Alert.alert(
            'Abandonar el campamento',
            '¿Seguro que querés salir?',
            [
                { text: 'Quedarme', style: 'cancel' },
                { text: 'Salir', onPress: logout, style: 'destructive' },
            ],
        );
    };

    const roleLabel = user?.role === 'DM' ? 'Dungeon Master' : user?.role === 'ADMIN' ? 'Administrador' : 'Aventurero';

    return (
        <Screen scroll>
            {/* Hero hoguera */}
            <View style={styles.hero}>
                <View style={[styles.flameRing, GLOWS.ember]}>
                    <Flame size={40} color={COLORS.ember} />
                </View>
                <Text style={styles.title}>Campamento</Text>
                <Text style={styles.subtitle}>Descansa, {user?.username || 'aventurero'}.</Text>
            </View>

            {/* Perfil */}
            <SectionHeader title="Tu cuenta" icon={<User size={14} color={COLORS.bronzeLight} />} />
            <Panel>
                <InfoRow icon={<User size={18} color={COLORS.bronzeLight} />} label="Usuario" value={user?.username} />
                <View style={styles.divider} />
                <InfoRow icon={<Mail size={18} color={COLORS.bronzeLight} />} label="Email" value={user?.email} />
                <View style={styles.divider} />
                <InfoRow icon={<Shield size={18} color={COLORS.bronzeLight} />} label="Rol" value={roleLabel} />
            </Panel>

            <View style={styles.logoutWrap}>
                <Button
                    title="Cerrar sesión"
                    variant="danger"
                    full
                    icon={<LogOut size={18} color="#FDEDE9" />}
                    onPress={handleLogout}
                />
            </View>
        </Screen>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
    return (
        <View style={styles.infoRow}>
            <View style={styles.infoIcon}>{icon}</View>
            <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    hero: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    flameRing: {
        width: 88,
        height: 88,
        borderRadius: RADIUS.pill,
        borderWidth: 1.5,
        borderColor: COLORS.bronze,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
    },
    title: { ...TYPO.display, color: COLORS.textPrimary },
    subtitle: { ...TYPO.body, color: COLORS.textSecondary, marginTop: SPACING.xs },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    infoIcon: {
        width: 38,
        height: 38,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.surfaceHighlight,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoLabel: { ...TYPO.label, color: COLORS.textMuted },
    infoValue: { ...TYPO.subtitle, color: COLORS.textPrimary, marginTop: 1 },
    divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
    logoutWrap: { marginTop: SPACING.xxl },
});
