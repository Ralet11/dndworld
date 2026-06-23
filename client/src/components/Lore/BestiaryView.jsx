import { useState, useEffect } from 'react';
import { ArrowLeft, Search, ChevronRight, X } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

export default function BestiaryView({ onBack }) {
  const { socket } = useSocket();
  const [creatures, setCreatures] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-all-npcs');
    const handler = (data) => { setCreatures(data); setLoading(false); };
    socket.on('all-npcs', handler);
    return () => socket.off('all-npcs', handler);
  }, [socket]);

  const filtered = creatures.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: '#0F1518' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 p-4" style={{ background: 'rgba(15,21,24,0.96)', borderBottom: '1px solid #2A332F', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#1E2A28', border: '1px solid #2A332F', color: '#EDE6D8' }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-black" style={{ color: '#EDE6D8' }}>Glosario</h1>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6B6557' }} />
          <input
            className="input-base pl-9"
            placeholder="Buscar criatura o NPC..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-amber rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-center py-10" style={{ color: '#6B6557' }}>
            {search ? 'No se encontraron resultados.' : 'El glosario está vacío.'}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {filtered.map(creature => (
            <button key={creature.id} onClick={() => setSelected(creature)}
              className="panel p-3 flex items-center gap-3 w-full text-left hover:border-bronze-dark transition-colors">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0"
                style={{ border: '1px solid #2A332F', background: '#1E2A28' }}>
                <img
                  src={creature.image_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${creature.name}`}
                  alt={creature.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate" style={{ color: '#EDE6D8' }}>{creature.name}</p>
                <p className="text-xs" style={{ color: '#6B6557' }}>
                  {creature.race} — {creature.class} · PG {creature.hp_max}
                </p>
              </div>
              <ChevronRight size={16} style={{ color: '#6B6557' }} />
            </button>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelected(null)}>
          <div className="panel-raised w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full overflow-hidden" style={{ border: '2px solid #8A6A3B' }}>
                  <img src={selected.image_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${selected.name}`}
                    alt={selected.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="font-black text-lg" style={{ color: '#EDE6D8' }}>{selected.name}</h2>
                  <p className="text-xs" style={{ color: '#A89F8E' }}>{selected.race} — {selected.class}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ color: '#6B6557' }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[['PG', selected.hp_max],['CA', selected.ac_base],['Nivel', selected.level]].map(([l, v]) => (
                <div key={l} className="panel p-2 text-center">
                  <p className="label-caps">{l}</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: '#EDE6D8' }}>{v || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
