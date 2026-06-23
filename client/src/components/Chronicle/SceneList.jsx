import { useState, useEffect } from 'react';
import { Scroll, Plus, Sun, Moon, Settings, ChevronRight, CheckCircle2, CircleDashed, Crown } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import CreateSceneModal from './CreateSceneModal';

export default function SceneList({ onSelectScene }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const isDm = user?.role === 'DM' || user?.role === 'ADMIN';

  const [scenes, setScenes] = useState([]);
  const [filter, setFilter] = useState('ACTIVE');
  const [globalTime, setGlobalTime] = useState('12:00');
  const [globalLocation, setGlobalLocation] = useState('...');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const isDay = () => {
    try { return parseInt(globalTime.split(':')[0], 10) >= 6 && parseInt(globalTime.split(':')[0], 10) < 19; }
    catch { return true; }
  };

  useEffect(() => {
    if (!socket) return;

    socket.emit('get-scenes');
    socket.emit('get-global-state');

    const handleScenes = (data) => { setScenes(data); setLoading(false); };
    const handleGlobal = (s) => {
      if (s?.global_time) setGlobalTime(s.global_time);
      if (s?.global_location) setGlobalLocation(s.global_location);
    };

    socket.on('scenes-data', handleScenes);
    socket.on('global-state-data', handleGlobal);
    return () => {
      socket.off('scenes-data', handleScenes);
      socket.off('global-state-data', handleGlobal);
    };
  }, [socket]);

  const filtered = scenes.filter(s => s.status === filter);

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 mt-2">
        <div>
          <p className="label-caps">Crónicas de la aventura</p>
          <h1 className="text-3xl font-black" style={{ color: '#EDE6D8' }}>Chronicles</h1>
        </div>
        {isDm && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center glow-ember"
            style={{ background: '#FF7A1A', color: '#1A0E04' }}
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* Global state bar */}
      <div className="panel flex items-center gap-3 p-3 mb-4">
        {isDay() ? <Sun size={16} style={{ color: '#F59E0B' }} /> : <Moon size={16} style={{ color: '#9B5DE5' }} />}
        <span className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{globalTime}</span>
        <span style={{ color: '#2A332F' }}>·</span>
        <span className="text-sm" style={{ color: '#A89F8E' }}>{globalLocation}</span>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[['ACTIVE','Activas'],['FINISHED','Terminadas']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className="flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
            style={filter === val
              ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }
              : { color: '#6B6557', border: '1px solid #2A332F', background: '#16211F' }}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 rounded-full border-2 border-amber animate-spin" style={{ borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="w-20 h-20 rounded-full flex items-center justify-center glow-ember"
            style={{ background: '#16211F', border: '1.5px solid #8A6A3B' }}>
            <Scroll size={32} style={{ color: '#F59E0B' }} />
          </div>
          <p className="text-center" style={{ color: '#6B6557' }}>
            {filter === 'ACTIVE' ? 'No hay escenas activas.' : 'No hay escenas terminadas.'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(scene => (
          <button
            key={scene.id}
            onClick={() => onSelectScene(scene)}
            className="w-full text-left rounded-xl overflow-hidden transition-transform active:scale-[0.98]"
            style={{ border: '1px solid #5A4424' }}
          >
            <div className="relative h-28">
              <img
                src={scene.imageUrl || 'https://via.placeholder.com/400x200/0F1518/C8A36A?text=Escena'}
                alt={scene.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,21,24,0.95) 0%, transparent 60%)' }} />
            </div>
            <div className="panel p-3" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-bold truncate" style={{ color: '#EDE6D8' }}>{scene.title}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#A89F8E' }}>{scene.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {scene.status === 'ACTIVE'
                    ? <CircleDashed size={16} style={{ color: '#F59E0B' }} />
                    : <CheckCircle2 size={16} style={{ color: '#5BA86B' }} />}
                  <ChevronRight size={16} style={{ color: '#6B6557' }} />
                </div>
              </div>
              {(scene.participants || []).length > 0 && (
                <p className="text-xs mt-1.5" style={{ color: '#6B6557' }}>
                  {scene.participants.length} participante{scene.participants.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {showCreate && (
        <CreateSceneModal
          socket={socket}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
