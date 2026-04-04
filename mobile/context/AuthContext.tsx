import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_URL } from '../constants/Config';

// API URL Helper
const getApiUrl = () => API_URL;

interface User {
    id: string;
    username: string;
    email: string;
    role: 'PLAYER' | 'DM' | 'ADMIN';
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for persisted token on mount
    useEffect(() => {
        const loadUser = async () => {
            try {
                const storedToken = await AsyncStorage.getItem('token');
                if (storedToken) {
                    // Ideally verify token with backend here
                    // For now, let's just Decode user info if we stored it, or fetch /me
                    const response = await fetch(`${getApiUrl()}/api/auth/me`, {
                        headers: { Authorization: `Bearer ${storedToken}` }
                    });

                    if (response.ok) {
                        const userData = await response.json();
                        setUser(userData);
                        setToken(storedToken);
                    } else {
                        // Token invalid/expired
                        await logout();
                    }
                }
            } catch (e) {
                console.error("Failed to load user", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadUser();
    }, []);

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${getApiUrl()}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            setToken(data.accessToken);
            setUser({
                id: data.id,
                username: data.username,
                email: data.email,
                role: data.role
            });

            await AsyncStorage.setItem('token', data.accessToken);
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (username: string, email: string, password: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${getApiUrl()}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            setToken(data.accessToken);
            setUser({
                id: data.id,
                username: data.username,
                email: data.email,
                role: data.role
            });

            await AsyncStorage.setItem('token', data.accessToken);
        } catch (error) {
            console.error(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setUser(null);
        setToken(null);
        await AsyncStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
