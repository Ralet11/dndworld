import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, ErrorBoundary, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { GameProvider, useGame } from '../context/GameContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { COLORS } from '../constants/Theme';

// ⚠️ TOOL DE DEV — botón flotante para alternar modo DM sin cambiar de cuenta.
// Quitar antes de producción (borrar este componente y su uso en ProtectedLayout).
const DevModeToggle = () => {
    const { isDmMode, toggleRole } = useGame();
    return (
        <TouchableOpacity
            onPress={toggleRole}
            activeOpacity={0.85}
            style={{
                position: 'absolute',
                right: 0,
                top: '42%',
                backgroundColor: isDmMode ? '#A855F7' : 'rgba(11,15,25,0.92)',
                borderTopLeftRadius: 14,
                borderBottomLeftRadius: 14,
                borderWidth: 1,
                borderRightWidth: 0,
                borderColor: isDmMode ? '#A855F7' : 'rgba(245,158,11,0.5)',
                paddingVertical: 10,
                paddingHorizontal: 12,
                alignItems: 'center',
                zIndex: 9999,
            }}
        >
            <Text style={{ color: isDmMode ? '#0B0B0B' : '#F59E0B', fontWeight: '800', fontSize: 13 }}>
                {isDmMode ? 'DM' : 'PJ'}
            </Text>
            <Text style={{ color: isDmMode ? 'rgba(0,0,0,0.6)' : '#6B7280', fontSize: 8, marginTop: 1, letterSpacing: 1 }}>DEV</Text>
        </TouchableOpacity>
    );
};

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
    // Ensure that reloading on `/modal` keeps a back button present.
    initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const ProtectedLayout = () => {
    const { user, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(tabs)';

        if (!user && inAuthGroup) {
            router.replace('/login');
        } else if (user && (segments[0] === 'login' || segments[0] === 'register')) {
            router.replace('/(tabs)');
        }
    }, [user, segments, isLoading]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
                <ActivityIndicator size="large" color={COLORS.amber} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="register" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
            </Stack>
            {/* ⚠️ DEV: toggle de modo DM (quitar en producción) */}
            {user && <DevModeToggle />}
        </View>
    );
};

export default function RootLayout() {
    const [loaded, error] = useFonts({
        // ... custom fonts if any
    });

    useEffect(() => {
        if (error) throw error;
    }, [error]);

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    if (!loaded) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
                <GameProvider>
                    <ActionSheetProvider>
                        <ThemeProvider value={DarkTheme}>
                            <ProtectedLayout />
                        </ThemeProvider>
                    </ActionSheetProvider>
                </GameProvider>
            </AuthProvider>
        </GestureHandlerRootView>
    );
}
