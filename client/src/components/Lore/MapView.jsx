import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Tent, Mountain, User, ScrollText, Store, Home,
  ChevronLeft, X, Map as MapIcon, Plus,
} from 'lucide-react';
import API_URL from '../../config';
import { useAuth } from '../../context/AuthContext';

// Dimensiones virtuales del mapa (igual que mobile)
const MAP_W = 2400;
const MAP_H = 1600;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

function parsePercent(val) {
  return parseFloat(String(val).replace('%', ''));
}

function questColor(questLevel, playerLevel = 1) {
  const diff = (questLevel ?? 1) - playerLevel;
  if (diff <= 1) return '#F5C518';
  if (diff === 2) return '#F97316';
  return '#EF4444';
}

const TYPE_ICONS = {
  camp:    Tent,
  dungeon: ({ ...p }) => <span style={{ fontSize: p.size || 14, color: p.color }}>☠</span>,
  cave:    Mountain,
  npc:     User,
  quest:   ScrollText,
  shop:    Store,
  place:   Home,
};

function MarkerIcon({ type, color, size = 15 }) {
  if (type === 'quest') {
    return <span style={{ fontSize: size + 2, fontWeight: 900, lineHeight: 1, color }}>!</span>;
  }
  const Icon = TYPE_ICONS[type] || MapPin;
  if (type === 'dungeon') {
    return <span style={{ fontSize: size, lineHeight: 1, color }}>☠</span>;
  }
  return <Icon size={size} color={color} />;
}

export default function MapView({ onBack }) {
  const { user } = useAuth();
  const isDM = user?.role === 'DM' || user?.role === 'ADMIN';

  // pan/zoom state
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0.35);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  // map data
  const [markers, setMarkers] = useState([]);
  const [parentStack, setParentStack] = useState([]);
  const currentParent = parentStack.length ? parentStack[parentStack.length - 1] : null;
  const currentParentId = currentParent?.id ?? null;

  const [selectedPOI, setSelectedPOI] = useState(null);
  const [playerLevel, setPlayerLevel] = useState(1);

  // DM create
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('city');

  const fetchMarkers = useCallback(async (parentId) => {
    try {
      const q = parentId === null || parentId === undefined ? 'null' : parentId;
      const res = await fetch(`${API_URL}/api/pois?parent_id=${q}`);
      if (res.ok) setMarkers(await res.json());
    } catch (e) {
      console.error('fetch POIs error', e);
    }
  }, []);

  useEffect(() => { fetchMarkers(currentParentId); }, [currentParentId]);

  // ─── Mouse pan ────────────────────────────────────────────────
  const onMouseDown = (e) => {
    drag.current = { startX: e.clientX - offset.x, startY: e.clientY - offset.y };
  };
  const onMouseMove = (e) => {
    if (!drag.current) return;
    setOffset({ x: e.clientX - drag.current.startX, y: e.clientY - drag.current.startY });
  };
  const onMouseUp = () => { drag.current = null; };

  // ─── Scroll wheel zoom ────────────────────────────────────────
  const onWheel = (e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    const scaleDiff = newScale / scale;
    setOffset(prev => ({
      x: mouseX - scaleDiff * (mouseX - prev.x),
      y: mouseY - scaleDiff * (mouseY - prev.y),
    }));
    setScale(newScale);
  };

  // ─── Create POI ───────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim()) return;
    const colorMap = {
      city: '#F59E0B', camp: '#FF7A1A', dungeon: '#9B5DE5', cave: '#6B6557',
      npc: '#3E84D6', quest: '#F59E0B', shop: '#5BA86B', place: '#A855F7',
    };
    try {
      const res = await fetch(`${API_URL}/api/pois`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newName.trim(),
          top: '50.00%', left: '50.00%',
          color: colorMap[newType] || '#F59E0B',
          type: newType,
          parent_id: currentParentId,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setMarkers(prev => [...prev, created]);
      }
    } catch (e) { console.error(e); }
    setShowCreate(false);
    setNewName('');
    setNewType('city');
  };

  const handleSelectPOI = (poi) => {
    if (poi.map_image || (poi.type === 'city' && isDM)) {
      // Could enter sub-map
    }
    setSelectedPOI(poi);
  };

  const enterPOI = (poi) => {
    setSelectedPOI(null);
    setMarkers([]);
    setParentStack(s => [...s, poi]);
    setScale(0.35);
    setOffset({ x: 0, y: 0 });
  };

  const exitToParent = () => {
    setSelectedPOI(null);
    setMarkers([]);
    setParentStack(s => s.slice(0, -1));
    setScale(0.35);
    setOffset({ x: 0, y: 0 });
  };

  const mapImageSrc = currentParent?.map_image ? currentParent.map_image : '/westamar.jpg';
  const showPlaceholder = currentParent && !currentParent.map_image;

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: '#0F1518', width: '100%', height: '100%' }}
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      {/* Map canvas */}
      <div
        style={{
          position: 'absolute',
          width: MAP_W,
          height: MAP_H,
          transformOrigin: '0 0',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: drag.current ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        {showPlaceholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4"
            style={{ background: '#0F1518' }}>
            <MapIcon size={64} style={{ color: '#2A3550' }} />
            <p style={{ color: '#2A3550', fontWeight: 700 }}>
              El DM aún no cargó el mapa de {currentParent.title}
            </p>
          </div>
        ) : (
          <img
            src={mapImageSrc}
            alt="Mapa de Westamar"
            style={{ width: MAP_W, height: MAP_H, display: 'block', pointerEvents: 'none' }}
            draggable={false}
          />
        )}

        {/* Markers */}
        {markers.map((m) => {
          const x = (parsePercent(m.left) / 100) * MAP_W;
          const y = (parsePercent(m.top) / 100) * MAP_H;
          const isQuest = m.type === 'quest';
          const tint = isQuest ? questColor(m.level, playerLevel) : m.color;

          return (
            <div
              key={m.id}
              onClick={(e) => { e.stopPropagation(); handleSelectPOI(m); }}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                transform: `translate(-50%, -50%) scale(${1 / scale})`,
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              <div
                className="flex flex-col items-center gap-0.5"
                style={{ pointerEvents: 'auto' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: '#0F1518',
                    border: `2px solid ${tint}`,
                    boxShadow: `0 0 8px ${tint}66`,
                  }}
                >
                  <MarkerIcon type={m.type} color={tint} size={14} />
                </div>
                <span
                  className="font-bold whitespace-nowrap"
                  style={{
                    fontSize: 10,
                    color: '#EDE6D8',
                    textShadow: '0 1px 4px #000, 0 0 8px #000',
                    maxWidth: 80,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {m.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── UI Overlay (no escala) ──────────────────────────────── */}
      {/* Header badge */}
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-center"
        style={{ background: 'rgba(15,21,24,0.85)', border: '1px solid #2A332F', backdropFilter: 'blur(8px)' }}
      >
        <p className="text-xs font-black" style={{ color: '#EDE6D8' }}>
          {currentParent ? currentParent.title : 'Atlas de Westamar'}
        </p>
        <p className="text-[10px]" style={{ color: '#6B6557' }}>
          {currentParent ? `Westamar › ${currentParent.title}` : 'Scroll para hacer zoom · Arrastrá para mover'}
        </p>
      </div>

      {/* Back button (inside a city) */}
      {currentParent && (
        <button
          onClick={exitToParent}
          className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-full font-bold text-sm"
          style={{ background: 'rgba(15,21,24,0.9)', border: '1px solid #8A6A3B', color: '#F59E0B' }}
        >
          <ChevronLeft size={18} /> Volver
        </button>
      )}

      {/* Back to Lore button */}
      {onBack && !currentParent && (
        <button
          onClick={onBack}
          className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-full font-bold text-sm"
          style={{ background: 'rgba(15,21,24,0.9)', border: '1px solid #5A4424', color: '#C8A36A' }}
        >
          <ChevronLeft size={18} /> Lore
        </button>
      )}

      {/* DM: create POI */}
      {isDM && (
        <button
          onClick={() => setShowCreate(true)}
          className="absolute bottom-6 right-4 w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: '#FF7A1A', boxShadow: '0 0 16px rgba(255,122,26,0.4)' }}
        >
          <Plus size={22} style={{ color: '#fff' }} />
        </button>
      )}

      {/* POI detail card */}
      {selectedPOI && (
        <div
          className="absolute bottom-0 left-0 right-0 p-4 rounded-t-2xl"
          style={{ background: '#16211F', border: '1px solid #2A332F', borderBottom: 'none' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="label-caps mb-0.5" style={{ color: selectedPOI.color || '#C8A36A' }}>
                {selectedPOI.type}
              </p>
              <h3 className="text-lg font-black" style={{ color: '#EDE6D8' }}>{selectedPOI.title}</h3>
            </div>
            <button onClick={() => setSelectedPOI(null)}><X size={18} style={{ color: '#6B6557' }} /></button>
          </div>
          {selectedPOI.description && (
            <p className="text-sm italic mb-3" style={{ color: '#A89F8E' }}>{selectedPOI.description}</p>
          )}
          {/* Enter sub-map */}
          {(selectedPOI.map_image || (isDM && selectedPOI.type === 'city')) && (
            <button
              onClick={() => enterPOI(selectedPOI)}
              className="w-full py-2 rounded-lg font-black text-sm"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}
            >
              Entrar al mapa de {selectedPOI.title}
            </button>
          )}
        </div>
      )}

      {/* Create POI modal */}
      {showCreate && (
        <div
          className="absolute inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowCreate(false)}
        >
          <div className="w-full max-w-sm p-5 rounded-2xl space-y-3"
            style={{ background: '#16211F', border: '1px solid #2A332F' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="font-black" style={{ color: '#EDE6D8' }}>Nuevo POI</h3>
            <input
              className="input-base"
              placeholder="Nombre del lugar"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <select
              className="input-base"
              value={newType}
              onChange={e => setNewType(e.target.value)}
            >
              {['city','camp','dungeon','cave','npc','quest','shop','place'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg font-bold text-sm"
                style={{ background: '#1E2A28', border: '1px solid #2A332F', color: '#A89F8E' }}>
                Cancelar
              </button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-lg font-bold text-sm"
                style={{ background: 'rgba(255,122,26,0.2)', border: '1px solid rgba(255,122,26,0.4)', color: '#FF7A1A' }}>
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
