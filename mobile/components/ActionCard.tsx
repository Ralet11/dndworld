import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { User, Dices } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface ActionCardProps {
    item: any;
    index: number;
}

export default function ActionCard({ item, index }: ActionCardProps) {
    return (
        <Animated.View
            style={styles.container}
        >
            <View style={styles.card}>
                <View style={styles.header}>
                    <View style={styles.avatar}>
                        <User size={20} color="#fff" />
                    </View>
                    <View>
                        <Text style={styles.author}>{item.author}</Text>
                        <Text style={styles.role}>Rogue Lvl 3</Text>
                    </View>
                </View>

                <Text style={styles.content}>"{item.content}"</Text>

                {item.metadata?.roll && (
                    <View style={styles.rollBox}>
                        <Dices size={16} color="#FFD700" style={{ marginRight: 8 }} />
                        <Text style={styles.rollText}>
                            {item.metadata.roll.skill}: <Text style={styles.rollTotal}>{item.metadata.roll.total}</Text>
                        </Text>
                    </View>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        alignItems: 'flex-start', // Align to left/right depending on user ID in future
        paddingHorizontal: 20,
        width: '100%',
    },
    card: {
        width: width * 0.85,
        backgroundColor: '#333',
        borderRadius: 16,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#FFD700',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#555',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    author: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    role: {
        color: '#888',
        fontSize: 10,
    },
    content: {
        color: '#ddd',
        fontSize: 14,
        lineHeight: 20,
        fontStyle: 'italic',
    },
    rollBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignSelf: 'flex-start',
        borderRadius: 8,
    },
    rollText: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: 'bold',
    },
    rollTotal: {
        fontSize: 14,
    }
});
