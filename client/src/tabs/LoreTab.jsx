import { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Map as MapIcon, BookMarked, Scroll } from 'lucide-react';
import BestiaryView from '../components/Lore/BestiaryView';
import QuestsView from '../components/Lore/QuestsView';

const MapView = lazy(() => import('../components/Lore/MapView'));

function AtlasLoading() {
  return <div className="h-full grid place-items-center label-caps" style={{ color: '#C8A36A' }}>Cargando Atlas...</div>;
}

export default function LoreTab() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = location.pathname.split('/')[2] || 'menu';
  const goToMenu = () => navigate('/lore');

  if (view === 'map') {
    return (
      <div className="h-[calc(100vh-113px)] min-h-[520px] md:h-full md:min-h-[640px]" style={{ background: '#0F1518' }}>
        <Suspense fallback={<AtlasLoading />}><MapView onBack={goToMenu} /></Suspense>
      </div>
    );
  }

  if (view === 'glossary' || view === 'bestiary') return <BestiaryView onBack={goToMenu} />;
  if (view === 'quests') return <QuestsView onBack={goToMenu} />;

  return (
    <div className="section-page">
      <p className="section-kicker">Conocimiento del mundo</p>
      <h1 className="section-title">Lore</h1>
      <p className="section-lead">Mapas, encuentros y asuntos pendientes recopilados durante el viaje.</p>
      <div className="section-rule" />

      <div className="lore-hub-grid">
        <LoreCard
          title="Atlas del mundo"
          subtitle="Explora Westamar, sus regiones y los lugares descubiertos por el grupo."
          Icon={MapIcon}
          art="linear-gradient(180deg, transparent, #080d0c), url('/sieteciudades.png')"
          onPress={() => navigate('/lore/map')}
        />
        <LoreCard
          title="Glosario"
          subtitle="Personas, aliados, adversarios y criaturas conocidas."
          Icon={BookMarked}
          art="radial-gradient(circle at 50% 25%, #26342e, #080d0c 68%)"
          onPress={() => navigate('/lore/glossary')}
        />
        <LoreCard
          title="Misiones"
          subtitle="Objetivos activos y compromisos del grupo."
          Icon={Scroll}
          art="radial-gradient(circle at 50% 25%, #312a1c, #080d0c 68%)"
          onPress={() => navigate('/lore/quests')}
        />
      </div>
    </div>
  );
}

function LoreCard({ title, subtitle, Icon, art, onPress }) {
  return (
    <button onClick={onPress} className="lore-hub-card" style={{ '--card-art': art }}>
      <div className="lore-hub-card-icon"><Icon size={21} strokeWidth={1.3} /></div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <small>Abrir registro</small>
    </button>
  );
}
