import { useState } from 'react';
import { Dices, Minus, Plus } from 'lucide-react';

const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100];
export default function DiceTray({ onRoll, compact = false }) {
  const [quantity, setQuantity] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false);

  const roll = sides => {
    if (rolling) return;
    setRolling(true);
    onRoll?.({ sides, quantity, modifier, label: `Tirada de d${sides}` }, () => setRolling(false));
    window.setTimeout(() => setRolling(false), 2500);
  };

  return (
    <section className={`game-dice-tray${compact ? ' is-compact' : ''}`}>
      <header>
        <div><Dices size={15} /><span>Dados</span></div>
        <small>Tirada publica</small>
      </header>
      <div className="game-dice-set">
        {DIE_SIDES.map(sides => (
          <button key={sides} disabled={rolling} onClick={() => roll(sides)} aria-label={`Tirar d${sides}`}>
            <span>d{sides}</span>
          </button>
        ))}
      </div>
      <div className="game-dice-options">
        <label>
          <span>Cantidad</span>
          <div><button onClick={() => setQuantity(value => Math.max(1, value - 1))}><Minus size={10} /></button><output>{quantity}</output><button onClick={() => setQuantity(value => Math.min(20, value + 1))}><Plus size={10} /></button></div>
        </label>
        <label>
          <span>Modificador</span>
          <input type="number" min="-100" max="100" value={modifier} onChange={event => setModifier(Math.max(-100, Math.min(100, Number(event.target.value) || 0)))} />
        </label>
      </div>
    </section>
  );
}
