import { useState, useEffect } from 'react';
import { Plus, Scroll, X, CheckCircle2 } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const STATUS_COLOR = { 'En Progreso': '#F59E0B', 'Completada': '#5BA86B', 'Bloqueada': '#6B6557', 'Fallida': '#C2452F' };
const TYPE_COLOR   = { Epica: '#F59E0B', Personal: '#C2452F', Cadena: '#5BA86B', Común: '#3E84D6' };

export default function QuestsPanel() {
  const { socket } = useSocket();
  const [quests, setQuests] = useState([]);
  const [players, setPlayers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  // form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [objectivesText, setObjectivesText] = useState('');
  const [targetId, setTargetId] = useState('');
  const [questType, setQuestType] = useState('Común');
  const [rewards, setRewards] = useState('{}');

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-all-qs');
    socket.emit('get-all-players');

    const handleQuests  = (data) => { setQuests(data); setLoading(false); };
    const handlePlayers = (data) => setPlayers(data);

    socket.on('all-quests', handleQuests);
    socket.on('all-players', handlePlayers);
    return () => {
      socket.off('all-quests', handleQuests);
      socket.off('all-players', handlePlayers);
    };
  }, [socket]);

  const handleCreate = () => {
    if (!title.trim() || !targetId) return;
    let parsedRewards = {};
    try { parsedRewards = JSON.parse(rewards); } catch { parsedRewards = {}; }

    const objectives = objectivesText.split('\n').filter(l => l.trim())
      .map((text, idx) => ({ id: idx + 1, text: text.trim(), completed: false }));

    socket.emit('create-assign-quest', {
      characterId: targetId,
      title: title.trim(),
      description: description.trim(),
      type: questType,
      rewards: parsedRewards,
      objectives,
    });

    setTitle(''); setDescription(''); setObjectivesText(''); setTargetId(''); setRewards('{}');
    setShowCreate(false);
    setTimeout(() => socket.emit('get-all-qs'), 500);
  };

  const handleComplete = (questId) => {
    socket.emit('complete-objective', { questId, allDone: true });
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="label-caps">Herramienta DM</p>
          <h1 className="text-3xl font-black mt-1" style={{ color: '#EDE6D8' }}>Misiones</h1>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm glow-ember"
          style={{ background: '#FF7A1A', color: '#1A0E04' }}>
          <Plus size={18} /> Nueva misión
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-amber rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quests.map(quest => (
          <div key={quest.id} className="panel p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="label-caps" style={{ color: TYPE_COLOR[quest.type] || '#C8A36A' }}>{quest.type}</span>
                  <span className="label-caps" style={{ color: STATUS_COLOR[quest.status] || '#C8A36A' }}>
                    · {quest.status}
                  </span>
                </div>
                <p className="font-bold" style={{ color: '#EDE6D8' }}>{quest.title}</p>
              </div>
              {quest.status !== 'Completada' && (
                <button onClick={() => handleComplete(quest.id)}
                  className="shrink-0 ml-2" title="Marcar completada"
                  style={{ color: '#5BA86B' }}>
                  <CheckCircle2 size={18} />
                </button>
              )}
            </div>

            <p className="text-xs italic line-clamp-2" style={{ color: '#A89F8E' }}>"{quest.description}"</p>

            {Array.isArray(quest.objectives) && quest.objectives.length > 0 && (
              <div className="space-y-1">
                {quest.objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full border shrink-0"
                      style={obj.completed
                        ? { background: '#5BA86B', borderColor: '#5BA86B' }
                        : { borderColor: '#2A332F' }} />
                    <span style={{ color: obj.completed ? '#6B6557' : '#A89F8E', textDecoration: obj.completed ? 'line-through' : 'none' }}>
                      {obj.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && quests.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3" style={{ color: '#6B6557' }}>
          <Scroll size={32} />
          <p>No hay misiones creadas aún.</p>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowCreate(false)}>
          <div className="panel-raised w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg" style={{ color: '#EDE6D8' }}>Nueva misión</h2>
              <button onClick={() => setShowCreate(false)} style={{ color: '#6B6557' }}><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="label-caps mb-1">Asignar a</p>
                <select className="input-base" value={targetId} onChange={e => setTargetId(e.target.value)}>
                  <option value="">Seleccionar jugador</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <p className="label-caps mb-1">Tipo</p>
                <select className="input-base" value={questType} onChange={e => setQuestType(e.target.value)}>
                  {['Común','Epica','Personal','Cadena'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <p className="label-caps mb-1">Título</p>
              <input className="input-base" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título de la misión" />
            </div>

            <div>
              <p className="label-caps mb-1">Descripción</p>
              <textarea className="input-base resize-none" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción narrativa..." />
            </div>

            <div>
              <p className="label-caps mb-1">Objetivos (uno por línea)</p>
              <textarea className="input-base resize-none" rows={4} value={objectivesText} onChange={e => setObjectivesText(e.target.value)}
                placeholder={"Encontrar el artefacto\nDerrotar al guardián\nRegresar con el tesoro"} />
            </div>

            <div>
              <p className="label-caps mb-1">Recompensas (JSON)</p>
              <input className="input-base font-mono text-sm" value={rewards} onChange={e => setRewards(e.target.value)}
                placeholder='{"xp": 500, "oro": 100}' />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold"
                style={{ background: '#1E2A28', color: '#A89F8E', border: '1px solid #2A332F' }}>
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={!title.trim() || !targetId}
                className="flex-1 py-2.5 rounded-lg text-sm font-black disabled:opacity-50"
                style={{ background: '#FF7A1A', color: '#1A0E04' }}>
                Crear misión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
