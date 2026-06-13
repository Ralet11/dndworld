import React from 'react';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { Scroll, Shield, Compass, Flame } from 'lucide-react-native';
import { COLORS } from '../../constants/Theme';

/**
 * Navegación inferior del jugador (MVP fin de semana):
 *   Chronicles · My Hero · Lore · Campfire
 * Las pantallas de DM/dev (party, bestiary, session, grimoire, atlas) quedan
 * como rutas ocultas (href: null) — su acceso es vía dev tools, no la barra.
 */
export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarBackground: () => (
                    Platform.OS === 'ios'
                        ? <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />
                        : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 21, 24, 0.96)' }]} />
                ),
                tabBarActiveTintColor: COLORS.amber,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.tabLabel,
                tabBarHideOnKeyboard: true,
            }}>

            <Tabs.Screen
                name="index"
                options={{
                    title: 'Chronicles',
                    tabBarIcon: ({ color }) => <Scroll size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="hero"
                options={{
                    title: 'My Hero',
                    tabBarIcon: ({ color }) => <Shield size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="lore"
                options={{
                    title: 'Lore',
                    tabBarIcon: ({ color }) => <Compass size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="campfire"
                options={{
                    title: 'Campfire',
                    tabBarIcon: ({ color }) => <Flame size={22} color={color} />,
                }}
            />

            {/* --- Rutas ocultas (DM / dev / fuera de scope del MVP) --- */}
            <Tabs.Screen name="atlas" options={{ href: null }} />
            <Tabs.Screen name="grimoire" options={{ href: null }} />
            <Tabs.Screen name="party" options={{ href: null }} />
            <Tabs.Screen name="bestiary" options={{ href: null }} />
            <Tabs.Screen name="session" options={{ href: null }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        borderTopWidth: 1,
        borderTopColor: COLORS.bronzeDark,
        backgroundColor: 'transparent',
        height: 82,
        paddingBottom: 22,
        paddingTop: 8,
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
