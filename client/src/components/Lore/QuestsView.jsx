import { useState, useEffect } from 'react';
import { ArrowLeft, Scroll, X, ChevronRight } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

const TYPE_COLOR = {
  Epica: '#F59E0B', Personal: '#C2452F', Cadena: '#5BA86B', Común: '#3E84D6',
};

export default function QuestsView({ onBack }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [quests, setQuests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-all-qs');
    const handler = (data) => { setQuests(data); setLoading(false); };
    socket.on('all-quests', handler);
    return () => socket.off('all-quests', handler);
  }, [socket]);

  return (
    <div className="min-h-screen" style={{ background: '#0F1518' }}>
      <div className="sticky top-0 z-10 p-4 flex items-center gap-3"
        style={{ background: 'rgba(15,21,24,0.96)', borderBottom: '1px solid #2A332F', backdropFilter: 'blur(12px)' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: '#1E2A28', border: '1px solid #2A332F', color: '#EDE6D8' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-black" style={{ color: '#EDE6D8' }}>Misiones</h1>
      </div>

      <div className="p-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-amber rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
          </div>
        )}

        {!loading && quests.length === 0 && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Scroll size={32} style={{ color: '#6B6557' }} />
            <p style={{ color: '#6B6557' }}>No hay misiones activas.</p>
          </div>
        )}

        {quests.map(quest => (
          <button key={quest.id} onClick={() => setSelected(quest)}
            className="panel p-4 w-full text-left transition-colors hover:border-bronze-dark">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="label-caps" style={{ color: TYPE_COLOR[quest.type] || '#C8A36A' }}>{quest.type}</span>
                <p className="font-bold mt-0.5 truncate" style={{ color: '#EDE6D8' }}>{quest.title}</p>
                <p className="text-xs mt-1 line-clamp-2 italic" style={{ color: '#A89F8E' }}>"{quest.description}"</p>
              </div>
              <span className="label-caps shrink-0 mt-1"
                style={{ color: quest.status === 'Completada' ? '#5BA86B' : '#C8A36A' }}>
                {quest.status}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelected(null)}>
          <div className="panel-raised w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <span className="label-caps" style={{ color: TYPE_COLOR[selected.type] || '#C8A36A' }}>{selected.type}</span>
                <h2 className="text-xl font-black mt-1" style={{ color: '#EDE6D8' }}>{selected.title}</h2>
              </div>
              <button onClick={() => setSelected(null)} style={{ color: '#6B6557' }}><X size={18} /></button>
            </div>

            <p className="text-sm italic" style={{ color: '#A89F8E', borderLeft: '2px solid #2A332F', paddingLeft: 12 }}>
              "{selected.description}"
            </p>

            {Array.isArray(selected.objectives) && selected.objectives.length > 0 && (
              <div>
                <p className="label-caps mb-2">Objetivos</p>
                <div className="space-y-2">
                  {selected.objectives.map((obj, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full border-2 mt-0.5 shrink-0"
                        style={obj.completed
                          ? { background: '#5BA86B', borderColor: '#5BA86B' }
                          : { borderColor: '#2A332F' }} />
                      <span style={{ color: obj.completed ? '#6B6557' : '#EDE6D8', textDecoration: obj.completed ? 'line-through' : 'none' }}>
                        {obj.text || obj}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.rewards && Object.keys(selected.rewards).length > 0 && (
              <div>
                <p className="label-caps mb-2">Recompensas</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selected.rewards).map(([k, v]) => (
                    <span key={k} className="px-2 py-1 rounded text-xs font-bold"
                      style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
