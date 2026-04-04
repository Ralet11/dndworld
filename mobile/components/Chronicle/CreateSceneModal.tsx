import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Image, Platform, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Upload, Check, Users } from 'lucide-react-native';
import socket from '../../services/socket';

interface Character {
    id: number;
    name: string;
    image_url: string;
    race: string;
    class: string;
}

interface CreateSceneModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (data: { title: string; description: string; imageUrl: string; participants: number[] }) => void;
}

export default function CreateSceneModal({ visible, onClose, onSubmit }: CreateSceneModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
    const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);

    useEffect(() => {
        if (visible) {
            socket.emit('get-players');
            const handlePlayers = (data: Character[]) => {
                setAvailableCharacters(data);
            };
            socket.on('players-data', handlePlayers);
            return () => {
                socket.off('players-data', handlePlayers);
            };
        }
    }, [visible]);

    const toggleParticipant = (id: number) => {
        setSelectedParticipants(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleSubmit = () => {
        if (!title.trim()) return;
        onSubmit({
            title,
            description,
            imageUrl: imageUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2568',
            participants: selectedParticipants
        });
        // Reset
        setTitle('');
        setDescription('');
        setImageUrl('');
        setSelectedParticipants([]);
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.container}>
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

                <View style={styles.content}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <Text style={styles.heading}>Crear Nueva Escena</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <X size={24} color="#aaa" />
                            </TouchableOpacity>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <Text style={styles.label}>Título</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej. El Bosque Susurrante"
                                placeholderTextColor="#555"
                                value={title}
                                onChangeText={setTitle}
                            />

                            <Text style={styles.label}>Descripción</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Describe el ambiente initial..."
                                placeholderTextColor="#555"
                                multiline
                                textAlignVertical="top"
                                value={description}
                                onChangeText={setDescription}
                            />

                            <Text style={styles.label}>Imagen (URL)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="https://..."
                                placeholderTextColor="#555"
                                value={imageUrl}
                                onChangeText={setImageUrl}
                            />
                            <Text style={styles.hint}>* O deja vacío para usar imagen por defecto</Text>

                            {imageUrl ? (
                                <Image source={{ uri: imageUrl }} style={styles.previewImage} />
                            ) : null}

                            {/* Participant Selection */}
                            <View style={styles.participantsSection}>
                                <View style={styles.sectionHeader}>
                                    <Users size={16} color="#FFD700" />
                                    <Text style={styles.label}>Participantes</Text>
                                </View>
                                <View style={styles.charGrid}>
                                    {availableCharacters.map(char => (
                                        <TouchableOpacity
                                            key={char.id}
                                            style={[
                                                styles.charItem,
                                                selectedParticipants.includes(char.id) && styles.charItemActive
                                            ]}
                                            onPress={() => toggleParticipant(char.id)}
                                        >
                                            <Image source={{ uri: char.image_url || 'https://via.placeholder.com/50' }} style={styles.charAvatar} />
                                            <Text style={[styles.charName, selectedParticipants.includes(char.id) && styles.charNameActive]} numberOfLines={1}>
                                                {char.name}
                                            </Text>
                                            {selectedParticipants.includes(char.id) && (
                                                <View style={styles.checkBadge}>
                                                    <Check size={10} color="#000" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                            <Text style={styles.submitText}>Crear Escena</Text>
                            <Check size={20} color="#000" />
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 24,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: '#333',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    heading: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    closeBtn: {
        padding: 4,
    },
    form: {
        gap: 15,
    },
    label: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    input: {
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 14,
    },
    textArea: {
        height: 100,
    },
    hint: {
        color: '#444',
        fontSize: 10,
        fontStyle: 'italic',
    },
    previewImage: {
        width: '100%',
        height: 120,
        borderRadius: 8,
        marginTop: 10,
        resizeMode: 'cover',
    },
    participantsSection: {
        marginTop: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    charGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    charItem: {
        width: '22%',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        padding: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    charItemActive: {
        borderColor: '#FFD700',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
    },
    charAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginBottom: 6,
    },
    charName: {
        color: '#888',
        fontSize: 10,
        textAlign: 'center',
    },
    charNameActive: {
        color: '#FFD700',
        fontWeight: 'bold',
    },
    checkBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: '#FFD700',
        borderRadius: 10,
        padding: 2,
    },
    submitBtn: {
        backgroundColor: '#FFD700',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 30,
        gap: 8,
    },
    submitText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

