import { useState, useEffect, useRef } from 'react';
import { Plus, Scroll, Users, CheckCircle2, CircleDashed, Trash2, Edit3, X, ImageIcon, Crown, Send, Sun, Moon, Settings, Upload } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config';

function SceneCard({ scene, onSelect, onDelete, socket }) {
  const statusColor = scene.status === 'ACTIVE' ? '#F59E0B' : '#5BA86B';
  const statusLabel = scene.status === 'ACTIVE' ? 'Activa' : scene.status === 'FINISHED' ? 'Terminada' : 'Archivada';

  const handleArchive = (e) => {
    e.stopPropagation();
    if (window.confirm(`¿Archivar "${scene.title}"?`)) {
      socket.emit('update-scene-status', { sceneId: scene.id, status: 'ARCHIVED' });
    }
  };

  const handleFinish = (e) => {
    e.stopPropagation();
    socket.emit('update-scene-status', { sceneId: scene.id, status: 'FINISHED' });
  };

  return (
    <div className="panel overflow-hidden" style={{ cursor: 'default' }}>
      {/* Scene image */}
      <div className="relative h-32 cursor-pointer" onClick={() => onSelect(scene)}>
        <img
          src={scene.imageUrl || 'https://via.placeholder.com/400x200/16211F/C8A36A?text=Escena'}
          alt={scene.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(22,33,31,0.95) 0%, transparent 60%)' }} />
        <div className="absolute bottom-2 left-3 right-3">
          <p className="font-black text-sm" style={{ color: '#EDE6D8' }}>{scene.title}</p>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(15,21,24,0.8)', border: `1px solid ${statusColor}40` }}>
          {scene.status === 'ACTIVE'
            ? <CircleDashed size={10} style={{ color: statusColor }} />
            : <CheckCircle2 size={10} style={{ color: statusColor }} />}
          <span className="label-caps" style={{ color: statusColor }}>{statusLabel}</span>
        </div>
      </div>

      {/* Info bar */}
      <div className="p-3 space-y-2">
        <p className="text-xs line-clamp-2" style={{ color: '#A89F8E' }}>{scene.description || 'Sin descripción.'}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1" style={{ color: '#6B6557' }}>
            <Users size={12} />
            <span className="text-xs">{(scene.participants || []).length} participantes</span>
          </div>

          <div className="flex gap-2">
            {scene.status === 'ACTIVE' && (
              <button onClick={handleFinish}
                className="label-caps px-2 py-1 rounded transition-colors"
                style={{ background: 'rgba(91,168,107,0.15)', border: '1px solid rgba(91,168,107,0.3)', color: '#5BA86B' }}>
                Terminar
              </button>
            )}
            <button onClick={handleArchive}
              className="label-caps px-2 py-1 rounded transition-colors"
              style={{ background: '#1E2A28', border: '1px solid #2A332F', color: '#6B6557' }}>
              Archivar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneChatDm({ scene, onBack, socket, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('narration'); // narration | description | action
  const [pendingImage, setPendingImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [globalTime, setGlobalTime] = useState('12:00');
  const [globalLocation, setGlobalLocation] = useState('...');
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef(null);

  const fileRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-timeline', scene.id);
    socket.emit('get-global-state');

    const handleTimeline = (data) => setMessages(data);
    const handleNew = (msg) => {
      if (msg.scene_id && msg.scene_id !== scene.id) return;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    };
    const handleUpdated = (msg) => setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    const handleGlobal = (s) => {
      if (s?.global_time) setGlobalTime(s.global_time);
      if (s?.global_location) setGlobalLocation(s.global_location);
    };

    socket.on('timeline-data', handleTimeline);
    socket.on('new-message', handleNew);
    socket.on('message-updated', handleUpdated);
    socket.on('global-state-data', handleGlobal);
    return () => {
      socket.off('timeline-data', handleTimeline);
      socket.off('new-message', handleNew);
      socket.off('message-updated', handleUpdated);
      socket.off('global-state-data', handleGlobal);
    };
  }, [socket, scene.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text && !pendingImage) return;
    socket.emit('dm-send-message', {
      sceneId: scene.id,
      text,
      type: mode.toUpperCase(),
      isDm: true,
      metadata: pendingImage ? { imageUrl: pendingImage } : undefined,
    });
    setInput('');
    setPendingImage(null);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) setPendingImage(data.url);
    } finally { setUploading(false); }
  };

  const saveGlobalState = () => {
    socket.emit('update-global-state', { global_time: globalTime, global_location: globalLocation });
    setShowSettings(false);
  };

  const modeStyle = {
    narration:   { bg: 'rgba(155,93,229,0.15)', border: 'rgba(155,93,229,0.4)', color: '#9B5DE5' },
    description: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  color: '#F59E0B' },
    action:      { bg: 'rgba(255,122,26,0.1)',  border: 'rgba(255,122,26,0.3)',  color: '#FF7A1A' },
  };
  const ms = modeStyle[mode];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-3" style={{ borderBottom: '1px solid #2A332F' }}>
        <button onClick={onBack} className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: '#1E2A28', color: '#A89F8E' }}>
          ←
        </button>
        <div className="flex-1">
          <p className="font-black text-sm" style={{ color: '#EDE6D8' }}>{scene.title}</p>
          <p className="text-xs" style={{ color: '#A89F8E' }}>{globalTime} · {globalLocation}</p>
        </div>
        <button onClick={() => setShowSettings(true)} style={{ color: '#6B6557' }}>
          <Settings size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => {
          const isDmMsg = msg.author === 'DM' || msg.isDm;
          if (msg.type === 'SYSTEM') {
            return (
              <div key={i} className="flex justify-center">
                <span className="label-caps px-3 py-1 rounded-full" style={{ background: '#1E2A28', color: '#A89F8E' }}>
                  {msg.text}
                </span>
              </div>
            );
          }
          return (
            <div key={i} className={`flex gap-2 ${isDmMsg ? 'flex-row-reverse' : 'flex-row'}`}>
              {isDmMsg && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 self-end"
                  style={{ background: '#9B5DE5', border: '1px solid #9B5DE530' }}>
                  <Crown size={11} style={{ color: '#EDE6D8' }} />
                </div>
              )}
              <div className="max-w-[75%] space-y-1">
                {!isDmMsg && <p className="label-caps pl-1" style={{ color: '#C8A36A' }}>{msg.author}</p>}
                {msg.metadata?.imageUrl && (
                  <img src={msg.metadata.imageUrl} alt="media"
                    className="rounded-xl max-h-48 w-full object-cover" />
                )}
                {msg.text && (
                  <div className="px-4 py-2.5 rounded-2xl text-sm"
                    style={isDmMsg
                      ? { background: 'rgba(155,93,229,0.15)', border: '1px solid rgba(155,93,229,0.25)', color: '#EDE6D8' }
                      : { background: '#16211F', border: '1px solid #2A332F', color: '#EDE6D8' }}>
                    {msg.text}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 px-3 pt-2" style={{ borderTop: '1px solid #2A332F' }}>
        {[['narration','Narrar'],['description','Describir'],['action','Acción']].map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)}
            className="flex-1 py-1.5 rounded-lg label-caps transition-all"
            style={mode === m
              ? { background: modeStyle[m].bg, border: `1px solid ${modeStyle[m].border}`, color: modeStyle[m].color }
              : { color: '#6B6557', border: '1px solid transparent' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 space-y-2">
        {pendingImage && (
          <div className="relative w-16 h-16">
            <img src={pendingImage} alt="preview" className="w-full h-full object-cover rounded-lg" />
            <button onClick={() => setPendingImage(null)}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: '#C2452F', color: '#EDE6D8' }}>
              <X size={10} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#1E2A28', border: '1px solid #2A332F', color: '#A89F8E' }}>
            {uploading ? <div className="w-4 h-4 border-2 border-bronze-light border-t-transparent rounded-full animate-spin" /> : <Upload size={16} />}
          </button>
          <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
          <textarea
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm"
            style={{ background: '#16211F', border: `1px solid ${ms.border}`, color: '#EDE6D8', outline: 'none', maxHeight: 120, minHeight: 40 }}
            rows={1}
            placeholder={`${mode === 'narration' ? 'Narrar...' : mode === 'description' ? 'Describir la escena...' : 'Acción DM...'}`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button onClick={handleSend} disabled={!input.trim() && !pendingImage}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40"
            style={{ background: ms.bg, border: `1px solid ${ms.border}`, color: ms.color }}>
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setShowSettings(false)}>
          <div className="panel-raised w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black" style={{ color: '#EDE6D8' }}>Estado global</h2>
              <button onClick={() => setShowSettings(false)} style={{ color: '#6B6557' }}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="label-caps mb-1">Hora del mundo</p>
                <input className="input-base" value={globalTime} onChange={e => setGlobalTime(e.target.value)} placeholder="HH:MM" />
              </div>
              <div>
                <p className="label-caps mb-1">Ubicación actual</p>
                <input className="input-base" value={globalLocation} onChange={e => setGlobalLocation(e.target.value)} />
              </div>
            </div>
            <button onClick={saveGlobalState}
              className="w-full h-11 rounded-lg font-black"
              style={{ background: '#FF7A1A', color: '#1A0E04' }}>
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScenesPanel() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [scenes, setScenes] = useState([]);
  const [filter, setFilter] = useState('ACTIVE');
  const [showCreate, setShowCreate] = useState(false);
  const [activeScene, setActiveScene] = useState(null);
  const [loading, setLoading] = useState(true);

  // Create scene form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-scenes');
    const handler = (data) => { setScenes(data); setLoading(false); };
    socket.on('scenes-data', handler);
    return () => socket.off('scenes-data', handler);
  }, [socket]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) setImageUrl(data.url);
    } finally { setUploading(false); }
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    socket.emit('create-scene', { title: title.trim(), description: description.trim(), imageUrl });
    setTitle(''); setDescription(''); setImageUrl('');
    setShowCreate(false);
    socket.emit('get-scenes');
  };

  const filtered = scenes.filter(s => s.status === filter);

  if (activeScene) {
    return <SceneChatDm scene={activeScene} onBack={() => setActiveScene(null)} socket={socket} user={user} />;
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="label-caps">Herramienta DM</p>
          <h1 className="text-3xl font-black mt-1" style={{ color: '#EDE6D8' }}>Escenas & Viñetas</h1>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm glow-ember"
          style={{ background: '#FF7A1A', color: '#1A0E04' }}>
          <Plus size={18} /> Nueva escena
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {[['ACTIVE','Activas'],['FINISHED','Terminadas'],['ARCHIVED','Archivadas']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
            style={filter === val
              ? { background: 'rgba(155,93,229,0.15)', border: '1px solid rgba(155,93,229,0.3)', color: '#9B5DE5' }
              : { color: '#6B6557', border: '1px solid #2A332F', background: '#16211F' }}>
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-purple-400 rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(scene => (
          <SceneCard key={scene.id} scene={scene} onSelect={setActiveScene} socket={socket} />
        ))}
        {!loading && filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center py-16 gap-3" style={{ color: '#6B6557' }}>
            <Scroll size={32} />
            <p>No hay escenas {filter === 'ACTIVE' ? 'activas' : filter === 'FINISHED' ? 'terminadas' : 'archivadas'}.</p>
          </div>
        )}
      </div>

      {/* Create scene modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowCreate(false)}>
          <div className="panel-raised w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-lg" style={{ color: '#EDE6D8' }}>Nueva escena</h2>
              <button onClick={() => setShowCreate(false)} style={{ color: '#6B6557' }}><X size={18} /></button>
            </div>

            <input className="input-base" placeholder="Título de la escena" value={title} onChange={e => setTitle(e.target.value)} />
            <textarea className="input-base resize-none" rows={3} placeholder="Descripción..." value={description} onChange={e => setDescription(e.target.value)} />

            {imageUrl ? (
              <div className="relative h-28 rounded-xl overflow-hidden">
                <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                <button onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.7)', color: '#EDE6D8' }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 h-20 rounded-xl cursor-pointer"
                style={{ border: '1px dashed #2A332F', color: '#6B6557' }}>
                {uploading
                  ? <div className="w-5 h-5 border-2 border-bronze-light border-t-transparent rounded-full animate-spin" />
                  : <><ImageIcon size={18} /><span className="text-sm">Subir imagen de escena</span></>}
                <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
              </label>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold"
                style={{ background: '#1E2A28', color: '#A89F8E', border: '1px solid #2A332F' }}>
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={!title.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-black disabled:opacity-50"
                style={{ background: '#FF7A1A', color: '#1A0E04' }}>
                Crear escena
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
