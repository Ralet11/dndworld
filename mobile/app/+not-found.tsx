import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPO } from '../constants/Theme';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <View style={styles.container}>
                <Text style={styles.title}>Esta pantalla no existe.</Text>
                <Link href="/" style={styles.link}>
                    <Text style={styles.linkText}>Volver al inicio</Text>
                </Link>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        backgroundColor: COLORS.background,
    },
    title: {
        ...TYPO.title,
        color: COLORS.textPrimary,
    },
    link: {
        marginTop: SPACING.lg,
        paddingVertical: SPACING.lg,
    },
    linkText: {
        ...TYPO.body,
        color: COLORS.amber,
    },
});
