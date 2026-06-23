import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Scroll, Shield, Compass, Flame, Menu, X } from 'lucide-react';
import Chronicles from '../tabs/Chronicles';
import HeroTab from '../tabs/HeroTab';
import LoreTab from '../tabs/LoreTab';
import CampfireTab from '../tabs/CampfireTab';
import NotificationBanner from '../components/UI/NotificationBanner';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { path: '/chronicles', label: 'Chronicles', Icon: Scroll },
  { path: '/hero',       label: 'My Hero',    Icon: Shield },
  { path: '/lore',       label: 'Lore',       Icon: Compass },
  { path: '/campfire',   label: 'Campfire',   Icon: Flame },
];

const SIDEBAR_W = 220;

export default function PlayerLayout() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [notification, setNotification] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setNotification(data);
      setTimeout(() => setNotification(null), 5000);
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket]);

  const NavItem = ({ path, label, Icon }) => (
    <NavLink
      to={path}
      onClick={() => setMobileMenuOpen(false)}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 10,
        fontWeight: 700,
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        transition: 'all 0.15s',
        textDecoration: 'none',
        background: isActive ? 'rgba(245,158,11,0.12)' : 'transparent',
        color: isActive ? '#F59E0B' : '#6B6557',
        border: isActive ? '1px solid rgba(245,158,11,0.25)' : '1px solid transparent',
      })}
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );

  return (
    <div className="flex min-h-screen" style={{ background: '#0F1518' }}>
      {notification && (
        <NotificationBanner data={notification} onClose={() => setNotification(null)} />
      )}

      {/* ── DESKTOP SIDEBAR ────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col"
        style={{
          width: SIDEBAR_W,
          minWidth: SIDEBAR_W,
          background: '#0D1A18',
          borderRight: '1px solid #2A332F',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Brand */}
        <div className="px-4 py-5" style={{ borderBottom: '1px solid #2A332F' }}>
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#C8A36A' }}>
            DnD World
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: '#6B6557' }}>
            {user?.username || 'Aventurero'}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {TABS.map(t => <NavItem key={t.path} {...t} />)}
        </nav>
      </aside>

      {/* ── MOBILE MENU OVERLAY ─────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="flex flex-col"
            style={{ width: 240, background: '#0D1A18', borderRight: '1px solid #2A332F' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid #2A332F' }}>
              <p className="font-black text-sm uppercase tracking-widest" style={{ color: '#C8A36A' }}>DnD World</p>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X size={20} style={{ color: '#6B6557' }} />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-3">
              {TABS.map(t => <NavItem key={t.path} {...t} />)}
            </nav>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile header */}
        <header
          className="flex md:hidden items-center gap-3 px-4 py-3 sticky top-0 z-30"
          style={{ background: 'rgba(13,26,24,0.95)', borderBottom: '1px solid #2A332F', backdropFilter: 'blur(12px)' }}
        >
          <button onClick={() => setMobileMenuOpen(true)}>
            <Menu size={22} style={{ color: '#C8A36A' }} />
          </button>
          <p className="font-black text-sm uppercase tracking-widest" style={{ color: '#C8A36A' }}>DnD World</p>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route index element={<Navigate to="/chronicles" replace />} />
            <Route path="/chronicles/*" element={<Chronicles />} />
            <Route path="/hero"         element={<HeroTab />} />
            <Route path="/lore"         element={<LoreTab />} />
            <Route path="/campfire"     element={<CampfireTab />} />
            <Route path="*"             element={<Navigate to="/chronicles" replace />} />
          </Routes>
        </main>

        {/* ── MOBILE BOTTOM TAB BAR ───────────────────────────────── */}
        <nav
          className="flex md:hidden justify-around items-center"
          style={{
            height: 64,
            background: 'rgba(13,26,24,0.96)',
            borderTop: '1px solid #5A4424',
            backdropFilter: 'blur(12px)',
          }}
        >
          {TABS.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              style={({ isActive }) => ({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '6px 12px',
                borderRadius: 10,
                color: isActive ? '#F59E0B' : '#6B6557',
                textDecoration: 'none',
              })}
            >
              {({ isActive }) => (
                <>
                  <div style={{
                    padding: 6,
                    borderRadius: 10,
                    background: isActive ? 'rgba(245,158,11,0.12)' : 'transparent',
                  }}>
                    <Icon size={22} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
