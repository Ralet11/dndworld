import React, { createContext, useContext, useState, ReactNode } from 'react';

type UserRole = 'PLAYER' | 'DM';

interface GameContextType {
    userRole: UserRole;
    toggleRole: () => void;
    isDmMode: boolean; // Computed helper
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
    const [userRole, setUserRole] = useState<UserRole>('PLAYER');

    const toggleRole = () => {
        setUserRole(prev => (prev === 'PLAYER' ? 'DM' : 'PLAYER'));
    };

    const value = {
        userRole,
        toggleRole,
        isDmMode: userRole === 'DM',
    };

    return (
        <GameContext.Provider value={value}>
            {children}
        </GameContext.Provider>
    );
}

export function useGame() {
    const context = useContext(GameContext);
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
}
