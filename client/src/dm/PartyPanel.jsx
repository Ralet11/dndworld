import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import CharacterEditorModal from '../components/Hero/CharacterEditorModal';

function HPBar({ hp, maxHp }) {
  const pct = Math.min(100, ((hp || 0) / (maxHp || 1)) * 100);
  const color = pct <= 20 ? '#C2452F' : pct <= 50 ? '#F59E0B' : '#5BA86B';
  return <div className="hp-bar mt-2"><div className="hp-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>;
}

function CharacterCard({ char, onEditHp, onEdit, onTogglePermission }) {
  const isCritical = (char.hp || 0) <= (char.maxHp || 1) * 0.2;
  return (
    <div className="panel p-4 space-y-3 cursor-pointer hover:border-bronze-dark transition-colors" style={{ borderColor: isCritical ? '#C2452F44' : '#2A332F' }} onClick={() => onEdit(char.id)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden" style={{ border: '1px solid #2A332F' }}>
            <img src={char.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${char.name}`} alt={char.name} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0"><p className="font-black text-sm truncate" style={{ color: '#EDE6D8' }}>{char.name}</p><p className="label-caps truncate">{char.race} · {char.class} {char.level}</p></div>
        </div>
        <div className="text-right shrink-0"><p className="label-caps">Percepción</p><p className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{char.passivePerception || '—'}</p></div>
      </div>

      <button
        type="button"
        onClick={event => { event.stopPropagation(); onTogglePermission(char); }}
        className="w-full min-h-9 px-3 flex items-center justify-between gap-2 border text-[8px] font-black uppercase tracking-wider"
        style={{ borderColor: char.self_edit_enabled ? '#416e4b' : '#5a3f38', color: char.self_edit_enabled ? '#71ad7b' : '#b97868', background: char.self_edit_enabled ? '#102017' : '#21120f' }}
      >
        <span className="flex items-center gap-2">{char.self_edit_enabled ? <Unlock size={13} /> : <Lock size={13} />}{char.self_edit_enabled ? 'Jugador puede editar' : 'Edición bloqueada'}</span>
        <span>Cambiar</span>
      </button>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['CA', char.ac, '#3E84D6'],
          ['INIC', char.initiative >= 0 ? `+${char.initiative}` : char.initiative, '#F59E0B'],
          ['VEL', `${char.speed}'`, '#5BA86B'],
        ].map(([label, value, color]) => <div key={label} className="text-center p-1.5 rounded-lg" style={{ background: '#0F1518' }}><p className="label-caps">{label}</p><p className="text-sm font-black" style={{ color }}>{value ?? '—'}</p></div>)}
      </div>

      <div onClick={event => event.stopPropagation()}>
        <div className="flex justify-between mb-1"><span className="label-caps" style={{ color: isCritical ? '#C2452F' : undefined }}>Puntos de golpe</span><span className="text-xs font-black" style={{ color: '#EDE6D8' }}>{char.hp || 0} / {char.maxHp || 0}</span></div>
        <HPBar hp={char.hp} maxHp={char.maxHp} />
        <input key={`${char.id}-${char.hp}`} type="number" aria-label={`Vida actual de ${char.name}`} className="input-base mt-2 text-center text-sm" style={{ height: 32 }} defaultValue={char.hp ?? 0} onBlur={event => onEditHp(char.id, event.target.value)} />
      </div>
    </div>
  );
}

export default function PartyPanel() {
  const { socket } = useSocket();
  const [players, setPlayers] = useState([]);
  const [editingCharId, setEditingCharId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const editingChar = players.find(character => character.id === editingCharId);

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-all-players');
    const handler = data => { setPlayers(data); setLoading(false); };
    socket.on('all-players', handler);
    socket.on('players-data', handler);
    socket.on('stats-updated', handler);
    return () => { socket.off('all-players', handler); socket.off('players-data', handler); socket.off('stats-updated', handler); };
  }, [socket]);

  const updateHp = (characterId, newHp) => socket.emit('update-hp', { characterId, newHp: Number(newHp) });
  const togglePermission = character => {
    setMessage('');
    socket.emit('character:set-self-edit', { characterId: character.id, enabled: !character.self_edit_enabled }, response => {
      setMessage(response?.ok ? `Permiso actualizado para ${character.name}.` : response?.message || 'No se pudo cambiar el permiso.');
    });
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="mb-5"><p className="label-caps">Gestión del grupo</p><h1 className="text-3xl font-black mt-1" style={{ color: '#EDE6D8' }}>Party</h1><p className="mt-2 text-xs text-[#777e77]">Abrí una ficha para editarla completa. El permiso de cada tarjeta controla si ese jugador puede modificar la suya.</p></div>
      <div className="flex items-center gap-3 mb-6"><div className="flex items-center gap-2 panel p-3 w-fit"><div className="w-2 h-2 rounded-full bg-success animate-pulse" /><span className="label-caps" style={{ color: '#5BA86B' }}>{players.length} héroe{players.length !== 1 ? 's' : ''} sincronizados</span></div>{message && <span className="text-xs text-[#aaa294]">{message}</span>}</div>
      {loading && <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-purple-400 rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} /></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{players.map(char => <CharacterCard key={char.id} char={char} onEditHp={updateHp} onEdit={setEditingCharId} onTogglePermission={togglePermission} />)}</div>
      {editingChar && <CharacterEditorModal character={editingChar} socket={socket} isDm onClose={() => setEditingCharId(null)} />}
    </div>
  );
}
