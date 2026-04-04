import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { CloudRain, Sun, Moon, MapPin, Clock } from 'lucide-react-native';

interface OrientationHUDProps {
    locationName: string;
    gameTime: string;
    weather: 'sun' | 'rain' | 'moon' | 'fog';
}

export default function OrientationHUD({ locationName, gameTime, weather }: OrientationHUDProps) {
    const Container = Platform.OS === 'ios' ? BlurView : View;
    const containerProps = Platform.OS === 'ios' ? { intensity: 50, tint: 'dark' } : { style: { backgroundColor: 'rgba(0, 0, 0, 0.85)' } };

    const getWeatherIcon = () => {
        switch (weather) {
            case 'rain': return <CloudRain size={16} color="#A4C3D2" />;
            case 'sun': return <Sun size={16} color="#FFD700" />;
            case 'moon': return <Moon size={16} color="#C0C0C0" />;
            default: return <CloudRain size={16} color="#888" />;
        }
    };

    return (
        // @ts-ignore
        <Container {...containerProps} style={[styles.container, Platform.OS === 'android' && containerProps.style]}>
            <View style={styles.section}>
                <MapPin size={14} color="#FFD700" style={styles.icon} />
                <Text style={styles.text}>{locationName}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
                <Clock size={14} color="#888" style={styles.icon} />
                <Text style={[styles.text, styles.timeText]}>{gameTime}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
                {getWeatherIcon()}
            </View>
        </Container>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        alignSelf: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden', // Important for BlurView border radius
        gap: 15,
    },
    section: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    divider: {
        width: 1,
        height: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    icon: {
        opacity: 0.8,
    },
    text: {
        color: '#E0E0E0',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    timeText: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', // Monospaced for time
        fontSize: 13,
    }
});
