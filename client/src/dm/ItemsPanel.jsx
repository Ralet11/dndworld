import { useState, useEffect } from 'react';
import { Package, Search, Dices, X } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const RARITY_COLOR = {
  'Común': '#9AA0A6', 'Poco Común': '#4FA85E', 'Raro': '#3E84D6',
  'Muy Raro': '#9B5DE5', 'Legendario': '#F59E0B',
};

const TYPE_FILTERS = [
  { id: 'all',       label: 'Todo' },
  { id: 'combate',   label: 'Combate' },
  { id: 'magico',    label: 'Mágico' },
  { id: 'consumible',label: 'Consumibles' },
  { id: 'otros',     label: 'Otros' },
];

function matchFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'combate') return ['Arma', 'Armadura'].includes(item.type);
  if (filter === 'magico') return ['Artefacto', 'Objeto Mágico', 'Varita', 'Pergamino'].includes(item.type);
  if (filter === 'consumible') return item.type === 'Consumible';
  return !['Arma', 'Armadura', 'Consumible', 'Artefacto', 'Objeto Mágico', 'Varita', 'Pergamino'].includes(item.type);
}

export default function ItemsPanel() {
  const { socket } = useSocket();
  const [items, setItems] = useState([]);
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [randomLevel, setRandomLevel] = useState(1);
  const [randomResult, setRandomResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-all-items');
    socket.emit('get-all-players');

    const handleItems = (data) => { setItems(data); setLoading(false); };
    const handlePlayers = (data) => setPlayers(data);

    socket.on('all-items', handleItems);
    socket.on('all-players', handlePlayers);
    return () => {
      socket.off('all-items', handleItems);
      socket.off('all-players', handlePlayers);
    };
  }, [socket]);

  const handleRandom = () => {
    const candidates = items.filter(i => (i.level || 1) === randomLevel);
    if (candidates.length === 0) {
      setRandomResult({ type: 'empty' });
      return;
    }
    setRandomResult({ type: 'item', data: candidates[Math.floor(Math.random() * candidates.length)] });
  };

  const handleAssign = (itemId, characterId) => {
    socket.emit('assign-item', { characterId, itemId });
    setRandomResult(null);
    setSelected(null);
  };

  const filtered = items
    .filter(i => i.name?.toLowerCase().includes(search.toLowerCase()))
    .filter(i => matchFilter(i, filter));

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="label-caps">Herramienta DM</p>
        <h1 className="text-3xl font-black mt-1" style={{ color: '#EDE6D8' }}>Items & Tesoros</h1>
        <p className="text-sm mt-1" style={{ color: '#A89F8E' }}>{items.length} items en el compendio</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6B6557' }} />
          <input className="input-base pl-9" placeholder="Buscar item..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Random generator */}
        <div className="flex items-center gap-2 panel px-3 py-2">
          <span className="label-caps">Nivel</span>
          <input type="number" min={1} max={20} value={randomLevel}
            onChange={e => setRandomLevel(parseInt(e.target.value) || 1)}
            className="w-14 text-center text-sm font-bold bg-transparent outline-none"
            style={{ color: '#EDE6D8', borderBottom: '1px solid #2A332F' }} />
          <button onClick={handleRandom}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
            <Dices size={16} />
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 mb-4">
        {TYPE_FILTERS.map(({ id, label }) => (
          <button key={id} onClick={() => setFilter(id)}
            className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all"
            style={filter === id
              ? { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }
              : { color: '#6B6557', border: '1px solid #2A332F', background: '#16211F' }}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-amber rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Items grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(item => {
          const rc = RARITY_COLOR[item.rarity] || '#9AA0A6';
          return (
            <button key={item.id} onClick={() => setSelected(item)}
              className="panel p-4 text-left hover:border-bronze-dark transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: rc + '20', border: `1px solid ${rc}40` }}>
                  <Package size={18} style={{ color: rc }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: '#EDE6D8' }}>{item.name}</p>
                  <p className="text-xs" style={{ color: rc }}>{item.rarity} · {item.type}</p>
                </div>
                {item.level && (
                  <span className="label-caps shrink-0">Nv.{item.level}</span>
                )}
              </div>
              {item.description && (
                <p className="text-xs mt-2 line-clamp-2 italic" style={{ color: '#A89F8E' }}>{item.description}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Random result modal */}
      {randomResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setRandomResult(null)}>
          <div className="panel-raised w-full max-w-sm p-6 space-y-4 text-center" onClick={e => e.stopPropagation()}>
            <button className="absolute top-3 right-3" onClick={() => setRandomResult(null)} style={{ color: '#6B6557' }}><X size={16} /></button>

            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Dices size={28} style={{ color: '#F59E0B' }} className="animate-bounce" />
            </div>

            {randomResult.type === 'empty' ? (
              <p style={{ color: '#6B6557' }}>No hay items de nivel {randomLevel}.</p>
            ) : (
              <>
                <p className="label-caps" style={{ color: '#C8A36A' }}>Item nivel {randomLevel}</p>
                <p className="font-black text-xl" style={{ color: '#EDE6D8' }}>{randomResult.data.name}</p>
                <p className="text-xs italic" style={{ color: '#A89F8E' }}>"{randomResult.data.description}"</p>
                <div>
                  <p className="label-caps mb-2">Asignar a</p>
                  <select
                    className="input-base"
                    onChange={e => { if (e.target.value) handleAssign(randomResult.data.id, e.target.value); }}
                  >
                    <option value="">-- Seleccionar jugador --</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Item detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelected(null)}>
          <div className="panel-raised w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <span className="label-caps" style={{ color: RARITY_COLOR[selected.rarity] || '#9AA0A6' }}>
                  {selected.rarity}
                </span>
                <h2 className="font-black text-xl mt-1" style={{ color: '#EDE6D8' }}>{selected.name}</h2>
                <p className="label-caps mt-0.5">{selected.type}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ color: '#6B6557' }}><X size={18} /></button>
            </div>
            {selected.description && (
              <p className="text-sm italic" style={{ color: '#A89F8E', borderLeft: '2px solid #2A332F', paddingLeft: 12 }}>
                "{selected.description}"
              </p>
            )}
            <div>
              <p className="label-caps mb-2">Asignar a</p>
              <select className="input-base"
                onChange={e => { if (e.target.value) handleAssign(selected.id, e.target.value); }}>
                <option value="">-- Seleccionar jugador --</option>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
