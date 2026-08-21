import { createElement, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookMarked,
  ChevronRight,
  Heart,
  Package,
  Search,
  Shield,
  Sparkles,
  Swords,
  UserCheck,
  Users,
  Wind,
  X,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import API_URL from '../../config';

const TYPES = {
  enemigo: { label: 'Enemigos', singular: 'Enemigo', color: '#E05252', Icon: Swords, order: 0 },
  neutral: { label: 'Neutrales', singular: 'Neutral', color: '#9CA69F', Icon: Users, order: 1 },
  amigo: { label: 'Amigos', singular: 'Amigo', color: '#65B77B', Icon: Sparkles, order: 2 },
  companero: { label: 'Compañeros', singular: 'Compañero', color: '#E5A948', Icon: UserCheck, order: 3 },
};

const ABILITIES = [
  ['FUE', 'STR'], ['DES', 'DEX'], ['CON', 'CON'],
  ['INT', 'INT'], ['SAB', 'WIS'], ['CAR', 'CHA'],
];

function normalizeType(value) {
  const type = String(value || 'neutral').toLowerCase();
  if (type.startsWith('compa')) return 'companero';
  return TYPES[type] ? type : 'neutral';
}

function creatureSubtitle(creature) {
  return [creature?.race, creature?.class].filter(Boolean).join(' · ') || 'Criatura desconocida';
}

function scoreValue(scores, ability) {
  const score = (scores || []).find(item => item.ability === ability);
  return (score?.base_value ?? 10) + (score?.bonus_value ?? 0);
}

function modifier(value) {
  const result = Math.floor((value - 10) / 2);
  return result >= 0 ? `+${result}` : String(result);
}

function resolveImageUrl(value) {
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value;
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

export default function BestiaryView({ onBack }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [creatures, setCreatures] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [myCharacterId, setMyCharacterId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket) return undefined;

    const handleAllNpcs = data => {
      setCreatures(Array.isArray(data) ? data : []);
      setLoading(false);
    };

    socket.on('all-npcs', handleAllNpcs);
    socket.emit('get-all-npcs');
    return () => socket.off('all-npcs', handleAllNpcs);
  }, [socket]);

  useEffect(() => {
    if (!socket || !user) return undefined;

    const handleParty = players => {
      const character = (players || []).find(player => player.UserId === user.id && !player.is_npc);
      setMyCharacterId(character?.id ?? null);
    };

    socket.on('players-data', handleParty);
    socket.on('stats-updated', handleParty);
    socket.emit('get-players');
    return () => {
      socket.off('players-data', handleParty);
      socket.off('stats-updated', handleParty);
    };
  }, [socket, user]);

  useEffect(() => {
    if (!socket || !myCharacterId) return undefined;

    const mergeOwnedNpcs = ownedNpcs => {
      setCreatures(current => current.map(creature => {
        const update = (ownedNpcs || []).find(npc => npc.id === creature.id);
        return update ? { ...creature, ...update } : creature;
      }));
      setTogglingId(null);
    };

    socket.on('my-npcs', mergeOwnedNpcs);
    socket.emit('get-my-npcs', myCharacterId);
    return () => socket.off('my-npcs', mergeOwnedNpcs);
  }, [socket, myCharacterId]);

  const knownCreatures = useMemo(
    () => creatures.filter(creature => creature.party_known !== false),
    [creatures],
  );

  const searchedCreatures = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    if (!query) return knownCreatures;
    return knownCreatures.filter(creature => (
      [creature.name, creature.race, creature.class, creature.origin]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase('es').includes(query))
    ));
  }, [knownCreatures, search]);

  const counts = useMemo(() => searchedCreatures.reduce((result, creature) => {
    const type = normalizeType(creature.npc_type);
    result[type] += 1;
    return result;
  }, { enemigo: 0, neutral: 0, amigo: 0, companero: 0 }), [searchedCreatures]);

  const filteredCreatures = useMemo(() => (
    typeFilter === 'all'
      ? searchedCreatures
      : searchedCreatures.filter(creature => normalizeType(creature.npc_type) === typeFilter)
  ), [searchedCreatures, typeFilter]);

  const sections = useMemo(() => Object.entries(TYPES)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([type, config]) => ({
      type,
      config,
      creatures: filteredCreatures.filter(creature => normalizeType(creature.npc_type) === type),
    }))
    .filter(section => section.creatures.length > 0), [filteredCreatures]);

  const selected = filteredCreatures.find(creature => creature.id === selectedId)
    || filteredCreatures[0]
    || null;

  const selectCreature = creature => {
    setSelectedId(creature.id);
    setMobileDetailOpen(true);
  };

  const toggleCompanion = creature => {
    if (!socket || !myCharacterId || creature.owner_id !== myCharacterId) return;
    setTogglingId(creature.id);
    socket.emit('toggle-npc-active', {
      characterId: myCharacterId,
      npcId: creature.is_active ? null : creature.id,
    });
  };

  return (
    <div className="bestiary-shell">
      <header className="bestiary-header">
        <div className="bestiary-title-row">
          <button className="bestiary-icon-button" onClick={onBack} aria-label="Volver a Lore">
            <ArrowLeft size={18} />
          </button>
          <div className="bestiary-mark"><BookMarked size={22} /></div>
          <div>
            <span className="bestiary-eyebrow">Archivo del aventurero</span>
            <h1>Personas y criaturas</h1>
          </div>
        </div>
        <div className="bestiary-discovery-count">
          <strong>{knownCreatures.length}</strong>
          <span>encuentros registrados</span>
        </div>
      </header>

      <div className="bestiary-workspace">
        <aside className="bestiary-filters" aria-label="Filtros del glosario">
          <label className="bestiary-search">
            <Search size={17} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Nombre, raza, clase o lugar..."
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button>
            )}
          </label>

          <div className="bestiary-filter-heading">
            <span>Relación conocida</span>
            <span>{searchedCreatures.length}</span>
          </div>

          <nav className="bestiary-filter-list">
            <FilterButton
              active={typeFilter === 'all'}
              label="Todos los registros"
              count={searchedCreatures.length}
              color="#C8A36A"
              Icon={BookMarked}
              onClick={() => setTypeFilter('all')}
            />
            {Object.entries(TYPES).sort(([, a], [, b]) => a.order - b.order).map(([type, config]) => (
              <FilterButton
                key={type}
                active={typeFilter === type}
                label={config.label}
                count={counts[type]}
                color={config.color}
                Icon={config.Icon}
                onClick={() => setTypeFilter(type)}
              />
            ))}
          </nav>

          <div className="bestiary-filter-note">
            <Sparkles size={15} />
            <p>El archivo crece a medida que exploras el mundo y conoces nuevos personajes.</p>
          </div>
        </aside>

        <main className="bestiary-catalog">
          <div className="bestiary-catalog-heading">
            <div>
              <span className="bestiary-eyebrow">Registros disponibles</span>
              <h2>{typeFilter === 'all' ? 'Todos los encuentros' : TYPES[typeFilter].label}</h2>
            </div>
            <span>{filteredCreatures.length} {filteredCreatures.length === 1 ? 'entrada' : 'entradas'}</span>
          </div>

          {loading && <LoadingState />}
          {!loading && filteredCreatures.length === 0 && <EmptyState hasSearch={Boolean(search)} />}

          {!loading && sections.map(section => (
            <section className="bestiary-section" key={section.type}>
              <div className="bestiary-section-heading" style={{ '--type-color': section.config.color }}>
                <section.config.Icon size={14} />
                <h3>{section.config.label}</h3>
                <span className="bestiary-section-line" />
                <strong>{section.creatures.length}</strong>
              </div>
              <div className="bestiary-card-grid">
                {section.creatures.map(creature => (
                  <CreatureCard
                    key={creature.id}
                    creature={creature}
                    selected={selected?.id === creature.id}
                    onClick={() => selectCreature(creature)}
                  />
                ))}
              </div>
            </section>
          ))}
        </main>

        <aside className="bestiary-inspector">
          {selected ? (
            <CreatureDetail
              key={selected.id}
              creature={selected}
              myCharacterId={myCharacterId}
              isToggling={togglingId === selected.id}
              onToggle={() => toggleCompanion(selected)}
            />
          ) : <InspectorPlaceholder />}
        </aside>
      </div>

      {mobileDetailOpen && selected && (
        <div className="bestiary-mobile-overlay" onClick={() => setMobileDetailOpen(false)}>
          <div className="bestiary-mobile-sheet" onClick={event => event.stopPropagation()}>
            <button className="bestiary-sheet-close" onClick={() => setMobileDetailOpen(false)} aria-label="Cerrar detalle">
              <X size={18} />
            </button>
            <CreatureDetail
              key={`mobile-${selected.id}`}
              creature={selected}
              myCharacterId={myCharacterId}
              isToggling={togglingId === selected.id}
              onToggle={() => toggleCompanion(selected)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, label, count, color, Icon: FilterIcon, onClick }) {
  return (
    <button
      className={`bestiary-filter-button${active ? ' is-active' : ''}`}
      style={{ '--type-color': color }}
      onClick={onClick}
    >
      <span className="bestiary-filter-icon">{createElement(FilterIcon, { size: 16 })}</span>
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function CreaturePortrait({ creature, large = false }) {
  const [failed, setFailed] = useState(false);
  const type = TYPES[normalizeType(creature.npc_type)];
  const Icon = type.Icon;
  const imageUrl = resolveImageUrl(creature.image_url);

  return (
    <div className={`bestiary-portrait${large ? ' is-large' : ''}`} style={{ '--type-color': type.color }}>
      {imageUrl && !failed
        ? <img src={imageUrl} alt={creature.name} onError={() => setFailed(true)} />
        : <Icon size={large ? 38 : 24} />}
    </div>
  );
}

function CreatureCard({ creature, selected, onClick }) {
  const type = TYPES[normalizeType(creature.npc_type)];
  const TypeIcon = type.Icon;

  return (
    <button
      className={`bestiary-card${selected ? ' is-selected' : ''}`}
      style={{ '--type-color': type.color }}
      onClick={onClick}
    >
      <CreaturePortrait key={resolveImageUrl(creature.image_url) || 'portrait'} creature={creature} />
      <span className="bestiary-card-copy">
        <strong>{creature.name}</strong>
        {creature.origin && <small className="bestiary-origin">{creature.origin}</small>}
        <small>{creatureSubtitle(creature)}</small>
      </span>
      <span className="bestiary-card-meta">
        {normalizeType(creature.npc_type) === 'companero' && (
          <span className={creature.is_active ? 'is-active' : ''}>
            <Heart size={12} /> {creature.hp_current ?? creature.hp_max ?? '—'}
          </span>
        )}
        <TypeIcon size={14} />
        <ChevronRight size={15} />
      </span>
    </button>
  );
}

function CreatureDetail({ creature, myCharacterId, isToggling, onToggle }) {
  const typeKey = normalizeType(creature.npc_type);
  const type = TYPES[typeKey];
  const TypeIcon = type.Icon;
  const isCompanion = typeKey === 'companero';
  const canToggle = isCompanion && myCharacterId != null && creature.owner_id === myCharacterId;
  const metrics = [
    { label: 'Nivel', value: creature.level ?? '—', Icon: Sparkles },
    { label: 'PG', value: creature.hp_max ?? '—', Icon: Heart },
    { label: 'CA', value: creature.ac_base ?? '—', Icon: Shield },
    { label: 'Movimiento', value: creature.speed ? `${creature.speed} ft` : '—', Icon: Wind },
  ];

  return (
    <article className="bestiary-detail" style={{ '--type-color': type.color }}>
      <div className="bestiary-detail-hero">
        <CreaturePortrait key={resolveImageUrl(creature.image_url) || 'portrait'} creature={creature} large />
        <div>
          <span className="bestiary-type-tag"><TypeIcon size={12} /> {type.singular}</span>
          <h2>{creature.name}</h2>
          {creature.origin && <p className="bestiary-origin">{creature.origin}</p>}
          <p>{creatureSubtitle(creature)}</p>
        </div>
      </div>

      {(isCompanion || typeKey === 'enemigo') && (
        <div className="bestiary-metrics">
          {metrics.map(({ label, value, Icon: MetricIcon }) => (
            <div key={label}>{createElement(MetricIcon, { size: 14 })}<strong>{value}</strong><span>{label}</span></div>
          ))}
        </div>
      )}

      {isCompanion && <AbilityGrid scores={creature.abilityScores} />}

      {creature.abilities_text && (
        <DetailSection title={typeKey === 'enemigo' ? 'Acciones conocidas' : 'Habilidades'}>
          <p className="bestiary-prose">{creature.abilities_text}</p>
        </DetailSection>
      )}

      {isCompanion && creature.items?.length > 0 && (
        <DetailSection title="Equipo">
          <div className="bestiary-items">
            {creature.items.map(item => (
              <div key={item.id || item.name}>
                <Package size={14} />
                <span><strong>{item.name}</strong><small>{[item.damage, item.damage_type, item.type].filter(Boolean).join(' · ')}</small></span>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {!creature.abilities_text && (!isCompanion || !creature.items?.length) && (
        <div className="bestiary-detail-empty">
          <BookMarked size={18} />
          <p>Aún no has registrado más información sobre este encuentro.</p>
        </div>
      )}

      {canToggle && (
        <button
          className={`bestiary-companion-action${creature.is_active ? ' is-active' : ''}`}
          onClick={onToggle}
          disabled={isToggling}
        >
          <UserCheck size={16} />
          {isToggling ? 'Actualizando...' : creature.is_active ? 'Enviar al campamento' : 'Unir al grupo'}
        </button>
      )}
    </article>
  );
}

function AbilityGrid({ scores }) {
  return (
    <DetailSection title="Atributos">
      <div className="bestiary-abilities">
        {ABILITIES.map(([label, key]) => {
          const value = scoreValue(scores, key);
          return <div key={key}><span>{label}</span><strong>{value}</strong><small>{modifier(value)}</small></div>;
        })}
      </div>
    </DetailSection>
  );
}

function DetailSection({ title, children }) {
  return (
    <section className="bestiary-detail-section">
      <div><span>{title}</span><i /></div>
      {children}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="bestiary-state">
      <div className="bestiary-loader" />
      <p>Consultando los archivos...</p>
    </div>
  );
}

function EmptyState({ hasSearch }) {
  return (
    <div className="bestiary-state">
      <BookMarked size={28} />
      <strong>{hasSearch ? 'Ningún registro coincide' : 'Todavía no hay encuentros'}</strong>
      <p>{hasSearch ? 'Prueba con otro nombre, raza, clase o lugar.' : 'Explora el mundo para completar tu glosario.'}</p>
    </div>
  );
}

function InspectorPlaceholder() {
  return (
    <div className="bestiary-inspector-placeholder">
      <BookMarked size={30} />
      <strong>Selecciona un registro</strong>
      <p>Su historia y sus datos conocidos aparecerán aquí.</p>
    </div>
  );
}
