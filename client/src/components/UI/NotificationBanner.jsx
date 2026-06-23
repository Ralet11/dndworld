import { X, ShieldCheck, Target, Scroll } from 'lucide-react';

export default function NotificationBanner({ data, onClose }) {
  const typeMap = {
    quest_success: { label: 'Misión Completada', Icon: ShieldCheck, color: '#F59E0B' },
    objective_success: { label: 'Objetivo Cumplido', Icon: Target, color: '#5BA86B' },
    new_quest: { label: 'Nueva Misión', Icon: Scroll, color: '#3E84D6' },
  };
  const { label, Icon, color } = typeMap[data.type] || { label: 'Notificación', Icon: Scroll, color: '#C8A36A' };

  return (
    <div className="fixed top-4 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto panel-raised flex items-start gap-3 p-4 max-w-sm w-full"
        style={{ borderColor: color + '40' }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: color + '20', color }}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="label-caps" style={{ color, marginBottom: 2 }}>{label}</p>
          <p className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{data.text}</p>
        </div>
        <button onClick={onClose} className="shrink-0" style={{ color: '#6B6557' }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
