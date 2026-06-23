import { createContext, useContext, useState, useEffect } from 'react';
import API_URL from '../config';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('dnd_token');
    if (!storedToken) { setIsLoading(false); return; }

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) { setUser(data); setToken(storedToken); }
        else { localStorage.removeItem('dnd_token'); }
      })
      .catch(() => localStorage.removeItem('dnd_token'))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login fallido');

    setToken(data.accessToken);
    setUser({ id: data.id, username: data.username, email: data.email, role: data.role });
    localStorage.setItem('dnd_token', data.accessToken);
  };

  const register = async (username, email, password) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registro fallido');

    setToken(data.accessToken);
    setUser({ id: data.id, username: data.username, email: data.email, role: data.role });
    localStorage.setItem('dnd_token', data.accessToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('dnd_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
