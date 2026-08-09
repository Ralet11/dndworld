import { useEffect, useRef, useState } from 'react';
import { Crown, Dices, X } from 'lucide-react';
import API_URL from '../../config';

function resolveImage(value) {
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value;
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

function formula(roll) {
  const modifier = Number(roll.modifier) || 0;
  return `${roll.quantity}d${roll.sides}${modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : ''}`;
}

export default function DiceRollOverlay({ rolls = [], isDm = false, onDismiss }) {
  const seededRef = useRef(false);
  const processedRollsRef = useRef(new Set());
  const queueRef = useRef(Promise.resolve());
  const hideTimerRef = useRef(null);
  const [activeRoll, setActiveRoll] = useState(null);

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

  useEffect(() => {
    if (!seededRef.current) {
      rolls.forEach(roll => processedRollsRef.current.add(String(roll.id)));
      seededRef.current = true;
      return;
    }

    const unseen = [...rolls]
      .filter(roll => roll.resolved && Array.isArray(roll.results) && roll.results.length)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .filter(roll => !processedRollsRef.current.has(String(roll.id)));

    unseen.forEach(roll => {
      processedRollsRef.current.add(String(roll.id));
      queueRef.current = queueRef.current.then(async () => {
        setActiveRoll(roll);
        await new Promise(resolve => {
          hideTimerRef.current = window.setTimeout(resolve, 2800 + Math.min(1200, roll.results.length * 70));
        });
        setActiveRoll(null);
      });
    });
  }, [rolls]);

  const orderedRolls = rolls.filter(roll => roll.resolved).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <>
      <div className={`game-dice-animation game-dice-synced${activeRoll ? ' is-active' : ''}`} aria-hidden={!activeRoll}>
        {activeRoll && (
          <div className="game-dice-synced-roll" aria-live="assertive">
            <span>{activeRoll.character_name || activeRoll.roller_name}</span>
            <small>{formula(activeRoll)}</small>
            <div className="game-dice-synced-set">
              {activeRoll.results.map((result, index) => (
                <b key={`${activeRoll.id}-${index}`} className={`is-d${activeRoll.sides}`} style={{ '--die-index': index }}>
                  <i>{result}</i>
                </b>
              ))}
            </div>
            <strong>Total {activeRoll.total}</strong>
          </div>
        )}
      </div>
      {!!orderedRolls.length && (
        <div className="game-roll-stack" aria-live="polite" aria-label="Resultados de las tiradas">
          {orderedRolls.map(roll => {
            const naturalTwenty = roll.sides === 20 && roll.quantity === 1 && roll.results?.[0] === 20;
            const naturalOne = roll.sides === 20 && roll.quantity === 1 && roll.results?.[0] === 1;
            return (
              <article key={roll.id} style={{ '--roll-accent': roll.theme_color || '#c89b43' }} className={`game-roll-card${naturalTwenty ? ' is-critical' : ''}${naturalOne ? ' is-fumble' : ''}`}>
                <div className="game-roll-card-portrait">
                  {roll.character_image ? <img src={resolveImage(roll.character_image)} alt="" /> : <Crown size={20} />}
                </div>
                <div className="game-roll-card-copy">
                  <span>{roll.character_name || roll.roller_name}</span>
                  <strong>{roll.label}</strong>
                  <small>{formula(roll)} · {roll.results?.join(' + ')}</small>
                </div>
                <div className="game-roll-total"><Dices size={13} /><strong>{roll.total}</strong></div>
                {isDm && <button className="game-roll-dismiss" onClick={() => onDismiss?.(roll.id)} aria-label="Cerrar resultado"><X size={12} /></button>}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
