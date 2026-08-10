import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, CircleDot, Crosshair, HeartPulse, LoaderCircle, MousePointer2, Sparkles, Swords, X } from 'lucide-react';

const ECONOMY_LABELS = { action: 'Acciones', bonus: 'Bonus', reaction: 'Reacciones' };

function actionIcon(action) {
  if (action.healing) return <HeartPulse size={14} />;
  if (action.source === 'spell') return <Sparkles size={14} />;
  if (String(action.target).startsWith('area-')) return <CircleDot size={14} />;
  if (action.range > 5) return <Crosshair size={14} />;
  return <Swords size={14} />;
}

export default function TurnActionPanel({ session, socket, isMyTurn, targeting, onTargetingChange, onError }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeEconomy, setActiveEconomy] = useState('action');

  const refresh = () => {
    if (!socket || !session?.id || !isMyTurn) return;
    setLoading(true);
    socket.emit('game:get-actions', { sessionId: session.id }, response => {
      setLoading(false);
      if (!response?.ok) return onError?.(response?.message || 'No se pudieron cargar las acciones.');
      setActions(response.actions || []);
    });
  };

  useEffect(() => {
    if (!isMyTurn) {
      setActions([]);
      onTargetingChange?.(null);
      return;
    }
    setCollapsed(false);
    refresh();
    // The serialized combat state and history change after every resolved action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, session?.id, session?.round, session?.turn_index, JSON.stringify(session?.combat_state || {}), session?.combat_actions?.[0]?.id, session?.combat_actions?.[0]?.status]);

  const economies = useMemo(() => [...new Set(actions.map(action => action.economy || 'action'))], [actions]);
  useEffect(() => {
    if (economies.length && !economies.includes(activeEconomy)) setActiveEconomy(economies[0]);
  }, [activeEconomy, economies]);

  if (!isMyTurn || session.status !== 'LIVE') return null;

  const execute = (action, targetTokenIds = [], area = null) => {
    setSubmitting(action.key);
    socket.emit('game:begin-action', {
      sessionId: session.id,
      actionKey: action.key,
      targetTokenIds,
      area,
      slotLevel: action.selectedSlotLevel,
    }, response => {
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
    if (!action.available || submitting) return;
    if (action.target === 'self') return execute(action);
    onTargetingChange?.({
      action,
      instruction: String(action.target).startsWith('area-')
        ? `Marca el centro de ${action.name} sobre el tablero.`
        : `Selecciona ${String(action.target).includes('ally') ? 'un aliado' : 'un objetivo'} para ${action.name}.`,
      execute,
    });
  };

  const visibleActions = actions.filter(action => (action.economy || 'action') === activeEconomy);

  return (
    <section className={`turn-action-panel${targeting ? ' is-targeting' : ''}${collapsed ? ' is-collapsed' : ''}`} aria-label="Acciones del turno">
      <header>
        <div><span>Tu turno</span><strong>{targeting ? 'Elige un objetivo' : 'Panel de acción'}</strong></div>
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
                {!loading && visibleActions.map(action => (
                  <button type="button" key={action.key} className={action.available ? '' : 'is-disabled'} disabled={!action.available || Boolean(submitting)} onClick={() => choose(action)} title={action.unavailableReason || action.description}>
                    <i>{submitting === action.key ? <LoaderCircle className="is-spinning" size={14} /> : actionIcon(action)}</i>
                    <span><strong>{action.name}</strong><small>{action.summary || action.description || 'Acción de combate'}</small></span>
                    <em>{action.target === 'self' ? 'Usar' : String(action.target).startsWith('area-') ? 'Área' : 'Elegir'}</em>
                  </button>
                ))}
                {!loading && !visibleActions.length && <p className="turn-action-empty">No hay acciones configuradas en esta categoría.</p>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
