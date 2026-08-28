import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Shield, Users } from 'lucide-react';

export default function TableChat({ session, socket, user, isDm = false, onError }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const feedRef = useRef(null);
  const messages = Array.isArray(session?.table_messages) ? session.table_messages : [];

  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages.length]);

  const send = event => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !socket || sending) return;
    setSending(true);
    socket.emit('game:send-table-message', { sessionId: session.id, text }, response => {
      setSending(false);
      if (!response?.ok) {
        onError?.(response?.message || 'No se pudo enviar el mensaje.');
        return;
      }
      setDraft('');
    });
  };

  return (
    <section className="game-table-chat" aria-label="Mensajes de la mesa">
      <header className="game-table-chat-header">
        <div><MessageCircle size={14} /><span>{isDm ? 'Mensajes de la mesa' : 'Canal del Dungeon Master'}</span></div>
        <small>{messages.length ? `${messages.length} mensaje${messages.length === 1 ? '' : 's'}` : 'En vivo'}</small>
      </header>
      <div className="game-table-chat-feed" ref={feedRef} aria-live="polite">
        {!messages.length && (
          <div className="game-table-chat-empty">
            {isDm ? <Shield size={15} /> : <Users size={15} />}
            <span>{isDm ? 'Envía una indicación a toda la mesa.' : 'Aquí verás los mensajes del DM y de tu mesa.'}</span>
          </div>
        )}
        {messages.map(message => {
          const mine = String(message.author_user_id) === String(user?.id);
          const dmMessage = message.author_role === 'DM';
          return (
            <article key={message.id} className={`game-table-chat-message${dmMessage ? ' is-dm' : ''}${mine ? ' is-mine' : ''}`}>
              <header><strong>{dmMessage ? 'DM' : message.author_name || 'Jugador'}</strong><time>{formatTime(message.created_at)}</time></header>
              <p>{message.text}</p>
            </article>
          );
        })}
      </div>
      <form className="game-table-chat-form" onSubmit={send}>
        <input value={draft} onChange={event => setDraft(event.target.value)} maxLength={700} placeholder={isDm ? 'Escribe para toda la mesa...' : 'Escribe a la mesa...'} aria-label="Mensaje para la mesa" />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar mensaje"><Send size={14} /></button>
      </form>
    </section>
  );
}

function formatTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}
