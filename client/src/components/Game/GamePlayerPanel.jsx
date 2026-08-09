import { useEffect, useState } from 'react';
import { Backpack, Check, CheckCircle, Circle, Clock, DoorOpen, Edit3, Heart, Pause, Scroll, Shield, Sparkles, Swords, Target, UserRound, Users, X, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import GameStage from './GameStage';
import DiceTray from './DiceTray';
import CharacterSheet from '../Hero/CharacterSheet';
import CharacterEditorModal from '../Hero/CharacterEditorModal';
import GameAudioPlayer from './GameAudioPlayer';

export default function GamePlayerPanel() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [session, setSession] = useState(null);
  const [character, setCharacter] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sheetSection, setSheetSection] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!socket) return undefined;
    const onState = next => {
      setSession(current => {
        if (!next || !current) return next;
        const dismissingIds = new Set((current.rolls || []).filter(roll => roll.dismissing).map(roll => String(roll.id)));
        if (!dismissingIds.size) return next;
        return {
          ...next,
          rolls: (next.rolls || []).map(roll => dismissingIds.has(String(roll.id)) ? { ...roll, dismissing: true } : roll),
        };
      });
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
    const onTokensMoved = ({ moves = [] } = {}) => setSession(current => {
      if (!current) return current;
      const positions = new Map(moves.map(move => [move.tokenId, move]));
      return { ...current, tokens: (current.tokens || []).map(token => positions.has(token.id) ? { ...token, ...positions.get(token.id) } : token) };
    });
    const onTokenHpUpdated = ({ tokenId, hpCurrent, hpMax, hpTemp }) => setSession(current => current ? ({
      ...current,
      tokens: (current.tokens || []).map(token => token.id === tokenId ? ({
        ...token,
        character: token.character ? { ...token.character, hp_current: hpCurrent, hp_max: hpMax, hp_temp: hpTemp } : token.character,
      }) : token),
    }) : current);
    const onTokenConditionUpdated = ({ tokenId, conditions = [] }) => setSession(current => current ? ({
      ...current,
      tokens: (current.tokens || []).map(token => token.id === tokenId ? { ...token, conditions } : token),
    }) : current);
    const onTurnUpdated = ({ round, turnIndex, activeCharacterId, turnOrder }) => setSession(current => current ? ({
      ...current, round, turn_index: turnIndex, active_character_id: activeCharacterId,
      ...(Array.isArray(turnOrder) ? { turn_order: turnOrder } : {}),
    }) : current);
    const onAnnotationAdded = ({ annotation }) => setSession(current => current && annotation ? ({
      ...current,
      stage_annotations: [...(current.stage_annotations || []).filter(item => item.id !== annotation.id), annotation],
    }) : current);
    const onAnnotationUpdated = ({ annotation }) => setSession(current => current && annotation ? ({
      ...current,
      stage_annotations: (current.stage_annotations || []).map(item => item.id === annotation.id ? annotation : item),
    }) : current);
    const onAnnotationDeleted = ({ annotationId, viewKey }) => setSession(current => current ? ({
      ...current,
      stage_annotations: (current.stage_annotations || []).filter(item => item.id !== annotationId || item.view_key !== viewKey),
    }) : current);
    const onAnnotationsCleared = ({ viewKey }) => setSession(current => current ? ({
      ...current,
      stage_annotations: (current.stage_annotations || []).filter(item => item.view_key !== viewKey),
    }) : current);
    const onRollUpsert = roll => setSession(current => current ? ({
      ...current,
      rolls: [roll, ...(current.rolls || []).filter(item => item.id !== roll.id)],
    }) : current);
    const onRollDismissing = ({ rollIds = [] } = {}) => setSession(current => {
      if (!current) return current;
      const ids = new Set(rollIds.map(String));
      return { ...current, rolls: (current.rolls || []).map(roll => ids.has(String(roll.id)) ? { ...roll, dismissing: true } : roll) };
    });
    const onRollDismissed = ({ rollIds = [] } = {}) => setSession(current => {
      if (!current) return current;
      const ids = new Set(rollIds.map(String));
      return { ...current, rolls: (current.rolls || []).filter(roll => !ids.has(String(roll.id))) };
    });

    socket.on('game:state', onState);
    socket.on('game:error', onError);
    socket.on('players-data', onPlayers);
    socket.on('stats-updated', onPlayers);
    socket.on('game:token-moved', onTokenMoved);
    socket.on('game:tokens-moved', onTokensMoved);
    socket.on('game:token-hp-updated', onTokenHpUpdated);
    socket.on('game:token-condition-updated', onTokenConditionUpdated);
    socket.on('game:turn-updated', onTurnUpdated);
    socket.on('game:annotation-added', onAnnotationAdded);
    socket.on('game:annotation-updated', onAnnotationUpdated);
    socket.on('game:annotation-deleted', onAnnotationDeleted);
    socket.on('game:annotations-cleared', onAnnotationsCleared);
    socket.on('game:roll-upsert', onRollUpsert);
    socket.on('game:roll-dismissing', onRollDismissing);
    socket.on('game:roll-dismissed', onRollDismissed);
    socket.emit('game:get-current');
    socket.emit('get-players');
    return () => {
      socket.off('game:state', onState);
      socket.off('game:error', onError);
      socket.off('players-data', onPlayers);
      socket.off('stats-updated', onPlayers);
      socket.off('game:token-moved', onTokenMoved);
      socket.off('game:tokens-moved', onTokensMoved);
      socket.off('game:token-hp-updated', onTokenHpUpdated);
      socket.off('game:token-condition-updated', onTokenConditionUpdated);
      socket.off('game:turn-updated', onTurnUpdated);
      socket.off('game:annotation-added', onAnnotationAdded);
      socket.off('game:annotation-updated', onAnnotationUpdated);
      socket.off('game:annotation-deleted', onAnnotationDeleted);
      socket.off('game:annotations-cleared', onAnnotationsCleared);
      socket.off('game:roll-upsert', onRollUpsert);
      socket.off('game:roll-dismissing', onRollDismissing);
      socket.off('game:roll-dismissed', onRollDismissed);
    };
  }, [socket, user.id]);

  useEffect(() => {
    if (!sheetSection) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setSheetSection(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [sheetSection]);

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

  const rollFromCharacterSheet = request => rollDice({
    sides: 20,
    quantity: 1,
    modifier: request.modifier || 0,
    label: request.label || request.title || 'Prueba de característica',
  });

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

      <div className="game-player-workspace">
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

        <aside className="game-player-character" aria-label="Ficha básica del personaje">
          <GameAudioPlayer session={session} />
          {character ? <PlayerCombatSheet character={character} onRoll={rollDice} onOpenSheet={setSheetSection} /> : <div className="game-panel-empty">No se pudo cargar tu personaje.</div>}
        </aside>
      </div>

      {sheetSection && character && (
        <div className="game-character-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSheetSection(null); }}>
          <aside className="game-character-drawer" aria-label="Ficha completa durante la partida">
            <header><div><span className="game-kicker">Acceso de partida</span><strong>{character.name}</strong></div><nav>{character.self_edit_enabled && <button type="button" className="is-edit" onClick={() => { setSheetSection(null); setEditorOpen(true); }}><Edit3 size={12} />Editar ficha</button>}<button type="button" onClick={() => setSheetSection(null)} aria-label="Cerrar ficha"><X size={17} /></button></nav></header>
            <div className="game-character-drawer-body"><CharacterSheet key={sheetSection} character={character} embedded initialTab={sheetSection} onRoll={rollFromCharacterSheet} /></div>
          </aside>
        </div>
      )}
      {editorOpen && character && <CharacterEditorModal character={character} socket={socket} onClose={() => setEditorOpen(false)} />}
    </div>
  );
}

function PlayerCombatSheet({ character, onRoll, onOpenSheet }) {
  const attributes = character.stats || character.attributes || {};
  const hp = Number(character.hp) || 0;
  const maxHp = Number(character.maxHp) || 1;
  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const hpColor = hpPercent > 50 ? '#65ad72' : hpPercent > 20 ? '#d0a348' : '#c94f43';
  const modifier = value => Math.floor(((Number(value) || 10) - 10) / 2);
  const signed = value => value >= 0 ? `+${value}` : String(value);
  const portrait = character.rendered_url || character.image_url || character.base_body_url;
  const proficiency = Number(character.proficiencyBonus) || 2;
  const skills = [
    ['Acrobacias', 'dex'], ['Trato con Animales', 'wis'], ['Arcana', 'int'],
    ['Atletismo', 'str'], ['Engaño', 'cha'], ['Historia', 'int'],
    ['Perspicacia', 'wis'], ['Intimidación', 'cha'], ['Investigación', 'int'],
    ['Medicina', 'wis'], ['Naturaleza', 'int'], ['Percepción', 'wis'],
    ['Interpretación', 'cha'], ['Persuasión', 'cha'], ['Religión', 'int'],
    ['Juego de Manos', 'dex'], ['Sigilo', 'dex'], ['Supervivencia', 'wis'],
  ].map(([name, attr]) => {
    const configured = (character.skills || []).find(skill => skill.name === name);
    const proficiencyLevel = Number(configured?.proficiency_level || (configured?.proficient ? 1 : 0));
    return { name, attr, proficient: proficiencyLevel > 0, bonus: modifier(attributes[attr]) + (proficiencyLevel * proficiency) };
  }).sort((left, right) => left.name.localeCompare(right.name));

  return (
    <div className="game-combat-sheet">
      <div className="game-combat-sheet-header">
        <div className="game-combat-portrait">{portrait ? <img src={portrait} alt="" /> : <Shield size={22} />}</div>
        <div><span className="game-kicker">Tu personaje</span><h2>{character.name || 'Aventurero'}</h2><p>{[character.race, character.class].filter(Boolean).join(' · ') || 'Sin clase'}</p></div>
      </div>
      <div className="game-combat-hp" style={{ '--player-hp-color': hpColor }}><div><span><Heart size={13} /> Puntos de golpe</span><strong>{hp}<small> / {maxHp}</small></strong></div><i><b style={{ width: `${hpPercent}%` }} /></i></div>
      <div className="game-combat-vitals">
        <div><Shield size={14} /><strong>{character.ac ?? 10}</strong><span>CA</span></div>
        <div><Zap size={14} /><strong>{signed(character.initiative ?? modifier(attributes.dex))}</strong><span>Iniciativa</span></div>
        <div><Swords size={14} /><strong>{character.speed ?? 30}</strong><span>Velocidad</span></div>
      </div>
      <nav className="game-combat-tools" aria-label="Secciones de la ficha">
        {[
          ['stats', 'Ficha', <UserRound key="stats-icon" size={13} />],
          ['inventory', 'Equipo', <Backpack key="inventory-icon" size={13} />],
          ['social', 'Rasgos', <Scroll key="social-icon" size={13} />],
          ['magic', 'Magia', <Sparkles key="magic-icon" size={13} />],
        ].map(([id, label, icon]) => <button key={id} type="button" onClick={() => onOpenSheet(id)}>{icon}<span>{label}</span></button>)}
      </nav>
      <div className="game-combat-abilities">
        {[['str', 'FUE'], ['dex', 'DES'], ['con', 'CON'], ['int', 'INT'], ['wis', 'SAB'], ['cha', 'CAR']].map(([key, label]) => {
          const score = Number(attributes[key]) || 10;
          const value = modifier(score);
          return <button key={key} type="button" onClick={() => onRoll({ sides: 20, quantity: 1, modifier: value, label: `Prueba de ${label}` })} title={`Tirar ${label}`}><span>{label}</span><strong>{signed(value)}</strong><small>{score}</small></button>;
        })}
      </div>
      <section className="game-combat-skills" aria-label="Habilidades del personaje">
        <header><span><Target size={11} /> Habilidades</span><small>Clic para tirar d20</small></header>
        <div>
          {skills.map(skill => (
            <button
              key={skill.name}
              type="button"
              className={skill.proficient ? 'is-proficient' : ''}
              onClick={() => onRoll({ sides: 20, quantity: 1, modifier: skill.bonus, label: skill.name })}
              title={`Tirar ${skill.name}`}
            >
              {skill.proficient ? <CheckCircle size={11} /> : <Circle size={11} />}
              <span>{skill.name}</span>
              <small>{skill.attr.toUpperCase()}</small>
              <strong>{signed(skill.bonus)}</strong>
            </button>
          ))}
        </div>
      </section>
      <p className="game-combat-sheet-tip">Todas las tiradas esenciales están disponibles sin abandonar la mesa.</p>
    </div>
  );
}
