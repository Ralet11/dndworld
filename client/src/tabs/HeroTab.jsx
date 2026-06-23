import { useEffect, useState } from 'react';
import { Swords, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CharacterSheet from '../components/Hero/CharacterSheet';
import API_URL from '../config';

export default function HeroTab() {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const [myCharacter, setMyCharacter] = useState(null);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

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
    } catch (e) {
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
        <CharacterSheet character={myCharacter} socket={socket} />
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
