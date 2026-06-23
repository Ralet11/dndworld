import { useState } from 'react';
import { Map as MapIcon, BookMarked, Scroll, ChevronRight } from 'lucide-react';
import MapView from '../components/Lore/MapView';
import BestiaryView from '../components/Lore/BestiaryView';
import QuestsView from '../components/Lore/QuestsView';

export default function LoreTab() {
  const [view, setView] = useState('menu');

  if (view === 'map') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#0F1518' }}>
        <MapView onBack={() => setView('menu')} />
      </div>
    );
  }

  if (view === 'bestiary') return <BestiaryView onBack={() => setView('menu')} />;
  if (view === 'quests')   return <QuestsView onBack={() => setView('menu')} />;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <p className="label-caps mt-2" style={{ color: '#C8A36A' }}>Conocimiento del mundo</p>
      <h1 className="text-4xl md:text-5xl font-black mb-8 mt-1" style={{ color: '#EDE6D8' }}>Lore</h1>

      {/* Desktop: 3-col grid / Mobile: single column */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LoreCard
          title="Mapa"
          subtitle="El Atlas del mundo y sus lugares"
          Icon={MapIcon}
          iconColor="#F59E0B"
          gradientFrom="#1A2A2E"
          onPress={() => setView('map')}
        />
        <LoreCard
          title="Glosario"
          subtitle="NPCs y criaturas que conoces"
          Icon={BookMarked}
          iconColor="#FF7A1A"
          gradientFrom="#2A1E18"
          onPress={() => setView('bestiary')}
        />
        <LoreCard
          title="Misiones"
          subtitle="Las misiones activas de la party"
          Icon={Scroll}
          iconColor="#F59E0B"
          gradientFrom="#1E2410"
          onPress={() => setView('quests')}
        />
      </div>
    </div>
  );
}

function LoreCard({ title, subtitle, Icon, iconColor, gradientFrom, onPress }) {
  return (
    <button
      onClick={onPress}
      className="flex md:flex-col items-center md:items-start gap-4 p-5 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: `linear-gradient(135deg, ${gradientFrom} 0%, #11191A 100%)`,
        border: '1px solid #5A4424',
      }}
    >
      <div className="rounded-xl flex items-center justify-center shrink-0"
        style={{ width: 60, height: 60, background: 'rgba(0,0,0,0.3)', border: '1px solid #2A332F' }}>
        <Icon size={30} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-base md:text-lg mt-0 md:mt-3" style={{ color: '#EDE6D8' }}>{title}</p>
        <p className="text-xs md:text-sm mt-1" style={{ color: '#A89F8E' }}>{subtitle}</p>
      </div>
      <ChevronRight size={20} className="md:hidden" style={{ color: '#6B6557', flexShrink: 0 }} />
    </button>
  );
}
