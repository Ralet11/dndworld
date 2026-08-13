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

function fallbackResults(quantity, sides) {
  const values = new Uint32Array(quantity);
  window.crypto.getRandomValues(values);
  return Array.from(values, value => (value % sides) + 1);
}

export default function DiceRollOverlay({ rolls = [], userId, onDismiss, onResolveRoll }) {
  const boxRef = useRef(null);
  const diceReadyRef = useRef(Promise.resolve(null));
  const initializedRef = useRef(false);
  const seededRef = useRef(false);
  const processedRollsRef = useRef(new Set());
  const queueRef = useRef(Promise.resolve());
  const hideTimerRef = useRef(null);
  const [activeRoll, setActiveRoll] = useState(null);
  const [fallback, setFallback] = useState(false);
  const [retiringRolls, setRetiringRolls] = useState([]);
  const visibleStackRef = useRef([]);
  const retirementTimersRef = useRef(new Map());

  useEffect(() => () => {
    window.clearTimeout(hideTimerRef.current);
    retirementTimersRef.current.forEach(timer => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!boxRef.current || initializedRef.current) return;
    initializedRef.current = true;
    diceReadyRef.current = import('@3d-dice/dice-box').then(({ default: DiceBox }) => {
      const box = new DiceBox('#game-dice-box', {
        assetPath: '/assets/dice-box/',
        theme: 'default',
        themeColor: '#c89b43',
        scale: 6,
        gravity: 1.8,
        throwForce: 6,
        spinForce: 5,
        lightIntensity: 1.2,
        enableShadows: true,
      });
      return box.init().then(() => box);
    }).catch(error => {
      console.error('No se pudo iniciar la animacion 3D de dados:', error);
      setFallback(true);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!seededRef.current) {
      rolls.filter(roll => roll.resolved).forEach(roll => processedRollsRef.current.add(`${roll.id}:resolved`));
      seededRef.current = true;
    }

    const unseen = [...rolls]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .filter(roll => !processedRollsRef.current.has(`${roll.id}:${roll.resolved ? 'resolved' : 'pending'}`));

    unseen.forEach(roll => {
      const phaseKey = `${roll.id}:${roll.resolved ? 'resolved' : 'pending'}`;
      processedRollsRef.current.add(phaseKey);

      if (roll.resolved || String(roll.user_id) !== String(userId)) return;

      queueRef.current = queueRef.current.then(async () => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const diceBox = reducedMotion ? null : await Promise.race([
          diceReadyRef.current,
          new Promise(resolve => window.setTimeout(() => resolve(null), 8000)),
        ]);

        setActiveRoll(roll);
        window.clearTimeout(hideTimerRef.current);
        let physicalResults = null;

        if (diceBox) {
          diceBox.show();
          try {
            const rolledDice = await Promise.race([
              diceBox.roll(`${roll.quantity}d${roll.sides}`, { themeColor: roll.theme_color || '#c89b43' }),
              new Promise(resolve => window.setTimeout(() => resolve(null), 7000)),
            ]);
            if (Array.isArray(rolledDice) && rolledDice.length === roll.quantity) {
              physicalResults = rolledDice.map(die => Number(die.value));
            }
          } catch (error) {
            console.error('La animacion de dados fallo:', error);
            setFallback(true);
          }
        } else {
          await new Promise(resolve => window.setTimeout(resolve, 900));
        }

        if (!physicalResults?.every(value => Number.isInteger(value) && value >= 1 && value <= roll.sides)) {
          physicalResults = fallbackResults(roll.quantity, roll.sides);
        }

        setActiveRoll({
          ...roll,
          resolved: true,
          results: physicalResults,
          total: physicalResults.reduce((sum, value) => sum + value, 0) + (Number(roll.modifier) || 0),
        });
        onResolveRoll?.(roll.id, physicalResults);
        await new Promise(resolve => {
          hideTimerRef.current = window.setTimeout(resolve, 2100);
        });
        diceBox?.clear();
        diceBox?.hide();
        setActiveRoll(null);
      });
    });
  }, [onResolveRoll, rolls, userId]);

  // Cola cronológica: las tres más recientes permanecen visibles y, al entrar
  // una nueva, la más antigua abandona la pila por arriba.
  const orderedRolls = rolls
    .filter(roll => roll.resolved)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-2);

  useEffect(() => {
    const desiredIds = new Set(orderedRolls.map(roll => String(roll.id)));
    // Una card cerrada por el DM ya tiene su propia animación de salida; no
    // debe entrar después en la rotación automática al desaparecer del estado.
    const departing = visibleStackRef.current.filter(roll => !desiredIds.has(String(roll.id)) && !roll.dismissing);
    if (departing.length) {
      setRetiringRolls(current => [
        ...current.filter(roll => !desiredIds.has(String(roll.id))),
        ...departing.filter(roll => !current.some(item => String(item.id) === String(roll.id))).map(roll => ({ ...roll, stackRetiring: true })),
      ]);
      departing.forEach(roll => {
        const id = String(roll.id);
        window.clearTimeout(retirementTimersRef.current.get(id));
        retirementTimersRef.current.set(id, window.setTimeout(() => {
          setRetiringRolls(current => current.filter(item => String(item.id) !== id));
          retirementTimersRef.current.delete(id);
        }, 720));
      });
    }
    visibleStackRef.current = orderedRolls;
  }, [orderedRolls]);

  const activeIds = new Set(orderedRolls.map(roll => String(roll.id)));
  const stackRolls = [...retiringRolls.filter(roll => !activeIds.has(String(roll.id))), ...orderedRolls];

  return (
    <>
      <div className={`game-dice-animation${activeRoll ? ' is-active' : ''}${fallback ? ' is-fallback' : ''}`} aria-hidden={!activeRoll}>
        <div id="game-dice-box" ref={boxRef} className="game-dice-box" />
      </div>
      {!!stackRolls.length && (
        <div className="game-roll-stack" aria-live="polite" aria-label="Resultados de las tiradas">
          {stackRolls.map(roll => {
            const naturalTwenty = roll.sides === 20 && roll.quantity === 1 && roll.results?.[0] === 20;
            const naturalOne = roll.sides === 20 && roll.quantity === 1 && roll.results?.[0] === 1;
            const modifier = Number(roll.modifier) || 0;
            const hasModifier = modifier !== 0;
            return (
              <article key={roll.id} style={{ '--roll-accent': roll.theme_color || '#c89b43' }} className={`game-roll-card${naturalTwenty ? ' is-critical' : ''}${naturalOne ? ' is-fumble' : ''}${roll.dismissing ? ' is-exiting' : ''}${roll.stackRetiring && !roll.dismissing ? ' is-stack-retiring' : ''}`}>
                <div className="game-roll-card-portrait">
                  {roll.character_image ? <img src={resolveImage(roll.character_image)} alt="" /> : <Crown size={20} />}
                </div>
                <div className="game-roll-card-copy">
                  <span>{roll.character_name || roll.roller_name}</span>
                  <strong>{roll.label}</strong>
                  <small>{formula(roll)} · {roll.results?.join(' + ')}</small>
                </div>
                <div className={`game-roll-total${hasModifier ? ' has-modifier' : ''}`}>
                  <Dices size={13} />
                  <div className="game-roll-total-values">
                    {hasModifier && <b className={modifier > 0 ? 'is-positive' : 'is-negative'}>{modifier > 0 ? '+' : '−'}{Math.abs(modifier)}</b>}
                    <strong className={hasModifier ? 'is-modified' : ''}>{roll.total}</strong>
                  </div>
                </div>
                <button className="game-roll-dismiss" disabled={roll.dismissing} onClick={() => onDismiss?.(roll.id)} aria-label="Cerrar resultado"><X size={12} /></button>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
