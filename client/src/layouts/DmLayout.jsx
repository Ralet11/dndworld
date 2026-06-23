import { useState } from 'react';
import { Users, Scroll, Package, BookMarked, Skull, Image as ImageIcon, Map as MapIcon, Crown, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PartyPanel from '../dm/PartyPanel';
import ScenesPanel from '../dm/ScenesPanel';
import ItemsPanel from '../dm/ItemsPanel';
import QuestsPanel from '../dm/QuestsPanel';
import NpcsPanel from '../dm/NpcsPanel';
import MediaPanel from '../dm/MediaPanel';

const TOOLS = [
  { id: 'party',   label: 'Party',    Icon: Users,     desc: 'Estado del grupo' },
  { id: 'scenes',  label: 'Escenas',  Icon: Scroll,    desc: 'Crónicas y viñetas' },
  { id: 'items',   label: 'Items',    Icon: Package,   desc: 'Tesoros y equipo' },
  { id: 'quests',  label: 'Misiones', Icon: BookMarked,desc: 'Gestión de misiones' },
  { id: 'npcs',    label: 'NPCs',     Icon: Skull,     desc: 'Personajes no jugadores' },
  { id: 'media',   label: 'Media',    Icon: ImageIcon, desc: 'Compartir imágenes' },
];

const PANELS = {
  party:   PartyPanel,
  scenes:  ScenesPanel,
  items:   ItemsPanel,
  quests:  QuestsPanel,
  npcs:    NpcsPanel,
  media:   MediaPanel,
};

export default function DmLayout() {
  const { user, logout } = useAuth();
  const [active, setActive] = useState('party');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const ActivePanel = PANELS[active];

  return (
    <div className="flex h-screen" style={{ background: '#0F1518' }}>
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ background: '#16211F', borderRight: '1px solid #2A332F' }}>

        {/* DM Header */}
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid #2A332F' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(155,93,229,0.2)', border: '1px solid rgba(155,93,229,0.4)' }}>
            <Crown size={18} style={{ color: '#9B5DE5' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm truncate" style={{ color: '#EDE6D8' }}>{user?.username}</p>
            <p className="label-caps" style={{ color: '#9B5DE5' }}>Dungeon Master</p>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)} style={{ color: '#6B6557' }}>
            <X size={18} />
          </button>
        </div>

        {/* Nav tools */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {TOOLS.map(({ id, label, Icon, desc }) => (
            <button
              key={id}
              onClick={() => { setActive(id); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
              style={active === id
                ? { background: 'rgba(155,93,229,0.15)', border: '1px solid rgba(155,93,229,0.3)' }
                : { border: '1px solid transparent' }}
            >
              <Icon size={18}
                style={{ color: active === id ? '#9B5DE5' : '#6B6557' }} />
              <div className="min-w-0">
                <p className="text-sm font-bold"
                  style={{ color: active === id ? '#EDE6D8' : '#A89F8E' }}>{label}</p>
                <p className="text-[10px]" style={{ color: '#6B6557' }}>{desc}</p>
              </div>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3" style={{ borderTop: '1px solid #2A332F' }}>
          <button
            onClick={() => { if (window.confirm('¿Salir del panel maestro?')) logout(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
            style={{ border: '1px solid transparent', color: '#C2452F' }}
          >
            <LogOut size={18} />
            <span className="text-sm font-bold">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 p-4"
          style={{ borderBottom: '1px solid #2A332F', background: '#16211F' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: '#A89F8E' }}>
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Crown size={16} style={{ color: '#9B5DE5' }} />
            <span className="font-black" style={{ color: '#EDE6D8' }}>
              {TOOLS.find(t => t.id === active)?.label}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="label-caps" style={{ color: '#5BA86B' }}>Online</span>
          </div>
        </div>

        {/* Panel */}
        <div className="flex-1 overflow-y-auto">
          <ActivePanel />
        </div>
      </div>
    </div>
  );
}
