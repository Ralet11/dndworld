import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, ErrorBoundary, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { GameProvider } from '../context/GameContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator } from 'react-native';

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
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
                <ActivityIndicator size="large" color="#e056fd" />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
        </Stack>
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
