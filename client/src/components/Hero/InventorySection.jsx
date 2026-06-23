import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Footprints,
  Hand,
  Layers,
  RefreshCw,
  Shield,
  Shirt,
  Sparkles,
  Sword,
  User,
  UserSquare,
  VenetianMask,
  X,
  Zap,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import API_URL from '../../config';
import ArmorTalents from './ArmorTalents';

const SLOT_KEYS = ['helmet', 'chest', 'shoulders', 'boots', 'pants', 'gloves', 'ring_1', 'ring_2', 'primary_weapon', 'secondary_weapon'];
const ARMOR_LABEL = {
  tela: 'Tela',
  cuero: 'Cuero',
  malla: 'Malla',
};

const RARITY_COLOR = {
  'Común': '#9AA0A6',
  'Poco Común': '#4FA85E',
  Raro: '#3E84D6',
  'Muy Raro': '#9B5DE5',
  Legendario: '#F59E0B',
};

const LEFT_SLOTS = [
  { id: 'helmet', label: 'Cabeza', Icon: VenetianMask },
  { id: 'chest', label: 'Cuerpo', Icon: Shirt },
  { id: 'gloves', label: 'Manos', Icon: Hand },
  { id: 'pants', label: 'Piernas', Icon: Layers },
  { id: 'boots', label: 'Pies', Icon: Footprints },
];

const RIGHT_SLOTS = [
  { id: 'shoulders', label: 'Capa', Icon: Shield },
  { id: 'primary_weapon', label: 'Arma', Icon: Sword },
  { id: 'secondary_weapon', label: 'Mano 2ª', Icon: Shield },
  { id: 'ring_1', label: 'Anillo', Icon: Zap },
  { id: 'ring_2', label: 'Anillo', Icon: Zap },
];

const rc = (rarity) => RARITY_COLOR[rarity] || '#9AA0A6';

function getItemInSlot(equipment, inventory, slotId) {
  if (!equipment) return null;
  if (equipment[slotId] && typeof equipment[slotId] === 'object') return equipment[slotId];
  const id = equipment[`${slotId}_id`];
  if (id) return (inventory || []).find((item) => item.id === id) || null;
  return null;
}

function resolveSlotColumn(logical, equipment = {}) {
  switch (logical) {
    case 'helmet':
    case 'chest':
    case 'shoulders':
    case 'boots':
    case 'pants':
    case 'gloves':
    case 'primary_weapon':
    case 'secondary_weapon':
    case 'ring_1':
    case 'ring_2':
      return logical;
    case 'weapon':
    case 'main_hand':
      return equipment.primary_weapon_id ? 'secondary_weapon' : 'primary_weapon';
    case 'off_hand':
    case 'shield':
      return 'secondary_weapon';
    case 'ring':
      return equipment.ring_1_id ? 'ring_2' : 'ring_1';
    default:
      return null;
  }
}

function RenderProgress({ stage, progress }) {
  return (
    <div style={styles.progressOverlay}>
      <div style={styles.progressCard}>
        <div className="animate-spin" style={styles.progressSpinner} />
        <p style={styles.progressStage}>{stage || 'Iniciando...'}</p>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${Math.max(2, Math.min(progress || 0, 100))}%` }} />
        </div>
        <p style={styles.progressPct}>{Math.round(progress || 0)}%</p>
      </div>
    </div>
  );
}

function SlotBox({ slot, item, onPress }) {
  const { Icon } = slot;
  const color = item ? rc(item.rarity) : '#2A332F';
  return (
    <button onClick={onPress} style={styles.slotWrap}>
      <div style={{ ...styles.slotIconBox, background: item ? `${color}22` : '#16211F', borderColor: item ? color : '#2A332F' }}>
        {item?.image_url
          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          : <Icon size={22} style={{ color: item ? color : '#3A4440' }} />}
      </div>
      <span style={styles.slotLabel}>{slot.label}</span>
    </button>
  );
}

function EquipmentDoll({ equipment, inventory, figureUrl, characterName, onSlotPress }) {
  return (
    <div style={styles.dollShell}>
      <div style={styles.slotColumn}>
        {LEFT_SLOTS.map((slot) => (
          <SlotBox
            key={slot.id}
            slot={slot}
            item={getItemInSlot(equipment, inventory, slot.id)}
            onPress={() => onSlotPress(getItemInSlot(equipment, inventory, slot.id), slot.id, slot.label)}
          />
        ))}
      </div>

      <div style={styles.figureStage}>
        <div style={styles.figureGlow} />
        {figureUrl ? (
          <div style={styles.figureFrame}>
            <img src={figureUrl} alt={characterName} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div style={styles.figurePlaceholder}>
            <User size={80} style={{ color: '#2A332F' }} strokeWidth={1} />
          </div>
        )}
      </div>

      <div style={styles.slotColumn}>
        {RIGHT_SLOTS.map((slot) => (
          <SlotBox
            key={slot.id}
            slot={slot}
            item={getItemInSlot(equipment, inventory, slot.id)}
            onPress={() => onSlotPress(getItemInSlot(equipment, inventory, slot.id), slot.id, slot.label)}
          />
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item, equipped, onEquip, onUse }) {
  const [open, setOpen] = useState(false);
  const color = rc(item.rarity);
  const qty = item.CharacterInventory?.quantity;
  const TypeIcon = item.type === 'Arma' ? Sword : item.type === 'Armadura' ? Shield : Zap;

  return (
    <div style={{ ...styles.itemCard, borderColor: open ? color : '#2A332F' }}>
      <button style={styles.itemRow} onClick={() => setOpen((previous) => !previous)}>
        <div style={{ ...styles.itemIcon, background: `${color}22`, borderColor: `${color}44` }}>
          {item.image_url
            ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            : <TypeIcon size={18} style={{ color }} />}
        </div>

        <div style={styles.itemInfo}>
          <p style={{ ...styles.itemName, color: equipped ? '#F59E0B' : '#EDE6D8' }}>
            {item.name}{equipped ? ' ✦' : ''}
          </p>
          <p style={styles.itemMeta}>
            <span style={{ color, fontWeight: 700 }}>{item.rarity}</span>
            <span style={{ color: '#6B6557' }}> · {item.type}</span>
            {item.slot && <span style={{ color: '#C8A36A' }}> · {item.slot}</span>}
          </p>
        </div>

        {qty > 1 && <span style={styles.itemQty}>×{qty}</span>}
        <span style={styles.itemChevron}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={styles.itemOpen}>
          {item.description && <p style={styles.itemDescription}>{item.description}</p>}
          {item.damage && (
            <p style={styles.itemStat}>
              <span style={{ color: '#6B6557' }}>Daño: </span>
              <span style={{ color: '#EDE6D8', fontWeight: 700 }}>{item.damage} {item.damage_type}</span>
            </p>
          )}
          {item.ca_value && (
            <p style={styles.itemStat}>
              <span style={{ color: '#6B6557' }}>CA: </span>
              <span style={{ color: '#3E84D6', fontWeight: 700 }}>+{item.ca_value}</span>
            </p>
          )}
          {Array.isArray(item.properties) && item.properties.length > 0 && (
            <p style={styles.itemProperties}>{item.properties.join(' · ')}</p>
          )}

          <div style={styles.itemActions}>
            {item.type === 'Consumible' && (
              <button onClick={() => onUse(item)} style={styles.useButton}>Usar</button>
            )}
            {item.slot && item.slot !== 'none' && (
              <button onClick={() => onEquip(item)} style={equipped ? styles.unequipButton : styles.equipButton}>
                {equipped ? 'Desequipar' : 'Equipar'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventorySection({ character }) {
  const { socket } = useSocket();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('COMBAT');
  const [slotModal, setSlotModal] = useState(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [talentsModalOpen, setTalentsModalOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(character.render_prompt || '');
  const [syncing, setSyncing] = useState(false);
  const [uploadingBody, setUploadingBody] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Iniciando...');
  const fileInputRef = useRef(null);
  const creepRef = useRef(null);

  const inventory = character.inventory || [];
  const equipment = character.equipment || {};
  const figureUrl = character.rendered_url || character.base_body_url || character.image_url || null;
  const hasBaseBody = !!character.base_body_url;
  const talents = character.talents || { espiritu: 0, agilidad: 0, aguante: 0 };
  const talentChoices = character.talent_choices || {};

  useEffect(() => {
    setCustomPrompt(character.render_prompt || '');
  }, [character.render_prompt]);

  useEffect(() => {
    if (!socket) return;
    const onProgress = (payload) => {
      if (payload.characterId !== character.id) return;
      if (payload.stage) setStage(payload.stage);
      if (typeof payload.pct === 'number') {
        setProgress((current) => Math.max(current, payload.pct));
      }
    };
    socket.on('render-progress', onProgress);
    return () => socket.off('render-progress', onProgress);
  }, [socket, character.id]);

  useEffect(() => () => {
    if (creepRef.current) window.clearInterval(creepRef.current);
  }, []);

  const startCreeper = () => {
    if (creepRef.current) window.clearInterval(creepRef.current);
    creepRef.current = window.setInterval(() => {
      setProgress((value) => (value < 90 ? value + (90 - value) * 0.045 : value));
    }, 400);
  };

  const stopCreeper = () => {
    if (creepRef.current) {
      window.clearInterval(creepRef.current);
      creepRef.current = null;
    }
  };

  const isEquipped = (itemId) => SLOT_KEYS.some((slot) => {
    if (equipment?.[slot] && typeof equipment[slot] === 'object') return equipment[slot].id === itemId;
    return equipment?.[`${slot}_id`] === itemId;
  });

  const slotForItem = (itemId) => SLOT_KEYS.find((slot) => {
    if (equipment?.[slot] && typeof equipment[slot] === 'object') return equipment[slot].id === itemId;
    return equipment?.[`${slot}_id`] === itemId;
  });

  const lostTalents = (projected) => {
    const treeLabels = { espiritu: 'Espiritu', agilidad: 'Agilidad', aguante: 'Aguante' };
    const lost = [];

    for (const tree of Object.keys(treeLabels)) {
      const chosen = talentChoices?.[tree] || {};
      for (const threshold of Object.keys(chosen)) {
        if (Number(threshold) > (projected?.[tree] ?? 0)) {
          lost.push(`${treeLabels[tree]} (umbral ${threshold})`);
        }
      }
    }

    return lost;
  };

  const confirmIfLoses = (projected) => {
    const lost = lostTalents(projected);
    if (lost.length === 0) return true;

    return window.confirm(
      `Este cambio bajara tus puntos y perderas el acceso a: ${lost.join(', ')}. La eleccion queda guardada y reaparece si recuperas los puntos.\n\nContinuar?`,
    );
  };

  const handleEquip = (item) => {
    if (!socket || !character.id || !item) return false;

    if (isEquipped(item.id)) {
      const slot = slotForItem(item.id);
      if (!slot) return false;

      const stats = item.talent_stats || {};
      const projected = {
        espiritu: (talents.espiritu || 0) - (stats.espiritu || 0),
        agilidad: (talents.agilidad || 0) - (stats.agilidad || 0),
        aguante: (talents.aguante || 0) - (stats.aguante || 0),
      };

      if (!confirmIfLoses(projected)) return false;

      socket.emit('unequip-item', { characterId: character.id, slot });
      return true;
    } else {
      const slot = resolveSlotColumn(item.slot, equipment);
      const currentItem = slot ? getItemInSlot(equipment, inventory, slot) : null;
      const currentStats = currentItem?.talent_stats || {};
      const nextStats = item.talent_stats || {};
      const projected = {
        espiritu: (talents.espiritu || 0) - (currentStats.espiritu || 0) + (nextStats.espiritu || 0),
        agilidad: (talents.agilidad || 0) - (currentStats.agilidad || 0) + (nextStats.agilidad || 0),
        aguante: (talents.aguante || 0) - (currentStats.aguante || 0) + (nextStats.aguante || 0),
      };

      if (!confirmIfLoses(projected)) return false;

      socket.emit('equip-item', { characterId: character.id, itemId: item.id });
      return true;
    }
  };

  const handleUse = (item) => {
    if (!socket || !character.id) return;
    socket.emit('use-item', { characterId: character.id, itemId: item.id });
  };

  const filteredItems = useMemo(() => inventory.filter((item) => {
    if (activeTab === 'COMBAT') return item.type === 'Arma' || item.type === 'Armadura';
    if (activeTab === 'MAGIC') return item.type === 'Objeto Mágico' || item.rarity === 'Raro' || item.rarity === 'Muy Raro' || item.rarity === 'Legendario';
    if (activeTab === 'CONSUMABLE') return item.type === 'Consumible';
    if (activeTab === 'ALL') return true;
    return false;
  }), [inventory, activeTab]);

  const handleSync = async (force = false) => {
    setStage('Iniciando...');
    setProgress(2);
    setSyncing(true);
    startCreeper();

    try {
      const response = await fetch(`${API_URL}/api/characters/${character.id}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ quality: 'high', force, customPrompt }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data.message || 'No se pudo generar el retrato.');
      } else if (data.cached) {
        window.alert('El retrato ya estaba al día. Usá "Regenerar" para otra versión.');
      } else {
        setStage('Listo');
        setProgress(100);
      }
    } catch (error) {
      window.alert('Fallo de conexión al sincronizar el retrato.');
    } finally {
      stopCreeper();
      window.setTimeout(() => {
        setSyncing(false);
        setProgress(0);
      }, 500);
    }
  };

  const handleBodyFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingBody(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        window.alert(data.message || 'No se pudo subir la imagen.');
      } else {
        socket.emit('update-character-base-body', { characterId: character.id, imageUrl: data.url });
      }
    } catch (error) {
      window.alert('Fallo de conexión al subir la imagen.');
    } finally {
      setUploadingBody(false);
    }
  };

  const TABS = [
    { id: 'COMBAT', label: 'Combate' },
    { id: 'MAGIC', label: 'Mágicos' },
    { id: 'CONSUMABLE', label: 'Consumibles' },
    { id: 'ALL', label: 'Todo' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <EquipmentDoll
          equipment={equipment}
          inventory={inventory}
          figureUrl={figureUrl}
          characterName={character.name}
          onSlotPress={(item, slotId, label) => setSlotModal({ item, slotId, label })}
        />

        {syncing && <RenderProgress stage={stage} progress={progress} />}

        <button onClick={() => setAiModalOpen(true)} style={styles.aiButton}>
          <Sparkles size={15} />
          {syncing ? 'Generando retrato...' : 'Retrato IA'}
        </button>

        <div style={styles.defenseRow}>
          <div style={{ ...styles.defenseBox, borderColor: '#8A6A3B' }}>
            <span style={styles.defenseAcVal}>{character.ac ?? '—'}</span>
            <span style={styles.defenseLabel}>Clase de Armadura</span>
          </div>
          <div style={styles.defenseBox}>
            <span style={styles.defenseVal}>{character.armorType ? ARMOR_LABEL[character.armorType] : 'Sin armadura'}</span>
            <span style={styles.defenseLabel}>Armadura</span>
          </div>
          {character.dodge?.die ? (
            <div style={styles.defenseBox}>
              <span style={styles.defenseVal}>1d{character.dodge.die}</span>
              <span style={styles.defenseLabel}>Esquive</span>
            </div>
          ) : null}
        </div>

        <div style={styles.talentSummary}>
          {[
            { key: 'espiritu', label: 'Espíritu', color: '#3E84D6' },
            { key: 'agilidad', label: 'Agilidad', color: '#5BA86B' },
            { key: 'aguante', label: 'Aguante', color: '#C2452F' },
          ].map((talent) => (
            <div key={talent.key} style={styles.talentChip}>
              <span style={{ ...styles.talentChipVal, color: talent.color }}>{talents[talent.key] ?? 0}</span>
              <span style={styles.talentChipLabel}>{talent.label}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setTalentsModalOpen(true)} style={styles.talentButton}>
          <Sparkles size={15} />
          Ver talentos
        </button>
      </div>

      <div style={styles.inventoryBlock}>
        <div style={styles.sectionHeader}>
          <Backpack size={14} style={{ color: '#C8A36A' }} />
          <span style={styles.sectionTitle}>Objetos</span>
        </div>

        <div style={styles.tabs}>
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={activeTab === tab.id ? styles.activeTab : styles.tab}>
              {tab.label}
            </button>
          ))}
        </div>

        {inventory.length === 0 ? (
          <p style={styles.emptyText}>Inventario vacío</p>
        ) : filteredItems.length === 0 ? (
          <p style={styles.emptyText}>Sin items en esta categoría</p>
        ) : (
          <div style={styles.itemGrid}>
            {filteredItems.map((item, index) => (
              <ItemCard
                key={item.id ?? index}
                item={item}
                equipped={isEquipped(item.id)}
                onEquip={handleEquip}
                onUse={handleUse}
              />
            ))}
          </div>
        )}
      </div>

      {slotModal && (
        <div style={styles.modalOverlay} onClick={() => setSlotModal(null)}>
          <div style={styles.slotModalCard} onClick={(event) => event.stopPropagation()}>
            <p className="label-caps" style={{ color: '#C8A36A', marginBottom: 12 }}>Slot: {slotModal.label}</p>
            {slotModal.item ? (
              <>
                <p style={styles.slotItemTitle}>{slotModal.item.name}</p>
                <p style={{ color: rc(slotModal.item.rarity), fontSize: 12, marginTop: 4 }}>{slotModal.item.rarity}</p>
                {slotModal.item.description && <p style={styles.slotItemDescription}>{slotModal.item.description}</p>}
                <button
                  onClick={() => {
                    if (handleEquip(slotModal.item)) setSlotModal(null);
                  }}
                  style={styles.slotActionButton}
                >
                  Desequipar
                </button>
              </>
            ) : (
              <p style={styles.slotEmptyText}>Slot vacío</p>
            )}
            <button onClick={() => setSlotModal(null)} style={styles.slotCloseButton}>Cerrar</button>
          </div>
        </div>
      )}

      {aiModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setAiModalOpen(false)}>
          <div style={styles.aiModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={styles.aiModalHeader}>
              <div style={styles.aiTitleWrap}>
                <Sparkles size={18} style={{ color: '#F59E0B' }} />
                <h3 style={styles.aiModalTitle}>Retrato IA</h3>
              </div>
              <button onClick={() => setAiModalOpen(false)} style={styles.aiCloseButton}>
                <X size={20} />
              </button>
            </div>

            <p style={styles.aiPromptLabel}>Indicaciones para la IA (opcional)</p>
            <textarea
              value={customPrompt}
              onChange={(event) => setCustomPrompt(event.target.value)}
              placeholder="Ej: capa más larga, pose de perfil mirando al horizonte, expresión seria..."
              style={styles.aiPromptInput}
              maxLength={1000}
              disabled={syncing}
            />

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleBodyFile} style={{ display: 'none' }} />

            <button onClick={() => fileInputRef.current?.click()} style={styles.aiGhostButton}>
              <UserSquare size={15} />
              {uploadingBody ? 'Subiendo...' : hasBaseBody ? 'Cambiar cuerpo entero' : 'Subir cuerpo entero'}
            </button>

            <button
              onClick={() => {
                setAiModalOpen(false);
                handleSync(false);
              }}
              disabled={syncing}
              style={styles.aiPrimaryButton}
            >
              <Sparkles size={15} />
              Sincronizar héroe
            </button>

            <button
              onClick={() => {
                setAiModalOpen(false);
                handleSync(true);
              }}
              disabled={syncing}
              style={styles.aiGhostButton}
            >
              <RefreshCw size={14} />
              Regenerar (otra versión)
            </button>
          </div>
        </div>
      )}

      {talentsModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setTalentsModalOpen(false)}>
          <div style={styles.talentsModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={styles.aiModalHeader}>
              <div style={styles.aiTitleWrap}>
                <Sparkles size={18} style={{ color: '#F59E0B' }} />
                <h3 style={styles.aiModalTitle}>Talentos</h3>
              </div>
              <button onClick={() => setTalentsModalOpen(false)} style={styles.aiCloseButton}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.talentsModalBody}>
              <ArmorTalents character={character} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  panel: {
    position: 'relative',
    padding: 18,
    borderRadius: 18,
    background: '#16211F',
    border: '1px solid #5A4424',
  },
  dollShell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 8px',
    borderRadius: 24,
    background: '#0D1A18',
    border: '1px solid #2A332F',
  },
  slotColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  slotWrap: {
    width: 54,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  slotIconBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderStyle: 'solid',
    borderWidth: 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slotLabel: {
    fontSize: 8,
    color: '#6B6557',
    fontWeight: 700,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  figureStage: {
    flex: 1,
    minHeight: 320,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  figureGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
    background: 'radial-gradient(ellipse at 50% 100%, rgba(255,122,26,0.15) 0%, transparent 70%)',
  },
  figureFrame: {
    width: '100%',
    maxWidth: 180,
    aspectRatio: '2 / 3',
    borderRadius: 24,
    overflow: 'hidden',
    border: '1.5px solid #8A6A3B',
    boxShadow: '0 4px 24px rgba(255,122,26,0.2)',
    background: '#16211F',
  },
  figurePlaceholder: {
    width: '100%',
    maxWidth: 180,
    aspectRatio: '2 / 3',
    borderRadius: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid #2A332F',
    background: '#16211F',
  },
  progressOverlay: {
    position: 'absolute',
    inset: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15,21,24,0.76)',
    backdropFilter: 'blur(6px)',
    borderRadius: 20,
  },
  progressCard: {
    width: '100%',
    maxWidth: 320,
    padding: 20,
    borderRadius: 18,
    background: '#16211F',
    border: '1px solid #8A6A3B',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  progressSpinner: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: '2px solid #F59E0B',
    borderTopColor: 'transparent',
  },
  progressStage: {
    color: '#EDE6D8',
    fontWeight: 800,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    background: '#0F1518',
    border: '1px solid #2A332F',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, #F59E0B 0%, #FF7A1A 100%)',
  },
  progressPct: {
    color: '#C8A36A',
    fontSize: 12,
    fontWeight: 800,
  },
  aiButton: {
    marginTop: 14,
    width: '100%',
    height: 42,
    borderRadius: 12,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: '#1E2A28',
    border: '1px solid #5A4424',
    color: '#C8A36A',
    fontWeight: 800,
    cursor: 'pointer',
  },
  defenseRow: {
    display: 'flex',
    gap: 10,
    marginTop: 18,
    flexWrap: 'wrap',
  },
  defenseBox: {
    flex: '1 1 160px',
    minHeight: 74,
    borderRadius: 14,
    border: '1px solid #2A332F',
    background: '#1E2A28',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    textAlign: 'center',
  },
  defenseAcVal: {
    fontSize: 28,
    fontWeight: 900,
    color: '#3E84D6',
    lineHeight: 1,
  },
  defenseVal: {
    fontSize: 16,
    fontWeight: 800,
    color: '#EDE6D8',
  },
  defenseLabel: {
    fontSize: 9,
    color: '#6B6557',
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 4,
    letterSpacing: 0.8,
  },
  talentSummary: {
    display: 'flex',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  talentChip: {
    flex: '1 1 140px',
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid #2A332F',
    background: '#1E2A28',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  talentChipVal: {
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1,
  },
  talentChipLabel: {
    fontSize: 9,
    color: '#6B6557',
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  talentButton: {
    marginTop: 10,
    width: '100%',
    height: 42,
    borderRadius: 12,
    border: '1px solid #2A332F',
    background: '#16211F',
    color: '#A89F8E',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  inventoryBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#C8A36A',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  tab: {
    padding: '8px 14px',
    borderRadius: 12,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#6B6557',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  activeTab: {
    padding: '8px 14px',
    borderRadius: 12,
    border: '1px solid rgba(245,158,11,0.3)',
    background: 'rgba(245,158,11,0.15)',
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: 900,
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  itemGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 10,
  },
  itemCard: {
    borderRadius: 14,
    borderStyle: 'solid',
    borderWidth: 1,
    background: '#16211F',
    overflow: 'hidden',
  },
  itemRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 800,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 3,
  },
  itemQty: {
    padding: '2px 8px',
    borderRadius: 999,
    background: '#1E2A28',
    color: '#EDE6D8',
    fontSize: 12,
    fontWeight: 800,
  },
  itemChevron: {
    color: '#6B6557',
    fontSize: 18,
    fontWeight: 900,
    flexShrink: 0,
  },
  itemOpen: {
    padding: '8px 12px 12px',
    borderTop: '1px solid #2A332F',
  },
  itemDescription: {
    fontSize: 12,
    lineHeight: 1.5,
    color: '#A89F8E',
    marginBottom: 10,
  },
  itemStat: {
    fontSize: 12,
    marginBottom: 8,
  },
  itemProperties: {
    fontSize: 12,
    color: '#6B6557',
    marginBottom: 12,
  },
  itemActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    flexWrap: 'wrap',
  },
  useButton: {
    padding: '7px 12px',
    borderRadius: 10,
    border: '1px solid rgba(91,168,107,0.4)',
    background: 'rgba(91,168,107,0.15)',
    color: '#5BA86B',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  equipButton: {
    padding: '7px 12px',
    borderRadius: 10,
    border: '1px solid rgba(138,106,59,0.4)',
    background: 'rgba(138,106,59,0.15)',
    color: '#C8A36A',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  unequipButton: {
    padding: '7px 12px',
    borderRadius: 10,
    border: '1px solid rgba(194,69,47,0.4)',
    background: 'rgba(194,69,47,0.15)',
    color: '#C2452F',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B6557',
    fontStyle: 'italic',
    paddingTop: 24,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    background: 'rgba(0,0,0,0.78)',
    backdropFilter: 'blur(8px)',
  },
  slotModalCard: {
    width: '100%',
    maxWidth: 380,
    padding: 20,
    borderRadius: 20,
    background: '#16211F',
    border: '1px solid #8A6A3B',
  },
  slotItemTitle: {
    color: '#EDE6D8',
    fontWeight: 800,
    fontSize: 18,
  },
  slotItemDescription: {
    color: '#6B6557',
    fontSize: 12,
    lineHeight: 1.5,
    marginTop: 10,
  },
  slotActionButton: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    border: '1px solid rgba(194,69,47,0.4)',
    background: 'rgba(194,69,47,0.15)',
    color: '#C2452F',
    fontWeight: 900,
    textTransform: 'uppercase',
    marginTop: 16,
    cursor: 'pointer',
  },
  slotCloseButton: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    border: 'none',
    background: '#1E2A28',
    color: '#A89F8E',
    fontWeight: 900,
    textTransform: 'uppercase',
    marginTop: 8,
    cursor: 'pointer',
  },
  slotEmptyText: {
    color: '#6B6557',
    fontStyle: 'italic',
  },
  aiModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '84vh',
    overflowY: 'auto',
    padding: 22,
    borderRadius: 22,
    background: '#243330',
    border: '1.5px solid #8A6A3B',
  },
  talentsModalCard: {
    width: '100%',
    maxWidth: 980,
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    padding: 22,
    borderRadius: 22,
    background: '#243330',
    border: '1.5px solid #8A6A3B',
  },
  talentsModalBody: {
    overflowY: 'auto',
    paddingRight: 4,
  },
  aiModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  aiTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  aiModalTitle: {
    color: '#EDE6D8',
    fontSize: 20,
    fontWeight: 900,
  },
  aiCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: 'none',
    background: '#1E2A28',
    color: '#EDE6D8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  aiPromptLabel: {
    color: '#C8A36A',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  aiPromptInput: {
    width: '100%',
    minHeight: 92,
    resize: 'vertical',
    borderRadius: 14,
    border: '1px solid #8A6A3B',
    background: '#16211F',
    color: '#EDE6D8',
    padding: 14,
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 14,
  },
  aiPrimaryButton: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    border: '1px solid rgba(245,158,11,0.45)',
    background: '#F59E0B',
    color: '#1A0E04',
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    marginTop: 8,
  },
  aiGhostButton: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    border: '1px solid #2A332F',
    background: '#16211F',
    color: '#A89F8E',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    marginTop: 8,
  },
};
