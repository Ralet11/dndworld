import { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, Send, RotateCcw, Clock3, MapPin, HeartPulse, Users, Mic, MicOff, Plus, Trash2 } from 'lucide-react';
import API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const DEFAULT_SUGGESTIONS = [
  'contexto',
  '5 menos de vida a Lucario',
  'cura 8 a Paleas Mucron',
  'sumale 50 xp a Zik',
  'sumale 25 oro a Rakion Altarion',
  'dale inspiracion a Lucario',
  'activa a Albert Obrien',
  'narra La niebla cubre el puerto',
  'pone la hora en 19:30',
  'pone la ubicacion en Prontera',
];

const THINKING_STEPS = [
  'Pensando...',
  'Revisando contexto e historial reciente...',
  'Decidiendo si hace falta usar tools...',
  'Ejecutando cambios en la sesion...',
  'Preparando la respuesta final...',
];

function ContextCard({ title, value, icon, tone = '#38bdf8' }) {
  const ContextIcon = icon;
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 mb-2">
        <ContextIcon size={16} style={{ color: tone }} />
        <span className="label-caps" style={{ color: tone }}>{title}</span>
      </div>
      <p className="font-black text-sm" style={{ color: '#EDE6D8' }}>{value}</p>
    </div>
  );
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#EDE6D8', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderText(text) {
  const lines = text.split('\n');
  const nodes = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="space-y-1 mt-1 mb-1">
        {listItems.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span style={{ color: '#38bdf8', marginTop: 2, flexShrink: 0 }}>·</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, i) => {
    if (/^- /.test(line)) {
      listItems.push(line.slice(2));
    } else {
      flushList();
      if (line.trim() === '') {
        nodes.push(<div key={i} className="h-2" />);
      } else {
        nodes.push(<p key={i}>{renderInline(line)}</p>);
      }
    }
  });
  flushList();

  return nodes;
}

function MessageBubble({ msg, onUndo }) {
  const isUser = msg.role === 'user';
  const showToolLabel = !isUser && msg.tool && !String(msg.tool).startsWith('assistant.');
  const bubbleStyle = isUser
    ? { background: 'rgba(62,132,214,0.18)', border: '1px solid rgba(62,132,214,0.35)', color: '#EDE6D8' }
    : msg.kind === 'error'
      ? { background: 'rgba(194,69,47,0.12)', border: '1px solid rgba(194,69,47,0.35)', color: '#F7D5CF' }
      : { background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.25)', color: '#EDE6D8' };

  return (
    <div className={`oracle-message-row ${isUser ? 'is-user' : 'is-assistant'}`}>
      <div className="oracle-message-content">
        <div
          className="oracle-message-bubble"
          style={bubbleStyle}
        >
          {showToolLabel && (
            <div className="label-caps mb-2" style={{ color: '#67e8f9' }}>{msg.tool}</div>
          )}
          {isUser ? msg.text : renderText(msg.text)}
        </div>
        {!isUser && msg.undoAvailable && (
          <button
            onClick={onUndo}
            className="oracle-undo-button"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#F59E0B' }}
          >
            <RotateCcw size={14} /> Deshacer
          </button>
        )}
      </div>
    </div>
  );
}

export default function AssistantPanel({ embedded = false }) {
  const { token, user } = useAuth();
  const { connected } = useSocket();
  const [context, setContext] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      kind: 'help',
      text: 'Asistente del DM listo. Hablame normal: puedes describir la situacion, pedir ideas, resumir escena o hacer cambios sobre la sesion sin escribir comandos rigidos.',
      tool: 'assistant.ready',
      suggestions: DEFAULT_SUGGESTIONS,
      undoAvailable: false,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [contextLoading, setContextLoading] = useState(true);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [micError, setMicError] = useState('');
  const recognitionRef = useRef(null);
  const keepListeningRef = useRef(false);
  const sendOnEndRef = useRef(false);
  const inputRef = useRef('');
  const sendFnRef = useRef(null);
  const bottomRef = useRef(null);

  const hasSpeechApi = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => { inputRef.current = input; }, [input]);

  const startRecognition = useCallback(() => {
    if (!hasSpeechApi || keepListeningRef.current) return;
    setMicError('');
    keepListeningRef.current = true;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'es-AR';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setInterimText('');
      if (keepListeningRef.current) {
        try { rec.start(); } catch { setListening(false); keepListeningRef.current = false; }
      } else {
        setListening(false);
        if (sendOnEndRef.current) {
          sendOnEndRef.current = false;
          setTimeout(() => {
            const val = inputRef.current.trim();
            if (val) sendFnRef.current?.(val);
          }, 150);
        }
      }
    };
    rec.onerror = (e) => {
      setInterimText('');
      if (e.error === 'not-allowed') {
        setListening(false);
        keepListeningRef.current = false;
        setMicError('Permiso de microfono denegado. Revisa chrome://settings/content/microphone');
      } else if (e.error === 'network') {
        setListening(false);
        keepListeningRef.current = false;
        setMicError('Error de red: el reconocimiento de voz requiere conexion a internet.');
      } else if (e.error === 'no-speech') {
        setMicError('Sin voz detectada — verifica el microfono en Windows');
      } else {
        setListening(false);
        keepListeningRef.current = false;
        setMicError(`Error: ${e.error}`);
      }
    };
    rec.onresult = (e) => {
      let interim = '';
      let finalText = '';
      for (const result of e.results) {
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setInterimText(interim);
      if (finalText) setInput((prev) => (prev ? `${prev} ${finalText}` : finalText));
    };

    recognitionRef.current = rec;
    rec.start();
  }, [hasSpeechApi]);

  const stopRecognition = useCallback((shouldSend = false) => {
    sendOnEndRef.current = shouldSend;
    keepListeningRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) stopRecognition(false);
    else startRecognition();
  }, [listening, startRecognition, stopRecognition]);

  // Push-to-talk: tecla ` (antes del 1)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Backquote' || e.repeat) return;
      e.preventDefault();
      startRecognition();
    };
    const onKeyUp = (e) => {
      if (e.code !== 'Backquote') return;
      e.preventDefault();
      stopRecognition(true);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startRecognition, stopRecognition]);

  const fetchContext = useCallback(async () => {
    if (!token) return;
    setContextLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/dm-assistant/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo cargar el contexto.');
      const data = await res.json();
      setContext(data);
    } catch (err) {
      console.error('Assistant context error:', err);
    } finally {
      setContextLoading(false);
    }
  }, [token]);

  const loadConversation = useCallback(async (id) => {
    if (!token || !id) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/dm-assistant/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo abrir la conversación.');
      const data = await res.json();
      setConversationId(data.conversation.id);
      setMessages(data.messages.length ? data.messages : [{
        id: 'welcome', role: 'assistant', kind: 'help',
        text: 'Conversación nueva. Decime qué querés preparar, narrar o modificar en la partida.',
        tool: 'assistant.ready', suggestions: DEFAULT_SUGGESTIONS, undoAvailable: false,
      }]);
    } catch (err) {
      console.error('Assistant history error:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  const fetchConversations = useCallback(async (selectLatest = false) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/dm-assistant/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo cargar las conversaciones.');
      const data = await res.json();
      setConversations(data);
      if (data.length && (selectLatest || !conversationId)) loadConversation(data[0].id);
      if (!data.length) setHistoryLoading(false);
    } catch (err) {
      console.error('Assistant conversations error:', err);
      setHistoryLoading(false);
    }
  }, [conversationId, loadConversation, token]);

  const createConversation = useCallback(async () => {
    if (!token || loading) return;
    try {
      const res = await fetch(`${API_URL}/api/dm-assistant/conversations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: 'Nueva conversación' }),
      });
      if (!res.ok) throw new Error('No se pudo crear la conversación.');
      const conversation = await res.json();
      setConversations((prev) => [conversation, ...prev]);
      await loadConversation(conversation.id);
    } catch (err) {
      console.error('Assistant new conversation error:', err);
    }
  }, [loadConversation, loading, token]);

  const deleteConversation = useCallback(async (id) => {
    if (!token || loading || !id) return;
    const conversation = conversations.find((item) => item.id === id);
    if (!window.confirm(`¿Eliminar la conversación “${conversation?.title || 'sin título'}”? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/dm-assistant/conversations/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo eliminar la conversación.');
      const remaining = conversations.filter((item) => item.id !== id);
      setConversations(remaining);
      if (String(conversationId) === String(id)) {
        if (remaining.length) await loadConversation(remaining[0].id);
        else {
          setConversationId(null);
          setMessages([{ id: 'welcome', role: 'assistant', kind: 'help', text: 'No hay una conversación abierta. Creá una nueva para empezar.', tool: 'assistant.ready', suggestions: DEFAULT_SUGGESTIONS, undoAvailable: false }]);
        }
      }
    } catch (err) {
      console.error('Assistant delete conversation error:', err);
      window.alert('No se pudo eliminar la conversación. Intentá de nuevo.');
    }
  }, [conversationId, conversations, loadConversation, loading, token]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return undefined;
    }

    setLoadingStep(0);
    const interval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, THINKING_STEPS.length - 1));
    }, 1400);

    return () => clearInterval(interval);
  }, [loading]);

  const pushAssistantReply = (reply) => {
    setMessages((prev) => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      role: 'assistant',
      kind: reply.kind,
      text: reply.text,
      tool: reply.tool,
      suggestions: reply.suggestions,
      undoAvailable: !!reply.undoAvailable,
    }]);
  };

  const sendCommand = async (rawMessage) => {
    const message = rawMessage.trim();
    if (!message || !token || loading) return;
    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      kind: 'user',
      text: message,
      undoAvailable: false,
    }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/dm-assistant/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, conversationId }),
      });

      const data = await res.json();
      if (!data?.reply) {
        throw new Error('Respuesta invalida del asistente.');
      }

      pushAssistantReply(data.reply);
      if (res.ok) {
        setConversationId(data.conversationId || conversationId);
        fetchContext();
        fetchConversations(true);
      }
    } catch (err) {
      console.error('Assistant command error:', err);
      pushAssistantReply({
        kind: 'error',
        text: 'No pude procesar ese comando.',
        tool: 'assistant.error',
      });
    } finally {
      setLoading(false);
    }
  };
  sendFnRef.current = sendCommand;

  return (
    <div className={`oracle-workspace${embedded ? ' is-game-embedded' : ''}`}>
      <div className="oracle-header">
        <div>
          <p className="label-caps">Herramienta DM</p>
          <h1 className="text-3xl font-black mt-1 flex items-center gap-3" style={{ color: '#EDE6D8' }}>
            <Sparkles size={26} style={{ color: '#38bdf8' }} />
            Assistant
          </h1>
          <p className="text-sm mt-2" style={{ color: '#A89F8E' }}>
            Conversacion real con IA y tools operativas para actuar sobre la sesion.
          </p>
        </div>
        <div className="panel px-3 py-2 flex items-center gap-2 h-fit">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-red-500'}`} />
          <span className="label-caps" style={{ color: connected ? '#5BA86B' : '#C2452F' }}>
            {connected ? 'Socket Online' : 'Socket Offline'}
          </span>
        </div>
      </div>

      <div className="oracle-grid">
        <div className="oracle-context-rail">
          <div className="oracle-history-panel">
            <div className="oracle-history-title">
              <span>Conversaciones</span>
              <button onClick={createConversation} title="Nueva conversación" disabled={loading}><Plus size={14} /></button>
            </div>
            <div className="oracle-history-list">
              {conversations.map((conversation) => (
                <div className={`oracle-history-item${conversation.id === conversationId ? ' is-active' : ''}`} key={conversation.id}>
                  <button onClick={() => loadConversation(conversation.id)} title={conversation.title}>{conversation.title}</button>
                  <button className="oracle-delete-conversation" onClick={() => deleteConversation(conversation.id)} title="Eliminar conversación" disabled={loading}><Trash2 size={12} /></button>
                </div>
              ))}
              {!conversations.length && !historyLoading && <p>Todavía no hay conversaciones.</p>}
            </div>
          </div>
          <div className="panel p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: '#38bdf8' }} />
              <span className="label-caps" style={{ color: '#38bdf8' }}>Operador</span>
            </div>
            <p className="font-black text-sm" style={{ color: '#EDE6D8' }}>{user?.username}</p>
            <p className="text-xs leading-5" style={{ color: '#A89F8E' }}>
              Puedes escribir largo, con contexto y en lenguaje de mesa. La IA decide cuando responder y cuando usar tools.
            </p>
          </div>

          {contextLoading ? (
            <div className="panel p-5">
              <div className="w-6 h-6 border-2 border-cyan-300 rounded-full animate-spin" style={{ borderTopColor: 'transparent' }} />
            </div>
          ) : context && (
            <>
              <ContextCard title="Hora" value={context.world?.time || '...'} icon={Clock3} tone="#F59E0B" />
              <ContextCard title="Ubicacion" value={context.world?.location || '...'} icon={MapPin} tone="#5BA86B" />
              <ContextCard
                title="Heridos"
                value={context.injured?.length ? context.injured.map((char) => `${char.name} ${char.hp}/${char.maxHp}`).join(' | ') : 'Nadie herido'}
                icon={HeartPulse}
                tone="#C2452F"
              />
              <ContextCard title="Party" value={`${context.party?.length || 0} personajes cargados`} icon={Users} tone="#9B5DE5" />
            </>
          )}
        </div>

        <div className="oracle-conversation">
          <div className="panel-raised oracle-chat-panel">
            <div className="oracle-thread-header">
              <div className="oracle-thread-emblem"><Sparkles size={17} /></div>
              <div>
                <span>Oracle de campaña</span>
                <h2>Asistente del Director</h2>
                <p>Consulta contexto y ejecuta acciones en vivo.</p>
              </div>
              <div className="oracle-thread-actions">
                <select aria-label="Conversación activa" value={conversationId || ''} onChange={(event) => loadConversation(event.target.value)} disabled={historyLoading || !conversations.length}>
                  {!conversations.length && <option>Sin conversaciones</option>}
                  {conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}
                </select>
                <button onClick={createConversation} title="Nueva conversación" disabled={loading}><Plus size={14} /></button>
                <button onClick={() => deleteConversation(conversationId)} title="Eliminar conversación actual" disabled={loading || !conversationId}><Trash2 size={13} /></button>
                <div className={`oracle-thread-status${connected ? ' is-online' : ''}`}><i />{connected ? 'En línea' : 'Sin conexión'}</div>
              </div>
            </div>

            <div className="oracle-messages">
              {historyLoading && <div className="oracle-history-loading">Cargando conversación…</div>}
              {!historyLoading && messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} onUndo={() => sendCommand('deshacer')} />
              ))}
              {loading && (
                <div className="oracle-message-row is-assistant">
                  <div className="oracle-message-bubble is-thinking">
                    <div className="label-caps" style={{ color: '#67e8f9' }}>Assistant</div>
                    <div className="oracle-thinking-line"><i /><span>{THINKING_STEPS[loadingStep]}</span></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="oracle-composer-shell">
              {micError && (
                <p className="oracle-mic-error">{micError}</p>
              )}
              <div className="oracle-composer">
                <div className="oracle-input-wrap">
                  <textarea
                    className="input-base"
                    rows={2}
                    placeholder="Describe una situación o pide una acción sobre la partida..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendCommand(input);
                      }
                    }}
                  />
                  {interimText && (
                    <p className="oracle-interim-text">
                      {interimText}
                    </p>
                  )}
                </div>
                <button
                  onClick={toggleListening}
                  title={listening ? 'Detener grabacion' : 'Hablar'}
                  className={`oracle-voice-button${listening ? ' is-listening' : ''}`}
                  style={listening
                    ? { background: 'rgba(194,69,47,0.20)', border: '1px solid rgba(194,69,47,0.50)', color: '#F87171' }
                    : { background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.20)', color: '#8FDBF0' }
                  }
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  onClick={() => sendCommand(input)}
                  disabled={!input.trim() || loading}
                  className="oracle-send-button"
                  style={{ background: '#38bdf8', color: '#06131A' }}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
