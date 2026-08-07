import { createElement, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BookMarked, Compass, Flame, Map, Menu, Scroll, Shield, Swords, X } from 'lucide-react';
import Chronicles from '../tabs/Chronicles';
import HeroTab from '../tabs/HeroTab';
import LoreTab from '../tabs/LoreTab';
import CampfireTab from '../tabs/CampfireTab';
import NotificationBanner from '../components/UI/NotificationBanner';
import GamePlayerPanel from '../components/Game/GamePlayerPanel';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

const MOBILE_TABS = [
  { path: '/game', label: 'Mesa', Icon: Swords },
  { path: '/chronicles', label: 'Crónicas', Icon: Scroll },
  { path: '/hero', label: 'Mi héroe', Icon: Shield },
  { path: '/lore', label: 'Lore', Icon: Compass },
  { path: '/campfire', label: 'Fogata', Icon: Flame },
];

const DESKTOP_TABS = [
  { path: '/game', label: 'Mesa', Icon: Swords },
  { path: '/chronicles', label: 'Crónicas', Icon: Scroll },
  { path: '/hero', label: 'Mi héroe', Icon: Shield },
  { path: '/lore/map', label: 'Atlas', Icon: Map },
  { path: '/lore/glossary', label: 'Glosario', Icon: BookMarked },
  { path: '/lore/quests', label: 'Misiones', Icon: Scroll },
  { path: '/campfire', label: 'Fogata', Icon: Flame },
];

function RailLink({ path, label, Icon, onClick }) {
  return (
    <NavLink to={path} onClick={onClick} className={({ isActive }) => `app-nav-item${isActive ? ' is-active' : ''}`}>
      {createElement(Icon, { size: 20, strokeWidth: 1.45 })}
      <span>{label}</span>
    </NavLink>
  );
}

function currentSection(pathname) {
  if (pathname.startsWith('/game')) return ['Mesa', 'Sesión en vivo'];
  if (pathname.startsWith('/hero')) return ['Mi héroe', 'Ficha de personaje'];
  if (pathname.startsWith('/lore/map')) return ['Atlas', 'Cartografía del mundo'];
  if (pathname.startsWith('/lore/glossary')) return ['Glosario', 'Personas y criaturas'];
  if (pathname.startsWith('/lore/quests')) return ['Misiones', 'Diario del aventurero'];
  if (pathname.startsWith('/campfire')) return ['Fogata', 'Conversaciones del grupo'];
  return ['Crónicas', 'Escenas de la campaña'];
}

export default function PlayerLayout() {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const location = useLocation();
  const [notification, setNotification] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [section, subtitle] = currentSection(location.pathname);

  useEffect(() => {
    if (!socket) return undefined;
    const handler = data => {
      setNotification(data);
      setTimeout(() => setNotification(null), 5000);
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket]);

  return (
    <div className="app-frame">
      {notification && <NotificationBanner data={notification} onClose={() => setNotification(null)} />}

      <aside className="app-rail hidden md:flex">
        <div className="app-brand" title="DnD World">
          <div className="app-brand-mark"><Compass size={28} strokeWidth={1.15} /></div>
        </div>
        <nav className="app-rail-nav">
          {DESKTOP_TABS.map(tab => <RailLink key={tab.path} {...tab} />)}
        </nav>
        <div className="app-rail-footer">
          <div className="app-user-medallion" title={user?.username || 'Aventurero'}>
            {(user?.username || 'A').slice(0, 1).toUpperCase()}
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-60 flex flex-col border-r border-[#493a22] bg-[#080e0d]" onClick={event => event.stopPropagation()}>
            <div className="h-16 px-4 flex items-center justify-between border-b border-[#493a22]/60">
              <span className="font-serif text-sm text-[#c7a35c]">DND WORLD</span>
              <button onClick={() => setMobileMenuOpen(false)}><X size={18} /></button>
            </div>
            <nav className="p-3 grid gap-1">
              {MOBILE_TABS.map(({ path, label, Icon }) => (
                <NavLink key={path} to={path} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-3 py-3 border ${isActive ? 'border-[#806636]/60 text-[#c7a35c] bg-[#c7a35c]/5' : 'border-transparent text-[#777b74]'}`}>
                  {createElement(Icon, { size: 18 })}<span className="text-xs font-serif uppercase tracking-wider">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="app-column">
        <header className="app-topbar">
          <div className="app-topbar-block"><strong>DnD World</strong><span>Campaña actual</span></div>
          <div className="app-topbar-block"><strong>{section}</strong><span>{subtitle}</span></div>
          <div className="app-live-state"><i className={`app-live-dot${connected ? '' : ' is-offline'}`} />{connected ? 'Sincronizado' : 'Sin conexión'}</div>
          <div className="app-topbar-user">
            <div><strong>{user?.username || 'Aventurero'}</strong><span>Jugador</span></div>
            <div className="app-user-medallion">{(user?.username || 'A').slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <header className="app-mobile-bar">
          <button onClick={() => setMobileMenuOpen(true)}><Menu size={20} /></button>
          <strong>{section}</strong>
          <i className={`app-live-dot ml-auto${connected ? '' : ' is-offline'}`} />
        </header>

        <main className="app-page">
          <Routes>
            <Route index element={<Navigate to="/chronicles" replace />} />
            <Route path="/game" element={<GamePlayerPanel />} />
            <Route path="/chronicles/*" element={<Chronicles />} />
            <Route path="/hero" element={<HeroTab />} />
            <Route path="/lore/*" element={<LoreTab />} />
            <Route path="/campfire" element={<CampfireTab />} />
            <Route path="*" element={<Navigate to="/chronicles" replace />} />
          </Routes>
        </main>

        <nav className="flex md:hidden justify-around items-center h-16 border-t border-[#493a22]/70 bg-[#080e0d]/95 backdrop-blur-xl">
          {MOBILE_TABS.map(({ path, label, Icon }) => (
            <NavLink key={path} to={path} className={({ isActive }) => `min-w-16 py-2 flex flex-col items-center gap-1 ${isActive ? 'text-[#c7a35c]' : 'text-[#656b65]'}`}>
              {createElement(Icon, { size: 19, strokeWidth: 1.5 })}<span className="text-[8px] font-serif uppercase tracking-wider">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
