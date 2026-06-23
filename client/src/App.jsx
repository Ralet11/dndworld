import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PlayerLayout from './layouts/PlayerLayout';
import DmLayout from './layouts/DmLayout';

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0F1518' }}>
        <div className="w-12 h-12 rounded-full border-2 border-amber animate-spin" style={{ borderTopColor: 'transparent' }} />
        <p className="label-caps" style={{ color: '#C8A36A' }}>Cargando aventura...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // DM y ADMIN van al panel maestro
  if (user.role === 'DM' || user.role === 'ADMIN') {
    return (
      <Routes>
        <Route path="/dm/*" element={<DmLayout />} />
        <Route path="*" element={<Navigate to="/dm" replace />} />
      </Routes>
    );
  }

  // PLAYER va al layout con tabs
  return (
    <Routes>
      <Route path="/*" element={<PlayerLayout />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
