import { useState, useEffect } from 'react';
import { Heart, Shield, Zap, Activity, Edit3, X, Save } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

function HPBar({ hp, maxHp }) {
  const pct = Math.min(100, ((hp || 0) / (maxHp || 1)) * 100);
  const color = pct <= 20 ? '#C2452F' : pct <= 50 ? '#F59E0B' : '#5BA86B';
  return (
    <div className="hp-bar mt-2">
      <div className="hp-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function CharacterCard({ char, onEditHp, onEdit }) {
  const [hpInput, setHpInput] = useState(char.hp || 0);
  const isCritical = (char.hp || 0) <= (char.maxHp || 1) * 0.2;

  return (
    <div
      className="panel p-4 space-y-3 cursor-pointer hover:border-bronze-dark transition-colors"
      style={{ borderColor: isCritical ? '#C2452F44' : '#2A332F' }}
      onClick={() => onEdit(char)}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden" style={{ border: '1px solid #2A332F' }}>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${char.name}`}
              alt={char.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="font-black text-sm" style={{ color: '#EDE6D8' }}>{char.name}</p>
            <p className="label-caps">{char.class} {char.level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="label-caps">Percepción</p>
          <p className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{char.passivePerception || '—'}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[['CA', char.ac, '#3E84D6'],['INIC', char.initiative >= 0 ? `+${char.initiative}` : char.initiative, '#F59E0B'],['VEL', `${char.speed}'`, '#5BA86B']].map(([l, v, c]) => (
          <div key={l} className="text-center p-1.5 rounded-lg" style={{ background: '#0F1518' }}>
            <p className="label-caps">{l}</p>
            <p className="text-sm font-black" style={{ color: c }}>{v ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* HP */}
      <div onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-1">
          <span className="label-caps" style={{ color: isCritical ? '#C2452F' : undefined }}>
            Puntos de golpe
          </span>
          <span className="text-xs font-black" style={{ color: '#EDE6D8' }}>
            {char.hp || 0} / {char.maxHp || 0}
          </span>
        </div>
        <HPBar hp={char.hp} maxHp={char.maxHp} />
        <input
          type="number"
          className="input-base mt-2 text-center text-sm"
          style={{ height: 32 }}
          defaultValue={char.hp || 0}
          onBlur={e => onEditHp(char.id, e.target.value)}
        />
      </div>
    </div>
  );
}

function EditModal({ char, onClose, socket }) {
  const [hp, setHp] = useState(char.hp || 0);
  const [maxHp, setMaxHp] = useState(char.maxHp || char.hp_max || 0);
  const [xp, setXp] = useState(char.xp || 0);
  const [inspiration, setInspiration] = useState(char.inspiration || 0);

  const handleSave = () => {
    socket.emit('update-character-quick', { characterId: char.id, hp: parseInt(hp), xp: parseInt(xp), inspiration: parseInt(inspiration) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="panel-raised w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lg" style={{ color: '#EDE6D8' }}>{char.name}</h2>
          <button onClick={onClose} style={{ color: '#6B6557' }}><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[['HP actual', hp, setHp],['HP máximo', maxHp, setMaxHp],['XP', xp, setXp],['Inspiración', inspiration, setInspiration]].map(([label, val, setter]) => (
            <div key={label}>
              <p className="label-caps mb-1">{label}</p>
              <input type="number" className="input-base"
                value={val} onChange={e => setter(e.target.value)} />
            </div>
          ))}
        </div>

        <button onClick={handleSave}
          className="w-full h-11 rounded-lg font-black flex items-center justify-center gap-2"
          style={{ background: '#FF7A1A', color: '#1A0E04' }}>
          <Save size={16} /> Guardar
        </button>
      </div>
    </div>
  );
}

export default function PartyPanel() {
  const { socket } = useSocket();
  const [players, setPlayers] = useState([]);
  const [editingChar, setEditingChar] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-all-players');

    const handler = (data) => { setPlayers(data); setLoading(false); };
    socket.on('all-players', handler);
    socket.on('players-data', handler);
    socket.on('stats-updated', handler);
    return () => {
      socket.off('all-players', handler);
      socket.off('players-data', handler);
      socket.off('stats-updated', handler);
    };
  }, [socket]);

  const updateHp = (characterId, newHp) => {
    socket.emit('update-hp', { characterId, newHp: parseInt(newHp) });
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="label-caps">Gestión del grupo</p>
        <h1 className="text-3xl font-black mt-1" style={{ color: '#EDE6D8' }}>Party</h1>
      </div>

      {/* Connected indicator */}
      <div className="flex items-center gap-2 mb-6 panel p-3 w-fit">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        <span className="label-caps" style={{ color: '#5BA86B' }}>{players.length} héroe{players.length !== 1 ? 's' : ''} sincronizados</span>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-purple-400 rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {players.map(char => (
          <CharacterCard
            key={char.id}
            char={char}
            onEditHp={updateHp}
            onEdit={setEditingChar}
          />
        ))}
      </div>

      {editingChar && (
        <EditModal
          char={editingChar}
          onClose={() => setEditingChar(null)}
          socket={socket}
        />
      )}
    </div>
  );
}
