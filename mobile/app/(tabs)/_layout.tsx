import React from 'react';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { Scroll, Sword, Book, Map as MapIcon, Flame, Users, Skull, Clock } from 'lucide-react-native';
import { useGame } from '../../context/GameContext';

export default function TabLayout() {
    const { userRole } = useGame();
    const isDm = userRole === 'DM';

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarBackground: () => (
                    Platform.OS === 'ios'
                        ? <BlurView intensity={80} style={StyleSheet.absoluteFill} tint="dark" />
                        : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11, 15, 25, 0.95)' }]} /> // Night Blue
                ),
                tabBarActiveTintColor: isDm ? '#A855F7' : '#38bdf8', // Purple for DM, Blue for Player
                tabBarInactiveTintColor: '#64748b', // Slate 500
                tabBarShowLabel: true,
                tabBarHideOnKeyboard: true,
            }}>

            {/* 1. CHRONICLE (Common) */}
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Chronicle',
                    tabBarIcon: ({ color }) => <Scroll size={24} color={color} />,
                }}
            />

            {/* PLAYER TABS */}
            <Tabs.Screen
                name="hero"
                options={{
                    title: 'Hero',
                    href: isDm ? null : '/hero', // Hide if DM
                    tabBarIcon: ({ color }) => <Sword size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="grimoire"
                options={{
                    href: null,
                }}
            />

            {/* DM TABS */}
            <Tabs.Screen
                name="party"
                options={{
                    title: 'Party',
                    href: isDm ? '/party' : null,
                    tabBarIcon: ({ color }) => <Users size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="bestiary"
                options={{
                    title: 'Cast',
                    href: isDm ? '/bestiary' : null,
                    tabBarIcon: ({ color }) => <Skull size={24} color={color} />,
                }}
            />

            {/* ATLAS (Common) */}
            <Tabs.Screen
                name="atlas"
                options={{
                    title: 'Atlas',
                    tabBarIcon: ({ color }) => <MapIcon size={24} color={color} />,
                }}
            />

            {/* PLAYER: CAMPFIRE / DM: SESSION */}
            <Tabs.Screen
                name="campfire"
                options={{
                    title: 'Campfire',
                    href: isDm ? null : '/campfire',
                    tabBarIcon: ({ color }) => <Flame size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="session"
                options={{
                    title: 'Session',
                    href: isDm ? '/session' : null,
                    tabBarIcon: ({ color }) => <Clock size={24} color={color} />,
                }}
            />

        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        borderTopWidth: 0,
        backgroundColor: 'transparent',
        height: 80,
        paddingBottom: 20,
    }
});
