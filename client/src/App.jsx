import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PlayerLayout from './layouts/PlayerLayout';
import DmLayout from './layouts/DmLayout';
import CampaignHub from './pages/CampaignHub';
import { CampaignProvider, useCampaign } from './context/CampaignContext';

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

  return <CampaignProvider><CampaignRoutes /></CampaignProvider>;
}

function CampaignRoutes() {
  const { campaign, campaignReady, loading } = useCampaign();
  const { user } = useAuth();
  if (loading) return null;
  if (!campaign) return <Routes><Route path="/campaigns" element={<CampaignHub />} /><Route path="*" element={<Navigate to="/campaigns" replace />} /></Routes>;
  if (!campaignReady) return <div className="min-h-screen grid place-items-center" style={{ background: '#0F1518', color: '#C8A36A' }}>Abriendo campaña...</div>;
  const campaignRoute = <Route path="/campaigns" element={<CampaignHub />} />;
  // DM y ADMIN van al panel maestro
  if (user.role === 'DM' || user.role === 'ADMIN') {
    return (
      <Routes>
        {campaignRoute}
        <Route path="/dm/*" element={<DmLayout />} />
        <Route path="*" element={<Navigate to="/dm" replace />} />
      </Routes>
    );
  }

  // PLAYER va al layout con tabs
  return (
    <Routes>
      {campaignRoute}
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
