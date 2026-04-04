import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { User, Shield, Sword, Crown } from 'lucide-react-native';

interface PaperDollProps {
    onSlotPress: (slot: string) => void;
}

export default function PaperDoll({ onSlotPress }: PaperDollProps) {
    return (
        <View style={styles.container}>
            {/* Silhouette */}
            <View style={styles.silhouette}>
                <User size={250} color="#333" strokeWidth={1} />
            </View>

            {/* Slots Overlay */}
            <View style={styles.overlays}>
                {/* Head */}
                <TouchableOpacity
                    style={[styles.slot, styles.head]}
                    onPress={() => onSlotPress('helmet')}
                >
                    <Crown size={24} color="#666" />
                </TouchableOpacity>

                {/* Main Hand */}
                <TouchableOpacity
                    style={[styles.slot, styles.handMain]}
                    onPress={() => onSlotPress('main_hand')}
                >
                    <Sword size={24} color="#666" />
                </TouchableOpacity>

                {/* Off Hand */}
                <TouchableOpacity
                    style={[styles.slot, styles.handOff]}
                    onPress={() => onSlotPress('off_hand')}
                >
                    <Shield size={24} color="#666" />
                </TouchableOpacity>

                {/* Chest */}
                <TouchableOpacity
                    style={[styles.slot, styles.chest]}
                    onPress={() => onSlotPress('chest')}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 300,
        height: 400,
        justifyContent: 'center',
        alignItems: 'center',
    },
    silhouette: {
        opacity: 0.5,
    },
    overlays: {
        ...StyleSheet.absoluteFillObject,
    },
    slot: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)', // Gold faint
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    head: {
        top: 20,
        left: 125,
    },
    chest: {
        top: 90,
        left: 125,
        width: 50,
        height: 80,
        borderRadius: 10,
    },
    handMain: {
        top: 150,
        left: 40,
    },
    handOff: {
        top: 150,
        right: 40,
    }
});
