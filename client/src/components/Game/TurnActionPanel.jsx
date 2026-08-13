import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, CircleDot, Crosshair, HeartPulse, LoaderCircle, Minus, MousePointer2, Plus, Sparkles, Swords, X } from 'lucide-react';

const ECONOMY_LABELS = { action: 'Acciones', bonus: 'Bonus', reaction: 'Reacciones' };
const TRIGGER_LABELS = {
  ATTACK_HIT_BEFORE_DAMAGE: 'Cuando un ataque impacta, antes del daño',
  DAMAGE_TAKEN: 'Después de recibir daño',
  ENEMY_LEAVES_REACH: 'Cuando un enemigo abandona tu alcance',
  SPELL_CAST_NEARBY: 'Cuando se lanza un conjuro cercano',
  ALLY_ATTACKED_NEARBY: 'Cuando atacan a un aliado cercano',
};

function actionIcon(action) {
  if (action.healing) return <HeartPulse size={14} />;
  if (action.source === 'spell') return <Sparkles size={14} />;
  if (String(action.target).startsWith('area-')) return <CircleDot size={14} />;
  if (action.range > 5) return <Crosshair size={14} />;
  return <Swords size={14} />;
}

export default function TurnActionPanel({ session, socket, isMyTurn, targeting, onTargetingChange, onError, actorName = null, actorCharacterId = null, mode = 'player', showReadOnlyActions = false }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeEconomy, setActiveEconomy] = useState('action');
  const [resourceSummary, setResourceSummary] = useState({ spellSlots: {}, trackers: [] });
  const [expandedActionKey, setExpandedActionKey] = useState(null);
  const submittingRef = useRef(false);

  const refresh = () => {
    if (!socket || !session?.id || session.status !== 'LIVE') return;
    setLoading(true);
    socket.emit('game:get-actions', { sessionId: session.id, characterId: actorCharacterId }, response => {
      setLoading(false);
      if (!response?.ok) return onError?.(response?.message || 'No se pudieron cargar las acciones.');
      setActions(response.actions || []);
      setResourceSummary(response.resourceSummary || { spellSlots: {}, trackers: [] });
    });
  };

  useEffect(() => {
    if (isMyTurn) setCollapsed(false);
    refresh();
    // The serialized combat state and history change after every resolved action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorCharacterId, isMyTurn, session?.id, session?.round, session?.turn_index, JSON.stringify(session?.combat_state || {}), session?.combat_actions?.[0]?.id, session?.combat_actions?.[0]?.status]);

  const economies = useMemo(() => [...new Set(actions.map(action => action.economy || 'action'))], [actions]);
  useEffect(() => {
    if (economies.length && !economies.includes(activeEconomy)) setActiveEconomy(economies[0]);
  }, [activeEconomy, economies]);

  const execute = (action, targetTokenIds = [], area = null) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(action.key);
    socket.emit('game:begin-action', {
      sessionId: session.id,
      characterId: actorCharacterId,
      actionKey: action.key,
      targetTokenIds,
      area,
      slotLevel: action.selectedSlotLevel,
    }, response => {
      submittingRef.current = false;
      setSubmitting(null);
      if (!response?.ok) {
        onError?.(response?.message || 'No se pudo ejecutar la acción.');
        return;
      }
      onTargetingChange?.(null);
      refresh();
    });
  };

  const choose = action => {
    if (!action.available || submitting || submittingRef.current) return;
    if (action.economy === 'reaction' && session.combat_state?.reactionWindow?.id) return execute(action);
    if (action.target === 'self') return execute(action);
    if (!['enemy', 'ally'].includes(action.target) && !String(action.target).startsWith('area-')) {
      onError?.('Esta habilidad no tiene un objetivo de combate configurado.');
      return;
    }
    onTargetingChange?.({
      action,
      instruction: String(action.target).startsWith('area-')
        ? `Marca el centro de ${action.name} sobre el tablero.`
        : `Selecciona ${String(action.target).includes('ally') ? 'un aliado' : 'un objetivo'} para ${action.name}.`,
      execute,
    });
  };

  const visibleActions = actions.filter(action => (action.economy || 'action') === activeEconomy);
  const reactions = actions.filter(action => action.economy === 'reaction');
  const hasReactions = reactions.length > 0;
  const adjustTracker = (trackerKey, delta) => socket?.emit('game:adjust-tracker', { sessionId: session.id, characterId: actorCharacterId, trackerKey, delta }, response => {
    if (!response?.ok) onError?.(response?.message || 'No se pudo actualizar el rastreador.');
    else refresh();
  });

  useEffect(() => {
    if (!isMyTurn && showReadOnlyActions && hasReactions) setActiveEconomy('reaction');
  }, [hasReactions, isMyTurn, showReadOnlyActions]);

  const isCombatMode = session.combat_state?.mode === 'COMBAT' || (session.combat_state?.mode == null && (session.turn_order || []).length > 0);
  if (session.status !== 'LIVE' || !isCombatMode) return null;

  if (!isMyTurn && !showReadOnlyActions) {
    if (!reactions.length) return null;
    return (
      <section className="turn-reaction-panel" aria-label="Reacciones disponibles">
        <header><span>Siempre disponible</span><strong>Reacciones</strong></header>
        <div>{reactions.map(action => <button key={action.key} disabled={!action.available || Boolean(submitting)} onClick={() => choose(action)}><i>{actionIcon(action)}</i><span><strong>{action.name}</strong><small>{action.available ? action.summary || 'Usar reacción' : action.unavailableReason}</small></span></button>)}</div>
      </section>
    );
  }

  return (
    <section className={`turn-action-panel${targeting ? ' is-targeting' : ''}${collapsed ? ' is-collapsed' : ''}`} aria-label="Acciones del turno">
      <header>
        <div><span>{mode === 'dm' ? (isMyTurn ? 'Turno del NPC' : 'Fuera de turno') : 'Tu turno'}</span><strong>{targeting ? 'Elige un objetivo' : actorName ? `Acciones de ${actorName}` : 'Panel de acción'}</strong></div>
        <button type="button" onClick={() => setCollapsed(current => !current)} aria-label={collapsed ? 'Abrir acciones' : 'Contraer acciones'}>{collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button>
      </header>
      {!collapsed && (
        <>
          {targeting ? (
            <div className="turn-action-targeting">
              <MousePointer2 size={18} />
              <div><strong>{targeting.action.name}</strong><p>{targeting.instruction}</p></div>
              <button type="button" onClick={() => onTargetingChange?.(null)} aria-label="Cancelar selección"><X size={14} /></button>
            </div>
          ) : (
            <>
              <nav>
                {economies.map(economy => <button type="button" key={economy} className={activeEconomy === economy ? 'is-active' : ''} onClick={() => setActiveEconomy(economy)}>{ECONOMY_LABELS[economy] || economy}</button>)}
              </nav>
              <div className="turn-action-list">
                {loading && <div className="turn-action-loading"><LoaderCircle size={16} /> Preparando acciones...</div>}
                {!loading && visibleActions.map(action => {
                  const expanded = expandedActionKey === action.key;
                  return (
                    <article key={action.key} className={`turn-action-card${action.available ? '' : ' is-disabled'}${expanded ? ' is-expanded' : ''}`}>
                      <button type="button" className="turn-action-inspect" onClick={() => setExpandedActionKey(current => current === action.key ? null : action.key)} aria-expanded={expanded}>
                        <i>{actionIcon(action)}</i>
                        <span><strong>{action.name}</strong><small>{action.summary || action.description || 'Acción de combate'}</small></span>
                        {expanded ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
                      </button>
                      {expanded && (
                        <div className="turn-action-detail">
                          <p>{action.description || 'Esta habilidad no tiene una descripción cargada.'}</p>
                          <dl>
                            <div><dt>Economía</dt><dd>{action.economy === 'reaction' ? 'Reacción' : action.economy === 'bonus' ? 'Acción bonus' : 'Acción'}</dd></div>
                            {action.reactionTrigger && <div><dt>Disparador</dt><dd>{TRIGGER_LABELS[action.reactionTrigger] || action.reactionTrigger}</dd></div>}
                            {action.range != null && <div><dt>Alcance</dt><dd>{Number(action.range) ? `${action.range} pies` : 'Propio'}</dd></div>}
                            {action.attackBonus != null && <div><dt>Ataque</dt><dd>{Number(action.attackBonus) >= 0 ? '+' : ''}{action.attackBonus}</dd></div>}
                            {action.damage && <div><dt>Daño</dt><dd>{action.damage} {action.damageType || ''}</dd></div>}
                            {action.saveDc && <div><dt>Salvación</dt><dd>{action.saveAbility || '—'} CD {action.saveDc}</dd></div>}
                            {action.resource && <div><dt>Recurso</dt><dd>{action.unavailableReason || action.summary || 'Uso limitado'}</dd></div>}
                          </dl>
                          {!action.available && <small className="turn-action-lock-reason">{action.unavailableReason}</small>}
                          <button type="button" className="turn-action-use" disabled={!action.available || Boolean(submitting)} onClick={() => choose(action)}>
                            {submitting === action.key ? <LoaderCircle className="is-spinning" size={13} /> : action.target === 'self' ? 'Usar habilidad' : String(action.target).startsWith('area-') ? 'Elegir área' : 'Elegir objetivo'}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
                {!loading && !visibleActions.length && <p className="turn-action-empty">No hay acciones configuradas en esta categoría.</p>}
              </div>
              <div className="turn-resource-panel">
                {!!Object.keys(resourceSummary.spellSlots || {}).length && <section><span>Espacios de hechizo</span><div>{Object.entries(resourceSummary.spellSlots).map(([level, slot]) => <small key={level}>Nv. {level}<strong>{Math.max(0, Number(slot.max || 0) - Number(slot.used || 0))} / {slot.max}</strong></small>)}</div></section>}
                {!!resourceSummary.trackers?.length && <section><span>Recursos custom</span><div>{resourceSummary.trackers.map(tracker => <small key={tracker.key}><em>{tracker.label}</em><button onClick={() => adjustTracker(tracker.key, -1)} aria-label={`Restar ${tracker.label}`}><Minus size={10} /></button><strong>{tracker.value} / {tracker.max}</strong><button onClick={() => adjustTracker(tracker.key, 1)} aria-label={`Sumar ${tracker.label}`}><Plus size={10} /></button>{tracker.unit && <i>{tracker.unit}</i>}</small>)}</div></section>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
