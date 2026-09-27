import { useState } from 'react';
import { Eye, EyeOff, Layers3, Minus, Sparkles, X } from 'lucide-react';

const PATH_CARDS = [
  { id: 'life', tone: 'green', color: 'VERDE', name: 'SENDA DE VIDA', text: 'Mientras esta senda permanezca abierta, la muerte puede reclamar… pero no puede llevarse a nadie.' },
  { id: 'death', tone: 'spectral', color: 'BLANCO ESPECTRAL', name: 'SENDA DE MUERTE', text: 'Los muertos recuerdan sus guerras. Y esta noche, han decidido volver a combatir.' },
  { id: 'mind', tone: 'blue', color: 'AZUL', name: 'SENDA DE LA MENTE', text: 'Antes del movimiento existe la intención. Antes del golpe, el pensamiento. Ahora podéis ver ambos.' },
  { id: 'shadows', tone: 'violet', color: 'VIOLETA', name: 'SENDA DE SOMBRAS', text: 'Ninguna sombra está realmente separada de otra. Entrad en una… y escoged dónde volver a existir.' },
  { id: 'darkness', tone: 'black', color: 'NEGRO', name: 'SENDA DE OSCURIDAD', text: 'Lo que no puede ser encontrado, no puede ser alcanzado. Pero toda violencia enciende una luz.' },
  { id: 'light', tone: 'gold', color: 'DORADO', name: 'SENDA DE LUZ', text: 'Nada permanece oculto bajo la luz verdadera. Toda protección es revelada. Toda mentira queda desnuda.' },
  { id: 'chaos', tone: 'crimson', color: 'CARMESÍ', name: 'SENDA DEL CAOS', text: 'La realidad ha dejado de obedecer. Desde este instante, nadie sabe qué ocurrirá… ni siquiera quien abrió la senda.' },
];

export default function PathCards({ session, socket, isDm = false, onError }) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const [minimizedPassiveKey, setMinimizedPassiveKey] = useState('');
  const state = session?.combat_state?.pathCards || {};
  const discarded = new Set(Array.isArray(state.discarded) ? state.discarded : []);
  const active = state.active?.round === session?.round ? PATH_CARDS.find(card => card.id === state.active.cardId) : null;
  const activePassiveKey = active ? `${active.id}:${state.active?.round}:${state.active?.revealedAt || ''}` : '';
  const passiveMinimized = Boolean(active && minimizedPassiveKey === activePassiveKey);
  const remaining = PATH_CARDS.length - discarded.size;

  const command = (event, payload = {}) => {
    socket?.timeout(7000).emit(event, { sessionId: session.id, ...payload }, (timeoutError, response) => {
      if (timeoutError || !response?.ok) onError?.(response?.message || 'No se pudo actualizar el panel de sendas.');
    });
  };

  const reveal = card => {
    if (!isDm || discarded.has(card.id)) return;
    command('game:reveal-path-card', { cardId: card.id });
  };

  return (
    <>
      {isDm && (
        <div className="path-card-director">
          <button className="path-card-launcher" type="button" onClick={() => setControlsOpen(current => !current)} aria-expanded={controlsOpen}>
            <Layers3 size={16} /><span>Sendas</span><em>{remaining}</em>
          </button>
          {controlsOpen && (
            <aside className="path-card-controls" aria-label="Control de las cartas de senda">
              <header><div><small>Encuentro especial</small><strong>Las siete sendas</strong></div><button type="button" onClick={() => setControlsOpen(false)} aria-label="Cerrar controles"><X size={15} /></button></header>
              <p>{remaining ? `${remaining} carta${remaining === 1 ? '' : 's'} disponible${remaining === 1 ? '' : 's'}. Cada elección se descarta.` : 'Todas las sendas fueron reveladas.'}</p>
              <button className={state.visible ? 'is-visible' : ''} type="button" onClick={() => command('game:set-path-cards-visible', { visible: !state.visible })}>
                {state.visible ? <EyeOff size={14} /> : <Eye size={14} />}{state.visible ? 'Ocultar cartas a la party' : 'Mostrar cartas a la party'}
              </button>
              {active && <button className="is-dismiss" type="button" onClick={() => command('game:dismiss-path-passive')}><X size={14} /> Cerrar pasiva activa</button>}
            </aside>
          )}
        </div>
      )}

      {state.visible && (
        <section className="path-card-table" aria-label="Las siete sendas">
          <header><div><small>El velo se ha abierto</small><h2>Escoge una senda</h2></div><span>{remaining} de 7 permanecen</span></header>
          <div className="path-card-grid">
            {PATH_CARDS.map(card => {
              const used = discarded.has(card.id);
              const selected = active?.id === card.id;
              const CardElement = isDm ? 'button' : 'div';
              return (
                <CardElement key={card.id} type={isDm ? 'button' : undefined} disabled={isDm ? used : undefined} onClick={() => reveal(card)} className={`path-card is-${card.tone}${used ? ' is-revealed' : ''}${selected ? ' is-active' : ''}`}>
                  <span className="path-card-inner">
                    <span className="path-card-back"><i /><b>✦</b><small>Senda sellada</small></span>
                    <span className="path-card-front"><small>{card.color}</small><strong>{card.name}</strong><q>{card.text}</q>{used && <em>{selected ? 'Senda activa' : 'Descartada'}</em>}</span>
                  </span>
                </CardElement>
              );
            })}
          </div>
          {isDm && remaining > 0 && <p className="path-card-hint">Elige una carta para revelarla a toda la mesa. No podrá volver a utilizarse.</p>}
        </section>
      )}

      {active && passiveMinimized && (
        <button className={`path-passive-tab is-${active.tone}`} type="button" onClick={() => setMinimizedPassiveKey('')} aria-label={`Volver a mostrar ${active.name}`}>
          <Sparkles size={13} /><strong>{active.name}</strong><span>Ver pasiva</span>
        </button>
      )}

      {active && !passiveMinimized && (
        <aside className={`path-passive is-${active.tone}`} aria-live="assertive">
          <span><Sparkles size={16} /></span>
          <div><small>Pasiva de ronda · {active.color}</small><strong>{active.name}</strong><p>{active.text}</p></div>
          <div className="path-passive-actions">
            <button type="button" onClick={() => setMinimizedPassiveKey(activePassiveKey)} aria-label="Minimizar pasiva"><Minus size={16} /></button>
            {isDm && <button className="is-dismiss" type="button" onClick={() => command('game:dismiss-path-passive')} aria-label="Cerrar pasiva para todos"><X size={16} /></button>}
          </div>
        </aside>
      )}
    </>
  );
}
