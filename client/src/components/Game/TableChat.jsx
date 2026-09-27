import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, MessageCircle, Send, Shield, UserRound, X } from 'lucide-react';

export default function TableChat({ session, socket, user, isDm = false, onError }) {
  const [open, setOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [readMessageIds, setReadMessageIds] = useState(() => new Set());
  const [initialMessageIds] = useState(() => new Set(
    (Array.isArray(session?.table_messages) ? session.table_messages : []).map(message => message.id),
  ));
  const feedRef = useRef(null);
  const participants = Array.isArray(session?.participants) ? session.participants : [];
  const selectedPlayerPresent = participants.some(item => String(item.user_id) === String(selectedPlayerId));
  const activePlayerId = isDm ? (selectedPlayerPresent ? selectedPlayerId : participants[0]?.user_id || '') : user?.id;
  const allMessages = Array.isArray(session?.table_messages) ? session.table_messages : [];
  const messages = allMessages.filter(message => String(message.player_user_id) === String(activePlayerId));
  const activeParticipant = participants.find(item => String(item.user_id) === String(activePlayerId));
  const activeName = participantName(activeParticipant);
  const unreadMessages = allMessages.filter(message => (
    String(message.author_user_id) !== String(user?.id)
    && !initialMessageIds.has(message.id)
    && !readMessageIds.has(message.id)
    && !(open && (!isDm || String(message.player_user_id) === String(activePlayerId)))
  ));
  const unreadByPlayer = unreadMessages.reduce((counts, message) => {
    const playerId = String(message.player_user_id || '');
    counts[playerId] = (counts[playerId] || 0) + 1;
    return counts;
  }, {});
  const unreadCount = Object.values(unreadByPlayer).reduce((total, count) => total + count, 0);

  useEffect(() => {
    if (!open) return;
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages.length, open, activePlayerId]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return;
      const receivedIds = messages
        .filter(message => String(message.author_user_id) !== String(user?.id))
        .map(message => message.id);
      if (receivedIds.length) setReadMessageIds(current => new Set([...current, ...receivedIds]));
      setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, messages, user?.id]);

  const markConversationRead = conversationMessages => {
    const receivedIds = conversationMessages
      .filter(message => String(message.author_user_id) !== String(user?.id))
      .map(message => message.id);
    if (!receivedIds.length) return;
    setReadMessageIds(current => new Set([...current, ...receivedIds]));
  };

  const openMessages = () => {
    setOpen(true);
    markConversationRead(messages);
  };

  const closeMessages = () => {
    markConversationRead(messages);
    setOpen(false);
  };

  const choosePlayer = playerId => {
    setSelectedPlayerId(playerId);
    setDraft('');
    markConversationRead(allMessages.filter(message => String(message.player_user_id) === String(playerId)));
  };

  const send = event => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !socket || sending || !activePlayerId) return;
    setSending(true);
    socket.timeout(7000).emit('game:send-table-message', {
      sessionId: session.id,
      text,
      ...(isDm ? { playerUserId: activePlayerId } : {}),
    }, (timeoutError, response) => {
      setSending(false);
      if (timeoutError || !response?.ok) {
        onError?.(response?.message || 'No se pudo enviar el mensaje. Revisa tu conexión.');
        return;
      }
      setDraft('');
    });
  };

  return (
    <div className={`game-direct-messages${open ? ' is-open' : ''}`}>
      {!open && (
        <button className={`game-direct-launcher${unreadCount ? ' has-unread' : ''}`} type="button" onClick={openMessages} aria-label={unreadCount ? `Abrir mensajes privados, ${unreadLabel(unreadCount)}` : 'Abrir mensajes privados'}>
          <MessageCircle size={17} />
          <span>Mensajes</span>
          {unreadCount > 0 && <strong className="game-direct-unread" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</strong>}
        </button>
      )}

      {open && (
        <section className={`game-direct-drawer${isDm ? ' is-dm' : ''}`} role="dialog" aria-label="Mensajes privados de la partida">
          <header className="game-direct-header">
            <div className="game-direct-heading">
              <span className="game-direct-mark">{isDm ? <Shield size={16} /> : <MessageCircle size={16} />}</span>
              <div><small>Canal privado</small><strong>{isDm ? 'Mensajes de jugadores' : 'Dungeon Master'}</strong></div>
            </div>
            <button type="button" onClick={closeMessages} aria-label="Cerrar mensajes"><X size={17} /></button>
          </header>

          <div className="game-direct-body">
            {isDm && (
              <nav className="game-direct-players" aria-label="Conversaciones con jugadores">
                <div className="game-direct-players-title"><UserRound size={13} /><span>Jugadores</span></div>
                {participants.map(participant => {
                  const playerId = String(participant.user_id);
                  const name = participantName(participant);
                  const count = unreadByPlayer[playerId] || 0;
                  return (
                    <button key={playerId} type="button" className={`${playerId === String(activePlayerId) ? 'is-active' : ''}${count ? ' has-unread' : ''}`} onClick={() => choosePlayer(playerId)} aria-label={count ? `${name}, ${unreadLabel(count)}` : name}>
                      <i>{initials(name)}</i><span><strong>{name}</strong><small>{participant.connected ? 'En línea' : 'Desconectado'}</small></span>{count > 0 && <em>{count}</em>}<ChevronLeft size={13} />
                    </button>
                  );
                })}
                {!participants.length && <p>Todavía no hay jugadores en esta mesa.</p>}
              </nav>
            )}

            <div className={`game-direct-conversation${activePlayerId ? '' : ' is-empty'}`}>
              {activePlayerId ? (
                <>
                  {isDm && <div className="game-direct-contact"><i>{initials(activeName)}</i><div><small>Conversación privada</small><strong>{activeName}</strong></div></div>}
                  <div className="game-direct-feed" ref={feedRef} aria-live="polite">
                    {!messages.length && (
                      <div className="game-direct-empty">
                        <MessageCircle size={22} />
                        <strong>Un canal sólo para ustedes</strong>
                        <span>{isDm ? `Escribe a ${activeName}. Los demás jugadores no verán esta conversación.` : 'Sólo tú y el Dungeon Master pueden leer estos mensajes.'}</span>
                      </div>
                    )}
                    {messages.map(message => {
                      const mine = String(message.author_user_id) === String(user?.id);
                      return (
                        <article key={message.id} className={`game-direct-message${mine ? ' is-mine' : ''}`}>
                          <header><strong>{mine ? 'Tú' : message.author_role === 'DM' ? 'DM' : message.author_name || 'Jugador'}</strong><time>{formatTime(message.created_at)}</time></header>
                          <p>{message.text}</p>
                        </article>
                      );
                    })}
                  </div>
                  <form className="game-direct-form" onSubmit={send}>
                    <input value={draft} onChange={event => setDraft(event.target.value)} maxLength={700} placeholder={isDm ? `Mensaje para ${activeName}...` : 'Mensaje privado al DM...'} aria-label="Mensaje privado" autoFocus />
                    <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar mensaje"><Send size={15} /></button>
                  </form>
                </>
              ) : <div className="game-direct-empty"><UserRound size={22} /><strong>Selecciona un jugador</strong><span>Sus conversaciones privadas aparecerán aquí.</span></div>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function participantName(participant) {
  return participant?.character?.name || participant?.user?.username || 'Jugador';
}

function initials(name) {
  return String(name || 'J').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function formatTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function unreadLabel(count) {
  return `${count} ${count === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`;
}
