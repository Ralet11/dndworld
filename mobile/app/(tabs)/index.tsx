import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useGame } from '../../context/GameContext';
import SceneList from '../../components/Chronicle/SceneList';
import SceneChat from '../../components/Chronicle/SceneChat';
import CreateSceneModal from '../../components/Chronicle/CreateSceneModal';
import socket from '../../services/socket';

export default function ChronicleScreen() {
    const { userRole } = useGame();
    const isDm = userRole === 'DM';

    const [viewMode, setViewMode] = useState<'LIST' | 'CHAT'>('LIST');
    const [selectedScene, setSelectedScene] = useState<any>(null);
    const [createModalVisible, setCreateModalVisible] = useState(false);

    const handleSelectScene = (scene: any) => {
        setSelectedScene(scene);
        setViewMode('CHAT');
    };

    const handleBackToList = () => {
        setSelectedScene(null);
        setViewMode('LIST');
    };

    const handleCreateScene = (data: any) => {
        console.log('Frontend: Create Scene:', data);
        socket.emit('create-scene', data);
        setCreateModalVisible(false);
    };

    return (
        <View style={styles.container}>
            {viewMode === 'LIST' ? (
                <SceneList
                    onSelectScene={handleSelectScene}
                    isDm={isDm}
                    onCreateScene={() => setCreateModalVisible(true)}
                />
            ) : (
                <SceneChat
                    scene={selectedScene}
                    onBack={handleBackToList}
                />
            )}

            <CreateSceneModal
                visible={createModalVisible}
                onClose={() => setCreateModalVisible(false)}
                onSubmit={handleCreateScene}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    }
});
