import { useEffect, useState } from 'react';
import { Swords, Loader, Edit3, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CharacterSheet from '../components/Hero/CharacterSheet';
import CharacterEditorModal from '../components/Hero/CharacterEditorModal';
import API_URL from '../config';

export default function HeroTab() {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const [myCharacter, setMyCharacter] = useState(null);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState('');

  const fetchAvailable = async () => {
    try {
      const res = await fetch(`${API_URL}/api/characters/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setAvailable(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!socket || !user) return;
    socket.emit('get-players');

    const handlePlayers = (players) => {
      const mine = players.find(p => p.UserId == user.id);
      setMyCharacter(mine || null);
      if (!mine) fetchAvailable();
      setLoading(false);
    };

    const handleStats = (players) => {
      const mine = players.find(p => p.UserId == user.id);
      if (mine) setMyCharacter(mine);
    };

    socket.on('players-data', handlePlayers);
    socket.on('stats-updated', handleStats);
    return () => {
      socket.off('players-data', handlePlayers);
      socket.off('stats-updated', handleStats);
    };
  }, [socket, user]);

  useEffect(() => {
    if (!socket) return;
    const handleError = ({ message } = {}) => {
      setPermissionMessage(message || 'No tenés permiso para realizar ese cambio.');
      window.setTimeout(() => setPermissionMessage(''), 4500);
    };
    socket.on('character:error', handleError);
    return () => socket.off('character:error', handleError);
  }, [socket]);

  const handleAssign = async (characterId) => {
    setAssigning(true);
    try {
      const res = await fetch(`${API_URL}/api/characters/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ characterId }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'No se pudo asignar el personaje');
      }
      // Socket will push updated players list
    } catch {
      alert('Error de conexión');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size={32} className="animate-spin" style={{ color: '#F59E0B' }} />
      </div>
    );
  }

  if (myCharacter) {
    return (
      <div style={{ height: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="min-h-11 px-3 flex items-center justify-between gap-3 border-b border-[#30362f] bg-[#09100e]">
          {myCharacter.self_edit_enabled ? <span className="text-[9px] text-[#75917a]">El DM habilitó la edición de tu ficha. Los cambios quedan registrados.</span> : <span className="flex items-center gap-2 text-[9px] text-[#887f70]"><Lock size={12} />Edición bloqueada por el DM</span>}
          {myCharacter.self_edit_enabled && <button type="button" onClick={() => setEditing(true)} className="h-8 px-3 flex items-center gap-2 border border-[#755e35] bg-[#24190e] text-[8px] font-black uppercase tracking-widest text-[#d5b66d]"><Edit3 size={12} />Editar mi ficha</button>}
        </div>
        {permissionMessage && <div className="px-3 py-2 text-xs text-[#d18a78] bg-[#21120f] border-b border-[#5a3f38]">{permissionMessage}</div>}
        <CharacterSheet character={myCharacter} socket={socket} />
        {editing && <CharacterEditorModal character={myCharacter} socket={socket} onClose={() => setEditing(false)} />}
      </div>
    );
  }

  // Character selection
  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex flex-col items-center py-10">
        <Swords size={48} style={{ color: '#C8A36A' }} />
        <h1 className="text-2xl font-black mt-4" style={{ color: '#C8A36A' }}>
          ELIGE TU HÉROE
        </h1>
        <p className="text-sm text-center mt-2" style={{ color: '#A89F8E' }}>
          Seleccioná un personaje para comenzar la aventura.
        </p>
      </div>

      {available.length === 0 ? (
        <p className="text-center" style={{ color: '#6B6557' }}>
          No hay personajes disponibles. Contactá a tu DM.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {available.map(char => (
            <button
              key={char.id}
              onClick={() => {
                if (window.confirm(`¿Querés elegir a ${char.name}?`)) handleAssign(char.id);
              }}
              disabled={assigning}
              className="panel p-4 flex items-center justify-between text-left disabled:opacity-50 transition-colors hover:border-bronze-light"
              style={{ borderColor: '#2A332F' }}
            >
              <div>
                <p className="font-bold" style={{ color: '#EDE6D8' }}>{char.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B6557' }}>
                  {char.race} {char.class} — Nivel {char.level}
                </p>
              </div>
              <span className="text-xs font-black" style={{ color: '#C8A36A' }}>ELEGIR</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
