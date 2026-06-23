import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Crown, Trash2, Upload, X, Users } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import API_URL from '../../config';

function ChatBubble({ msg, isDm, userId }) {
  const isSystem = msg.type === 'SYSTEM';
  const isOwn = msg.userId == userId || msg.author === 'DM' && isDm;
  const isDmMsg = msg.author === 'DM' || msg.isDm;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="label-caps px-3 py-1 rounded-full"
          style={{ background: '#1E2A28', color: '#A89F8E' }}>{msg.text}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {isDmMsg && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 self-end"
          style={{ background: '#9B5DE5', border: '1px solid #9B5DE520' }}>
          <Crown size={12} style={{ color: '#EDE6D8' }} />
        </div>
      )}
      <div className="max-w-[75%] space-y-1">
        {!isOwn && (
          <p className="label-caps" style={{ color: isDmMsg ? '#9B5DE5' : '#C8A36A', paddingLeft: 4 }}>
            {isDmMsg ? 'Dungeon Master' : (msg.author || 'Jugador')}
          </p>
        )}
        {msg.metadata?.imageUrl && (
          <img src={msg.metadata.imageUrl} alt="media"
            className="rounded-xl max-h-48 w-full object-cover mb-1"
            style={{ border: '1px solid #2A332F' }} />
        )}
        {msg.text && (
          <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
            style={isDmMsg
              ? { background: 'rgba(155,93,229,0.15)', border: '1px solid rgba(155,93,229,0.25)', color: '#EDE6D8' }
              : isOwn
              ? { background: 'rgba(200,163,106,0.15)', border: '1px solid rgba(200,163,106,0.25)', color: '#EDE6D8' }
              : { background: '#16211F', border: '1px solid #2A332F', color: '#EDE6D8' }}>
            {msg.text}
          </div>
        )}
        {msg.metadata?.roll && (
          <div className="px-3 py-2 rounded-xl text-sm"
            style={{ background: '#1E2A28', border: '1px solid #2A332F' }}>
            <span style={{ color: '#C8A36A' }}>🎲 d{msg.metadata.roll.sides}: </span>
            <span className="font-black text-lg" style={{ color: '#F59E0B' }}>{msg.metadata.roll.result}</span>
          </div>
        )}
        <p className="text-[10px] px-1" style={{ color: '#6B6557' }}>
          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''}
        </p>
      </div>
    </div>
  );
}

export default function SceneChat({ scene, onBack }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const isDm = user?.role === 'DM' || user?.role === 'ADMIN';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    socket.emit('get-timeline', scene.id);
    socket.emit('get-players');

    const handleTimeline = (data) => setMessages(data);
    const handleNew = (msg) => {
      if (msg.scene_id && msg.scene_id !== scene.id) return;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    };
    const handleUpdated = (msg) => setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    const handlePlayers = (players) => {
      const mine = players.find(p => p.UserId == user?.id);
      if (mine) setMyPlayerId(mine.id);
    };

    socket.on('timeline-data', handleTimeline);
    socket.on('new-message', handleNew);
    socket.on('message-updated', handleUpdated);
    socket.on('players-data', handlePlayers);

    return () => {
      socket.off('timeline-data', handleTimeline);
      socket.off('new-message', handleNew);
      socket.off('message-updated', handleUpdated);
      socket.off('players-data', handlePlayers);
    };
  }, [socket, scene.id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text && !pendingImage) return;

    const payload = {
      sceneId: scene.id,
      text,
      type: isDm ? 'NARRATION' : 'ACTION',
      isDm,
      metadata: pendingImage ? { imageUrl: pendingImage } : undefined,
    };

    socket.emit(isDm ? 'dm-send-message' : 'player-send-action', payload);
    setInput('');
    setPendingImage(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) setPendingImage(data.url);
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0F1518' }}>
      {/* Scene Header */}
      <header className="shrink-0 relative">
        {scene.imageUrl && (
          <div className="h-28 overflow-hidden">
            <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, #0F1518 100%)' }} />
          </div>
        )}
        <div className="flex items-center gap-3 p-4 relative z-10" style={!scene.imageUrl ? { borderBottom: '1px solid #2A332F' } : {}}>
          <button onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: '#1E2A28', border: '1px solid #2A332F', color: '#EDE6D8' }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-base truncate" style={{ color: '#EDE6D8' }}>{scene.title}</h1>
            <p className="text-xs truncate" style={{ color: '#A89F8E' }}>{scene.description}</p>
          </div>
          <div className="flex items-center gap-1" style={{ color: '#6B6557' }}>
            <Users size={14} />
            <span className="text-xs">{(scene.participants || []).length}</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: '#6B6557' }}>
            <p className="text-sm">La escena acaba de comenzar...</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatBubble key={msg.id || i} msg={msg} isDm={isDm} userId={user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 p-3" style={{ borderTop: '1px solid #2A332F', background: 'rgba(15,21,24,0.98)' }}>
        {pendingImage && (
          <div className="relative mb-2 h-20 w-20">
            <img src={pendingImage} alt="preview" className="h-full w-full object-cover rounded-lg" />
            <button onClick={() => setPendingImage(null)}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: '#C2452F', color: '#EDE6D8' }}>
              <X size={10} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors"
            style={{ background: '#1E2A28', border: '1px solid #2A332F', color: '#A89F8E' }}>
            {uploading
              ? <div className="w-4 h-4 border-2 border-bronze-light border-t-transparent rounded-full animate-spin" />
              : <Upload size={16} />}
          </button>
          <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

          <textarea
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm"
            style={{
              background: '#16211F', border: '1px solid #2A332F', color: '#EDE6D8',
              outline: 'none', maxHeight: 120, minHeight: 40,
            }}
            rows={1}
            placeholder={isDm ? 'Narrar...' : 'Tu acción...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() && !pendingImage}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 glow-ember transition-opacity disabled:opacity-40"
            style={{ background: isDm ? '#9B5DE5' : '#FF7A1A', color: '#EDE6D8' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
