import { useEffect, useRef, useState } from 'react';
import { Dices, Minus, Plus, RotateCcw } from 'lucide-react';

const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100];

function clampModifier(value) {
  return Math.max(-100, Math.min(100, Number.parseInt(value, 10) || 0));
}

function signedModifier(value) {
  if (!value) return '';
  return value > 0 ? `+${value}` : String(value);
}

export default function DiceTray({ onRoll, compact = false }) {
  const [quantity, setQuantity] = useState(1);
  const [modifierInput, setModifierInput] = useState('0');
  const [rolling, setRolling] = useState(false);
  const unlockTimerRef = useRef(null);
  const modifier = clampModifier(modifierInput);

  useEffect(() => () => window.clearTimeout(unlockTimerRef.current), []);

  const changeModifier = delta => setModifierInput(String(clampModifier(modifier + delta)));

  const resetOptions = () => {
    setQuantity(1);
    setModifierInput('0');
  };

  const roll = sides => {
    if (rolling) return;
    setRolling(true);
    const notation = `${quantity}d${sides}${signedModifier(modifier)}`;
    onRoll?.({ sides, quantity, modifier, label: `Tirada de ${notation}` }, () => setRolling(false));
    window.clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = window.setTimeout(() => setRolling(false), 2500);
  };

  return (
    <section className={`game-dice-tray${compact ? ' is-compact' : ''}`}>
      <header>
        <div><Dices size={15} /><span>Dados</span></div>
        <small><b>{quantity} dado{quantity === 1 ? '' : 's'}</b>{modifier !== 0 && <b className="has-modifier">Mod. {signedModifier(modifier)}</b>}</small>
      </header>
      <div className="game-dice-set">
        {DIE_SIDES.map(sides => (
          <button type="button" key={sides} disabled={rolling} onClick={() => roll(sides)} aria-label={`Tirar ${quantity}d${sides}${signedModifier(modifier)}`} title={`${quantity}d${sides}${signedModifier(modifier)}`}>
            <span>d{sides}</span>
          </button>
        ))}
      </div>
      <div className="game-dice-options">
        <label title="Cantidad de dados">
          <span>Cantidad</span>
          <div><button type="button" onClick={() => setQuantity(value => Math.max(1, value - 1))} aria-label="Quitar un dado"><Minus size={10} /></button><output aria-label={`${quantity} dados`}>{quantity}</output><button type="button" onClick={() => setQuantity(value => Math.min(20, value + 1))} aria-label="Agregar un dado"><Plus size={10} /></button></div>
        </label>
        <label title="Modificador opcional">
          <span>Modificador</span>
          <div><button type="button" onClick={() => changeModifier(-1)} aria-label="Reducir modificador"><Minus size={10} /></button><input type="number" min="-100" max="100" value={modifierInput} onChange={event => setModifierInput(event.target.value)} onBlur={() => setModifierInput(String(modifier))} aria-label="Modificador de la tirada" /><button type="button" onClick={() => changeModifier(1)} aria-label="Aumentar modificador"><Plus size={10} /></button></div>
        </label>
        <button type="button" className="game-dice-reset" disabled={quantity === 1 && modifier === 0} onClick={resetOptions} aria-label="Restablecer cantidad y modificador" title="Restablecer"><RotateCcw size={11} /></button>
      </div>
    </section>
  );
}
