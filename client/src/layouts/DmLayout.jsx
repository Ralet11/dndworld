import { createElement, lazy, Suspense, useState } from 'react';
import { BookMarked, Compass, Image as ImageIcon, LogOut, Map, Menu, Package, Scroll, Skull, Sparkles, Swords, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import PartyPanel from '../dm/PartyPanel';
import ScenesPanel from '../dm/ScenesPanel';
import ItemsPanel from '../dm/ItemsPanel';
import QuestsPanel from '../dm/QuestsPanel';
import NpcsPanel from '../dm/NpcsPanel';
import MediaPanel from '../dm/MediaPanel';
import AssistantPanel from '../dm/AssistantPanel';
import GameMasterPanel from '../dm/GameMasterPanel';

const MapView = lazy(() => import('../components/Lore/MapView'));

const TOOLS = [
  { id: 'game', label: 'Mesa', Icon: Swords, subtitle: 'Sesión de juego en vivo' },
  { id: 'assistant', label: 'Oracle IA', Icon: Sparkles, subtitle: 'Copiloto privado del director', oracle: true },
  { id: 'atlas', label: 'Atlas', Icon: Map, subtitle: 'Cartografía del mundo' },
  { id: 'party', label: 'Grupo', Icon: Users, subtitle: 'Estado de los aventureros' },
  { id: 'scenes', label: 'Escenas', Icon: Scroll, subtitle: 'Crónicas y narrativa' },
  { id: 'items', label: 'Objetos', Icon: Package, subtitle: 'Tesoros y equipo' },
  { id: 'quests', label: 'Misiones', Icon: BookMarked, subtitle: 'Objetivos de la campaña' },
  { id: 'npcs', label: 'Personajes', Icon: Skull, subtitle: 'NPC y criaturas' },
  { id: 'media', label: 'Media', Icon: ImageIcon, subtitle: 'Imágenes compartidas' },
];

const PANELS = {
  game: GameMasterPanel,
  assistant: AssistantPanel,
  atlas: AtlasPanel,
  party: PartyPanel,
  scenes: ScenesPanel,
  items: ItemsPanel,
  quests: QuestsPanel,
  npcs: NpcsPanel,
  media: MediaPanel,
};

function AtlasPanel() {
  return (
    <div className="h-full min-h-[640px]">
      <Suspense fallback={<div className="h-full grid place-items-center label-caps text-[#c2a269]">Cargando Atlas...</div>}>
        <MapView />
      </Suspense>
    </div>
  );
}

export default function DmLayout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const [active, setActive] = useState('game');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const ActivePanel = PANELS[active];
  const activeTool = TOOLS.find(tool => tool.id === active) || TOOLS[0];

  const chooseTool = id => {
    setActive(id);
    setSidebarOpen(false);
  };

  const confirmLogout = () => {
    if (window.confirm('¿Salir del panel del director?')) logout();
  };

  return (
    <div className="app-frame">
      <aside className="app-rail hidden md:flex">
        <div className="app-brand" title="DnD World">
          <div className="app-brand-mark"><Compass size={28} strokeWidth={1.15} /></div>
        </div>
        <nav className="app-rail-nav">
          {TOOLS.map(({ id, label, Icon, oracle }) => (
            <button key={id} onClick={() => chooseTool(id)} className={`app-nav-item${active === id ? ' is-active' : ''}${oracle ? ' is-oracle' : ''}`}>
              {createElement(Icon, { size: 20, strokeWidth: 1.45 })}<span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="app-rail-footer">
          <button className="app-nav-item !min-h-11 text-[#7f5049]" onClick={confirmLogout} title="Cerrar sesión">
            <LogOut size={18} strokeWidth={1.5} /><span>Salir</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}>
          <div className="w-64 flex flex-col border-r border-[#493a22] bg-[#080e0d]" onClick={event => event.stopPropagation()}>
            <div className="h-16 px-4 flex items-center justify-between border-b border-[#493a22]/60">
              <div><strong className="block font-serif text-sm text-[#d7caae]">Sala del director</strong><span className="text-[9px] text-[#777269]">{user?.username}</span></div>
              <button onClick={() => setSidebarOpen(false)}><X size={18} /></button>
            </div>
            <nav className="p-3 grid grid-cols-2 gap-2 overflow-y-auto">
              {TOOLS.map(({ id, label, Icon, oracle }) => (
                <button key={id} onClick={() => chooseTool(id)} className={`app-nav-item !min-h-20 ${active === id ? 'is-active' : ''} ${oracle ? 'is-oracle' : ''}`}>
                  {createElement(Icon, { size: 20 })}<span>{label}</span>
                </button>
              ))}
            </nav>
            <button onClick={confirmLogout} className="m-3 mt-auto p-3 flex items-center justify-center gap-2 border border-[#733126]/50 text-xs text-[#b55a4e]">
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <div className="app-column">
        {active !== 'game' && (
          <header className="app-topbar">
            <div className="app-topbar-block"><strong>DnD World</strong><span>Campaña actual</span></div>
            <div className="app-topbar-block"><strong>{activeTool.label}</strong><span>{activeTool.subtitle}</span></div>
            <div className="app-live-state"><i className={`app-live-dot${connected ? '' : ' is-offline'}`} />{connected ? 'Sincronizado' : 'Sin conexión'}</div>
            <div className="app-topbar-user">
              <div><strong>{user?.username || 'Director'}</strong><span>Dungeon Master</span></div>
              <div className="app-user-medallion">{(user?.username || 'D').slice(0, 1).toUpperCase()}</div>
            </div>
          </header>
        )}

        <header className="app-mobile-bar">
          <button onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <strong>{activeTool.label}</strong>
          <i className={`app-live-dot ml-auto${connected ? '' : ' is-offline'}`} />
        </header>

        <main className={`app-page dm-surface dm-surface-${active}`}><ActivePanel /></main>
      </div>
    </div>
  );
}
