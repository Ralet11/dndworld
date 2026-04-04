import { View, Text, StyleSheet } from 'react-native';

export default function GrimoireScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Grimoire</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
    },
    text: {
        color: '#fff',
        fontSize: 24,
    },
});
