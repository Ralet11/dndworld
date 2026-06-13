const DEFAULT_API_URL = 'http://192.168.1.36:3001';

export const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
