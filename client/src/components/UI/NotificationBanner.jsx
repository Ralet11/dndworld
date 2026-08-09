import { Coins, Gift, Scroll, Send, ShieldCheck, Target, X } from 'lucide-react';

const TYPE_MAP = {
  item_received: { label: 'Botín recibido', Icon: Gift, color: '#d2a84c' },
  item_shared: { label: 'Objeto compartido', Icon: Gift, color: '#6faf7b' },
  item_sent: { label: 'Intercambio completo', Icon: Send, color: '#6f9fc5' },
  gold_received: { label: 'Recompensa', Icon: Coins, color: '#e0b348' },
  gold_lost: { label: 'Tesorería actualizada', Icon: Coins, color: '#ba6b5d' },
  quest_success: { label: 'Misión completada', Icon: ShieldCheck, color: '#F59E0B' },
  objective_success: { label: 'Objetivo cumplido', Icon: Target, color: '#5BA86B' },
  new_quest: { label: 'Nueva misión', Icon: Scroll, color: '#3E84D6' },
};

export default function NotificationBanner({ data, onClose }) {
  const config = TYPE_MAP[data.type] || { label: 'Notificación', Icon: Scroll, color: '#C8A36A' };
  const { Icon, color } = config;
  const mainImage = data.item?.imageUrl || null;
  const actorImage = data.actor?.imageUrl || null;

  return (
    <article className="player-toast" style={{ '--toast-accent': color }}>
      <div className="player-toast-shine" />
      <div className="player-toast-visual">
        {mainImage ? <img src={mainImage} alt={data.item?.name || ''} /> : <Icon size={28} strokeWidth={1.35} />}
        {actorImage && <img className="player-toast-actor" src={actorImage} alt={data.actor?.name || ''} />}
      </div>
      <div className="player-toast-copy">
        <span>{data.eyebrow || config.label}</span>
        <strong>{data.title || config.label}</strong>
        <p>{data.text}</p>
        {data.item && <div className="player-toast-item"><b>{data.item.quantity > 1 ? `${data.item.quantity} × ` : ''}{data.item.name}</b><small>{data.item.rarity} · {data.item.type}</small></div>}
        {data.amount != null && <div className="player-toast-gold"><b>{data.type === 'gold_lost' ? '−' : '+'}{data.amount}</b><span>oro</span>{data.total != null && <small>Saldo: {data.total}</small>}</div>}
        {data.actor?.name && <small className="player-toast-source">{data.actor.role === 'DM' ? 'Otorgado por' : data.type === 'item_sent' ? 'Enviado a' : 'Compartido por'} <b>{data.actor.name}</b></small>}
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar notificación"><X size={14} /></button>
      <i className="player-toast-progress" />
    </article>
  );
}
