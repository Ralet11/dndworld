import { Clock3, Shield, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const TRIGGER_LABELS = {
  ATTACK_HIT_BEFORE_DAMAGE: 'Un ataque está por impactarte',
  DAMAGE_TAKEN: 'Acabas de recibir daño',
  ENEMY_LEAVES_REACH: 'Un enemigo abandona tu alcance',
  SPELL_CAST_NEARBY: 'Se está lanzando un conjuro cerca',
  ALLY_ATTACKED_NEARBY: 'Un aliado cercano es atacado',
};

export default function ReactionPrompt({ session, socket, onError }) {
  const window = session?.combat_state?.reactionWindow;
  const [submitting, setSubmitting] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!window?.expiresAt) return undefined;
    const update = () => setSeconds(Math.max(0, Math.ceil((new Date(window.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [window?.id, window?.expiresAt]);

  if (!window?.id || !window.canRespond) return null;

  const resolve = actionKey => {
    if (submitting) return;
    setSubmitting(true);
    socket.emit('game:resolve-reaction', { sessionId: session.id, windowId: window.id, actionKey }, response => {
      setSubmitting(false);
      if (!response?.ok) onError?.(response?.message || 'No se pudo resolver la reacción.');
    });
  };

  return (
    <div className="game-reaction-backdrop" role="dialog" aria-modal="true" aria-live="assertive">
      <section className="game-reaction-prompt">
        <header>
          <div className="game-reaction-icon"><Shield size={22} /></div>
          <div><span>Ventana de reacción</span><h2>{window.reactorName}</h2></div>
          <div className="game-reaction-timer"><Clock3 size={13} /><strong>{seconds}s</strong></div>
        </header>
        <p>{TRIGGER_LABELS[window.trigger] || 'Ocurrió un disparador para una reacción.'}{window.sourceName ? ` Origen: ${window.sourceName}.` : ''}</p>
        <div className="game-reaction-options">
          {(window.options || []).map(option => (
            <button key={option.key} type="button" disabled={submitting} onClick={() => resolve(option.key)}>
              <Shield size={15} /><span><strong>{option.name}</strong><small>{option.summary}</small></span>
            </button>
          ))}
        </div>
        <button className="game-reaction-pass" type="button" disabled={submitting} onClick={() => resolve(null)}><X size={13} /> No reaccionar</button>
      </section>
    </div>
  );
}
