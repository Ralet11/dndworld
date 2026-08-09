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

function rollTone(roll) {
  if (roll.sides === 20 && roll.quantity === 1 && roll.results?.[0] === 20) return 'critical';
  if (roll.sides === 20 && roll.quantity === 1 && roll.results?.[0] === 1) return 'fumble';
  return 'standard';
}

function rollEyebrow(tone) {
  if (tone === 'critical') return 'Golpe crítico';
  if (tone === 'fumble') return 'Fallo crítico';
  return 'Resultado de la tirada';
}

export default function DiceRollOverlay({ rolls = [], userId, isDm = false, onDismiss, onResolveRoll }) {
  const boxRef = useRef(null);
  const diceReadyRef = useRef(Promise.resolve(null));
  const initializedRef = useRef(false);
  const seededRef = useRef(false);
  const revealSeededRef = useRef(false);
  const processedRollsRef = useRef(new Set());
  const revealedRollsRef = useRef(new Set());
  const queueRef = useRef(Promise.resolve());
  const revealQueueRef = useRef(Promise.resolve());
  const hideTimerRef = useRef(null);
  const revealTimerRef = useRef(null);
  const [activeRoll, setActiveRoll] = useState(null);
  const [featuredRoll, setFeaturedRoll] = useState(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => () => {
    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(revealTimerRef.current);
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

  useEffect(() => {
    if (!seededRef.current) return;

    const resolvedRolls = [...rolls]
      .filter(roll => roll.resolved && Array.isArray(roll.results) && roll.results.length)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (!revealSeededRef.current) {
      resolvedRolls.forEach(roll => revealedRollsRef.current.add(String(roll.id)));
      revealSeededRef.current = true;
      return;
    }

    resolvedRolls
      .filter(roll => !revealedRollsRef.current.has(String(roll.id)))
      .forEach(roll => {
        revealedRollsRef.current.add(String(roll.id));
        revealQueueRef.current = revealQueueRef.current.then(async () => {
          setFeaturedRoll(roll);
          await new Promise(resolve => {
            revealTimerRef.current = window.setTimeout(resolve, 3600);
          });
          setFeaturedRoll(null);
          await new Promise(resolve => window.setTimeout(resolve, 180));
        });
      });
  }, [rolls]);

  const orderedRolls = rolls.filter(roll => roll.resolved).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <>
      <div className={`game-dice-animation${activeRoll ? ' is-active' : ''}${fallback ? ' is-fallback' : ''}`} aria-hidden={!activeRoll}>
        <div id="game-dice-box" ref={boxRef} className="game-dice-box" />
      </div>
      {featuredRoll && (() => {
        const tone = rollTone(featuredRoll);
        const modifier = Number(featuredRoll.modifier) || 0;
        return (
          <div
            className={`game-roll-reveal is-${tone}`}
            style={{ '--roll-accent': featuredRoll.theme_color || '#c89b43' }}
            role="status"
            aria-live="assertive"
          >
            <div className="game-roll-reveal-vignette" />
            <div className="game-roll-reveal-particles" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <i key={index} style={{ '--particle-angle': `${index * 20}deg`, '--particle-delay': `${110 + index * 18}ms` }} />
              ))}
            </div>
            <article className="game-roll-reveal-card">
              <div className="game-roll-reveal-glint" aria-hidden="true" />
              <div className="game-roll-reveal-portrait">
                {featuredRoll.character_image
                  ? <img src={resolveImage(featuredRoll.character_image)} alt="" />
                  : <Crown size={36} />}
              </div>
              <div className="game-roll-reveal-copy">
                <span>{rollEyebrow(tone)}</span>
                <small>{featuredRoll.character_name || featuredRoll.roller_name}</small>
                <h3>{featuredRoll.label}</h3>
                <div className="game-roll-reveal-formula">{formula(featuredRoll)}</div>
                <div className="game-roll-reveal-values">
                  {featuredRoll.results.map((result, index) => (
                    <b key={`${featuredRoll.id}-result-${index}`} className={`is-${tone}`}>{result}</b>
                  ))}
                  {modifier !== 0 && <em>{modifier > 0 ? '+' : '−'} {Math.abs(modifier)}</em>}
                </div>
              </div>
              <div className="game-roll-reveal-total">
                <Dices size={19} />
                <small>Total</small>
                <strong>{featuredRoll.total}</strong>
              </div>
            </article>
          </div>
        );
      })()}
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
