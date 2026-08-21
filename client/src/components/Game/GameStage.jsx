import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Circle, Copy, Equal, Eraser, Eye, EyeOff, FlaskConical, Flame, Heart, Image as ImageIcon, Map as MapIcon, Minus, MousePointer2, Move, Palette, Pencil, Plus, Shield, Snowflake, Sparkles, Square, Swords, Trash2, Type, X } from 'lucide-react';
import API_URL from '../../config';
import DiceRollOverlay from './DiceRollOverlay';
import GameBoardVfx from './GameBoardVfx';
import TurnActionPanel from './TurnActionPanel';

const COMBAT_GRID = Object.freeze({ columns: 20, rows: 15, feetPerCell: 5 });

function normalizedNpcType(token) {
  return String(token?.character?.npc_type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function combatRelationship(actorToken, targetToken) {
  if (!actorToken || !targetToken) return 'neutral';
  if (Number(actorToken.character_id) === Number(targetToken.character_id)) return 'self';
  const actorPlayer = Boolean(actorToken.owner_user_id);
  const targetPlayer = Boolean(targetToken.owner_user_id);
  const targetType = normalizedNpcType(targetToken);
  if ((actorPlayer && targetPlayer) || ['amigo', 'companero', 'ally'].includes(targetType)) return 'ally';
  if (['enemigo', 'enemy'].includes(targetType)) return 'enemy';
  return actorPlayer ? 'enemy' : 'neutral';
}

function gridDistanceFeet(left, right) {
  if (!left || !right) return Infinity;
  const dx = Math.abs(Number(right.x) - Number(left.x)) * COMBAT_GRID.columns / 100;
  const dy = Math.abs(Number(right.y) - Number(left.y)) * COMBAT_GRID.rows / 100;
  return Math.max(dx, dy) * COMBAT_GRID.feetPerCell;
}

function validTargetRelationship(action, actorToken, targetToken) {
  const relation = combatRelationship(actorToken, targetToken);
  if (action?.target === 'self') return relation === 'self';
  if (String(action?.target || '').includes('ally')) return relation === 'ally' || relation === 'self';
  if (String(action?.target || '').includes('enemy')) return relation === 'enemy' || relation === 'neutral';
  return true;
}

const CONDITIONS = ['Envenenado', 'Aturdido', 'Derribado', 'Invisible', 'Concentración'];
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const EMPTY_SCENE_NPCS = [];

function resolveUrl(value) {
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value;
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

const PATH_TOOLS = new Set(['pen', 'line', 'circle', 'rectangle']);
const VFX_TOOLS = new Set(['vfx-fire', 'vfx-ice', 'vfx-acid']);

function shapePathPoints(tool, start, end) {
  if (tool === 'line') return [start, end];
  if (tool === 'rectangle') return [
    start,
    { x: end.x, y: start.y },
    end,
    { x: start.x, y: end.y },
    start,
  ];
  if (tool === 'circle') {
    const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const radius = { x: Math.abs(end.x - start.x) / 2, y: Math.abs(end.y - start.y) / 2 };
    return Array.from({ length: 49 }, (_, index) => {
      const angle = (index / 48) * Math.PI * 2;
      return {
        x: clamp(center.x + Math.cos(angle) * radius.x),
        y: clamp(center.y + Math.sin(angle) * radius.y),
      };
    });
  }
  return [start, end];
}

function signed(value) {
  const number = Number(value) || 0;
  return number >= 0 ? `+${number}` : String(number);
}

function abilityModifier(score) {
  return Math.floor(((Number(score?.base_value) || 10) + (Number(score?.bonus_value) || 0) - 10) / 2);
}

function canMoveToken(token, isDm, session, userId) {
  return isDm || (
    session?.status === 'LIVE'
    && token.owner_user_id === userId
    && (session?.combat_state?.mode !== 'COMBAT' || token.character_id === session?.active_character_id)
    && !token.locked
  );
}

export default function GameStage({
  session,
  userId,
  isDm = false,
  onMoveToken,
  onMoveTokens,
  onAdjustHp,
  onSetHp,
  onToggleCondition,
  onDeleteToken,
  onDuplicateToken,
  onGridStyleChange,
  onNarrativeStyleChange,
  onNarrativePanelDrop,
  onHideContent,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onClearAnnotations,
  onAddVfx,
  onUpdateVfx,
  onDeleteVfx,
  onClearVfx,
  onDismissRoll,
  onResolveRoll,
  hiddenRollIds = [],
  consciousnessNotice = null,
  onRollCharacter,
  combatTargeting,
  onCombatTokenTarget,
  onCombatAreaTarget,
  combatSocket,
  onCombatTargetingChange,
  onCombatError,
  toolbarHost,
}) {
  const stageRef = useRef(null);
  const interactionRef = useRef(null);
  const runtimeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const pendingPreviewRef = useRef(null);
  const tokenElementsRef = useRef(new Map());
  const annotationElementsRef = useRef(new Map());
  const vfxElementsRef = useRef(new Map());
  const contextCardRef = useRef(null);
  const contextDragRef = useRef(null);
  const readingLensSnapshotRef = useRef(null);
  const readingLensActiveRef = useRef(false);
  const combatUseNoticeTimeoutRef = useRef(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [hpEditor, setHpEditor] = useState(null);
  const [detailTab, setDetailTab] = useState('sheet');
  const [showAllHealth, setShowAllHealth] = useState(false);
  const [narrativeDropTarget, setNarrativeDropTarget] = useState(null);
  const [annotationTool, setAnnotationTool] = useState('cursor');
  const [annotationColor, setAnnotationColor] = useState('#e8c66a');
  const [annotationWidth, setAnnotationWidth] = useState(3);
  const [annotationSize, setAnnotationSize] = useState(28);
  const [annotationBackground, setAnnotationBackground] = useState(true);
  const [vfxSize, setVfxSize] = useState(170);
  const [vfxIntensity, setVfxIntensity] = useState(1);
  const [vfxShape, setVfxShape] = useState('point');
  const [vfxLoop, setVfxLoop] = useState(true);
  const [vfxDuration, setVfxDuration] = useState(8);
  const [vfxEnabled, setVfxEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(`dndworld:board-vfx:${userId || 'guest'}`) !== 'off';
    } catch {
      return true;
    }
  });
  const [draftVfxShape, setDraftVfxShape] = useState(null);
  const [selectedVfxId, setSelectedVfxId] = useState(null);
  const [selectedVfxDraft, setSelectedVfxDraft] = useState(null);
  const [draftPath, setDraftPath] = useState(null);
  const [textEditor, setTextEditor] = useState(null);
  const [combatPointer, setCombatPointer] = useState(null);
  const [readingLensHeld, setReadingLensHeld] = useState(false);
  const [readingLensPinned, setReadingLensPinned] = useState(false);
  const [readingLensPointer, setReadingLensPointer] = useState({ x: 0, y: 0 });
  const [readingLensZoom, setReadingLensZoom] = useState(1.7);
  const [combatUseNotice, setCombatUseNotice] = useState(null);
  const readingLens = readingLensHeld || readingLensPinned;
  const reactionNotice = (() => {
    if (!session?.combat_state?.reactionWindow?.id) return null;
    const windows = [session.combat_state.reactionWindow, ...(session.combat_state.reactionQueue || [])].filter(window => window?.id);
    return { count: windows.length, activeName: windows[0]?.reactorName || 'Un jugador', waitingNames: windows.slice(1).map(window => window.reactorName || 'Un jugador') };
  })();

  useEffect(() => {
    if (!combatSocket) return undefined;
    const handleCombatActionUsed = payload => {
      if (!payload?.manualResolution) return;
      setCombatUseNotice(payload);
      window.clearTimeout(combatUseNoticeTimeoutRef.current);
      combatUseNoticeTimeoutRef.current = window.setTimeout(() => setCombatUseNotice(null), 6500);
    };
    combatSocket.on('game:combat-action-used', handleCombatActionUsed);
    return () => {
      combatSocket.off('game:combat-action-used', handleCombatActionUsed);
      window.clearTimeout(combatUseNoticeTimeoutRef.current);
    };
  }, [combatSocket]);
  const activeCharacterId = session?.active_character_id;
  const hasMedia = session?.shared_type !== 'NONE' && session?.shared_url;
  const tokens = (session?.tokens || []).filter(token => token.visible);
  const sceneNpcs = session?.scene_npcs || EMPTY_SCENE_NPCS;
  const speakingNpcId = session?.speaking_npc_id;
  const narrativeLayout = Math.max(1, Math.min(4, Number(session?.narrative_layout) || 1));
  const storedNarrativePanels = Array.isArray(session?.narrative_panels) ? session.narrative_panels : [];
  const narrativePanels = Array.from({ length: narrativeLayout }, (_, index) => {
    if (Object.prototype.hasOwnProperty.call(storedNarrativePanels, index)) return storedNarrativePanels[index];
    return index === 0 && session?.shared_url
      ? { asset_id: null, url: session.shared_url, title: session.shared_title }
      : null;
  });
  const displayedNarrativePanels = isDm ? narrativePanels : narrativePanels.filter(panel => panel?.url);
  const displayedNarrativeLayout = isDm
    ? narrativeLayout
    : Math.max(1, Math.min(4, displayedNarrativePanels.length));
  const annotationViewKey = `${session?.shared_type}:${session?.shared_url || ''}`;
  const annotations = (session?.stage_annotations || []).filter(item => item.view_key === annotationViewKey);
  const stageVfx = (session?.stage_vfx || []).filter(item => item.view_key === annotationViewKey);
  const selectedVfx = stageVfx.find(item => item.id === selectedVfxId) || null;
  const renderedStageVfx = selectedVfx && selectedVfxDraft
    ? stageVfx.map(item => item.id === selectedVfx.id ? { ...item, ...selectedVfxDraft } : item)
    : stageVfx;

  useEffect(() => {
    try {
      window.localStorage.setItem(`dndworld:board-vfx:${userId || 'guest'}`, vfxEnabled ? 'on' : 'off');
    } catch {
      // Local storage can be unavailable in hardened/private browser modes.
    }
  }, [userId, vfxEnabled]);
  const latestSceneNpcsRef = useRef(sceneNpcs);
  const renderedSceneNpcsRef = useRef(sceneNpcs);
  const sceneNpcExitTimersRef = useRef(new Map());
  const [renderedSceneNpcs, setRenderedSceneNpcs] = useState(sceneNpcs);
  const [leavingSceneNpcIds, setLeavingSceneNpcIds] = useState([]);

  const canMove = token => canMoveToken(token, isDm, session, userId);

  const positionFromEvent = event => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    };
  };

  useEffect(() => {
    latestSceneNpcsRef.current = sceneNpcs;
    const nextById = new Map(sceneNpcs.map(npc => [npc.id, npc]));
    const previous = renderedSceneNpcsRef.current;
    const previousIds = new Set(previous.map(npc => npc.id));
    const leaving = previous.filter(npc => !nextById.has(npc.id));
    const merged = [
      ...previous.map(npc => nextById.get(npc.id) || npc),
      ...sceneNpcs.filter(npc => !previousIds.has(npc.id)),
    ];

    renderedSceneNpcsRef.current = merged;
    setRenderedSceneNpcs(merged);
    setLeavingSceneNpcIds(current => current.filter(id => !nextById.has(id)));

    sceneNpcs.forEach(npc => {
      const timer = sceneNpcExitTimersRef.current.get(npc.id);
      if (timer) {
        window.clearTimeout(timer);
        sceneNpcExitTimersRef.current.delete(npc.id);
      }
    });

    leaving.forEach(npc => {
      if (sceneNpcExitTimersRef.current.has(npc.id)) return;
      setLeavingSceneNpcIds(current => current.includes(npc.id) ? current : [...current, npc.id]);
      const timer = window.setTimeout(() => {
        const isVisibleAgain = latestSceneNpcsRef.current.some(currentNpc => currentNpc.id === npc.id);
        if (!isVisibleAgain) {
          const updated = renderedSceneNpcsRef.current.filter(currentNpc => currentNpc.id !== npc.id);
          renderedSceneNpcsRef.current = updated;
          setRenderedSceneNpcs(updated);
        }
        setLeavingSceneNpcIds(current => current.filter(id => id !== npc.id));
        sceneNpcExitTimersRef.current.delete(npc.id);
      }, 230);
      sceneNpcExitTimersRef.current.set(npc.id, timer);
    });
  }, [sceneNpcs]);

  useEffect(() => () => {
    sceneNpcExitTimersRef.current.forEach(timer => window.clearTimeout(timer));
    sceneNpcExitTimersRef.current.clear();
  }, []);

  useEffect(() => {
    const updatePointer = event => {
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      if (readingLensActiveRef.current) setReadingLensPointer({ x: event.clientX, y: event.clientY });
    };
    const keyDown = event => {
      const editable = event.target instanceof HTMLElement
        && (event.target.matches('input, textarea, select') || event.target.isContentEditable);
      if (!editable && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        if (event.shiftKey) {
          if (!event.repeat) setReadingLensPinned(current => !current);
        } else {
          setReadingLensHeld(true);
        }
      }
    };
    const clearLens = () => setReadingLensHeld(false);
    const adjustLensZoom = event => {
      if (!readingLensActiveRef.current) return;
      event.preventDefault();
      setReadingLensZoom(current => Math.max(1.2, Math.min(3, Number((current + (event.deltaY < 0 ? .15 : -.15)).toFixed(2)))));
    };
    const keyUp = event => {
      if (event.key.toLowerCase() === 'l') clearLens();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('wheel', adjustLensZoom, { passive: false });
    window.addEventListener('blur', clearLens);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('wheel', adjustLensZoom);
      window.removeEventListener('blur', clearLens);
    };
  }, []);

  useEffect(() => {
    readingLensActiveRef.current = readingLens;
    const lensViewport = readingLensSnapshotRef.current;
    if (!readingLens || !lensViewport) return undefined;
    const source = document.getElementById('root');
    if (!source) return undefined;
    const snapshot = source.cloneNode(true);
    snapshot.removeAttribute('id');
    snapshot.classList.add('game-reading-lens-snapshot');
    lensViewport.replaceChildren(snapshot);
    return () => lensViewport.replaceChildren();
  }, [readingLens]);

  useEffect(() => {
    const clearNarrativeDrop = () => setNarrativeDropTarget(null);
    window.addEventListener('dragend', clearNarrativeDrop);
    window.addEventListener('drop', clearNarrativeDrop);
    return () => {
      window.removeEventListener('dragend', clearNarrativeDrop);
      window.removeEventListener('drop', clearNarrativeDrop);
    };
  }, []);

  useEffect(() => {
    runtimeRef.current = {
      tokens: (session?.tokens || []).filter(token => token.visible),
      isDm,
      session,
      userId,
      onMoveToken,
      onMoveTokens,
      onAddAnnotation,
      onUpdateAnnotation,
      onAddVfx,
      onUpdateVfx,
    };
  }, [session, userId, isDm, onMoveToken, onMoveTokens, onAddAnnotation, onUpdateAnnotation, onAddVfx, onUpdateVfx]);

  useEffect(() => {
    const applyTokenPositions = positions => {
      positions.forEach(position => {
        const element = tokenElementsRef.current.get(position.id);
        if (!element) return;
        element.style.left = `${position.x}%`;
        element.style.top = `${position.y}%`;
      });
    };

    const schedulePreview = (type, value) => {
      pendingPreviewRef.current = { type, value };
      if (animationFrameRef.current) return;
      animationFrameRef.current = window.requestAnimationFrame(() => {
        const pending = pendingPreviewRef.current;
        animationFrameRef.current = null;
        if (!pending) return;
        if (pending.type === 'selection') setSelectionBox(pending.value);
        else applyTokenPositions(pending.value);
      });
    };

    const dragPositions = (interaction, event, rect) => {
      const dx = ((event.clientX - interaction.startClientX) / rect.width) * 100;
      const dy = ((event.clientY - interaction.startClientY) / rect.height) * 100;
      return interaction.startPositions.map(token => ({
        id: token.id,
        x: clamp(token.x + dx),
        y: clamp(token.y + dy),
      }));
    };

    const move = event => {
      const interaction = interactionRef.current;
      const rect = stageRef.current?.getBoundingClientRect();
      if (!interaction || !rect) return;

      if (interaction.type === 'annotation-path') {
        const point = {
          x: clamp(((event.clientX - rect.left) / rect.width) * 100),
          y: clamp(((event.clientY - rect.top) / rect.height) * 100),
        };
        const previous = interaction.points.at(-1);
        if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.18) return;
        interaction.points.push(point);
        setDraftPath({ ...interaction, points: [...interaction.points] });
        return;
      }

      if (interaction.type === 'annotation-shape') {
        const end = {
          x: clamp(((event.clientX - rect.left) / rect.width) * 100),
          y: clamp(((event.clientY - rect.top) / rect.height) * 100),
        };
        interaction.end = end;
        interaction.points = shapePathPoints(interaction.tool, interaction.start, end);
        setDraftPath({ ...interaction, points: interaction.points });
        return;
      }

      if (interaction.type === 'annotation-drag') {
        const x = clamp(interaction.x + ((event.clientX - interaction.startClientX) / rect.width) * 100);
        const y = clamp(interaction.y + ((event.clientY - interaction.startClientY) / rect.height) * 100);
        interaction.current = { x, y };
        const element = annotationElementsRef.current.get(interaction.id);
        if (element) {
          element.style.left = `${x}%`;
          element.style.top = `${y}%`;
        }
        return;
      }

      if (interaction.type === 'annotation-editor-drag') {
        const x = clamp(interaction.x + ((event.clientX - interaction.startClientX) / rect.width) * 100);
        const y = clamp(interaction.y + ((event.clientY - interaction.startClientY) / rect.height) * 100);
        setTextEditor(current => current ? { ...current, x, y } : current);
        return;
      }

      if (interaction.type === 'vfx-shape') {
        const current = {
          x: clamp(((event.clientX - rect.left) / rect.width) * 100),
          y: clamp(((event.clientY - rect.top) / rect.height) * 100),
        };
        interaction.current = current;
        setDraftVfxShape({ ...interaction, current });
        return;
      }

      if (interaction.type === 'vfx-drag') {
        const dx = ((event.clientX - interaction.startClientX) / rect.width) * 100;
        const dy = ((event.clientY - interaction.startClientY) / rect.height) * 100;
        interaction.current = {
          x: clamp(interaction.x + dx),
          y: clamp(interaction.y + dy),
          end_x: clamp(interaction.end_x + dx),
          end_y: clamp(interaction.end_y + dy),
          marker_x: clamp(interaction.marker_x + dx),
          marker_y: clamp(interaction.marker_y + dy),
        };
        const element = vfxElementsRef.current.get(interaction.id);
        if (element) {
          element.style.left = `${interaction.current.marker_x}%`;
          element.style.top = `${interaction.current.marker_y}%`;
        }
        return;
      }

      if (interaction.type === 'selection') {
        const current = {
          x: clamp(((event.clientX - rect.left) / rect.width) * 100),
          y: clamp(((event.clientY - rect.top) / rect.height) * 100),
        };
        interaction.current = current;
        schedulePreview('selection', { start: interaction.start, current });
        return;
      }

      const positions = dragPositions(interaction, event, rect);
      interaction.positions = positions;
      schedulePreview('drag', positions);
    };

    const end = event => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      const runtime = runtimeRef.current;
      const rect = stageRef.current?.getBoundingClientRect();

      if (interaction.type === 'annotation-path') {
        if (interaction.points.length > 1) runtime.onAddAnnotation?.({
          type: 'path',
          points: interaction.points,
          color: interaction.color,
          width: interaction.width,
        });
        setDraftPath(null);
        interactionRef.current = null;
        return;
      }

      if (interaction.type === 'vfx-shape') {
        const current = interaction.current || interaction.start;
        if (Math.hypot(current.x - interaction.start.x, current.y - interaction.start.y) > .35) {
          runtime.onAddVfx?.({
            type: interaction.effectType,
            shape: interaction.shape,
            x: interaction.start.x,
            y: interaction.start.y,
            end_x: current.x,
            end_y: current.y,
            size: interaction.size,
            intensity: interaction.intensity,
            loop: interaction.loop,
            duration: interaction.duration,
          });
        }
        setDraftVfxShape(null);
        interactionRef.current = null;
        return;
      }

      if (interaction.type === 'annotation-shape') {
        const points = interaction.points || [];
        if (interaction.end && Math.hypot(interaction.end.x - interaction.start.x, interaction.end.y - interaction.start.y) > 0.15) runtime.onAddAnnotation?.({
          type: 'path',
          points,
          color: interaction.color,
          width: interaction.width,
        });
        setDraftPath(null);
        interactionRef.current = null;
        return;
      }

      if (interaction.type === 'annotation-drag') {
        const position = interaction.current || { x: interaction.x, y: interaction.y };
        runtime.onUpdateAnnotation?.(interaction.id, { x: position.x, y: position.y });
        interactionRef.current = null;
        return;
      }


      if (interaction.type === 'annotation-editor-drag') {
        interactionRef.current = null;
        return;
      }

      if (interaction.type === 'vfx-drag') {
        const position = interaction.current || interaction;
        runtime.onUpdateVfx?.(interaction.id, {
          x: position.x,
          y: position.y,
          end_x: position.end_x,
          end_y: position.end_y,
        });
        interactionRef.current = null;
        return;
      }

      if (interaction.type === 'selection') {
        const endPosition = rect ? {
          x: clamp(((event.clientX - rect.left) / rect.width) * 100),
          y: clamp(((event.clientY - rect.top) / rect.height) * 100),
        } : interaction.current || interaction.start;
        const left = Math.min(interaction.start.x, endPosition.x);
        const right = Math.max(interaction.start.x, endPosition.x);
        const top = Math.min(interaction.start.y, endPosition.y);
        const bottom = Math.max(interaction.start.y, endPosition.y);
        const tokenRadiusX = rect ? (24 / rect.width) * 100 : 0;
        const tokenRadiusY = rect ? (30 / rect.height) * 100 : 0;
        setSelectedIds(runtime.tokens.filter(token => (
          canMoveToken(token, runtime.isDm, runtime.session, runtime.userId)
          && token.x + tokenRadiusX >= left
          && token.x - tokenRadiusX <= right
          && token.y + tokenRadiusY >= top
          && token.y - tokenRadiusY <= bottom
        )).map(token => token.id));
        setSelectionBox(null);
      } else {
        const positions = rect ? dragPositions(interaction, event, rect) : interaction.positions || interaction.startPositions;
        applyTokenPositions(positions);
        if (positions.length > 1 && runtime.onMoveTokens) {
          runtime.onMoveTokens(positions.map(token => ({ tokenId: token.id, x: token.x, y: token.y })));
        } else if (positions[0]) {
          runtime.onMoveToken?.(positions[0].id, positions[0].x, positions[0].y);
        }
      }
      pendingPreviewRef.current = null;
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const moveCard = event => {
      const drag = contextDragRef.current;
      const stage = stageRef.current?.getBoundingClientRect();
      const card = contextCardRef.current;
      if (!drag || !stage || !card) return;
      const left = Math.max(8, Math.min(stage.width - card.offsetWidth - 8, drag.left + event.clientX - drag.clientX));
      const top = Math.max(8, Math.min(stage.height - 180, drag.top + event.clientY - drag.clientY));
      drag.currentLeft = left;
      drag.currentTop = top;
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.maxHeight = `${Math.max(172, stage.height - top - 8)}px`;
    };
    const endCardMove = () => {
      const drag = contextDragRef.current;
      if (!drag) return;
      setContextMenu(current => current ? {
        ...current,
        left: drag.currentLeft ?? drag.left,
        top: drag.currentTop ?? drag.top,
      } : current);
      contextDragRef.current = null;
    };
    window.addEventListener('pointermove', moveCard);
    window.addEventListener('pointerup', endCardMove);
    return () => {
      window.removeEventListener('pointermove', moveCard);
      window.removeEventListener('pointerup', endCardMove);
    };
  }, []);

  useEffect(() => {
    const keyDown = event => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setSelectedIds([]);
        setSelectedVfxId(null);
        setSelectedVfxDraft(null);
      }
      const editable = event.target instanceof HTMLElement
        && (event.target.matches('input, textarea, select') || event.target.isContentEditable);
      if (!editable && event.ctrlKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        setShowAllHealth(true);
      }
    };
    const keyUp = event => {
      if (event.key === 'Control' || event.key.toLowerCase() === 'v') setShowAllHealth(false);
    };
    const clearHealth = () => setShowAllHealth(false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clearHealth);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clearHealth);
    };
  }, []);

  const openTokenMenu = (event, token) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setContextMenu({
      tokenId: token.id,
      left: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 354)),
      top: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 470)),
    });
    setHpEditor(null);
    setDetailTab('sheet');
  };

  const menuToken = tokens.find(token => token.id === contextMenu?.tokenId);
  const menuImage = menuToken && (menuToken.image_url || menuToken.character?.rendered_url || menuToken.character?.image_url || menuToken.character?.base_body_url);
  const menuCharacter = menuToken?.character;
  const canSeeFullSheet = Boolean(menuToken && (isDm || menuToken.owner_user_id === userId));
  const menuActions = menuCharacter?.npcActions || [];
  const boxStyle = selectionBox ? {
    left: `${Math.min(selectionBox.start.x, selectionBox.current.x)}%`,
    top: `${Math.min(selectionBox.start.y, selectionBox.current.y)}%`,
    width: `${Math.abs(selectionBox.current.x - selectionBox.start.x)}%`,
    height: `${Math.abs(selectionBox.current.y - selectionBox.start.y)}%`,
  } : null;

  return (
    <div
      ref={stageRef}
      className={`game-stage${session?.shared_type === 'MAP' && session?.grid_enabled ? ' has-grid' : ''}${hasMedia ? ' has-media' : ''}${session?.shared_type === 'MAP' ? ` is-map map-fit-${String(session?.map_fit || 'COVER').toLowerCase()}` : ` is-narrative fit-${String(session?.narrative_fit || 'COVER').toLowerCase()}`}${showAllHealth ? ' is-showing-health' : ''}${isDm && annotationTool !== 'cursor' ? ` is-annotating tool-${annotationTool}` : ''}${combatTargeting ? ' is-combat-targeting' : ''}`}
      style={{
        '--game-grid-color': session?.grid_color || '#d8cdb1',
        '--game-grid-line-width': `${session?.grid_line_width ?? 1}px`,
      }}
      onContextMenu={event => event.preventDefault()}
      onPointerMove={event => {
        const lensPosition = positionFromEvent(event);
        if (!combatTargeting || !String(combatTargeting.action?.target).startsWith('area-')) return;
        if (combatTargeting.action?.area?.origin === 'self') return;
        const position = lensPosition;
        if (position) setCombatPointer({ ...position, actionKey: combatTargeting.action?.key });
      }}
      onPointerDown={event => {
        if (event.button === 0 && combatTargeting && String(combatTargeting.action?.target).startsWith('area-')) {
          event.preventDefault();
          event.stopPropagation();
          const actor = tokens.find(token => Number(token.character_id) === Number(activeCharacterId));
          const position = combatTargeting.action?.area?.origin === 'self' && actor
            ? { x: Number(actor.x), y: Number(actor.y) }
            : positionFromEvent(event);
          if (position) onCombatAreaTarget?.({ x: position.x, y: position.y });
          return;
        }
        if (event.button !== 0 || !isDm) return;
        if (VFX_TOOLS.has(annotationTool)) {
          event.preventDefault();
          event.stopPropagation();
          setContextMenu(null);
          const position = positionFromEvent(event);
          if (!position) return;
          const config = {
            effectType: annotationTool.slice(4),
            shape: vfxShape,
            start: position,
            current: position,
            size: vfxSize,
            intensity: vfxIntensity,
            loop: vfxLoop,
            duration: vfxDuration,
          };
          if (vfxShape === 'point') {
            onAddVfx?.({
              type: config.effectType,
              shape: 'point',
              x: position.x,
              y: position.y,
              end_x: position.x,
              end_y: position.y,
              size: config.size,
              intensity: config.intensity,
              loop: config.loop,
              duration: config.duration,
            });
          } else {
            interactionRef.current = { type: 'vfx-shape', ...config };
            setDraftVfxShape({ type: 'vfx-shape', ...config });
          }
          return;
        }
        if (annotationTool === 'pen' && session?.shared_type === 'MAP') {
          event.preventDefault();
          setContextMenu(null);
          const start = positionFromEvent(event);
          if (!start) return;
          const interaction = { type: 'annotation-path', points: [start], color: annotationColor, width: annotationWidth };
          interactionRef.current = interaction;
          setDraftPath(interaction);
          return;
        }
        if (['line', 'circle', 'rectangle'].includes(annotationTool) && session?.shared_type === 'MAP') {
          event.preventDefault();
          setContextMenu(null);
          const start = positionFromEvent(event);
          if (!start) return;
          const interaction = {
            type: 'annotation-shape',
            tool: annotationTool,
            start,
            points: [start],
            color: annotationColor,
            width: annotationWidth,
          };
          interactionRef.current = interaction;
          setDraftPath(interaction);
          return;
        }
        if (annotationTool === 'text') {
          event.preventDefault();
          const position = positionFromEvent(event);
          if (!position) return;
          setTextEditor({
            id: null,
            text: '',
            x: position.x,
            y: position.y,
            color: annotationColor,
            size: annotationSize,
            background: annotationBackground,
          });
          return;
        }
        if (annotationTool !== 'cursor' || session?.shared_type !== 'MAP') return;
        event.preventDefault();
        setContextMenu(null);
        const start = positionFromEvent(event);
        if (!start) return;
        interactionRef.current = { type: 'selection', start, current: start };
        setSelectionBox({ start, current: start });
        setSelectedIds([]);
      }}
    >
      {hasMedia ? (
        session.shared_type === 'IMAGE' ? (
          <div className={`game-narrative-grid layout-${displayedNarrativeLayout}${isDm ? ' is-editable' : ''}`}>
            {displayedNarrativePanels.map((panel, index) => (
              <div
                key={`${index}-${panel?.asset_id || panel?.url || 'empty'}`}
                className={`game-narrative-panel${narrativeDropTarget === index ? ' is-drop-target' : ''}`}
                data-drop-label={`Soltar en área ${index + 1}`}
                onDragEnter={isDm ? event => {
                  const types = Array.from(event.dataTransfer.types);
                  if (!types.includes('application/x-game-asset') && !types.includes('application/x-game-scene')) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setNarrativeDropTarget(index);
                } : undefined}
                onDragOver={isDm ? event => {
                  const types = Array.from(event.dataTransfer.types);
                  if (!types.includes('application/x-game-asset') && !types.includes('application/x-game-scene')) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = 'copy';
                  if (narrativeDropTarget !== index) setNarrativeDropTarget(index);
                } : undefined}
                onDragLeave={isDm ? event => {
                  event.stopPropagation();
                  if (!event.currentTarget.contains(event.relatedTarget)) setNarrativeDropTarget(null);
                } : undefined}
                onDrop={isDm ? event => {
                  event.preventDefault();
                  event.stopPropagation();
                  const assetPayload = event.dataTransfer.getData('application/x-game-asset');
                  const sceneData = event.dataTransfer.getData('application/x-game-scene');
                  setNarrativeDropTarget(null);
                  if (assetPayload?.startsWith('scene:')) {
                    onNarrativePanelDrop?.(index, { sceneId: assetPayload.slice(6) });
                    return;
                  }
                  if (assetPayload) {
                    onNarrativePanelDrop?.(index, { assetId: assetPayload });
                    return;
                  }
                  if (sceneData) {
                    try {
                      const scene = JSON.parse(sceneData);
                      if (scene.id) onNarrativePanelDrop?.(index, { sceneId: scene.id });
                      else if (scene.url) onNarrativePanelDrop?.(index, { panelUrl: scene.url, panelTitle: scene.title });
                    } catch {
                      // Ignore malformed external drag data.
                    }
                  }
                } : undefined}
              >
                {panel?.url ? <img src={resolveUrl(panel.url)} alt={panel.title || `Imagen narrativa ${index + 1}`} draggable={false} /> : <div><ImageIcon size={22} /><span>Área {index + 1}</span><small>Sin imagen asignada</small></div>}
                {panel?.title && displayedNarrativeLayout > 1 && <span>{panel.title}</span>}
                {isDm && panel?.url && (
                  <button
                    type="button"
                    className="game-narrative-panel-clear"
                    aria-label={`Quitar imagen del área ${index + 1}`}
                    title="Quitar de este cuadrante"
                    onPointerDown={event => event.stopPropagation()}
                    onClick={event => {
                      event.stopPropagation();
                      if (narrativePanels.filter(item => item?.url).length === 1) {
                        onHideContent?.();
                      } else {
                        onNarrativePanelDrop?.(index, { clearSlot: true });
                      }
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : <img className="game-stage-media" src={resolveUrl(session.shared_url)} alt={session.shared_title || 'Mapa compartido'} draggable={false} />
      ) : (
        <div className="game-stage-empty">
          {session?.shared_type === 'MAP' ? <MapIcon size={38} /> : <ImageIcon size={38} />}
          <strong>La mesa está preparada</strong>
          <p>El DM todavía no compartió una imagen o mapa para esta escena.</p>
        </div>
      )}

      <GameBoardVfx effects={vfxEnabled ? renderedStageVfx : []} />
      {readingLens && createPortal(
        <aside
          className="game-reading-lens"
          role="status"
          aria-label="Lupa de lectura activa"
          style={{
            left: `${Math.max(330, Math.min(window.innerWidth - 330, readingLensPointer.x))}px`,
            top: `${Math.max(220, Math.min(window.innerHeight - 220, readingLensPointer.y))}px`,
            '--reading-lens-x': `${readingLensPointer.x}px`,
            '--reading-lens-y': `${readingLensPointer.y}px`,
            '--reading-lens-zoom': readingLensZoom,
          }}
        >
          <div ref={readingLensSnapshotRef} className="game-reading-lens-viewport" aria-hidden="true" />
          <span>Lupa {Math.round(readingLensZoom * 100)}% · rueda ajusta · {readingLensPinned ? 'Shift + L para cerrar' : 'suelta L'}</span>
        </aside>,
        document.body,
      )}
      {!vfxEnabled && !!renderedStageVfx.length && (
        <div className="game-vfx-fallback-layer" aria-label="Indicadores tácticos de efectos">
          {renderedStageVfx.map(effect => {
            const useMidpoint = effect.shape === 'line' || effect.shape === 'square';
            const x = useMidpoint ? (Number(effect.x) + Number(effect.end_x ?? effect.x)) / 2 : Number(effect.x);
            const y = useMidpoint ? (Number(effect.y) + Number(effect.end_y ?? effect.y)) / 2 : Number(effect.y);
            return (
              <span
                key={effect.id}
                className={`game-vfx-fallback is-${effect.type}`}
                style={{ left: `${x}%`, top: `${y}%`, '--fallback-size': `${Math.max(60, Math.min(360, (Number(effect.size) || 170) * .9))}px`, '--fallback-opacity': Math.max(.48, Math.min(.82, (Number(effect.intensity) || 1) * .72)) }}
                title={`${effect.type} (FX desactivados)`}
              >
                {effect.type === 'fire' ? <Flame size={15} /> : effect.type === 'ice' ? <Snowflake size={15} /> : <FlaskConical size={15} />}
              </span>
            );
          })}
        </div>
      )}
      {!isDm && (
        <button
          type="button"
          className={`game-vfx-visibility-toggle${vfxEnabled ? ' is-enabled' : ''}`}
          title={vfxEnabled ? 'Desactivar efectos animados' : 'Activar efectos animados'}
          aria-pressed={vfxEnabled}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => { event.stopPropagation(); setVfxEnabled(current => !current); }}
        >
          {vfxEnabled ? <Eye size={13} /> : <EyeOff size={13} />}
          <span>FX {vfxEnabled ? 'ON' : 'OFF'}</span>
        </button>
      )}
      {draftVfxShape && (
        <svg className={`game-vfx-shape-preview is-${draftVfxShape.effectType}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {draftVfxShape.shape === 'line' && <line x1={draftVfxShape.start.x} y1={draftVfxShape.start.y} x2={draftVfxShape.current.x} y2={draftVfxShape.current.y} />}
          {draftVfxShape.shape === 'square' && <rect x={Math.min(draftVfxShape.start.x, draftVfxShape.current.x)} y={Math.min(draftVfxShape.start.y, draftVfxShape.current.y)} width={Math.abs(draftVfxShape.current.x - draftVfxShape.start.x)} height={Math.abs(draftVfxShape.current.y - draftVfxShape.start.y)} />}
          {draftVfxShape.shape === 'circle' && <circle cx={draftVfxShape.start.x} cy={draftVfxShape.start.y} r={Math.hypot(draftVfxShape.current.x - draftVfxShape.start.x, draftVfxShape.current.y - draftVfxShape.start.y)} />}
        </svg>
      )}
      {isDm && annotationTool === 'vfx-manage' && (
        <div className="game-vfx-control-layer" aria-label="Controles de efectos visuales">
          {stageVfx.map(effect => {
            const isAreaShape = effect.shape === 'line' || effect.shape === 'square';
            const markerX = isAreaShape ? (Number(effect.x) + Number(effect.end_x ?? effect.x)) / 2 : Number(effect.x);
            const markerY = isAreaShape ? (Number(effect.y) + Number(effect.end_y ?? effect.y)) / 2 : Number(effect.y);
            return (
            <div
              key={effect.id}
              ref={element => {
                if (element) vfxElementsRef.current.set(effect.id, element);
                else vfxElementsRef.current.delete(effect.id);
              }}
              className={`game-vfx-handle is-${effect.type}${selectedVfxId === effect.id ? ' is-selected' : ''}`}
              style={{ left: `${markerX}%`, top: `${markerY}%`, '--vfx-handle-size': `${effect.shape === 'point' ? Math.max(42, Math.min(68, effect.size * .28)) : 46}px` }}
              title="Selecciona o arrastra para mover el efecto"
              onPointerDown={event => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                setSelectedVfxId(effect.id);
                setSelectedVfxDraft({ size: Number(effect.size) || 170, intensity: Number(effect.intensity) || 1 });
                interactionRef.current = {
                  type: 'vfx-drag',
                  id: effect.id,
                  x: Number(effect.x),
                  y: Number(effect.y),
                  end_x: Number(effect.end_x ?? effect.x),
                  end_y: Number(effect.end_y ?? effect.y),
                  marker_x: markerX,
                  marker_y: markerY,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                };
              }}
            >
              {effect.type === 'fire' ? <Flame size={15} /> : effect.type === 'ice' ? <Snowflake size={15} /> : <FlaskConical size={15} />}
              <button
                type="button"
                title="Eliminar efecto"
                aria-label="Eliminar efecto"
                onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }}
                onClick={event => {
                  event.stopPropagation();
                  onDeleteVfx?.(effect.id);
                  if (selectedVfxId === effect.id) {
                    setSelectedVfxId(null);
                    setSelectedVfxDraft(null);
                  }
                }}
              ><X size={10} /></button>
            </div>
            );
          })}
        </div>
      )}

      {!!(annotations.length || draftPath || textEditor) && (
        <div className={`game-annotation-layer${isDm ? ' is-dm' : ''}`} aria-label="Anotaciones compartidas">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {annotations.filter(item => item.type === 'path').map(item => {
              const points = item.points.map(point => `${point.x},${point.y}`).join(' ');
              return (
                <g key={item.id}>
                  <polyline className="game-annotation-path" points={points} fill="none" stroke={item.color} strokeWidth={item.width} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                  {isDm && annotationTool === 'eraser' && <polyline className="game-annotation-path-hit" points={points} fill="none" stroke="transparent" strokeWidth={Math.max(14, item.width + 10)} vectorEffect="non-scaling-stroke" onPointerDown={event => { event.stopPropagation(); onDeleteAnnotation?.(item.id); }} />}
                </g>
              );
            })}
            {draftPath && <polyline className="game-annotation-path is-draft" points={draftPath.points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={draftPath.color} strokeWidth={draftPath.width} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          {annotations.filter(item => item.type === 'text').map(item => (
            <div
              key={item.id}
              ref={element => {
                if (element) annotationElementsRef.current.set(item.id, element);
                else annotationElementsRef.current.delete(item.id);
              }}
              className={`game-stage-annotation-text${item.background ? ' has-background' : ''}${isDm && annotationTool !== 'eraser' ? ' is-movable' : ''}${isDm && annotationTool === 'eraser' ? ' is-erasable' : ''}`}
              style={{ left: `${item.x}%`, top: `${item.y}%`, color: item.color, fontSize: `${item.size}px` }}
              onPointerDown={isDm ? event => {
                event.stopPropagation();
                if (annotationTool === 'eraser') {
                  onDeleteAnnotation?.(item.id);
                  return;
                }
                if (event.button !== 0) return;
                event.preventDefault();
                interactionRef.current = {
                  type: 'annotation-drag',
                  id: item.id,
                  x: item.x,
                  y: item.y,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                };
              } : undefined}
              onDoubleClick={isDm ? event => {
                event.stopPropagation();
                event.preventDefault();
                setTextEditor({ ...item });
              } : undefined}
            >
              {item.text}
              {isDm && (
                <button
                  type="button"
                  className="game-stage-annotation-close"
                  aria-label="Eliminar texto"
                  title="Eliminar texto"
                  onPointerDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteAnnotation?.(item.id);
                    setTextEditor(current => current?.id === item.id ? null : current);
                  }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          {isDm && textEditor && (
            <div
              className="game-stage-text-editor"
              style={{ left: `${textEditor.x}%`, top: `${textEditor.y}%`, '--editor-color': textEditor.color }}
              onPointerDown={event => event.stopPropagation()}
            >
              <div
                className="game-stage-text-editor-handle"
                onPointerDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  interactionRef.current = {
                    type: 'annotation-editor-drag',
                    x: textEditor.x,
                    y: textEditor.y,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                  };
                }}
              >
                <Move size={12} /><span>{textEditor.id ? 'Editar texto' : 'Nuevo texto'}</span><small>Arrastra para mover</small>
              </div>
              <textarea
                autoFocus
                rows="3"
                maxLength="500"
                value={textEditor.text}
                onChange={event => setTextEditor(current => ({ ...current, text: event.target.value }))}
                placeholder="Escribe directamente aquí..."
                style={{ color: textEditor.color, fontSize: `${Math.max(13, textEditor.size * 0.58)}px` }}
              />
              <div className="game-stage-text-editor-controls">
                <label title="Color del texto"><input type="color" value={textEditor.color} onChange={event => setTextEditor(current => ({ ...current, color: event.target.value }))} /></label>
                <button title="Achicar texto" onClick={() => setTextEditor(current => ({ ...current, size: Math.max(12, current.size - 2) }))}><Minus size={13} /></button>
                <output>{textEditor.size}px</output>
                <button title="Agrandar texto" onClick={() => setTextEditor(current => ({ ...current, size: Math.min(72, current.size + 2) }))}><Plus size={13} /></button>
                <button className={textEditor.background ? 'is-active' : ''} title="Alternar fondo" onClick={() => setTextEditor(current => ({ ...current, background: !current.background }))}>Fondo</button>
              </div>
              <div className="game-stage-text-editor-actions">
                {textEditor.id && <button className="is-delete" title="Eliminar texto" onClick={() => { onDeleteAnnotation?.(textEditor.id); setTextEditor(null); }}><Trash2 size={12} /> Eliminar</button>}
                <button title="Cancelar" onClick={() => setTextEditor(null)}><X size={13} /> Cancelar</button>
                <button
                  className="is-save"
                  disabled={!textEditor.text.trim()}
                  onClick={() => {
                    const payload = {
                      text: textEditor.text,
                      x: textEditor.x,
                      y: textEditor.y,
                      color: textEditor.color,
                      size: textEditor.size,
                      background: textEditor.background,
                    };
                    if (textEditor.id) onUpdateAnnotation?.(textEditor.id, payload);
                    else onAddAnnotation?.({ type: 'text', ...payload });
                    setAnnotationColor(textEditor.color);
                    setAnnotationSize(textEditor.size);
                    setAnnotationBackground(textEditor.background);
                    setTextEditor(null);
                  }}
                ><Check size={13} /> Guardar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {isDm && session?.shared_type !== 'NONE' && toolbarHost && createPortal(
        <div className="game-grid-tools is-open is-inline" onPointerDown={event => event.stopPropagation()}>
            <div className="game-grid-tools-panel">
              {session.shared_type === 'MAP' ? (
                <>
                  <header><div><span>Modo combate</span><strong>Cuadrícula del mapa</strong></div><Palette size={15} /></header>
                  <button className={`game-grid-visibility${session.grid_enabled ? ' is-active' : ''}`} onClick={() => onGridStyleChange?.({ enabled: !session.grid_enabled })}>
                    <span><i />Mostrar cuadrícula</span><small>{session.grid_enabled ? 'Visible' : 'Oculta'}</small>
                  </button>
                  <label className="game-grid-color-control">
                    <span>Color de líneas</span>
                    <div><input type="color" value={session.grid_color || '#d8cdb1'} onChange={event => onGridStyleChange?.({ color: event.target.value })} /><output>{session.grid_color || '#d8cdb1'}</output></div>
                  </label>
                  <label className="game-grid-width-control">
                    <span>Grosor <output>{Number(session.grid_line_width || 1).toFixed(2)} px</output></span>
                    <input type="range" min="0.25" max="4" step="0.25" value={session.grid_line_width || 1} onChange={event => onGridStyleChange?.({ lineWidth: Number(event.target.value) })} />
                  </label>
                  <div className="game-narrative-fit-control">
                    <span>Encuadre del mapa</span>
                    <div>
                      <button className={session.map_fit !== 'CONTAIN' ? 'is-active' : ''} onClick={() => onGridStyleChange?.({ mapFit: 'COVER' })}>Llenar</button>
                      <button className={session.map_fit === 'CONTAIN' ? 'is-active' : ''} onClick={() => onGridStyleChange?.({ mapFit: 'CONTAIN' })}>Completo</button>
                    </div>
                    <small>{session.map_fit === 'CONTAIN' ? 'Muestra el mapa completo con márgenes.' : 'Mantiene el mapa ocupando todo el visor.'}</small>
                  </div>
                </>
              ) : (
                <>
                  <header><div><span>Modo narrativa</span><strong>Encuadre de escena</strong></div><ImageIcon size={15} /></header>
                  <div className="game-narrative-fit-control">
                    <span>Presentación de imagen</span>
                    <div>
                      <button className={session.narrative_fit !== 'CONTAIN' ? 'is-active' : ''} onClick={() => onNarrativeStyleChange?.({ fit: 'COVER' })}>Llenar</button>
                      <button className={session.narrative_fit === 'CONTAIN' ? 'is-active' : ''} onClick={() => onNarrativeStyleChange?.({ fit: 'CONTAIN' })}>Completa</button>
                    </div>
                    <small>{session.narrative_fit === 'CONTAIN' ? 'Muestra toda la imagen sin recortarla.' : 'Ocupa todo el visor y recorta los bordes.'}</small>
                  </div>
                  <div className="game-narrative-layout-control">
                    <span>Áreas simultáneas</span>
                    <div>{[1, 2, 3, 4].map(count => <button key={count} className={narrativeLayout === count ? 'is-active' : ''} onClick={() => onNarrativeStyleChange?.({ layout: count })}>{count}</button>)}</div>
                  </div>
                  <div className="game-narrative-slots">
                    {narrativePanels.map((panel, index) => (
                      <label key={index}>
                        <span>Área {index + 1}</span>
                        <select value={panel?.asset_id || ''} onChange={event => onNarrativeStyleChange?.({ slotIndex: index, assetId: event.target.value || null })}>
                          <option value="">{index === 0 ? 'Escena principal' : 'Sin imagen'}</option>
                          {(session.assets || []).map(asset => <option key={asset.id} value={asset.id}>{asset.title}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <div className="game-annotation-tools">
                <div className="game-annotation-tools-title"><span>{session.shared_type === 'MAP' ? 'Marcas de combate' : 'Texto sobre escena'}</span><strong>{annotations.length}</strong></div>
                <div className="game-annotation-tool-buttons">
                  <button className={annotationTool === 'cursor' ? 'is-active' : ''} onClick={() => setAnnotationTool('cursor')} title="Seleccionar y mover"><MousePointer2 size={13} /><span>Cursor</span></button>
                  {session.shared_type === 'MAP' && <button className={annotationTool === 'pen' ? 'is-active' : ''} onClick={() => setAnnotationTool('pen')} title="Dibujar"><Pencil size={13} /><span>Pincel</span></button>}
                  {session.shared_type === 'MAP' && <button className={annotationTool === 'line' ? 'is-active' : ''} onClick={() => setAnnotationTool('line')} title="Dibujar línea recta"><Minus size={13} /><span>Línea</span></button>}
                  {session.shared_type === 'MAP' && <button className={annotationTool === 'circle' ? 'is-active' : ''} onClick={() => setAnnotationTool('circle')} title="Dibujar círculo"><Circle size={13} /><span>Círculo</span></button>}
                  {session.shared_type === 'MAP' && <button className={annotationTool === 'rectangle' ? 'is-active' : ''} onClick={() => setAnnotationTool('rectangle')} title="Dibujar rectángulo"><Square size={13} /><span>Rectángulo</span></button>}
                  <button className={annotationTool === 'text' ? 'is-active' : ''} onClick={() => setAnnotationTool('text')} title="Agregar texto"><Type size={13} /><span>Texto</span></button>
                  <button className={annotationTool === 'eraser' ? 'is-active' : ''} onClick={() => setAnnotationTool('eraser')} title="Borrar anotación"><Eraser size={13} /><span>Borrar</span></button>
                </div>
                {PATH_TOOLS.has(annotationTool) && (
                  <label className="game-annotation-color">
                    <span>Color</span>
                    <div><input type="color" value={annotationColor} onChange={event => setAnnotationColor(event.target.value)} /><output>{annotationColor}</output></div>
                  </label>
                )}
                {PATH_TOOLS.has(annotationTool) && session.shared_type === 'MAP' && (
                  <label className="game-annotation-range">
                    <span>Grosor <output>{annotationWidth}px</output></span>
                    <input type="range" min="1" max="18" step="1" value={annotationWidth} onChange={event => setAnnotationWidth(Number(event.target.value))} />
                  </label>
                )}
                {annotationTool === 'text' && (
                  <p className="game-annotation-hint">Haz clic sobre la imagen y escribe directamente allí. Haz doble clic sobre un texto para volver a editarlo.</p>
                )}
                {annotationTool === 'eraser' && <p className="game-annotation-hint">Haz clic sobre un trazo o texto para eliminarlo.</p>}
                <button className="game-annotation-clear" disabled={!annotations.length} onClick={() => onClearAnnotations?.()}><Trash2 size={12} /> Limpiar anotaciones</button>
              </div>
              <div className="game-vfx-tools">
                <div className="game-annotation-tools-title"><span>VFX del tablero</span><strong>{stageVfx.length}</strong></div>
                <div className="game-vfx-tool-buttons">
                  <button className={annotationTool === 'vfx-fire' ? 'is-active is-fire' : ''} onClick={() => { setAnnotationTool('vfx-fire'); setSelectedVfxId(null); }} title="Colocar fuego"><Flame size={13} /><span>Fuego</span></button>
                  <button className={annotationTool === 'vfx-ice' ? 'is-active is-ice' : ''} onClick={() => { setAnnotationTool('vfx-ice'); setSelectedVfxId(null); }} title="Colocar hielo"><Snowflake size={13} /><span>Hielo</span></button>
                  <button className={annotationTool === 'vfx-acid' ? 'is-active is-acid' : ''} onClick={() => { setAnnotationTool('vfx-acid'); setSelectedVfxId(null); }} title="Colocar ácido"><FlaskConical size={13} /><span>Ácido</span></button>
                  <button className={annotationTool === 'vfx-manage' ? 'is-active' : ''} onClick={() => setAnnotationTool('vfx-manage')} title="Mover o eliminar efectos"><Sparkles size={13} /><span>Editar</span></button>
                  <button className={vfxEnabled ? 'is-active' : ''} onClick={() => setVfxEnabled(current => !current)} title={vfxEnabled ? 'Desactivar animaciones VFX' : 'Activar animaciones VFX'}>{vfxEnabled ? <Eye size={13} /> : <EyeOff size={13} />}<span>FX {vfxEnabled ? 'ON' : 'OFF'}</span></button>
                </div>
                {VFX_TOOLS.has(annotationTool) && (
                  <>
                    <div className="game-vfx-shape-buttons" aria-label="Forma del efecto">
                      <button className={vfxShape === 'point' ? 'is-active' : ''} onClick={() => setVfxShape('point')} title="Punto"><Sparkles size={12} /><span>Punto</span></button>
                      <button className={vfxShape === 'line' ? 'is-active' : ''} onClick={() => setVfxShape('line')} title="Línea"><Minus size={12} /><span>Línea</span></button>
                      <button className={vfxShape === 'circle' ? 'is-active' : ''} onClick={() => setVfxShape('circle')} title="Círculo"><Circle size={12} /><span>Círculo</span></button>
                      <button className={vfxShape === 'square' ? 'is-active' : ''} onClick={() => setVfxShape('square')} title="Cuadrado"><Square size={12} /><span>Cuadrado</span></button>
                    </div>
                    <label className="game-annotation-range">
                      <span>Tamaño <output>{vfxSize}px</output></span>
                      <input type="range" min="80" max="320" step="10" value={vfxSize} onChange={event => setVfxSize(Number(event.target.value))} />
                    </label>
                    <label className="game-annotation-range">
                      <span>Intensidad <output>{vfxIntensity.toFixed(2)}</output></span>
                      <input type="range" min="0.45" max="1.45" step="0.05" value={vfxIntensity} onChange={event => setVfxIntensity(Number(event.target.value))} />
                    </label>
                    <div className="game-vfx-lifetime">
                      <button className={vfxLoop ? 'is-active' : ''} onClick={() => setVfxLoop(true)}>En bucle</button>
                      <button className={!vfxLoop ? 'is-active' : ''} onClick={() => setVfxLoop(false)}>Temporal</button>
                      {!vfxLoop && <select value={vfxDuration} onChange={event => setVfxDuration(Number(event.target.value))}><option value="4">4 s</option><option value="8">8 s</option><option value="15">15 s</option><option value="30">30 s</option></select>}
                    </div>
                  </>
                )}
                {annotationTool === 'vfx-manage' && selectedVfx && selectedVfxDraft && (
                  <div className="game-vfx-selected-editor">
                    <strong>{selectedVfx.type} · {selectedVfx.shape || 'point'}</strong>
                    <label className="game-annotation-range">
                      <span>Tamaño <output>{selectedVfxDraft.size}px</output></span>
                      <input type="range" min="80" max="320" step="10" value={selectedVfxDraft.size} onChange={event => setSelectedVfxDraft(current => ({ ...current, size: Number(event.target.value) }))} onPointerUp={event => onUpdateVfx?.(selectedVfx.id, { size: Number(event.currentTarget.value) })} onKeyUp={event => onUpdateVfx?.(selectedVfx.id, { size: Number(event.currentTarget.value) })} />
                    </label>
                    <label className="game-annotation-range">
                      <span>Intensidad <output>{selectedVfxDraft.intensity.toFixed(2)}</output></span>
                      <input type="range" min="0.45" max="1.45" step="0.05" value={selectedVfxDraft.intensity} onChange={event => setSelectedVfxDraft(current => ({ ...current, intensity: Number(event.target.value) }))} onPointerUp={event => onUpdateVfx?.(selectedVfx.id, { intensity: Number(event.currentTarget.value) })} onKeyUp={event => onUpdateVfx?.(selectedVfx.id, { intensity: Number(event.currentTarget.value) })} />
                    </label>
                    <button className="game-vfx-remove-selected" onClick={() => { onDeleteVfx?.(selectedVfx.id); setSelectedVfxId(null); setSelectedVfxDraft(null); }}><Trash2 size={11} /> Quitar seleccionado</button>
                  </div>
                )}
                <p className="game-annotation-hint">{annotationTool === 'vfx-manage' ? (selectedVfx ? 'Edita el efecto seleccionado o arrástralo sobre el mapa.' : 'Selecciona un efecto del tablero para editarlo o quitarlo.') : VFX_TOOLS.has(annotationTool) ? (vfxShape === 'point' ? 'Haz clic para colocar el efecto.' : 'Arrastra sobre el tablero para darle forma y extensión.') : 'Selecciona un elemento y colócalo directamente sobre la escena.'}</p>
                <button className="game-annotation-clear" disabled={!stageVfx.length} onClick={() => onClearVfx?.()}><Trash2 size={12} /> Quitar VFX de esta escena</button>
              </div>
            </div>
        </div>
      , toolbarHost)}

      {!!renderedSceneNpcs.length && (
        <div className="game-scene-cast" aria-live="polite" aria-label="Personajes presentes en la escena">
          {renderedSceneNpcs.map(npc => {
            const image = npc.rendered_url || npc.image_url || npc.base_body_url;
            const speaking = npc.id === speakingNpcId;
            const leaving = leavingSceneNpcIds.includes(npc.id);
            return (
              <div key={npc.id} className={`game-scene-cast-entry${leaving ? ' is-leaving' : ''}`} onPointerDown={event => event.stopPropagation()}>
                <article className={`${speaking ? 'is-speaking' : ''}${speakingNpcId && !speaking ? ' is-listening' : ''}`} tabIndex={0}>
                  <div className="game-scene-cast-image">
                    {image ? <img src={resolveUrl(image)} alt="" /> : <span>{npc.name?.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div>
                    {speaking && <small>Hablando</small>}
                    <strong>{npc.name}</strong>
                    <span>{npc.npc_type || npc.creature_type || 'NPC'}</span>
                  </div>
                </article>
                <aside className="game-scene-cast-preview">
                  <div className="game-scene-cast-preview-portrait">
                    {image ? <img src={resolveUrl(image)} alt="" /> : <span>{npc.name?.slice(0, 1).toUpperCase()}</span>}
                    <div><small>{npc.npc_type || npc.creature_type || 'NPC'}</small><strong>{npc.name}</strong><p>{[npc.race, npc.class, npc.level && `Nivel ${npc.level}`].filter(Boolean).join(' · ')}</p></div>
                  </div>
                  <div className="game-scene-cast-preview-stats">
                    <div><Heart size={11} /><span>PG</span><strong>{npc.hp_current ?? '—'} / {npc.hp_max ?? '—'}</strong></div>
                    <div><Shield size={11} /><span>CA</span><strong>{npc.ac ?? npc.ac_base ?? '—'}</strong></div>
                    <div><Move size={11} /><span>Mov.</span><strong>{npc.speed ? `${npc.speed} ft` : '—'}</strong></div>
                  </div>
                  <p>{npc.origin || 'Información pública del personaje en escena.'}</p>
                </aside>
              </div>
            );
          })}
        </div>
      )}
      <DiceRollOverlay rolls={(session?.rolls || []).filter(roll => !hiddenRollIds.includes(String(roll.id)))} userId={userId} isDm={isDm} onDismiss={onDismissRoll} onResolveRoll={onResolveRoll} consciousnessNotice={consciousnessNotice} combatNotice={combatUseNotice} onDismissCombatNotice={() => setCombatUseNotice(null)} reactionNotice={reactionNotice} />
      {combatTargeting && String(combatTargeting.action?.target).startsWith('area-') && (combatTargeting.action?.area?.origin === 'self' || combatPointer?.actionKey === combatTargeting.action?.key) && (() => {
        const action = combatTargeting.action;
        const shape = action.area?.shape || 'circle';
        const actor = tokens.find(token => Number(token.character_id) === Number(activeCharacterId));
        const origin = actor ? { x: Number(actor.x), y: Number(actor.y) } : combatPointer;
        const center = action.area?.origin === 'self' ? origin : combatPointer;
        if (!center) return null;
        const widthPct = Number(action.area?.widthPct) || (Number(action.area?.spanCells) || 1) * 100 / COMBAT_GRID.columns;
        const heightPct = Number(action.area?.heightPct) || (Number(action.area?.spanCells) || 1) * 100 / COMBAT_GRID.rows;
        const gridDx = (center.x - origin.x) * COMBAT_GRID.columns / 100;
        const gridDy = (center.y - origin.y) * COMBAT_GRID.rows / 100;
        const angle = Math.atan2(gridDy, gridDx) * (180 / Math.PI);
        const directional = shape === 'cone' || shape === 'line';
        const style = directional
          ? { left: `${origin.x}%`, top: `${origin.y}%`, width: `${widthPct}%`, '--combat-area-height': `${100 / COMBAT_GRID.rows}%`, '--combat-cone-height': `${heightPct}%`, '--combat-angle': `${angle}deg` }
          : { left: `${center.x}%`, top: `${center.y}%`, width: `${widthPct}%`, height: `${heightPct}%` };
        return <div className={`game-combat-area-preview is-${shape}`} style={style}><span>{action.name}</span></div>;
      })()}
      {selectionBox && <div className="game-token-selection-box" style={boxStyle} />}

      {session?.shared_type !== 'NONE' && tokens.map(token => {
        const movable = canMove(token);
        const ownedByPlayer = !isDm && token.owner_user_id === userId;
        const selected = selectedIds.includes(token.id);
        const hpCurrent = Number(token.character?.hp_current);
        const hpMax = Number(token.character?.hp_max);
        const hasHp = Number.isFinite(hpCurrent) && Number.isFinite(hpMax) && hpMax > 0;
        const isUnconscious = hasHp && hpCurrent <= 0;
        const hpPercent = hasHp ? Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) : 0;
        const hpColor = hpPercent > 50 ? '#65ad72' : hpPercent > 20 ? '#d0a348' : '#c94f43';
        const npcType = String(token.character?.npc_type || '').toLowerCase();
        const tokenRole = token.owner_user_id
          ? 'player'
          : ['enemigo', 'enemy'].includes(npcType)
            ? 'enemy'
            : ['amigo', 'compañero', 'ally'].includes(npcType)
              ? 'ally'
              : 'neutral';
        const tokenAccent = tokenRole === 'player'
          ? '#d7b35f'
          : tokenRole === 'enemy'
            ? '#c94f43'
            : tokenRole === 'ally'
              ? '#65ad72'
              : token.color || '#83948c';
        const tokenSize = Math.max(44, Math.min(72, 50 * (Number(token.size) || 1)));
        const targetingArea = String(combatTargeting?.action?.target || '').startsWith('area-');
        const combatActor = tokens.find(item => Number(item.character_id) === Number(activeCharacterId));
        const actionRange = Number(combatTargeting?.action?.range) || 5;
        const withinCombatRange = !combatActor || gridDistanceFeet(combatActor, token) <= actionRange + 0.01;
        const validCombatTarget = !combatTargeting || targetingArea || (
          withinCombatRange && validTargetRelationship(combatTargeting.action, combatActor, token)
        );
        return (
          <button
            key={token.id}
            ref={element => {
              if (element) tokenElementsRef.current.set(token.id, element);
              else tokenElementsRef.current.delete(token.id);
            }}
            className={`game-token is-${tokenRole}${movable ? ' is-movable' : ''}${selected ? ' is-selected' : ''}${isUnconscious ? ' is-unconscious' : ''}${token.character_id === activeCharacterId ? ' is-active-turn' : ''}${combatTargeting ? (validCombatTarget ? ' is-valid-combat-target' : ' is-invalid-combat-target') : ''}`}
            style={{ left: `${token.x}%`, top: `${token.y}%`, '--token-color': tokenAccent, '--token-size': `${tokenSize}px` }}
            onContextMenu={event => {
              event.preventDefault();
              if (isDm || ownedByPlayer) openTokenMenu(event, token);
            }}
            onPointerDown={event => {
              if (combatTargeting && event.button === 0) {
                event.preventDefault();
                event.stopPropagation();
                if (targetingArea) {
                  const position = combatTargeting.action?.area?.origin === 'self' && combatActor
                    ? { x: Number(combatActor.x), y: Number(combatActor.y) }
                    : positionFromEvent(event);
                  if (position) onCombatAreaTarget?.({ x: position.x, y: position.y });
                } else if (validCombatTarget) {
                  onCombatTokenTarget?.(token);
                }
                return;
              }
              if (isDm && event.button === 0 && annotationTool !== 'cursor') return;
              event.stopPropagation();
              if (event.button === 2) {
                event.preventDefault();
                if (isDm || ownedByPlayer) openTokenMenu(event, token);
                return;
              }
              if (event.button !== 0) return;
              if (!isDm && !ownedByPlayer) {
                openTokenMenu(event, token);
                return;
              }
              if (!movable) return;
              event.preventDefault();
              setContextMenu(null);
              const movingIds = selected && selectedIds.length > 1 ? selectedIds : [token.id];
              if (!selected) setSelectedIds([token.id]);
              const startPositions = tokens.filter(item => movingIds.includes(item.id) && canMove(item)).map(item => ({ id: item.id, x: item.x, y: item.y }));
              interactionRef.current = { type: 'drag', startClientX: event.clientX, startClientY: event.clientY, startPositions, positions: startPositions };
            }}
            title={isDm || ownedByPlayer
              ? `${token.label}: clic izquierdo para mover, clic derecho para ver ficha`
              : `${token.label}: clic izquierdo para ver ficha pública`}
          >
            <span className="game-token-image">
              <span className="game-token-portrait">
                {token.image_url || token.character?.rendered_url || token.character?.image_url || token.character?.base_body_url
                  ? <img src={resolveUrl(token.image_url || token.character?.rendered_url || token.character?.image_url || token.character?.base_body_url)} alt="" />
                  : token.label.slice(0, 1).toUpperCase()}
              </span>
              {isUnconscious && <span className="game-token-unconscious" role="img" aria-label={`${token.label} está inconsciente`}>☠</span>}
            </span>
            <small className="game-token-name">{token.label}</small>
            {hasHp && (
              <span className="game-token-health" style={{ '--token-hp-color': hpColor }}>
                <i><b style={{ width: `${hpPercent}%` }} /></i>
                <em>{hpCurrent} / {hpMax}</em>
              </span>
            )}
            {!!token.conditions?.length && <b className="game-token-condition-count">{token.conditions.length}</b>}
            {movable && <Move size={10} />}
          </button>
        );
      })}

      {contextMenu && menuToken && (
        <article ref={contextCardRef} className={`game-token-context${isDm ? ' is-dm' : ' is-player'}`} style={{ left: contextMenu.left, top: contextMenu.top, maxHeight: `calc(100% - ${contextMenu.top + 8}px)` }} onPointerDown={event => event.stopPropagation()}>
          <button className="game-token-context-close" onClick={() => setContextMenu(null)} aria-label="Cerrar"><X size={13} /></button>
          <div className="game-token-context-scroll">
          <div className="game-token-context-portrait" onPointerDown={event => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            contextDragRef.current = {
              clientX: event.clientX,
              clientY: event.clientY,
              left: contextMenu.left,
              top: contextMenu.top,
              currentLeft: contextMenu.left,
              currentTop: contextMenu.top,
            };
          }}>
            {menuImage ? (
              <>
                <img className="game-token-context-backdrop" src={resolveUrl(menuImage)} alt="" aria-hidden="true" />
                <img className="game-token-context-subject" src={resolveUrl(menuImage)} alt={menuToken.label} />
              </>
            ) : <span>{menuToken.label.slice(0, 1)}</span>}
            <div><small>{menuCharacter?.npc_type || (menuToken.owner_user_id ? 'Aventurero' : 'Criatura')}</small><strong>{menuToken.label}</strong><p>{[menuCharacter?.race, menuCharacter?.class, menuCharacter?.level && `Nivel ${menuCharacter.level}`].filter(Boolean).join(' · ')}</p></div>
          </div>
          <div className="game-token-context-stats">
            <div className="game-token-hp-stat">
              <Heart size={12} /><span>PG</span><strong>{menuCharacter?.hp_current ?? '—'} / {menuCharacter?.hp_max ?? '—'}</strong>
              {isDm && (
                <div className="game-token-hp-stack">
                  <button title="Sumar vida" onClick={() => setHpEditor({ operation: 'add', value: '' })}><Plus size={8} /></button>
                  <button title="Fijar vida" onClick={() => setHpEditor({ operation: 'set', value: '' })}><Equal size={8} /></button>
                  <button title="Restar vida" onClick={() => setHpEditor({ operation: 'subtract', value: '' })}><Minus size={8} /></button>
                </div>
              )}
              {isDm && hpEditor && (
                <form className="game-token-hp-popover" onSubmit={event => {
                  event.preventDefault();
                  const amount = Number.parseInt(hpEditor.value, 10);
                  if (!Number.isFinite(amount) || amount < 0) return;
                  if (hpEditor.operation === 'set') onSetHp?.(menuToken.id, amount);
                  else onAdjustHp?.(menuToken.id, hpEditor.operation === 'subtract' ? -amount : amount);
                  setHpEditor(null);
                }}>
                  <small>{hpEditor.operation === 'add' ? 'Sumar PG' : hpEditor.operation === 'subtract' ? 'Restar PG' : 'Fijar PG'}</small>
                  <input autoFocus type="number" min="0" value={hpEditor.value} onChange={event => setHpEditor(current => ({ ...current, value: event.target.value }))} />
                  <button type="submit" disabled={hpEditor.value === ''}><Check size={10} /></button>
                  <button type="button" onClick={() => setHpEditor(null)}><X size={10} /></button>
                </form>
              )}
            </div>
            <div><Shield size={12} /><span>CA</span><strong>{menuCharacter?.ac ?? menuCharacter?.ac_base ?? '—'}</strong></div>
            <div><Move size={12} /><span>Mov.</span><strong>{menuCharacter?.speed ? `${menuCharacter.speed} ft` : '—'}</strong></div>
          </div>
          {(isDm || !!menuToken.conditions?.length) && (
            <div className="game-token-condition-manager">
              {!!menuToken.conditions?.length && (
                <div className="game-token-active-conditions">
                  {menuToken.conditions.map(condition => isDm ? (
                    <button key={condition} onClick={() => onToggleCondition?.(menuToken.id, condition)} title={`Quitar ${condition}`}>{condition}<X size={8} /></button>
                  ) : <span key={condition}>{condition}</span>)}
                </div>
              )}
              {isDm && (
                <label className="game-token-condition-select">
                  <span>Estado</span>
                  <select value="" onChange={event => {
                    const condition = event.target.value;
                    if (condition && !menuToken.conditions?.includes(condition)) onToggleCondition?.(menuToken.id, condition);
                  }}>
                    <option value="">Agregar estado...</option>
                    {CONDITIONS.map(condition => <option key={condition} value={condition} disabled={menuToken.conditions?.includes(condition)}>{condition}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          {canSeeFullSheet && (
            <>
              <nav className="game-token-detail-tabs">
                <button className={detailTab === 'sheet' ? 'is-active' : ''} onClick={() => setDetailTab('sheet')}>Ficha</button>
                <button className={detailTab === 'actions' ? 'is-active' : ''} onClick={() => setDetailTab('actions')}>Acciones <span>{menuActions.length}</span></button>
                {isDm && <button className={detailTab === 'notes' ? 'is-active' : ''} onClick={() => setDetailTab('notes')}>Notas</button>}
              </nav>
              <div className="game-token-full-sheet">
                {detailTab === 'sheet' && (
                  <>
                    <section>
                      <header><span>Atributos</span>{menuCharacter?.challenge_rating && <small>Desafío {menuCharacter.challenge_rating}</small>}</header>
                      <div className="game-token-abilities">
                        {ABILITIES.map(ability => {
                          const score = menuCharacter?.abilityScores?.find(item => item.ability === ability);
                          if (!score) return <div key={ability}><span>{ability}</span><strong>—</strong><small>Sin dato</small></div>;
                          const total = (Number(score?.base_value) || 10) + (Number(score?.bonus_value) || 0);
                          return isDm ? <button type="button" key={ability} onClick={() => onRollCharacter?.({ characterId: menuCharacter?.id, label: `Prueba de ${ability}`, modifier: abilityModifier(score) })}><span>{ability}</span><strong>{signed(abilityModifier(score))}</strong><small>{total}</small></button> : <div key={ability}><span>{ability}</span><strong>{signed(abilityModifier(score))}</strong><small>{total}</small></div>;
                        })}
                      </div>
                    </section>
                    <section className="game-token-detail-lines">
                      <header><span>Perfil de combate</span></header>
                      {menuCharacter?.initiative_bonus != null && <p><strong>Iniciativa</strong><span>{signed(menuCharacter.initiative_bonus)}</span></p>}
                      {menuCharacter?.passive_perception != null && <p><strong>Percepción pasiva</strong><span>{menuCharacter.passive_perception}</span></p>}
                      {Object.keys(menuCharacter?.saving_throws || {}).length > 0 && <div className="game-token-saving-throws"><strong>Salvaciones</strong><span>{Object.entries(menuCharacter.saving_throws).map(([key, value]) => <button type="button" key={key} onClick={() => onRollCharacter?.({ characterId: menuCharacter?.id, label: `Salvación de ${key.toUpperCase()}`, modifier: Number(value) || 0 })}>{key.toUpperCase()} {signed(value)}</button>)}</span></div>}
                      {!!menuCharacter?.skills?.length && <p><strong>Competencias</strong><span>{menuCharacter.skills.filter(skill => skill.proficiency_level > 0).map(skill => skill.name).join(', ') || 'Ninguna'}</span></p>}
                      {!!menuCharacter?.damage_resistances?.length && <p><strong>Resistencias</strong><span>{menuCharacter.damage_resistances.join(', ')}</span></p>}
                      {!!menuCharacter?.damage_vulnerabilities?.length && <p><strong>Vulnerabilidades</strong><span>{menuCharacter.damage_vulnerabilities.join(', ')}</span></p>}
                      {!!menuCharacter?.damage_immunities?.length && <p><strong>Inmunidades</strong><span>{menuCharacter.damage_immunities.join(', ')}</span></p>}
                      {!!menuCharacter?.condition_immunities?.length && <p><strong>Estados inmunes</strong><span>{menuCharacter.condition_immunities.join(', ')}</span></p>}
                      {!!menuCharacter?.senses?.length && <p><strong>Sentidos</strong><span>{menuCharacter.senses.join(', ')}</span></p>}
                      {!!menuCharacter?.languages?.length && <p><strong>Idiomas</strong><span>{menuCharacter.languages.join(', ')}</span></p>}
                    </section>
                  </>
                )}

                {detailTab === 'actions' && (
                  <section className="game-token-actions-list">
                    <header><span>Acciones y habilidades</span><small>{menuActions.length}</small></header>
                    {isDm && !menuToken.owner_user_id && session?.combat_state?.mode === 'COMBAT' && combatSocket ? (
                      <TurnActionPanel
                        session={session}
                        socket={combatSocket}
                        isMyTurn={Number(menuToken.character_id) === Number(activeCharacterId)}
                        targeting={combatTargeting}
                        onTargetingChange={next => {
                          onCombatTargetingChange?.(next);
                          if (next) setContextMenu(null);
                        }}
                        onError={onCombatError}
                        actorName={menuCharacter?.name || menuToken.label}
                        actorCharacterId={menuToken.character_id}
                        mode="dm"
                        showReadOnlyActions
                      />
                    ) : menuActions.map(action => (
                      <article key={action.id}>
                        <div><strong>{action.name}</strong><small>{action.action_type}</small></div>
                        <p>{[
                          action.attack_bonus != null && `Ataque ${signed(action.attack_bonus)}`,
                          action.damage_dice && `${action.damage_dice}${action.damage_bonus ? signed(action.damage_bonus) : ''} ${action.damage_type || ''}`,
                          action.reach,
                          action.save_dc && `CD ${action.save_dc} ${action.save_ability || ''}`,
                        ].filter(Boolean).join(' · ')}</p>
                        {action.description && <span>{action.description}</span>}
                      </article>
                    ))}
                    {!menuActions.length && !(isDm && !menuToken.owner_user_id && session?.combat_state?.mode === 'COMBAT') && <p className="game-token-empty-detail">Sin acciones estructuradas todavía.</p>}
                  </section>
                )}

                {isDm && detailTab === 'notes' && (
                  <section className="game-token-private-notes">
                    <header><span>Notas privadas del DM</span></header>
                    <p>{menuCharacter?.notes || 'No hay notas privadas para esta criatura.'}</p>
                  </section>
                )}
              </div>
            </>
          )}

          {!isDm && <p className="game-token-player-note">Ficha visible para jugadores. Los estados y valores se actualizan en vivo.</p>}
          </div>

          {isDm && (
            <>
              <footer>
                <button onClick={() => { onDuplicateToken?.(menuToken.id); setContextMenu(null); }}><Copy size={12} /> Duplicar</button>
                <button className="is-danger" onClick={() => { onDeleteToken?.(menuToken.id); setContextMenu(null); }}><Trash2 size={12} /> Eliminar</button>
              </footer>
            </>
          )}
        </article>
      )}
    </div>
  );
}
