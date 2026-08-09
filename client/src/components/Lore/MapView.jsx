import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, Crosshair, Layers3, Map as MapIcon, MapPin, Plus, X,
} from 'lucide-react';
import {
  ImageOverlay, MapContainer, Marker, Tooltip, useMap, useMapEvents, ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import API_URL from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1600;
const WORLD_MAP_IMAGE = '/westamar.jpg';
const CONTINENT_MAP = { id: 'seven-cities', title: 'Las Siete Ciudades', image: '/sieteciudades.png', width: 1881, height: 836 };
const WESTAMAR_MAP = { id: 'westamar', title: 'Westamar', image: WORLD_MAP_IMAGE, width: MAP_WIDTH, height: MAP_HEIGHT };
const REGIONS = [
  { id: 'westamar', title: 'Westamar', top: '29%', left: '20%', color: '#E5A948', target: 'westamar' },
];

const TYPE_META = {
  city: { label: 'Ciudad', symbol: 'C', color: '#E5A948' },
  camp: { label: 'Campamento', symbol: 'T', color: '#FF7A1A' },
  dungeon: { label: 'Mazmorra', symbol: 'D', color: '#9B5DE5' },
  cave: { label: 'Cueva', symbol: 'V', color: '#A89F8E' },
  npc: { label: 'NPC', symbol: 'N', color: '#3E84D6' },
  quest: { label: 'Mision', symbol: '!', color: '#F5C518' },
  shop: { label: 'Comercio', symbol: '$', color: '#5BA86B' },
  place: { label: 'Lugar', symbol: 'P', color: '#A855F7' },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function parsePercent(value, fallback = 50) {
  const parsed = Number.parseFloat(String(value).replace('%', ''));
  return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : fallback;
}

function questColor(questLevel, playerLevel = 1) {
  const difference = (questLevel ?? 1) - playerLevel;
  if (difference <= 1) return '#F5C518';
  if (difference === 2) return '#F97316';
  return '#EF4444';
}

function poiColor(poi, playerLevel) {
  if (poi.type === 'quest') return questColor(poi.level, playerLevel);
  return poi.color || TYPE_META[poi.type]?.color || '#E5A948';
}

function poiToLatLng(poi, mapConfig) {
  const left = parsePercent(poi.left);
  const top = parsePercent(poi.top);
  return L.latLng(mapConfig.height - (top / 100) * mapConfig.height, (left / 100) * mapConfig.width);
}

function latLngToPercent(latlng, mapConfig) {
  const left = clamp((latlng.lng / mapConfig.width) * 100, 0, 100);
  const top = clamp(((mapConfig.height - latlng.lat) / mapConfig.height) * 100, 0, 100);
  return { top: `${top.toFixed(2)}%`, left: `${left.toFixed(2)}%` };
}

function createPoiIcon(poi, playerLevel, isDM) {
  const meta = TYPE_META[poi.type] || TYPE_META.place;
  const color = poiColor(poi, playerLevel);
  return L.divIcon({
    className: 'atlas-marker-host',
    html: `<span class="atlas-marker ${isDM ? 'is-editable' : ''}" style="--marker-color:${color}"><b>${meta.symbol}</b></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function createRegionIcon(region) {
  return L.divIcon({
    className: 'atlas-region-host',
    html: `<span class="atlas-region-marker" style="--region-color:${region.color}"><b>${region.title}</b><small>Explorar region</small></span>`,
    iconSize: [148, 54],
    iconAnchor: [74, 27],
  });
}

function FitImageBounds({ mapKey, bounds, mapConfig }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize({ animate: false });
    const fitZoom = map.getBoundsZoom(bounds, false, L.point(0, 0));
    const viewport = map.getSize();
    const viewportRatio = viewport.x / viewport.y;
    const imageRatio = mapConfig.width / mapConfig.height;
    const coverBoost = Math.abs(Math.log2(viewportRatio / imageRatio)) + 0.08;
    const coverZoom = fitZoom + coverBoost;

    map.setMaxBounds(bounds);
    map.setView(bounds.getCenter(), coverZoom, { animate: false });
  }, [map, mapKey, bounds, mapConfig]);

  return null;
}

function MapInteractionHandler({ placing, mapConfig, onPlace, onZoomOut }) {
  useMapEvents({
    click(event) {
      if (placing) onPlace(latLngToPercent(event.latlng, mapConfig));
    },
    contextmenu(event) {
      event.originalEvent?.preventDefault();
      onZoomOut();
    },
  });
  return null;
}

export default function MapView({ onBack }) {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const isDM = user?.role === 'DM' || user?.role === 'ADMIN';

  const [markers, setMarkers] = useState([]);
  const [atlasLevel, setAtlasLevel] = useState('westamar');
  const [parentStack, setParentStack] = useState([]);
  const [selectedPOI, setSelectedPOI] = useState(null);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [placingPOI, setPlacingPOI] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createPosition, setCreatePosition] = useState({ top: '50.00%', left: '50.00%' });
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('city');
  const [newLevel, setNewLevel] = useState('1');

  const currentParent = parentStack.at(-1) || null;
  const currentParentId = currentParent?.id ?? null;
  const isContinentView = atlasLevel === 'continent' && !currentParent;
  const mapConfig = isContinentView ? CONTINENT_MAP : WESTAMAR_MAP;
  const mapImage = currentParent ? currentParent.map_image : mapConfig.image;
  const mapKey = currentParentId ? `poi-${currentParentId}` : mapConfig.id;
  const mapBounds = useMemo(
    () => L.latLngBounds([[0, 0], [mapConfig.height, mapConfig.width]]),
    [mapConfig],
  );
  const canEditPOIs = isDM && !isContinentView;
  const availableTypes = currentParent
    ? ['npc', 'quest', 'shop', 'place']
    : ['city', 'camp', 'dungeon', 'cave'];

  const requestHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const fetchMarkers = useCallback(async (parentId) => {
    setLoading(true);
    setError('');
    try {
      const query = parentId === null || parentId === undefined ? 'null' : parentId;
      const response = await fetch(`${API_URL}/api/pois?parent_id=${query}`);
      if (!response.ok) throw new Error('No se pudieron cargar los puntos del mapa.');
      setMarkers(await response.json());
    } catch (fetchError) {
      setError(fetchError.message || 'No se pudo cargar el Atlas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isContinentView) {
      setMarkers([]);
      setLoading(false);
      setError('');
      return;
    }
    fetchMarkers(currentParentId);
  }, [currentParentId, fetchMarkers, isContinentView]);

  useEffect(() => {
    if (!socket || !user) return undefined;
    const updateLevel = (players) => {
      const character = players.find((player) => player.UserId === user.id);
      if (character?.level) setPlayerLevel(character.level);
    };
    socket.emit('get-players');
    socket.on('players-data', updateLevel);
    socket.on('stats-updated', updateLevel);
    return () => {
      socket.off('players-data', updateLevel);
      socket.off('stats-updated', updateLevel);
    };
  }, [socket, user]);

  const updateMarkerPosition = async (poi, latlng) => {
    const position = latLngToPercent(latlng, mapConfig);
    const previous = { top: poi.top, left: poi.left };
    setMarkers((current) => current.map((item) => item.id === poi.id ? { ...item, ...position } : item));
    try {
      const response = await fetch(`${API_URL}/api/pois/${poi.id}`, {
        method: 'PUT',
        headers: requestHeaders,
        body: JSON.stringify(position),
      });
      if (!response.ok) throw new Error();
    } catch {
      setMarkers((current) => current.map((item) => item.id === poi.id ? { ...item, ...previous } : item));
      setError('No se pudo guardar la nueva posicion.');
    }
  };

  const beginPlacement = () => {
    setSelectedPOI(null);
    setPlacingPOI((current) => !current);
  };

  const handlePlace = (position) => {
    setCreatePosition(position);
    setNewType(currentParent ? 'npc' : 'city');
    setPlacingPOI(false);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const meta = TYPE_META[newType] || TYPE_META.place;
    const payload = {
      title: newName.trim(),
      ...createPosition,
      color: meta.color,
      type: newType,
      parent_id: currentParentId,
      ...(newType === 'quest' ? { level: Number.parseInt(newLevel, 10) || 1 } : {}),
    };

    try {
      const response = await fetch(`${API_URL}/api/pois`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('No se pudo crear el punto.');
      const created = await response.json();
      setMarkers((current) => [...current, created]);
      setShowCreate(false);
      setNewName('');
      setNewLevel('1');
    } catch (createError) {
      setError(createError.message || 'No se pudo crear el punto.');
    }
  };

  const enterPOI = (poi) => {
    setSelectedPOI(null);
    setParentStack((current) => [...current, poi]);
  };

  const exitToParent = () => {
    setSelectedPOI(null);
    setParentStack((current) => current.slice(0, -1));
  };

  const zoomOutLevel = () => {
    setSelectedPOI(null);
    setPlacingPOI(false);
    if (currentParent) {
      setParentStack((current) => current.slice(0, -1));
      return;
    }
    if (atlasLevel === 'westamar') setAtlasLevel('continent');
  };

  const enterRegion = (region) => {
    if (region.target !== 'westamar') return;
    setSelectedPOI(null);
    setAtlasLevel('westamar');
  };

  return (
    <div className={`atlas-shell ${placingPOI ? 'is-placing' : ''}`}>
      <MapContainer
        key={mapKey}
        className="atlas-map"
        crs={L.CRS.Simple}
        bounds={mapBounds}
        minZoom={-2}
        maxZoom={3}
        zoomSnap={0.05}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={90}
        maxBounds={mapBounds}
        maxBoundsViscosity={1}
        zoomControl={false}
        attributionControl={false}
      >
        <FitImageBounds mapKey={mapKey} bounds={mapBounds} mapConfig={mapConfig} />
        <MapInteractionHandler
          placing={placingPOI}
          mapConfig={mapConfig}
          onPlace={handlePlace}
          onZoomOut={zoomOutLevel}
        />
        <ZoomControl position="bottomright" />

        {mapImage && <ImageOverlay url={mapImage} bounds={mapBounds} />}

        {isContinentView && REGIONS.map((region) => (
          <Marker
            key={region.id}
            position={poiToLatLng(region, mapConfig)}
            icon={createRegionIcon(region)}
            bubblingMouseEvents={false}
            eventHandlers={{ click: () => enterRegion(region) }}
          />
        ))}

        {markers.map((poi) => (
          <Marker
            key={poi.id}
            position={poiToLatLng(poi, mapConfig)}
            icon={createPoiIcon(poi, playerLevel, isDM)}
            draggable={canEditPOIs}
            autoPan={canEditPOIs}
            bubblingMouseEvents={false}
            eventHandlers={{
              click: () => setSelectedPOI(poi),
              dragend: (event) => updateMarkerPosition(poi, event.target.getLatLng()),
            }}
          >
            <Tooltip permanent direction="bottom" offset={[0, 13]} className="atlas-marker-label">
              {poi.title}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {!mapImage && (
        <div className="atlas-empty-map">
          <MapIcon size={44} />
          <strong>Mapa pendiente</strong>
          <span>El DM aun no cargo la imagen de {currentParent?.title}.</span>
        </div>
      )}

      <div className="atlas-topbar">
        <div className="atlas-topbar-left">
          {(currentParent || onBack || atlasLevel === 'westamar') && (
            <button
              className="atlas-icon-button"
              onClick={currentParent ? exitToParent : isContinentView ? onBack : zoomOutLevel}
              aria-label="Subir un nivel"
            >
              <ChevronLeft size={19} />
            </button>
          )}
          <div className="atlas-title-block">
            <span>Atlas de las Siete Ciudades</span>
            <strong>{currentParent?.title || mapConfig.title}</strong>
          </div>
        </div>
        <div className="atlas-map-status">
          <Layers3 size={14} /> {isContinentView ? `${REGIONS.length} regiones` : `${markers.length} puntos`}
        </div>
        {canEditPOIs && (
          <button className={`atlas-place-button ${placingPOI ? 'is-active' : ''}`} onClick={beginPlacement}>
            {placingPOI ? <X size={16} /> : <Plus size={16} />}
            <span>{placingPOI ? 'Cancelar' : 'Agregar punto'}</span>
          </button>
        )}
      </div>

      {placingPOI && (
        <div className="atlas-placement-hint"><Crosshair size={16} /> Haz clic donde quieras colocar el punto</div>
      )}

      {!placingPOI && !currentParent && (
        <div className="atlas-level-hint">
          {isContinentView ? 'Selecciona una region para explorarla' : 'Clic derecho para ver las Siete Ciudades'}
        </div>
      )}

      {(loading || error) && (
        <div className={`atlas-feedback ${error ? 'is-error' : ''}`}>
          {loading ? 'Cargando puntos...' : error}
          {error && <button onClick={() => fetchMarkers(currentParentId)}>Reintentar</button>}
        </div>
      )}

      {selectedPOI && (
        <aside className="atlas-inspector">
          <button className="atlas-inspector-close" onClick={() => setSelectedPOI(null)} aria-label="Cerrar detalle">
            <X size={18} />
          </button>
          {(selectedPOI.image || selectedPOI.map_image) && (
            <img
              src={selectedPOI.image || selectedPOI.map_image}
              alt=""
              className="atlas-inspector-image"
              onError={(event) => {
                const fallback = selectedPOI.map_image;
                if (fallback && event.currentTarget.src !== fallback) {
                  event.currentTarget.src = fallback;
                  return;
                }
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="atlas-inspector-body">
            <span className="atlas-inspector-type" style={{ color: poiColor(selectedPOI, playerLevel) }}>
              {TYPE_META[selectedPOI.type]?.label || selectedPOI.type}
            </span>
            <h2>{selectedPOI.title}</h2>
            {selectedPOI.type === 'quest' && <span className="atlas-level-chip">Nivel {selectedPOI.level ?? 1}</span>}
            <p>{selectedPOI.description || 'Todavia no hay una descripcion publica para este lugar.'}</p>
            {(selectedPOI.map_image || (isDM && selectedPOI.type === 'city')) && (
              <button className="atlas-enter-button" onClick={() => enterPOI(selectedPOI)}>
                <MapPin size={16} /> Entrar a {selectedPOI.title}
              </button>
            )}
            {canEditPOIs && <small>Arrastra el marcador para cambiar su posicion.</small>}
          </div>
        </aside>
      )}

      {showCreate && (
        <div className="atlas-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="atlas-create-card" onClick={(event) => event.stopPropagation()}>
            <div className="atlas-create-header">
              <div><span>Nuevo punto</span><strong>{currentParent?.title || mapConfig.title}</strong></div>
              <button onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <label>Nombre</label>
            <input className="input-base" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nombre del lugar" autoFocus />
            <label>Tipo</label>
            <div className="atlas-type-grid">
              {availableTypes.map((type) => {
                const meta = TYPE_META[type];
                return (
                  <button key={type} className={newType === type ? 'is-active' : ''} onClick={() => setNewType(type)}>
                    <span style={{ color: meta.color }}>{meta.symbol}</span>{meta.label}
                  </button>
                );
              })}
            </div>
            {newType === 'quest' && (
              <><label>Nivel recomendado</label><input className="input-base" type="number" min="1" max="20" value={newLevel} onChange={(event) => setNewLevel(event.target.value)} /></>
            )}
            <div className="atlas-coordinate-preview">{createPosition.left} · {createPosition.top}</div>
            <button className="atlas-create-submit" onClick={handleCreate} disabled={!newName.trim()}>Crear punto</button>
          </div>
        </div>
      )}
    </div>
  );
}
