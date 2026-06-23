import { useState, useEffect } from 'react';
import { Plus, Skull, X, Search } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function NpcsPanel() {
  const { socket } = useSocket();
  const [npcs, setNpcs] = useState([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', race: 'Monstruo', class: 'NPC', hp_max: 10, ac_base: 10, npc_type: 'enemy' });

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-all-npcs');
    const handler = (data) => { setNpcs(data); setLoading(false); };
    socket.on('all-npcs', handler);
    return () => socket.off('all-npcs', handler);
  }, [socket]);

  const handleCreate = () => {
    if (!form.name.trim()) return;
    socket.emit('create-npc', form);
    setForm({ name: '', race: 'Monstruo', class: 'NPC', hp_max: 10, ac_base: 10, npc_type: 'enemy' });
    setShowCreate(false);
    setTimeout(() => socket.emit('get-all-npcs'), 500);
  };

  const handleActivate = (npcId) => {
    socket.emit('activate-npc', { npcId });
  };

  const filtered = npcs.filter(n => n.name?.toLowerCase().includes(search.toLowerCase()));

  const npcTypeColor = {
    enemy:  '#C2452F',
    ally:   '#5BA86B',
    neutral:'#A89F8E',
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="label-caps">Herramienta DM</p>
          <h1 className="text-3xl font-black mt-1" style={{ color: '#EDE6D8' }}>NPCs & Criaturas</h1>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm glow-ember"
          style={{ background: '#FF7A1A', color: '#1A0E04' }}>
          <Plus size={18} /> Nuevo NPC
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6B6557' }} />
        <input className="input-base pl-9" placeholder="Buscar NPC..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-amber rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(npc => (
          <div key={npc.id} className="panel p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0"
                style={{ border: `1px solid ${npcTypeColor[npc.npc_type] || '#2A332F'}40` }}>
                <img src={npc.image_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${npc.name}`}
                  alt={npc.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: '#EDE6D8' }}>{npc.name}</p>
                <p className="label-caps" style={{ color: npcTypeColor[npc.npc_type] || '#6B6557' }}>
                  {npc.race} — {npc.npc_type || 'NPC'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[['PG', npc.hp_max],['CA', npc.ac_base],['Nivel', npc.level || '?']].map(([l, v]) => (
                <div key={l} className="text-center p-1.5 rounded-lg" style={{ background: '#0F1518' }}>
                  <p className="label-caps">{l}</p>
                  <p className="font-black text-sm" style={{ color: '#EDE6D8' }}>{v}</p>
                </div>
              ))}
            </div>

            <button onClick={() => handleActivate(npc.id)}
              className="w-full py-1.5 rounded-lg label-caps transition-colors"
              style={{ background: 'rgba(155,93,229,0.1)', border: '1px solid rgba(155,93,229,0.3)', color: '#9B5DE5' }}>
              Añadir a escena
            </button>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center py-16 gap-3" style={{ color: '#6B6557' }}>
            <Skull size={32} />
            <p>{search ? 'Sin resultados.' : 'No hay NPCs creados.'}</p>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowCreate(false)}>
          <div className="panel-raised w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg" style={{ color: '#EDE6D8' }}>Nuevo NPC</h2>
              <button onClick={() => setShowCreate(false)} style={{ color: '#6B6557' }}><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="label-caps mb-1">Nombre</p>
                <input className="input-base" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del NPC" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="label-caps mb-1">Raza / Tipo</p>
                  <input className="input-base" value={form.race} onChange={e => setForm(f => ({ ...f, race: e.target.value }))} />
                </div>
                <div>
                  <p className="label-caps mb-1">Rol</p>
                  <select className="input-base" value={form.npc_type} onChange={e => setForm(f => ({ ...f, npc_type: e.target.value }))}>
                    <option value="enemy">Enemigo</option>
                    <option value="ally">Aliado</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="label-caps mb-1">PG Máximo</p>
                  <input type="number" className="input-base" value={form.hp_max} onChange={e => setForm(f => ({ ...f, hp_max: parseInt(e.target.value) || 1 }))} />
                </div>
                <div>
                  <p className="label-caps mb-1">Clase de Armadura</p>
                  <input type="number" className="input-base" value={form.ac_base} onChange={e => setForm(f => ({ ...f, ac_base: parseInt(e.target.value) || 10 }))} />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold"
                style={{ background: '#1E2A28', color: '#A89F8E', border: '1px solid #2A332F' }}>
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={!form.name.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-black disabled:opacity-50"
                style={{ background: '#FF7A1A', color: '#1A0E04' }}>
                Crear NPC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
