import { useEffect, useState } from 'react';
import { Check, Clock, DoorOpen, Pause, Shield, Swords, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import CharacterSheet from '../Hero/CharacterSheet';
import GameStage from './GameStage';
import DiceTray from './DiceTray';

export default function GamePlayerPanel() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [session, setSession] = useState(null);
  const [character, setCharacter] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return undefined;
    const onState = next => {
      setSession(next);
      setLoading(false);
    };
    const onError = payload => {
      setError(payload?.message || 'No se pudo completar la acción.');
      setLoading(false);
    };
    const onPlayers = players => {
      const owned = (players || []).find(candidate => candidate.UserId === user.id && !candidate.is_npc);
      if (owned) setCharacter(owned);
    };
    const onTokenMoved = ({ tokenId, x, y }) => setSession(current => current ? ({
      ...current,
      tokens: current.tokens.map(token => token.id === tokenId ? { ...token, x, y } : token),
    }) : current);

    socket.on('game:state', onState);
    socket.on('game:error', onError);
    socket.on('players-data', onPlayers);
    socket.on('stats-updated', onPlayers);
    socket.on('game:token-moved', onTokenMoved);
    socket.emit('game:get-current');
    socket.emit('get-players');
    return () => {
      socket.off('game:state', onState);
      socket.off('game:error', onError);
      socket.off('players-data', onPlayers);
      socket.off('stats-updated', onPlayers);
      socket.off('game:token-moved', onTokenMoved);
    };
  }, [socket, user.id]);

  const join = event => {
    event.preventDefault();
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    socket?.emit('game:join', { code: code.trim().toUpperCase(), characterId: character?.id });
  };

  const rollDice = (request, done) => {
    setError('');
    socket?.emit('game:roll-dice', { sessionId: session.id, ...request }, response => {
      done?.();
      if (!response?.ok) setError(response?.message || 'No se pudo completar la tirada.');
    });
  };

  const resolveDiceRoll = (rollId, results) => {
    socket?.emit('game:resolve-roll', { sessionId: session.id, rollId, results }, response => {
      if (!response?.ok) setError(response?.message || 'No se pudo confirmar el resultado de los dados.');
    });
  };

  if (loading && !session) {
    return <div className="game-player-loading"><div /><span>Buscando tu mesa...</span></div>;
  }

  if (!session) {
    return (
      <div className="game-join-shell">
        <form className="game-join-card" onSubmit={join}>
          <span className="game-kicker">Sesión compartida</span>
          <DoorOpen size={36} />
          <h1>Entra a la mesa</h1>
          <p>Escribe el código que te dio tu Dungeon Master. Tu personaje asignado se conectará automáticamente.</p>
          <label><span>Código de invitación</span><input value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={8} placeholder="ABC123" autoFocus /></label>
          <div className="game-join-character"><Shield size={17} /><span><small>Entrarás como</small><strong>{character?.name || 'Personaje no asignado'}</strong></span></div>
          <button disabled={!code.trim() || !character}>Unirme a la partida</button>
          {error && <small className="game-error">{error}</small>}
        </form>
      </div>
    );
  }

  const participant = session.participants.find(item => item.user_id === user.id);
  const activeParticipant = session.participants.find(item => item.character_id === session.active_character_id);
  const isMyTurn = participant?.character_id === session.active_character_id;

  if (session.status === 'WAITING') {
    return (
      <div className="game-waiting-shell">
        <header><span className="game-kicker">Sala de espera</span><h1>{session.title}</h1><p>Código {session.code}</p></header>
        <div className="game-waiting-card">
          <div className="game-waiting-emblem"><Swords size={30} /></div>
          <h2>La aventura está por comenzar</h2>
          <p>Confirma que estás preparado. El DM podrá iniciar cuando todos los jugadores estén listos.</p>
          <div className="game-waiting-roster">
            {session.participants.map(item => (
              <div key={item.id} className={item.is_ready ? 'is-ready' : ''}>
                <span>{item.character?.image_url ? <img src={item.character.image_url} alt="" /> : item.user?.username?.slice(0, 1)}</span>
                <div><strong>{item.character?.name}</strong><small>{item.user?.username}</small></div>
                <i>{item.is_ready ? <Check size={13} /> : <Clock size={13} />}</i>
              </div>
            ))}
          </div>
          <button className={participant?.is_ready ? 'is-ready' : ''} onClick={() => socket.emit('game:ready', { sessionId: session.id, ready: !participant?.is_ready })}>
            {participant?.is_ready ? <><Check size={16} /> Estoy listo</> : 'Marcarme como listo'}
          </button>
          {error && <small className="game-error">{error}</small>}
        </div>
      </div>
    );
  }

  if (session.status === 'FINISHED') {
    return <div className="game-finished"><Swords size={38} /><h1>La sesión ha terminado</h1><p>El registro de la aventura permanece en tus crónicas.</p></div>;
  }

  return (
    <div className="game-player-shell">
      <header className="game-player-bar">
        <div><span className="game-kicker">Mesa de juego</span><h1>{session.title}</h1></div>
        <div className="game-player-round"><span>Ronda</span><strong>{session.round}</strong></div>
        <div className={`game-player-turn${isMyTurn ? ' is-mine' : ''}`}><span>{isMyTurn ? 'Tu turno' : 'Turno actual'}</span><strong>{isMyTurn ? character?.name : activeParticipant?.character?.name || 'DM'}</strong></div>
        {session.status === 'PAUSED' && <div className="game-paused-badge"><Pause size={13} /> Partida pausada</div>}
        <div className="game-player-presence"><Users size={14} />{session.participants.filter(item => item.connected).length} conectados</div>
      </header>

      {error && <div className="game-error-banner"><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div>}

      <section className="game-player-stage-wrap">
        <GameStage
          session={session}
          userId={user.id}
          onMoveToken={(tokenId, x, y) => socket.emit('game:move-token', { sessionId: session.id, tokenId, x, y })}
          onResolveRoll={resolveDiceRoll}
        />
        <div className="game-player-stage-note">
          <DiceTray onRoll={rollDice} compact />
          <span>{session.shared_type === 'MAP' ? 'Mapa de combate' : 'Escena compartida'}</span>
          <p>{isMyTurn ? 'Puedes mover tu token arrastrándolo sobre el mapa.' : 'Observa la escena; el movimiento se habilitará durante tu turno.'}</p>
        </div>
      </section>

      <section className="game-player-character">
        <div className="game-character-heading"><span className="game-kicker">Panel de personaje</span><h2>Decide y actúa</h2></div>
        {character ? <CharacterSheet character={character} embedded onRoll={roll => rollDice({ sides: 20, quantity: 1, modifier: roll.modifier || 0, label: roll.title || 'Tirada de caracteristica' })} /> : <div className="game-panel-empty">No se pudo cargar tu personaje.</div>}
      </section>
    </div>
  );
}
