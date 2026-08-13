import { useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Clipboard,
  Eye,
  EyeOff,
  GripVertical,
  Heart,
  Image as ImageIcon,
  LockKeyhole,
  Map as MapIcon,
  MessageCircle,
  MonitorUp,
  Moon,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Settings2,
  Shield,
  SkipBack,
  SkipForward,
  Sparkles,
  Skull,
  Sun,
  Sunset,
  Swords,
  Thermometer,
  Trash2,
  Upload,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config';
import AssistantPanel from './AssistantPanel';
import GameStage from '../components/Game/GameStage';
import DiceTray from '../components/Game/DiceTray';
import GameAudioControl from './GameAudioControl';
import TurnActionPanel from '../components/Game/TurnActionPanel';
import { deriveWorldConditions } from '../utils/worldTime';

function resolveMediaUrl(value) {
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value;
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

export default function GameMasterPanel() {
  const { socket, connected, connectionError } = useSocket();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [hostedSessions, setHostedSessions] = useState([]);
  const [switchingSession, setSwitchingSession] = useState(false);
  const sessionDashboardRef = useRef(false);
  const [players, setPlayers] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('La campaña actual');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [mediaType, setMediaType] = useState('IMAGE');
  const [gridEnabled, setGridEnabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [rightTab, setRightTab] = useState('session');
  const [partyView, setPartyView] = useState('npcs');
  const [composerOpen, setComposerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [savingAsset, setSavingAsset] = useState(false);
  const [assetOverStage, setAssetOverStage] = useState(false);
  const [assetOverTray, setAssetOverTray] = useState(false);
  const [dropAssetType, setDropAssetType] = useState('IMAGE');
  const [trayUploading, setTrayUploading] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [npcSearch, setNpcSearch] = useState('');
  const [npcsLoading, setNpcsLoading] = useState(false);
  const [npcsError, setNpcsError] = useState('');
  const [quickNpcOpen, setQuickNpcOpen] = useState(false);
  const [draggedTurnId, setDraggedTurnId] = useState(null);
  const [creatingNpcToken, setCreatingNpcToken] = useState(false);
  const [quickNpc, setQuickNpc] = useState({ name: '', hpMax: 10, armorClass: 10, npcType: 'enemigo', imageUrl: '' });
  const [stageToolbarHost, setStageToolbarHost] = useState(null);
  const [combatTargeting, setCombatTargeting] = useState(null);
  const [selectedActiveTokenId, setSelectedActiveTokenId] = useState(null);
  const [dismissedCombatNotices, setDismissedCombatNotices] = useState([]);
  const [worldState, setWorldState] = useState({ global_time: '12:00', day_period: 'Día', temperature_c: 24 });
  const deferredAssetSearch = useDeferredValue(assetSearch);

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
      setSessionResolved(true);
    };
    const onError = payload => setError(payload?.message || 'No se pudo completar la acción.');
    const onPlayers = data => setPlayers(Array.isArray(data) ? data.filter(character => !character.is_npc) : []);
    const onScenes = data => setScenes(Array.isArray(data) ? data : []);
    const onNpcs = data => {
      setNpcs(Array.isArray(data) ? data : []);
      setNpcsLoading(false);
      setNpcsError('');
    };
    const onWorldState = state => setWorldState(current => ({ ...current, ...state }));
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
    const onVfxAdded = ({ effect }) => setSession(current => current && effect ? ({
      ...current,
      stage_vfx: [...(current.stage_vfx || []).filter(item => item.id !== effect.id), effect],
    }) : current);
    const onVfxUpdated = ({ effect }) => setSession(current => current && effect ? ({
      ...current,
      stage_vfx: (current.stage_vfx || []).map(item => item.id === effect.id ? effect : item),
    }) : current);
    const onVfxDeleted = ({ effectId, viewKey }) => setSession(current => current ? ({
      ...current,
      stage_vfx: (current.stage_vfx || []).filter(item => item.id !== effectId || item.view_key !== viewKey),
    }) : current);
    const onVfxCleared = ({ viewKey }) => setSession(current => current ? ({
      ...current,
      stage_vfx: (current.stage_vfx || []).filter(item => item.view_key !== viewKey),
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

    const syncGame = () => {
      setSessionResolved(false);
      if (!sessionDashboardRef.current) socket.emit('game:get-current');
      else setSessionResolved(true);
      socket.timeout(5000).emit('game:list-hosted', (timeoutError, response) => {
        if (!timeoutError && response?.ok) setHostedSessions(Array.isArray(response.sessions) ? response.sessions : []);
      });
      socket.emit('get-players');
      socket.emit('get-scenes');
      socket.emit('get-global-state');
    };

    socket.on('game:state', onState);
    socket.on('game:error', onError);
    socket.on('players-data', onPlayers);
    socket.on('stats-updated', onPlayers);
    socket.on('scenes-data', onScenes);
    socket.on('all-npcs', onNpcs);
    socket.on('game:token-moved', onTokenMoved);
    socket.on('game:tokens-moved', onTokensMoved);
    socket.on('game:token-hp-updated', onTokenHpUpdated);
    socket.on('game:token-condition-updated', onTokenConditionUpdated);
    socket.on('game:turn-updated', onTurnUpdated);
    socket.on('game:annotation-added', onAnnotationAdded);
    socket.on('game:annotation-updated', onAnnotationUpdated);
    socket.on('game:annotation-deleted', onAnnotationDeleted);
    socket.on('game:annotations-cleared', onAnnotationsCleared);
    socket.on('game:vfx-added', onVfxAdded);
    socket.on('game:vfx-updated', onVfxUpdated);
    socket.on('game:vfx-deleted', onVfxDeleted);
    socket.on('game:vfx-cleared', onVfxCleared);
    socket.on('game:roll-upsert', onRollUpsert);
    socket.on('game:roll-dismissing', onRollDismissing);
    socket.on('game:roll-dismissed', onRollDismissed);
    socket.on('global-state-data', onWorldState);
    socket.on('connect', syncGame);
    if (socket.connected) syncGame();
    return () => {
      socket.off('game:state', onState);
      socket.off('game:error', onError);
      socket.off('players-data', onPlayers);
      socket.off('stats-updated', onPlayers);
      socket.off('scenes-data', onScenes);
      socket.off('all-npcs', onNpcs);
      socket.off('game:token-moved', onTokenMoved);
      socket.off('game:tokens-moved', onTokensMoved);
      socket.off('game:token-hp-updated', onTokenHpUpdated);
      socket.off('game:token-condition-updated', onTokenConditionUpdated);
      socket.off('game:turn-updated', onTurnUpdated);
      socket.off('game:annotation-added', onAnnotationAdded);
      socket.off('game:annotation-updated', onAnnotationUpdated);
      socket.off('game:annotation-deleted', onAnnotationDeleted);
      socket.off('game:annotations-cleared', onAnnotationsCleared);
      socket.off('game:vfx-added', onVfxAdded);
      socket.off('game:vfx-updated', onVfxUpdated);
      socket.off('game:vfx-deleted', onVfxDeleted);
      socket.off('game:vfx-cleared', onVfxCleared);
      socket.off('game:roll-upsert', onRollUpsert);
      socket.off('game:roll-dismissing', onRollDismissing);
      socket.off('game:roll-dismissed', onRollDismissed);
      socket.off('global-state-data', onWorldState);
      socket.off('connect', syncGame);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || rightTab !== 'party') return undefined;

    setNpcsLoading(true);
    setNpcsError('');
    socket.timeout(7000).emit('get-all-npcs', (timeoutError, response) => {
      if (timeoutError) {
        setNpcsLoading(false);
        setNpcsError('No se pudo sincronizar el archivo de NPCs.');
        return;
      }
      if (!response?.ok) {
        setNpcsLoading(false);
        setNpcsError(response?.message || 'No se pudieron cargar los NPCs.');
        return;
      }
      setNpcs(Array.isArray(response.npcs) ? response.npcs : []);
      setNpcsLoading(false);
    });

    return undefined;
  }, [socket, rightTab]);

  const emit = (event, payload = {}) => {
    setError('');
    socket?.emit(event, payload);
  };

  const updateWorldTime = value => {
    const conditions = deriveWorldConditions(value);
    setWorldState(current => ({ ...current, global_time: conditions.time, day_period: conditions.dayPeriod, temperature_c: conditions.temperatureC }));
    socket.timeout(5000).emit('update-global-state', { global_time: conditions.time }, (timeoutError, response) => {
      if (timeoutError || !response?.ok) {
        setError(response?.message || 'No se pudo actualizar la hora del mundo.');
        socket.emit('get-global-state');
      }
    });
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

  const refreshHostedSessions = () => {
    socket?.timeout(5000).emit('game:list-hosted', (timeoutError, response) => {
      if (!timeoutError && response?.ok) setHostedSessions(Array.isArray(response.sessions) ? response.sessions : []);
    });
  };

  const createSession = (forceNew = false) => {
    if (!socket || !connected) {
      setError(connectionError || 'La conexión con la mesa está interrumpida. Espera unos segundos o recarga la página.');
      return;
    }
    setError('');
    setCreatingSession(true);
    sessionDashboardRef.current = false;
    socket.timeout(7000).emit('game:create', { title: forceNew ? `${title} - prueba` : title, forceNew }, (timeoutError, response) => {
      setCreatingSession(false);
      if (timeoutError) {
        setError('El servidor no confirmó la creación de la sala. Inténtalo nuevamente.');
        return;
      }
      if (!response?.ok) setError(response?.message || 'No se pudo crear la sala.');
      else refreshHostedSessions();
    });
  };

  const openHostedSession = sessionId => {
    if (!sessionId || Number(sessionId) === Number(session?.id) || switchingSession) return;
    setError('');
    setSwitchingSession(true);
    sessionDashboardRef.current = false;
    socket?.timeout(7000).emit('game:open-hosted', { sessionId }, (timeoutError, response) => {
      setSwitchingSession(false);
      if (timeoutError) return setError('El servidor no confirmo el cambio de mesa.');
      if (!response?.ok) return setError(response?.message || 'No se pudo abrir la mesa elegida.');
      refreshHostedSessions();
    });
  };

  const leaveSessionToDashboard = () => {
    setError('');
    setSwitchingSession(true);
    socket?.timeout(7000).emit('game:leave-hosted', (timeoutError, response) => {
      setSwitchingSession(false);
      if (timeoutError || !response?.ok) return setError(response?.message || 'No se pudo salir de la mesa.');
      sessionDashboardRef.current = true;
      setSession(null);
      setSessionResolved(true);
      refreshHostedSessions();
    });
  };

  const uploadMedia = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('dnd_token')}` }, body: form });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.message || 'No se pudo subir el archivo.');
      setMediaUrl(data.url);
      setUploadedFileName(file.name);
      if (!mediaTitle) setMediaTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

  const publish = (url = mediaUrl, nextTitle = mediaTitle, type = mediaType, nextGridEnabled = gridEnabled) => {
    if (!url) return setError('Selecciona una imagen o mapa antes de compartir.');
    emit('game:share', {
      sessionId: session.id,
      type,
      url,
      title: nextTitle || 'Escena sin título',
      gridEnabled: type === 'MAP' && nextGridEnabled,
    });
    setComposerOpen(false);
  };

  const savePreparedAsset = publishNow => {
    if (!mediaUrl) return setError('Selecciona una imagen o mapa antes de guardarlo.');
    setError('');
    setSavingAsset(true);
    const assetTitle = mediaTitle || (mediaType === 'MAP' ? 'Mapa sin título' : 'Escena sin título');
    socket.timeout(7000).emit('game:save-asset', {
      sessionId: session.id,
      title: assetTitle,
      url: mediaUrl,
      type: mediaType,
      gridEnabled,
    }, (timeoutError, response) => {
      setSavingAsset(false);
      if (timeoutError || !response?.ok) {
        setError(response?.message || 'No se pudo guardar el asset en la bandeja.');
        return;
      }
      if (publishNow) publish(mediaUrl, assetTitle, mediaType, gridEnabled);
      else setComposerOpen(false);
    });
  };

  const saveDroppedAsset = (asset, fileName) => new Promise((resolve, reject) => {
    socket.timeout(7000).emit('game:save-asset', {
      sessionId: session.id,
      title: fileName.replace(/\.[^.]+$/, '') || 'Asset sin título',
      url: asset.url,
      type: asset.type,
      gridEnabled: asset.type === 'MAP' && gridEnabled,
    }, (timeoutError, response) => {
      if (timeoutError || !response?.ok) reject(new Error(response?.message || 'No se pudo guardar el asset.'));
      else resolve(response.asset);
    });
  });

  const addFilesToTray = async (files, type = 'IMAGE') => {
    const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) return setError('La bandeja sólo admite archivos de imagen.');
    setError('');
    setTrayUploading(true);
    try {
      for (const file of imageFiles) {
        const form = new FormData();
        form.append('image', file);
        const response = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('dnd_token')}` }, body: form });
        const data = await response.json();
        if (!response.ok || !data.url) throw new Error(data.message || `No se pudo subir ${file.name}.`);
        await saveDroppedAsset({ url: data.url, type }, file.name);
      }
    } catch (dropError) {
      setError(dropError.message);
    } finally {
      setTrayUploading(false);
      setAssetOverTray(false);
    }
  };

  const publishAsset = asset => publish(asset.url, asset.title, asset.type, asset.grid_enabled);

  const switchViewMode = type => {
    setMediaType(type);
    if (!session.shared_url || session.shared_type === 'NONE' || session.shared_type === type) return;
    emit('game:share', {
      sessionId: session.id,
      type,
      url: session.shared_url,
      title: session.shared_title,
      gridEnabled: session.grid_enabled,
      preserveNarrativeLayout: true,
    });
  };

  const reorderAssets = (draggedId, targetId) => {
    if (!draggedId || draggedId === targetId) return;
    const ordered = [...(session.assets || [])];
    const fromIndex = ordered.findIndex(asset => asset.id === draggedId);
    const targetIndex = ordered.findIndex(asset => asset.id === targetId);
    if (fromIndex < 0 || targetIndex < 0) return;
    const [dragged] = ordered.splice(fromIndex, 1);
    ordered.splice(targetIndex, 0, dragged);
    setSession(current => ({ ...current, assets: ordered }));
    emit('game:reorder-assets', { sessionId: session.id, assetIds: ordered.map(asset => asset.id) });
  };

  const createQuickNpcToken = () => {
    if (!quickNpc.name.trim()) return setError('Escribe un nombre para el NPC.');
    setError('');
    setCreatingNpcToken(true);
    socket.timeout(7000).emit('game:create-npc-token', {
      sessionId: session.id,
      ...quickNpc,
    }, (timeoutError, response) => {
      setCreatingNpcToken(false);
      if (timeoutError || !response?.ok) {
        setError(response?.message || 'No se pudo crear el NPC.');
        return;
      }
      setQuickNpc({ name: '', hpMax: 10, armorClass: 10, npcType: 'enemigo', imageUrl: '' });
      setQuickNpcOpen(false);
      socket.emit('get-all-npcs');
    });
  };

  const copyCode = async () => {
    await navigator.clipboard?.writeText(session.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const openComposer = (type, reset = false) => {
    setMediaType(type);
    if (reset) {
      setMediaUrl('');
      setMediaTitle('');
      setUploadedFileName('');
    }
    setComposerOpen(true);
  };

  if (!session && (!connected || !sessionResolved)) {
    return (
      <div className="game-session-recovery">
        <div className="game-button-spinner" />
        <span className="game-kicker">Reconectando con la mesa</span>
        <h1>Recuperando tu sala</h1>
        <p>{connectionError || 'Tus mapas, imágenes y jugadores siguen guardados.'}</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="game-launch-shell">
        <div className="game-launch-card">
          <span className="game-kicker">Mesa virtual</span>
          <Swords size={36} />
          <h1>Mis mesas</h1>
          <p>Crea un punto de encuentro para tus jugadores y controla desde aquí todo lo que verán durante la sesión.</p>
          <div className="game-dashboard-list">
            {hostedSessions.map(item => (
              <article key={item.id}>
                <div><span>{item.status === 'LIVE' ? 'En vivo' : item.status === 'PAUSED' ? 'Pausada' : 'Sala de espera'}</span><h2>{item.title || 'Mesa sin nombre'}</h2><small>Codigo {item.code} · Ronda {item.round || 0}</small></div>
                <button disabled={switchingSession} onClick={() => openHostedSession(item.id)}>{switchingSession ? 'Abriendo...' : 'Abrir mesa'}</button>
              </article>
            ))}
            {!hostedSessions.length && <div className="game-dashboard-empty">Todavia no tienes mesas activas. Crea la primera para comenzar.</div>}
          </div>
          <label><span>Nombre de la nueva mesa</span><input value={title} onChange={event => setTitle(event.target.value)} /></label>
          <button disabled={creatingSession || !connected} onClick={() => createSession(true)}>
            {creatingSession ? <i className="game-button-spinner" /> : <Plus size={16} />}
            {creatingSession ? 'Creando sala...' : connected ? 'Crear sala' : 'Conectando...'}
          </button>
          {!connected && <small className="game-connection-note">{connectionError || 'Esperando conexión con el servidor de juego.'}</small>}
          {error && <small className="game-error">{error}</small>}
        </div>
      </div>
    );
  }

  const allReady = session.participants.length > 0 && session.participants.every(participant => participant.is_ready);
  const activeCharacter = players.find(character => character.id === session.active_character_id)
    || session.tokens.find(token => token.character_id === session.active_character_id)?.character;
  const selectedDmToken = session.tokens.find(token => token.id === selectedActiveTokenId && !token.owner_user_id);
  const initiativeState = session.combat_state?.initiative || {};
  const awaitingInitiative = Boolean(session.combat_state?.awaitingInitiative);
  const pendingInitiative = new Set((session.combat_state?.pendingInitiative || []).map(Number));
  const initiativeOrder = [...new Set([
    ...(session.turn_order || []),
    ...session.participants.map(item => item.character_id),
    ...session.tokens.filter(item => item.visible !== false).map(item => item.character_id),
  ].map(Number).filter(Number.isInteger))];
  const initiativeEntries = initiativeOrder.map((characterId, index) => {
    const normalizedId = Number(characterId);
    const token = session.tokens.find(item => Number(item.character_id) === normalizedId);
    const participant = session.participants.find(item => Number(item.character_id) === normalizedId);
    const character = token?.character || participant?.character || players.find(item => Number(item.id) === normalizedId);
    const result = initiativeState[normalizedId] || initiativeState[String(normalizedId)] || null;
    return character ? {
      id: normalizedId,
      index,
      name: character.name || token?.label || 'Personaje',
      image: token?.image_url || character.rendered_url || character.image_url || character.base_body_url,
      initiative: result ? Number(result.total) : null,
      initiativeBonus: result ? Number(result.bonus) : Number(character.initiative_bonus) || 0,
      initiativeRoll: result ? Number(result.roll) : null,
      pending: pendingInitiative.has(normalizedId),
    } : null;
  }).filter(Boolean);
  const connectedPlayers = session.participants.filter(item => item.connected).length;
  const visibleScenes = scenes.filter(scene => scene.imageUrl).slice(0, 8);
  const normalizedAssetSearch = deferredAssetSearch.trim().toLocaleLowerCase('es');
  const preparedAssets = (session.assets || []).filter(asset => (
    (assetFilter === 'ALL' || asset.type === assetFilter)
    && (!normalizedAssetSearch || asset.title.toLocaleLowerCase('es').includes(normalizedAssetSearch))
  ));
  const filteredScenes = visibleScenes.filter(scene => !normalizedAssetSearch || scene.title.toLocaleLowerCase('es').includes(normalizedAssetSearch));
  const sceneNpcOrder = new Map((session.scene_npcs || []).map((npc, index) => [npc.id, index]));
  const filteredNpcs = npcs
    .filter(npc => npc.name?.toLocaleLowerCase('es').includes(npcSearch.trim().toLocaleLowerCase('es')))
    .sort((first, second) => {
      const firstVisible = sceneNpcOrder.has(first.id);
      const secondVisible = sceneNpcOrder.has(second.id);
      if (firstVisible !== secondVisible) return firstVisible ? -1 : 1;
      if (!firstVisible) return 0;
      if (first.id === session.speaking_npc_id) return -1;
      if (second.id === session.speaking_npc_id) return 1;
      return sceneNpcOrder.get(first.id) - sceneNpcOrder.get(second.id);
    });
  const statusLabel = session.status === 'WAITING' ? 'Sala de espera' : session.status === 'LIVE' ? 'En vivo' : session.status === 'PAUSED' ? 'Pausada' : 'Finalizada';
  const dmControlledCharacterIds = new Set(
    session.tokens.filter(token => !token.owner_user_id).map(token => Number(token.character_id)),
  );
  const pendingCombatNotice = (session.combat_actions || []).find(action => {
    const belongsToDm = String(action.actor_user_id) === String(user.id)
      || dmControlledCharacterIds.has(Number(action.actor_character_id));
    if (!belongsToDm || dismissedCombatNotices.includes(String(action.id))) return false;
    return action.status === 'DAMAGE_READY'
      || (action.status === 'COMPLETED' && action.attack && action.attack.hit === false);
  });

  const reorderInitiative = (characterId, targetIndex) => {
    const order = initiativeEntries.map(entry => entry.id);
    const sourceIndex = order.indexOf(Number(characterId));
    const boundedTarget = Math.max(0, Math.min(order.length - 1, targetIndex));
    if (sourceIndex < 0 || sourceIndex === boundedTarget) return;
    const [moved] = order.splice(sourceIndex, 1);
    order.splice(boundedTarget, 0, moved);
    emit('game:update-turn-order', { sessionId: session.id, turnOrder: order });
  };

  const setCombatMode = mode => {
    socket?.emit('game:set-combat-mode', { sessionId: session.id, mode }, response => {
      if (!response?.ok) setError(response?.message || 'No se pudo cambiar el modo de partida.');
    });
  };

  const rollPendingDamage = action => {
    socket?.emit('game:roll-action-damage', { sessionId: session.id, combatActionId: action.id }, response => {
      if (!response?.ok) setError(response?.message || 'No se pudo iniciar la tirada de daño.');
    });
  };
  const WorldPeriodIcon = worldState.day_period === 'Día' ? Sun : worldState.day_period === 'Tarde' ? Sunset : Moon;

  return (
    <div className="game-dm-shell game-control-room">
      <div className="game-control-grid">
      <header className="game-command-bar">
        <div className="game-command-campaign">
          <span>Campaña activa</span>
          <h1>{session.title}</h1>
        </div>
        <div className="game-command-scene">
          <span>Escena en mesa</span>
          <strong>{session.shared_title || 'Sin contenido publicado'}</strong>
        </div>
        <div className="game-world-clock" title="Hora y clima actual del mundo">
          <label><span><Clock3 size={8} />Hora mundial</span><input aria-label="Hora mundial" type="time" value={worldState.global_time || '12:00'} onClick={event => event.currentTarget.showPicker?.()} onChange={event => updateWorldTime(event.target.value)} /></label>
          <div><span><WorldPeriodIcon size={10} />{worldState.day_period}</span><small><Thermometer size={9} />{worldState.temperature_c}°C</small></div>
        </div>
        <div className={`game-live-badge is-${session.status.toLowerCase()}`}><i />{statusLabel}</div>
        <div className="game-command-presence"><Users size={16} /><strong>{connectedPlayers} / {session.participants.length}</strong><span>Conectados</span></div>
        <div className="game-round"><span>Ronda</span><strong>{session.round}</strong></div>
        <div className="game-command-turn"><span>Turno</span><strong>{activeCharacter?.name || 'Sin iniciativa'}</strong></div>
        {session.status === 'WAITING' ? (
          <button className="game-primary-action" disabled={!allReady} onClick={() => emit('game:set-status', { sessionId: session.id, status: 'LIVE' })}><Play size={15} /> Iniciar partida</button>
        ) : (
          <div className="game-session-actions">
            <button onClick={() => emit('game:set-status', { sessionId: session.id, status: session.status === 'PAUSED' ? 'LIVE' : 'PAUSED' })}>{session.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />}{session.status === 'PAUSED' ? 'Reanudar' : 'Pausar'}</button>
            <button className="is-danger" onClick={() => window.confirm('¿Finalizar esta partida?') && emit('game:set-status', { sessionId: session.id, status: 'FINISHED' })}>Finalizar</button>
          </div>
        )}
        <button className="game-return-dashboard" disabled={switchingSession} onClick={leaveSessionToDashboard}><MapIcon size={14} /> Mis mesas</button>
      </header>

      {error && <div className="game-error-banner"><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div>}

      {pendingCombatNotice && (
        <div className={`game-combat-result-prompt${pendingCombatNotice.status === 'DAMAGE_READY' ? ' is-success' : ' is-failure'}`} role="dialog" aria-live="assertive">
          <div>
            <span>{pendingCombatNotice.status === 'DAMAGE_READY' ? 'Impacto confirmado' : 'El ataque no impacta'}</span>
            <h2>{pendingCombatNotice.status === 'DAMAGE_READY' ? '¡Éxito!' : 'Fallo'}</h2>
            <p>{pendingCombatNotice.actor_name} · {pendingCombatNotice.action_name}{pendingCombatNotice.attack ? ` · ${pendingCombatNotice.attack.total} contra CA ${pendingCombatNotice.attack.targetAc}` : ''}</p>
            {pendingCombatNotice.status === 'DAMAGE_READY' ? (
              <button onClick={() => rollPendingDamage(pendingCombatNotice)}>Tirar daño ({pendingCombatNotice.damage_formula || 'daño'})</button>
            ) : (
              <button onClick={() => setDismissedCombatNotices(current => [...current, String(pendingCombatNotice.id)])}>Continuar</button>
            )}
          </div>
        </div>
      )}

        <main className="game-scene-workspace">
          <section className="game-scene-frame">
            <div className="game-scene-visibility">
              <div className={session.shared_type === 'NONE' ? 'is-private' : 'is-public'}>
                {session.shared_type === 'NONE' ? <LockKeyhole size={14} /> : <Radio size={14} />}
                <strong>{session.shared_type === 'NONE' ? 'Sin publicar' : 'Visible para jugadores'}</strong>
              </div>
              <span>{session.shared_type === 'NONE' ? 'Prepara la escena antes de mostrarla' : `${connectedPlayers} jugadores reciben este contenido en vivo`}</span>
              <GameAudioControl session={session} socket={socket} onError={setError} />
              <div ref={setStageToolbarHost} className="game-stage-toolbar-host" />
              <button onClick={() => openComposer(session.shared_type === 'MAP' ? 'MAP' : 'IMAGE')}><MonitorUp size={14} /> Cambiar contenido</button>
            </div>
            <div
              className={`game-stage-wrap-dm${assetOverStage ? ' is-asset-over' : ''}`}
              onDragEnter={event => {
                event.preventDefault();
                const dragTypes = Array.from(event.dataTransfer.types);
                const isNarrativeAsset = session.shared_type === 'IMAGE' && (
                  dragTypes.includes('application/x-game-asset') || dragTypes.includes('application/x-game-scene')
                );
                setAssetOverStage(!isNarrativeAsset);
              }}
              onDragOver={event => event.preventDefault()}
              onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setAssetOverStage(false);
              }}
              onDrop={event => {
                event.preventDefault();
                setAssetOverStage(false);
                const assetId = event.dataTransfer.getData('application/x-game-asset');
                const sceneData = event.dataTransfer.getData('application/x-game-scene');
                if (session.shared_type === 'IMAGE' && (assetId || sceneData)) return;
                const asset = (session.assets || []).find(item => item.id === assetId);
                if (asset) publishAsset(asset);
              }}
            >
              <GameStage
                session={session}
                userId={user.id}
                isDm
                combatTargeting={combatTargeting}
                onCombatTokenTarget={token => combatTargeting?.execute?.(combatTargeting.action, [token.id])}
                onCombatAreaTarget={area => combatTargeting?.execute?.(combatTargeting.action, [], area)}
                onActiveTokenClick={token => setSelectedActiveTokenId(token.id)}
                onMoveToken={(tokenId, x, y) => emit('game:move-token', { sessionId: session.id, tokenId, x, y })}
                onMoveTokens={moves => emit('game:move-tokens', { sessionId: session.id, moves })}
                onAdjustHp={(tokenId, delta) => emit('game:adjust-token-hp', { sessionId: session.id, tokenId, delta })}
                onSetHp={(tokenId, hp) => emit('game:set-token-hp', { sessionId: session.id, tokenId, hp })}
                onToggleCondition={(tokenId, condition) => emit('game:toggle-token-condition', { sessionId: session.id, tokenId, condition })}
                onDeleteToken={tokenId => emit('game:delete-token', { sessionId: session.id, tokenId })}
                onDuplicateToken={tokenId => emit('game:duplicate-token', { sessionId: session.id, tokenId })}
                onGridStyleChange={settings => emit('game:update-grid-style', { sessionId: session.id, ...settings })}
                onNarrativeStyleChange={settings => emit('game:update-narrative-style', { sessionId: session.id, ...settings })}
                onNarrativePanelDrop={(slotIndex, panel) => emit('game:update-narrative-style', { sessionId: session.id, slotIndex, ...panel })}
                onHideContent={() => emit('game:share', { sessionId: session.id, type: 'NONE' })}
                onAddAnnotation={annotation => emit('game:add-annotation', { sessionId: session.id, annotation })}
                onUpdateAnnotation={(annotationId, changes) => emit('game:update-annotation', { sessionId: session.id, annotationId, ...changes })}
                onDeleteAnnotation={annotationId => emit('game:delete-annotation', { sessionId: session.id, annotationId })}
                onClearAnnotations={() => emit('game:clear-annotations', { sessionId: session.id })}
                onAddVfx={effect => emit('game:add-vfx', { sessionId: session.id, effect })}
                onUpdateVfx={(effectId, changes) => emit('game:update-vfx', { sessionId: session.id, effectId, ...changes })}
                onDeleteVfx={effectId => emit('game:delete-vfx', { sessionId: session.id, effectId })}
                onClearVfx={() => emit('game:clear-vfx', { sessionId: session.id })}
                onDismissRoll={rollId => emit('game:dismiss-roll', { sessionId: session.id, rollId })}
                onResolveRoll={resolveDiceRoll}
                onRollCharacter={({ characterId, label, modifier }) => rollDice({ sides: 20, quantity: 1, modifier, label, characterId })}
                toolbarHost={stageToolbarHost}
              />
            </div>
            <div className="game-scene-actions">
              <button onClick={() => openComposer(session.shared_type === 'MAP' ? 'MAP' : 'IMAGE')}><Upload size={14} /> Reemplazar</button>
              <button onClick={() => emit('game:share', { sessionId: session.id, type: 'NONE' })}><EyeOff size={14} /> Ocultar</button>
              <div className="game-scene-mode">
                <button className={session.combat_state?.mode !== 'COMBAT' ? 'is-active' : ''} onClick={() => setCombatMode('NARRATIVE')}><ImageIcon size={14} /> Narrativa</button>
                <button className={session.combat_state?.mode === 'COMBAT' ? 'is-active' : ''} onClick={() => setCombatMode('COMBAT')}><Swords size={14} /> Combate</button>
              </div>
            </div>
          </section>

          <section
            className={`game-media-library${rightTab === 'assets' ? ' is-dock-active' : ''}${assetOverTray ? ' is-file-over' : ''}`}
            onDragEnter={event => {
              if (Array.from(event.dataTransfer.types).includes('Files')) {
                event.preventDefault();
                setAssetOverTray(true);
              }
            }}
            onDragOver={event => {
              if (Array.from(event.dataTransfer.types).includes('Files')) {
                event.preventDefault();
                const bounds = event.currentTarget.getBoundingClientRect();
                setDropAssetType(event.clientX < bounds.left + bounds.width / 2 ? 'IMAGE' : 'MAP');
              }
            }}
            onDragLeave={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) setAssetOverTray(false);
            }}
            onDrop={event => {
              if (!event.dataTransfer.files?.length) return;
              event.preventDefault();
              addFilesToTray(event.dataTransfer.files, dropAssetType);
            }}
          >
            <div className="game-library-header">
              <div><span className="game-kicker">Biblioteca de la sesión</span><h2>Escenas y mapas</h2></div>
              <div className="game-library-actions">
                <button onClick={() => openComposer('IMAGE', true)}><ImageIcon size={14} /> Nueva escena</button>
                <button className="is-map-action" onClick={() => openComposer('MAP', true)}><MapIcon size={14} /> Subir mapa</button>
              </div>
            </div>

            <div className="game-asset-toolbar">
              <div>
                {[['ALL', 'Todos'], ['IMAGE', 'Narrativa'], ['MAP', 'Mapas']].map(([value, label]) => (
                  <button key={value} className={assetFilter === value ? 'is-active' : ''} onClick={() => setAssetFilter(value)}>{label}</button>
                ))}
              </div>
              <label className="game-asset-search">
                <Search size={12} />
                <input value={assetSearch} onChange={event => setAssetSearch(event.target.value)} placeholder="Buscar..." aria-label="Buscar assets por nombre" />
                {assetSearch && <button onClick={() => setAssetSearch('')} aria-label="Limpiar búsqueda"><X size={10} /></button>}
              </label>
            </div>

            {composerOpen && (
              <div className="game-broadcast-composer">
                <div className="game-composer-heading">
                  <div><span>Preparar contenido</span><strong>{mediaType === 'MAP' ? 'Nuevo mapa táctico' : 'Nueva escena narrativa'}</strong></div>
                  <button onClick={() => setComposerOpen(false)} aria-label="Cerrar"><X size={15} /></button>
                </div>
                <div className="game-composer-body">
                  <div className="game-media-type">
                    <button className={mediaType === 'IMAGE' ? 'is-active' : ''} onClick={() => setMediaType('IMAGE')}><ImageIcon size={14} /> Escena</button>
                    <button className={mediaType === 'MAP' ? 'is-active' : ''} onClick={() => setMediaType('MAP')}><MapIcon size={14} /> Mapa táctico</button>
                  </div>
                  <label className={`game-map-upload${mediaUrl ? ' has-file' : ''}`}>
                    {mediaUrl ? <Check size={17} /> : <Upload size={17} />}
                    <span><strong>{uploading ? 'Subiendo archivo...' : uploadedFileName || (mediaType === 'MAP' ? 'Seleccionar mapa desde el equipo' : 'Seleccionar imagen desde el equipo')}</strong><small>{mediaUrl ? 'Archivo preparado para publicar' : 'PNG, JPG o WEBP'}</small></span>
                    <input type="file" accept="image/*" onChange={uploadMedia} disabled={uploading} />
                  </label>
                  <label className="game-composer-field"><span>Nombre visible</span><input value={mediaTitle} onChange={event => setMediaTitle(event.target.value)} placeholder={mediaType === 'MAP' ? 'Ej. Cripta del eco' : 'Ej. Entrada al castillo'} /></label>
                  <label className="game-composer-field"><span>O usar una URL</span><input value={mediaUrl} onChange={event => { setMediaUrl(event.target.value); setUploadedFileName(''); }} placeholder="https://..." /></label>
                  {mediaType === 'MAP' && <label className="game-grid-toggle"><input type="checkbox" checked={gridEnabled} onChange={event => setGridEnabled(event.target.checked)} /><span><strong>Cuadrícula táctica</strong><small>Superpone una grilla para posicionar tokens</small></span></label>}
                  <div className="game-composer-actions">
                    <button className="game-save-asset-button" disabled={!mediaUrl || uploading || savingAsset} onClick={() => savePreparedAsset(false)}>Guardar en bandeja</button>
                    <button className="game-publish-button" disabled={!mediaUrl || uploading || savingAsset} onClick={() => savePreparedAsset(true)}><MonitorUp size={14} /> {savingAsset ? 'Guardando...' : 'Guardar y mostrar'}</button>
                  </div>
                </div>
              </div>
            )}

            <div className="game-scene-strip game-library-strip">
              {preparedAssets.map(asset => (
                <article
                  key={asset.id}
                  className={session.shared_url === asset.url ? 'is-current' : ''}
                  draggable
                  onDragStart={event => {
                    event.dataTransfer.effectAllowed = 'copyMove';
                    event.dataTransfer.setData('application/x-game-asset', asset.id);
                    event.dataTransfer.setData('text/plain', asset.id);
                  }}
                  onDragEnd={() => setAssetOverStage(false)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault();
                    reorderAssets(event.dataTransfer.getData('application/x-game-asset'), asset.id);
                  }}
                  onClick={() => publishAsset(asset)}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') publishAsset(asset); }}
                  role="button"
                  tabIndex={0}
                >
                  <img src={resolveMediaUrl(asset.url)} alt="" draggable={false} />
                  <span>{asset.title}</span>
                  <small>{session.shared_url === asset.url ? 'En mesa' : asset.type === 'MAP' ? 'Mapa' : 'Escena'}</small>
                  <i><GripVertical size={11} /></i>
                  <button aria-label={`Eliminar ${asset.title}`} onClick={event => { event.stopPropagation(); emit('game:delete-asset', { sessionId: session.id, assetId: asset.id }); }}><Trash2 size={11} /></button>
                </article>
              ))}
              {filteredScenes.map(scene => (
                <button
                  key={`scene-${scene.id}`}
                  draggable
                  onDragStart={event => {
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('application/x-game-asset', `scene:${scene.id}`);
                    event.dataTransfer.setData('application/x-game-scene', JSON.stringify({
                      id: scene.id,
                      url: scene.imageUrl,
                      title: scene.title,
                    }));
                    event.dataTransfer.setData('text/plain', `scene:${scene.id}`);
                  }}
                  onDragEnd={() => setAssetOverStage(false)}
                  onClick={() => publish(scene.imageUrl, scene.title, 'IMAGE')}
                >
                  <img src={resolveMediaUrl(scene.imageUrl)} alt="" draggable={false} />
                  <span>{scene.title}</span>
                  <small>Archivo</small>
                </button>
              ))}
              {!preparedAssets.length && !filteredScenes.length && <div className="game-library-empty"><ImageIcon size={22} /><span>{normalizedAssetSearch ? 'No hay assets que coincidan con la búsqueda.' : 'Tu bandeja está vacía. Agrega mapas o escenas para tenerlos a mano.'}</span></div>}
            </div>
            {(assetOverTray || trayUploading) && (
              <div className={`game-tray-drop-overlay${trayUploading ? ' is-uploading' : ''}`}>
                {trayUploading ? (
                  <div className="game-tray-uploading"><i className="game-button-spinner" /><strong>Agregando a la bandeja...</strong></div>
                ) : (
                  <>
                    <div className={dropAssetType === 'IMAGE' ? 'is-target' : ''}><ImageIcon size={24} /><strong>Imagen narrativa</strong><small>Suelta en este lado</small></div>
                    <div className={dropAssetType === 'MAP' ? 'is-target' : ''}><MapIcon size={24} /><strong>Mapa táctico</strong><small>Suelta en este lado</small></div>
                  </>
                )}
              </div>
            )}
          </section>
        </main>

        <aside className="game-director-console">
          <nav className="game-console-tabs">
            <button className={rightTab === 'session' ? 'is-active' : ''} onClick={() => setRightTab('session')}>Partida</button>
            <button className={rightTab === 'party' ? 'is-active' : ''} onClick={() => setRightTab('party')}>Grupo <span>{session.participants.length}</span></button>
            <button className={rightTab === 'assets' ? 'is-active' : ''} onClick={() => setRightTab('assets')}><ImageIcon size={13} /> Assets <span>{(session.assets || []).length}</span></button>
            <button className={rightTab === 'oracle' ? 'is-active is-oracle' : 'is-oracle'} onClick={() => setRightTab('oracle')}><Sparkles size={13} /> Oracle</button>
          </nav>

          <div className="game-console-body">
            {rightTab === 'session' && (
              <div className="game-console-section">
                <div className="game-console-heading"><div><span>Control de sesión</span><h2>Sala del director</h2></div><Settings2 size={17} /></div>
                <div className="game-session-manager is-hidden">
                  <label>
                    <span>Mesas activas</span>
                    <select value={session.id} disabled={switchingSession} onChange={event => openHostedSession(event.target.value)}>
                      {(hostedSessions.length ? hostedSessions : [session]).map(item => (
                        <option key={item.id} value={item.id}>{item.title || 'Mesa sin nombre'} · {item.code}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" disabled={creatingSession || switchingSession} onClick={() => createSession(true)} title="Crear una mesa separada para pruebas">
                    {creatingSession ? <i className="game-button-spinner" /> : <Plus size={13} />}
                    Nueva mesa
                  </button>
                </div>
                <button className="game-invite-card game-invite-compact" onClick={copyCode}>
                  <span>Código de sala</span><strong>{session.code}</strong><small>{copied ? <><Check size={12} /> Copiado</> : <><Clipboard size={12} /> Copiar</>}</small>
                </button>
                <div className="game-console-metrics">
                  <div><span>Estado</span><strong>{statusLabel}</strong></div>
                  <div><span>Jugadores</span><strong>{connectedPlayers}/{session.participants.length}</strong></div>
                  <div><span>Tokens</span><strong>{session.tokens.length}</strong></div>
                </div>
                <DiceTray onRoll={rollDice} />
                {session.status === 'LIVE'
                  && selectedDmToken && (
                    <TurnActionPanel
                      session={session}
                      socket={socket}
                      isMyTurn={Number(selectedDmToken.character_id) === Number(session.active_character_id)}
                      targeting={combatTargeting}
                      onTargetingChange={setCombatTargeting}
                      onError={setError}
                      actorName={selectedDmToken.character?.name || selectedDmToken.label}
                      actorCharacterId={selectedDmToken.character_id}
                      mode="dm"
                    />
                  )}
                <div className="game-turn-card game-initiative-card">
                  <header><div><span>Control de iniciativa</span><strong>{awaitingInitiative ? `Esperando ${pendingInitiative.size} tirada(s)` : activeCharacter?.name || 'Sin iniciativa'}</strong></div>{session.combat_state?.mode === 'COMBAT' ? <button className="game-combat-end-button" onClick={() => setCombatMode('NARRATIVE')}>Finalizar combate</button> : <small>Narrativa</small>}</header>
                  {awaitingInitiative && <button className="game-initiative-complete" onClick={() => socket.emit('game:complete-initiative', { sessionId: session.id }, response => { if (!response?.ok) setError(response?.message || 'No se pudo completar la iniciativa.'); })}>Tirar automáticamente las pendientes</button>}
                  <div className="game-initiative-order" aria-label="Orden de iniciativa">
                    {initiativeEntries.map((entry, index) => {
                      const active = entry.id === Number(session.active_character_id);
                      return (
                        <article
                          key={entry.id}
                          className={`${active ? 'is-active' : ''}${draggedTurnId === entry.id ? ' is-dragging' : ''}`}
                          draggable={!awaitingInitiative}
                          onDragStart={event => { setDraggedTurnId(entry.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(entry.id)); }}
                          onDragEnd={() => setDraggedTurnId(null)}
                          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }}
                          onDrop={event => { event.preventDefault(); const sourceId = Number(event.dataTransfer.getData('text/plain') || draggedTurnId); setDraggedTurnId(null); reorderInitiative(sourceId, index); }}
                        >
                          <GripVertical size={12} className="game-initiative-grip" />
                          <button type="button" className="game-initiative-person" disabled={awaitingInitiative} onClick={() => emit('game:set-turn', { sessionId: session.id, characterId: entry.id })} title={`Dar el turno a ${entry.name}`}>
                            <span className="game-initiative-avatar">{entry.image ? <img src={resolveMediaUrl(entry.image)} alt="" /> : entry.name.slice(0, 1).toUpperCase()}</span>
                            <span><strong>{entry.name}</strong><small>{entry.pending ? 'Esperando tirada' : `${active ? 'Turno actual' : `Posición ${index + 1}`} · ${entry.initiativeRoll} ${entry.initiativeBonus >= 0 ? '+' : '−'} ${Math.abs(entry.initiativeBonus)} = ${entry.initiative}`}</small></span>
                          </button>
                          <div className="game-initiative-move">
                            <button type="button" disabled={awaitingInitiative || index === 0} onClick={() => reorderInitiative(entry.id, index - 1)} aria-label={`Subir a ${entry.name}`}><ChevronUp size={11} /></button>
                            <button type="button" disabled={awaitingInitiative || index === initiativeEntries.length - 1} onClick={() => reorderInitiative(entry.id, index + 1)} aria-label={`Bajar a ${entry.name}`}><ChevronDown size={11} /></button>
                          </div>
                        </article>
                      );
                    })}
                    {!initiativeEntries.length && <p>{session.status === 'WAITING' ? 'La iniciativa se genera al iniciar la partida.' : 'No hay personajes en la iniciativa.'}</p>}
                  </div>
                  <div className="game-initiative-navigation">
                    <button disabled={session.status === 'WAITING' || awaitingInitiative || !initiativeEntries.length} onClick={() => emit('game:previous-turn', { sessionId: session.id })}><SkipBack size={13} /> Anterior</button>
                    <button disabled={session.status === 'WAITING' || awaitingInitiative || !initiativeEntries.length} onClick={() => emit('game:next-turn', { sessionId: session.id })}>Siguiente <SkipForward size={13} /></button>
                  </div>
                  {activeCharacter && session.status !== 'WAITING' && (
                    <div className="game-rest-controls">
                      <button type="button" onClick={() => socket.emit('game:rest-character', { sessionId: session.id, characterId: activeCharacter.id, restType: 'short' }, response => { if (!response?.ok) setError(response?.message || 'No se pudo aplicar el descanso corto.'); })}><Moon size={11} /> Descanso corto</button>
                      <button type="button" onClick={() => socket.emit('game:rest-character', { sessionId: session.id, characterId: activeCharacter.id, restType: 'long' }, response => { if (!response?.ok) setError(response?.message || 'No se pudo aplicar el descanso largo.'); })}><Sun size={11} /> Descanso largo</button>
                    </div>
                  )}
                </div>
                {!!session.combat_actions?.length && (
                  <div className="game-combat-log">
                    <header><div><span>Resolución automática</span><strong>Registro de combate</strong></div><small>{session.combat_actions.length}</small></header>
                    <div>
                      {session.combat_actions.slice(0, 8).map((action, index) => (
                        <article key={action.id} className={action.status === 'UNDONE' ? 'is-undone' : ''}>
                          <span className="game-combat-log-avatar">{action.actor_image ? <img src={resolveMediaUrl(action.actor_image)} alt="" /> : action.actor_name?.slice(0, 1)}</span>
                          <div><strong>{action.actor_name} · {action.action_name}</strong><small>{action.summary || (action.status.includes('ROLL') ? 'Esperando dados...' : action.status)}</small></div>
                          {index === 0 && action.status === 'COMPLETED' && !action.undone_at && (
                            <button type="button" title="Deshacer última acción" onClick={() => socket.emit('game:undo-action', { sessionId: session.id, combatActionId: action.id }, response => { if (!response?.ok) setError(response?.message || 'No se pudo deshacer la acción.'); })}><Undo2 size={12} /></button>
                          )}
                          {action.status === 'DAMAGE_READY' && (
                            <button type="button" title="Tirar daño" onClick={() => rollPendingDamage(action)}><Swords size={12} /></button>
                          )}
                          {['PENDING', 'ATTACK_ROLL', 'DAMAGE_READY', 'EFFECT_ROLL'].includes(action.status) && (
                            <button type="button" title="Cancelar acción bloqueada" onClick={() => socket.emit('game:cancel-action', { sessionId: session.id, combatActionId: action.id }, response => { if (!response?.ok) setError(response?.message || 'No se pudo cancelar la acción.'); })}><X size={12} /></button>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                )}
                <div className="game-token-list">
                  <div className="game-token-list-title"><span>Tokens en tablero</span><strong>{session.tokens.length}</strong></div>
                  {session.tokens.map(token => (
                    <div key={token.id}><span>{token.label}</span><small>{token.owner_user_id ? 'Jugador' : 'DM'}</small><button onClick={() => emit('game:delete-token', { sessionId: session.id, tokenId: token.id })}><X size={12} /></button></div>
                  ))}
                  {!session.tokens.length && <p className="game-console-empty">Los tokens aparecerán aquí cuando los asignes desde la pestaña Grupo.</p>}
                </div>
              </div>
            )}

            {rightTab === 'party' && (
              <div className="game-console-section">
                <div className="game-console-heading"><div><span>Fichas y tokens</span><h2>Personajes en la mesa</h2></div><strong>{session.tokens.length}</strong></div>
                <div className="game-party-switch" role="tablist" aria-label="Contenido del grupo">
                  <button role="tab" aria-selected={partyView === 'players'} className={partyView === 'players' ? 'is-active' : ''} onClick={() => setPartyView('players')}>
                    <Users size={13} /><span>Jugadores</span><strong>{session.participants.length}</strong>
                  </button>
                  <button role="tab" aria-selected={partyView === 'npcs'} className={partyView === 'npcs' ? 'is-active' : ''} onClick={() => setPartyView('npcs')}>
                    <Skull size={13} /><span>NPCs</span><strong>{npcs.length}</strong>
                  </button>
                </div>

                {partyView === 'players' && (
                  <div className="game-party-view">
                    <div className="game-token-manager-title"><span>Jugadores</span><strong>{connectedPlayers}/{session.participants.length} conectados</strong></div>
                    <div className="game-roster-list game-console-roster">
                      {session.participants.map(participant => (
                        <article key={participant.id} className={participant.character_id === session.active_character_id ? 'is-turn' : ''}>
                          <div className="game-avatar">{participant.character?.image_url ? <img src={resolveMediaUrl(participant.character.image_url)} alt="" /> : participant.user?.username?.slice(0, 1)}</div>
                          <div><strong>{participant.user?.username}</strong><span>{participant.character?.name || 'Sin personaje'}</span></div>
                          <i className={participant.connected ? 'is-online' : ''} />
                          <small className={participant.is_ready ? 'is-ready' : ''}>{participant.is_ready ? 'Listo' : 'No listo'}</small>
                          {participant.character && !session.tokens.some(token => token.character_id === participant.character_id) && (
                            <button title="Asignar token" onClick={() => emit('game:create-token', { sessionId: session.id, characterId: participant.character_id })}><Plus size={13} /></button>
                          )}
                        </article>
                      ))}
                    </div>
                    {!session.participants.length && <div className="game-panel-empty"><Users size={28} /><h3>Esperando aventureros</h3><p>Comparte el código <strong>{session.code}</strong> para recibir jugadores.</p><button onClick={copyCode}><Clipboard size={13} /> Copiar invitación</button></div>}
                  </div>
                )}

                {partyView === 'npcs' && (
                  <div className="game-party-view">
                    <div className="game-token-manager-title"><span>NPCs y criaturas</span><button onClick={() => setQuickNpcOpen(current => !current)}><Plus size={12} /> Crear rápido</button></div>
                    {quickNpcOpen && (
                      <div className="game-quick-npc-form">
                        <label className="is-wide"><span>Nombre</span><input value={quickNpc.name} onChange={event => setQuickNpc(current => ({ ...current, name: event.target.value }))} placeholder="Ej. Goblin explorador" /></label>
                        <label><span>PG</span><input type="number" min="1" value={quickNpc.hpMax} onChange={event => setQuickNpc(current => ({ ...current, hpMax: event.target.value }))} /></label>
                        <label><span>CA</span><input type="number" min="1" value={quickNpc.armorClass} onChange={event => setQuickNpc(current => ({ ...current, armorClass: event.target.value }))} /></label>
                        <label><span>Tipo</span><select value={quickNpc.npcType} onChange={event => setQuickNpc(current => ({ ...current, npcType: event.target.value }))}><option value="enemigo">Enemigo</option><option value="neutral">Neutral</option><option value="amigo">Aliado</option></select></label>
                        <label className="is-wide"><span>URL de retrato opcional</span><input value={quickNpc.imageUrl} onChange={event => setQuickNpc(current => ({ ...current, imageUrl: event.target.value }))} placeholder="https://..." /></label>
                        <button disabled={creatingNpcToken || !quickNpc.name.trim()} onClick={createQuickNpcToken}><Skull size={13} />{creatingNpcToken ? 'Creando...' : 'Crear ficha y token'}</button>
                      </div>
                    )}
                    <label className="game-npc-search"><Search size={13} /><input value={npcSearch} onChange={event => setNpcSearch(event.target.value)} placeholder="Buscar NPC por nombre..." /></label>
                    <div className="game-npc-token-grid">
                      {filteredNpcs.map(npc => {
                        const tokenExists = session.tokens.some(token => token.character_id === npc.id);
                        const visibleInScene = (session.scene_npcs || []).some(character => character.id === npc.id);
                        const isSpeaking = session.speaking_npc_id === npc.id;
                        return (
                          <article key={npc.id} className={`${tokenExists ? 'is-added' : ''}${visibleInScene ? ' is-on-scene' : ''}${isSpeaking ? ' is-speaking' : ''}`}>
                            <div className="game-npc-token-avatar">{npc.image_url ? <img src={resolveMediaUrl(npc.image_url)} alt="" /> : <Skull size={16} />}</div>
                            <div><strong>{npc.name}</strong><span>{npc.race || 'Criatura'} · {npc.npc_type || 'neutral'}</span></div>
                            <small><Heart size={9} />{npc.hp_max || 10}</small><small><Shield size={9} />{npc.ac_base || 10}</small>
                            <div className="game-npc-row-actions">
                              <button className={visibleInScene ? 'is-visible' : ''} onClick={() => emit('game:toggle-scene-npc', { sessionId: session.id, characterId: npc.id })}>
                                {visibleInScene ? <EyeOff size={10} /> : <Eye size={10} />}{visibleInScene ? 'Ocultar' : 'Mostrar'}
                              </button>
                              <button className={isSpeaking ? 'is-speaking' : ''} disabled={!visibleInScene} onClick={() => emit('game:set-scene-speaker', { sessionId: session.id, characterId: npc.id })}>
                                <MessageCircle size={10} />{isSpeaking ? 'Hablando' : 'Hablar'}
                              </button>
                              <button disabled={tokenExists} onClick={() => emit('game:create-token', { sessionId: session.id, characterId: npc.id })}>{tokenExists ? 'En mapa' : <><Plus size={10} /> Token</>}</button>
                            </div>
                          </article>
                        );
                      })}
                      {npcsLoading && <p className="game-console-empty">Sincronizando NPCs y criaturas...</p>}
                      {!npcsLoading && npcsError && <p className="game-console-empty is-error">{npcsError}</p>}
                      {!npcsLoading && !npcsError && !filteredNpcs.length && (
                        <p className="game-console-empty">{npcSearch.trim() ? 'No hay NPCs que coincidan con la búsqueda.' : 'No hay NPCs registrados en la campaña.'}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {rightTab === 'oracle' && (
              <div className="game-console-oracle"><AssistantPanel embedded /></div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
