import { useState, useMemo, useEffect } from 'react';
import {
  Shield, Zap, Eye, Target, Footprints, Heart, HeartCrack,
  Scroll, Sparkles, Backpack, User, Wind, Coins,
  CheckCircle, Circle, Dices, Dna, ChevronRight, ChevronDown,
  BookOpen, Swords, VenetianMask, Shirt, Hand, Layers, Gem, Sword,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import ActionCheatSheet from './ActionCheatSheet';
import InventorySection from './InventorySection';
import SpellsManager from './SpellsManager';
import { getCharacterCustomFeatures, getCharacterNotesText } from './customFeatures';

// ─── D&D utils ────────────────────────────────────────────────
const getModifier = (score) => Math.floor(((score || 10) - 10) / 2);
const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);

const STANDARD_SKILLS = [
  { name: 'Acrobacias', attr: 'dex' }, { name: 'Trato con Animales', attr: 'wis' },
  { name: 'Arcana', attr: 'int' }, { name: 'Atletismo', attr: 'str' },
  { name: 'Engaño', attr: 'cha' }, { name: 'Historia', attr: 'int' },
  { name: 'Perspicacia', attr: 'wis' }, { name: 'Intimidación', attr: 'cha' },
  { name: 'Investigación', attr: 'int' }, { name: 'Medicina', attr: 'wis' },
  { name: 'Naturaleza', attr: 'int' }, { name: 'Percepción', attr: 'wis' },
  { name: 'Interpretación', attr: 'cha' }, { name: 'Persuasión', attr: 'cha' },
  { name: 'Religión', attr: 'int' }, { name: 'Juego de Manos', attr: 'dex' },
  { name: 'Sigilo', attr: 'dex' }, { name: 'Supervivencia', attr: 'wis' },
];
const ABILITIES = [
  { label: 'FUE', key: 'str' }, { label: 'DES', key: 'dex' }, { label: 'CON', key: 'con' },
  { label: 'INT', key: 'int' }, { label: 'SAB', key: 'wis' }, { label: 'CAR', key: 'cha' },
];
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];
function xpProgress(level, xp) {
  const lvl = Math.max(1, Math.min(20, level || 1));
  const cur = XP_THRESHOLDS[lvl - 1] ?? 0;
  const next = XP_THRESHOLDS[lvl] ?? cur;
  const gained = Math.max(0, (xp || 0) - cur);
  const needed = Math.max(0, next - cur);
  const isMax = lvl >= 20;
  const pct = isMax ? 100 : needed > 0 ? Math.min(100, (gained / needed) * 100) : 0;
  return { gained, needed, pct, isMax };
}
function hpColor(hp, max) {
  const pct = max > 0 ? hp / max : 0;
  if (pct >= 0.5) return '#5BA86B';
  if (pct >= 0.25) return '#F59E0B';
  return '#C2452F';
}

const TABS = [
  { id: 'stats',     label: 'Principal', Icon: User },
  { id: 'inventory', label: 'Equipo',    Icon: Backpack },
  { id: 'social',    label: 'Rasgos',   Icon: Scroll },
  { id: 'magic',     label: 'Hechizos', Icon: Sparkles },
];

// ─── Roll Modal ────────────────────────────────────────────────
function RollModal({ roll, onClose }) {
  if (!roll) return null;
  const d20 = Math.floor(Math.random() * 20) + 1;
  const result = d20 + roll.modifier;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="flex flex-col items-center gap-3 p-10 rounded-2xl" onClick={e => e.stopPropagation()}
        style={{ background: '#16211F', border: '1px solid #8A6A3B', boxShadow: '0 0 40px rgba(255,122,26,0.25)' }}>
        <p className="label-caps" style={{ color: '#C8A36A' }}>{roll.title}</p>
        <p className="text-7xl font-black" style={{ color: '#EDE6D8', lineHeight: 1 }}>{result}</p>
        <p className="text-sm" style={{ color: '#6B6557' }}>d20({d20}) {roll.modifier >= 0 ? '+' : ''}{roll.modifier}</p>
        <button onClick={onClose} className="label-caps mt-2 px-4 py-2 rounded-lg"
          style={{ background: '#1E2A28', color: '#A89F8E' }}>Cerrar</button>
      </div>
    </div>
  );
}

// ─── AttributeHex ─────────────────────────────────────────────
const HEX_POINTS = '50,3 94,28 94,84 50,109 6,84 6,28';
function AttributeHex({ label, score, modifier, onPress, compact = false }) {
  return (
    <button onClick={onPress} className="relative transition-transform hover:scale-105"
      style={{ aspectRatio: '100 / 112', width: compact ? 132 : '100%', maxWidth: '100%' }}>
      <svg viewBox="0 0 100 112" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <polygon points={HEX_POINTS} fill="#1E2A28" stroke="#8A6A3B" strokeWidth="2.5" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ fontSize: compact ? 8 : 9, fontWeight: 700, color: '#C8A36A', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
        <span style={{ fontSize: compact ? 22 : 26, fontWeight: 900, lineHeight: 1, color: modifier >= 0 ? '#EDE6D8' : '#C2452F' }}>
          {modifier >= 0 ? '+' : ''}{modifier}
        </span>
      </div>
      <div style={{ position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)',
        background: '#0F1518', border: '1px solid #8A6A3B', borderRadius: 11,
        minWidth: compact ? 22 : 24, height: compact ? 20 : 22, paddingInline: 4, fontSize: compact ? 10 : 11, fontWeight: 900,
        color: '#C8A36A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {score}
      </div>
    </button>
  );
}

function VitalChip({ icon, value, label }) {
  return (
    <div className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl"
      style={{ background: '#16211F', border: '1px solid #2A332F' }}>
      {icon}
      <span style={{ fontWeight: 900, fontSize: 14, color: '#EDE6D8' }}>{value}</span>
      <span style={{ fontWeight: 700, fontSize: 9, color: '#6B6557', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

function SkillsSection({ skills, onRoll, grid = false }) {
  const ordered = [...(skills || [])].sort((a, b) => a.name.localeCompare(b.name));
  if (!ordered.length) return null;

  if (grid) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {ordered.map((skill) => (
          <button
            key={skill.name}
            onClick={() => onRoll?.(skill)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-surface-hi"
            style={{ background: '#16211F', border: '1px solid #2A332F' }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {skill.proficient
                ? <CheckCircle size={15} style={{ color: '#F59E0B', flexShrink: 0 }} />
                : <Circle size={15} style={{ color: '#6B6557', flexShrink: 0 }} />}
              <span className="text-xs font-bold truncate" style={{ color: skill.proficient ? '#EDE6D8' : '#A89F8E' }}>{skill.name}</span>
              <span style={{ fontSize: 10, color: '#6B6557', flexShrink: 0 }}>{skill.attr?.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-black font-mono" style={{ color: skill.proficient ? '#F59E0B' : '#6B6557' }}>{sign(skill.bonus)}</span>
              <Dices size={13} style={{ color: '#6B6557' }} />
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#16211F', border: '1px solid #2A332F' }}>
      {ordered.map((skill, i) => (
        <button key={skill.name} onClick={() => onRoll?.(skill)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface-hi"
          style={i < ordered.length - 1 ? { borderBottom: '1px solid rgba(42,51,47,0.6)' } : {}}>
          <div className="flex items-center gap-2 flex-1">
            {skill.proficient
              ? <CheckCircle size={15} style={{ color: '#F59E0B', flexShrink: 0 }} />
              : <Circle size={15} style={{ color: '#6B6557', flexShrink: 0 }} />}
            <span className="text-xs font-bold truncate" style={{ color: skill.proficient ? '#EDE6D8' : '#A89F8E' }}>{skill.name}</span>
            <span style={{ fontSize: 10, color: '#6B6557' }}>{skill.attr?.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-black font-mono" style={{ color: skill.proficient ? '#F59E0B' : '#6B6557' }}>{sign(skill.bonus)}</span>
            <Dices size={13} style={{ color: '#6B6557' }} />
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── StatsSidebar ─────────────────────────────────────────────
function StatsSidebar({ character, onRoll, compact = false }) {
  const proficiency = character.proficiencyBonus || 2;
  const initiative = character.initiative ?? getModifier(character.stats?.dex || 10);
  const passivePerception = character.passivePerception ?? 10 + getModifier(character.stats?.wis || 10);
  const hp = character.hp ?? 0;
  const maxHp = character.maxHp ?? 1;
  const color = hpColor(hp, maxHp);
  const hpPct = Math.min(100, Math.max(0, (hp / maxHp) * 100));
  const xp = xpProgress(character.level, character.xp);
  const abilityMod = (key) => getModifier(character.stats?.[key] || 10);
  const saveFor = (key) => {
    const st = character.savingThrows?.[key];
    return { mod: st?.mod ?? abilityMod(key), proficient: !!st?.proficient };
  };
  const vitalLayout = compact ? 'grid gap-2 sm:grid-cols-2 xl:grid-cols-5' : 'flex gap-1.5 flex-wrap';
  const compactWrapStyle = compact ? { display: 'flex', flexWrap: 'wrap', gap: 12 } : undefined;

  return (
    <div className="space-y-4" style={compact ? { maxWidth: 1080 } : undefined}>
      {/* HP + XP */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: '#16211F', border: '1px solid #5A4424' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Heart size={15} style={{ color: '#C2452F' }} /><span className="label-caps" style={{ color: '#A89F8E' }}>Puntos de Vida</span></div>
          <span className="text-xl font-black"><span style={{ color }}>{hp}</span><span style={{ color: '#6B6557', fontSize: 14 }}> / {maxHp}</span></span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: '#0F1518', border: '1px solid #2A332F' }}>
          <div className="h-full rounded-full" style={{ width: `${hpPct}%`, background: color }} />
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: '#A855F7', textTransform: 'uppercase' }}>EXP</span>
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#0F1518' }}>
            <div style={{ height: '100%', borderRadius: 9999, width: `${xp.pct}%`, background: '#A855F7' }} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#6B6557' }}>{xp.isMax ? 'MÁX' : `${xp.gained}/${xp.needed}`}</span>
        </div>
      </div>
      {/* Vital chips */}
      <div className={vitalLayout}>
        <VitalChip icon={<Shield size={15} style={{ color: '#3E84D6' }} />} value={character.ac ?? 10} label="CA" />
        {character.dodge?.die && <VitalChip icon={<Wind size={15} style={{ color: '#F59E0B' }} />} value={`1d${character.dodge.die}`} label="Esquive" />}
        <VitalChip icon={<Zap size={15} style={{ color: '#F59E0B' }} />} value={sign(initiative)} label="Inic." />
        <VitalChip icon={<Footprints size={15} style={{ color: '#EDE6D8' }} />} value={`${character.speed ?? 30}'`} label="Vel." />
        <VitalChip icon={<Eye size={15} style={{ color: '#5BA86B' }} />} value={passivePerception} label="Perc." />
        <VitalChip icon={<Target size={15} style={{ color: '#C8A36A' }} />} value={`+${proficiency}`} label="Comp." />
      </div>
      {/* Atributos */}
      <div>
        <p className="label-caps flex items-center gap-1.5 mb-1"><Sparkles size={11} style={{ color: '#C8A36A' }} /> Atributos</p>
        <p className="text-xs italic mb-3" style={{ color: '#6B6557' }}>Clic para tirar</p>
        <div className={compact ? '' : 'grid grid-cols-3 gap-2'} style={compactWrapStyle}>
          {ABILITIES.map(a => (
            <AttributeHex key={a.key} label={a.label} score={character.stats?.[a.key] || 10}
              modifier={abilityMod(a.key)} compact={compact}
              onPress={() => onRoll({ title: `Prueba de ${a.label}`, modifier: abilityMod(a.key) })} />
          ))}
        </div>
      </div>
      {/* Salvaciones */}
      <div>
        <p className="label-caps flex items-center gap-1.5 mb-2"><Shield size={11} style={{ color: '#C8A36A' }} /> Salvaciones</p>
        <div className={compact ? '' : 'grid grid-cols-3 gap-2'} style={compactWrapStyle}>
          {ABILITIES.map(a => {
            const s = saveFor(a.key);
            return (
              <button key={a.key} onClick={() => onRoll({ title: `Salvación de ${a.label}`, modifier: s.mod })}
                className="flex flex-col items-center gap-0.5 py-2 rounded-xl"
                style={{
                  ...(s.proficient ? { background: '#1E2A28', border: '1px solid #8A6A3B' } : { background: '#16211F', border: '1px solid #2A332F' }),
                  ...(compact ? { width: 104, minHeight: 68, justifyContent: 'center' } : null),
                }}>
                <span className="label-caps" style={{ color: s.proficient ? '#F59E0B' : '#A89F8E' }}>{a.label}</span>
                <span style={{ fontWeight: 900, fontSize: 16, color: s.proficient ? '#F59E0B' : '#EDE6D8' }}>{sign(s.mod)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SkillsTab ────────────────────────────────────────────────
function buildSkillRows(character, proficiency) {
  const cs = character.skills || [];
  return STANDARD_SKILLS.map((s) => {
    const c = cs.find((x) => x.name === s.name);
    const prof = (c?.proficiency_level || 0) > 0 || !!c?.proficient;
    const mod = getModifier(character.stats?.[s.attr] || 10);
    return { name: s.name, attr: s.attr, bonus: mod + (prof ? proficiency : 0), proficient: prof };
  });
}

function SkillsBlock({ character, onRoll, grid = false }) {
  const proficiency = character.proficiencyBonus || 2;
  const skills = useMemo(() => buildSkillRows(character, proficiency), [character.skills, character.stats, proficiency]);

  return (
    <div>
      <p className="label-caps flex items-center gap-1.5 mb-3"><Target size={11} style={{ color: '#C8A36A' }} /> Habilidades</p>
      <SkillsSection skills={skills} grid={grid} onRoll={skill => onRoll({ title: skill.name, modifier: skill.bonus })} />
    </div>
  );
}

function SkillsTab({ character, onRoll }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl" style={{ background: '#11191B', border: '1px solid #2A332F' }}>
        <SkillsBlock character={character} onRoll={onRoll} />
      </div>
      <ActionCheatSheet character={character} />
    </div>
  );
}

function StatsOverviewTab({ character, onRoll, className = 'space-y-5', compactStats = false }) {
  return (
    <div className={className}>
      <StatsSidebar character={character} onRoll={onRoll} compact={compactStats} />
      <SkillsTab character={character} onRoll={onRoll} />
    </div>
  );
}

function DesktopStatsTab({ character, onRoll }) {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="p-4 rounded-2xl" style={{ background: '#16211F', border: '1px solid #5A4424' }}>
        <CharacterHeader character={character} />
      </div>
      <StatsOverviewTab character={character} onRoll={onRoll} className="space-y-4" compactStats />
    </div>
  );
}

// ─── InventoryTab — Equipment Doll + Item Cards ───────────────
const RARITY_COLOR = { 'Común': '#9AA0A6', 'Poco Común': '#4FA85E', 'Raro': '#3E84D6', 'Muy Raro': '#9B5DE5', 'Legendario': '#F59E0B' };
const RC = (rarity) => RARITY_COLOR[rarity] || '#9AA0A6';

const LEFT_SLOTS = [
  { id: 'helmet',          label: 'Cabeza',  Icon: VenetianMask },
  { id: 'chest',           label: 'Cuerpo',  Icon: Shirt },
  { id: 'gloves',          label: 'Manos',   Icon: Hand },
  { id: 'pants',           label: 'Piernas', Icon: Layers },
  { id: 'boots',           label: 'Pies',    Icon: Footprints },
];
const RIGHT_SLOTS = [
  { id: 'shoulders',       label: 'Capa',    Icon: Shield },
  { id: 'primary_weapon',  label: 'Arma',    Icon: Sword },
  { id: 'secondary_weapon',label: 'Mano 2ª', Icon: Shield },
  { id: 'ring_1',          label: 'Anillo',  Icon: Gem },
  { id: 'ring_2',          label: 'Anillo',  Icon: Gem },
];
const SLOT_KEYS = ['helmet','chest','shoulders','boots','pants','gloves','ring_1','ring_2','primary_weapon','secondary_weapon'];

function getItemInSlot(equipment, inventory, slotId) {
  if (!equipment) return null;
  if (equipment[slotId] && typeof equipment[slotId] === 'object') return equipment[slotId];
  const id = equipment[`${slotId}_id`];
  if (id) return (inventory || []).find(i => i.id === id) || null;
  return null;
}

function SlotBox({ slot, item, onPress }) {
  const { Icon } = slot;
  const color = item ? RC(item.rarity) : '#2A332F';
  return (
    <button onClick={onPress}
      className="flex flex-col items-center gap-1 transition-transform hover:scale-105"
      style={{ width: 54 }}>
      <div className="w-[54px] h-[54px] rounded-xl flex items-center justify-center overflow-hidden"
        style={{ background: item ? color + '22' : '#16211F', border: `1.5px solid ${item ? color : '#2A332F'}` }}>
        {item?.image_url
          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          : <Icon size={22} style={{ color: item ? color : '#3A4440' }} />}
      </div>
      <span style={{ fontSize: 8, color: '#6B6557', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center' }}>
        {slot.label}
      </span>
    </button>
  );
}

function EquipmentDoll({ character, inventory, onSlotPress }) {
  const eq = character.equipment;
  return (
    <div className="flex items-center justify-between py-3 px-2 rounded-2xl"
      style={{ background: '#0D1A18', border: '1px solid #2A332F' }}>
      {/* Left slots */}
      <div className="flex flex-col gap-3">
        {LEFT_SLOTS.map(s => (
          <SlotBox key={s.id} slot={s}
            item={getItemInSlot(eq, inventory, s.id)}
            onPress={() => onSlotPress(getItemInSlot(eq, inventory, s.id), s.id, s.label)} />
        ))}
      </div>

      {/* Figure */}
      <div className="flex-1 flex items-center justify-center mx-3"
        style={{ minHeight: 300, position: 'relative' }}>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255,122,26,0.15) 0%, transparent 70%)',
        }} />
        {character.rendered_url || character.image_url ? (
          <div className="rounded-2xl overflow-hidden"
            style={{ width: '100%', maxWidth: 160, aspectRatio: '2/3',
              border: '1.5px solid #8A6A3B', boxShadow: '0 4px 24px rgba(255,122,26,0.2)' }}>
            <img src={character.rendered_url || character.image_url} alt={character.name}
              className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="rounded-2xl flex items-center justify-center"
            style={{ width: '100%', maxWidth: 160, aspectRatio: '2/3',
              border: '1.5px solid #2A332F', background: '#16211F' }}>
            <User size={80} style={{ color: '#2A332F' }} strokeWidth={1} />
          </div>
        )}
      </div>

      {/* Right slots */}
      <div className="flex flex-col gap-3">
        {RIGHT_SLOTS.map(s => (
          <SlotBox key={s.id} slot={s}
            item={getItemInSlot(eq, inventory, s.id)}
            onPress={() => onSlotPress(getItemInSlot(eq, inventory, s.id), s.id, s.label)} />
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item, equipped, onEquip, onUse }) {
  const [open, setOpen] = useState(false);
  const color = RC(item.rarity);
  const qty = item.CharacterInventory?.quantity;
  const TypeIcon = item.type === 'Arma' ? Sword : item.type === 'Armadura' ? Shield : Zap;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#16211F', border: `1px solid ${open ? color : '#2A332F'}` }}>
      <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
          style={{ background: color + '22', border: `1px solid ${color}44` }}>
          {item.image_url
            ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            : <TypeIcon size={18} style={{ color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: equipped ? '#F59E0B' : '#EDE6D8' }}>
            {item.name}{equipped ? ' ✦' : ''}
          </p>
          <p className="text-xs mt-0.5">
            <span style={{ color, fontWeight: 700 }}>{item.rarity}</span>
            <span style={{ color: '#6B6557' }}> · {item.type}</span>
            {item.slot && <span style={{ color: '#C8A36A' }}> · {item.slot}</span>}
          </p>
        </div>
        {qty > 1 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: '#1E2A28', color: '#EDE6D8' }}>×{qty}</span>
        )}
        {open ? <ChevronDown size={16} style={{ color: '#6B6557', flexShrink: 0 }} />
               : <ChevronRight size={16} style={{ color: '#6B6557', flexShrink: 0 }} />}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid #2A332F' }}>
          {item.description && (
            <p className="text-xs leading-relaxed mb-3" style={{ color: '#A89F8E' }}>{item.description}</p>
          )}
          {item.damage && (
            <p className="text-xs mb-2"><span style={{ color: '#6B6557' }}>Daño: </span><span style={{ color: '#EDE6D8', fontWeight: 700 }}>{item.damage} {item.damage_type}</span></p>
          )}
          {item.ca_value && (
            <p className="text-xs mb-2"><span style={{ color: '#6B6557' }}>CA: </span><span style={{ color: '#3E84D6', fontWeight: 700 }}>+{item.ca_value}</span></p>
          )}
          {Array.isArray(item.properties) && item.properties.length > 0 && (
            <p className="text-xs mb-3" style={{ color: '#6B6557' }}>{item.properties.join(' · ')}</p>
          )}
          <div className="flex gap-2 justify-end">
            {item.type === 'Consumible' && (
              <button onClick={() => onUse(item)}
                className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider"
                style={{ background: 'rgba(91,168,107,0.15)', border: '1px solid rgba(91,168,107,0.4)', color: '#5BA86B' }}>
                Usar
              </button>
            )}
            {item.slot && item.slot !== 'none' && (
              <button onClick={() => onEquip(item)}
                className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider"
                style={equipped
                  ? { background: 'rgba(194,69,47,0.15)', border: '1px solid rgba(194,69,47,0.4)', color: '#C2452F' }
                  : { background: 'rgba(138,106,59,0.15)', border: '1px solid rgba(138,106,59,0.4)', color: '#C8A36A' }}>
                {equipped ? 'Desequipar' : 'Equipar'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryTab({ character }) {
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState('COMBAT');
  const [slotModal, setSlotModal] = useState(null); // { item, slotId, label }

  const inventory = character.inventory || [];
  const equipment = character.equipment;

  const isEquipped = (itemId) => SLOT_KEYS.some(s => {
    if (equipment?.[s] && typeof equipment[s] === 'object') return equipment[s].id === itemId;
    return equipment?.[`${s}_id`] === itemId;
  });
  const slotForItem = (itemId) => SLOT_KEYS.find(s => {
    if (equipment?.[s] && typeof equipment[s] === 'object') return equipment[s].id === itemId;
    return equipment?.[`${s}_id`] === itemId;
  });

  const handleEquip = (item) => {
    if (!socket || !character.id) return;
    if (isEquipped(item.id)) {
      const slot = slotForItem(item.id);
      if (slot) socket.emit('unequip-item', { characterId: character.id, slot });
    } else {
      socket.emit('equip-item', { characterId: character.id, itemId: item.id });
    }
  };

  const handleUse = (item) => {
    if (!socket || !character.id) return;
    socket.emit('use-item', { characterId: character.id, itemId: item.id });
  };

  const filteredItems = useMemo(() => inventory.filter(item => {
    if (activeTab === 'COMBAT')     return item.type === 'Arma' || item.type === 'Armadura';
    if (activeTab === 'MAGIC')      return item.type === 'Objeto Mágico' || item.rarity === 'Raro' || item.rarity === 'Muy Raro' || item.rarity === 'Legendario';
    if (activeTab === 'CONSUMABLE') return item.type === 'Consumible';
    return true;
  }), [inventory, activeTab]);

  const TABS = [
    { id: 'COMBAT',     label: 'Combate' },
    { id: 'MAGIC',      label: 'Mágicos' },
    { id: 'CONSUMABLE', label: 'Consumibles' },
    { id: 'ALL',        label: 'Todo' },
  ];

  return (
    <div className="space-y-4">
      {/* Equipment doll */}
      <EquipmentDoll character={character} inventory={inventory} onSlotPress={(item, slotId, label) => setSlotModal({ item, slotId, label })} />

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap"
            style={activeTab === t.id
              ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }
              : { color: '#6B6557', border: '1px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Items */}
      {inventory.length === 0 ? (
        <p className="text-center py-10 italic" style={{ color: '#6B6557' }}>Inventario vacío</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-center py-8 italic" style={{ color: '#6B6557' }}>Sin items en esta categoría</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filteredItems.map((item, i) => (
            <ItemCard key={item.id ?? i} item={item}
              equipped={isEquipped(item.id)}
              onEquip={handleEquip}
              onUse={handleUse} />
          ))}
        </div>
      )}

      {/* Slot modal */}
      {slotModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }} onClick={() => setSlotModal(null)}>
          <div className="w-full max-w-sm p-5 rounded-t-2xl md:rounded-2xl" onClick={e => e.stopPropagation()}
            style={{ background: '#16211F', border: '1px solid #8A6A3B' }}>
            <p className="label-caps mb-3" style={{ color: '#C8A36A' }}>Slot: {slotModal.label}</p>
            {slotModal.item ? (
              <>
                <p className="font-bold" style={{ color: '#EDE6D8' }}>{slotModal.item.name}</p>
                <p className="text-xs mt-1" style={{ color: RC(slotModal.item.rarity) }}>{slotModal.item.rarity}</p>
                {slotModal.item.description && <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6B6557' }}>{slotModal.item.description}</p>}
                <button onClick={() => { handleEquip(slotModal.item); setSlotModal(null); }}
                  className="w-full h-10 rounded-lg font-black uppercase tracking-wider mt-4 text-sm"
                  style={{ background: 'rgba(194,69,47,0.15)', border: '1px solid rgba(194,69,47,0.4)', color: '#C2452F' }}>
                  Desequipar
                </button>
              </>
            ) : (
              <p className="text-sm italic" style={{ color: '#6B6557' }}>Slot vacío</p>
            )}
            <button onClick={() => setSlotModal(null)}
              className="w-full h-10 rounded-lg font-black uppercase tracking-wider mt-2 text-sm"
              style={{ background: '#1E2A28', color: '#A89F8E' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RasgosTab ────────────────────────────────────────────────
function cleanText(text) {
  if (!text) return '';
  return text.replace(/\*\*\*/g, '').replace(/\*\*/g, '').replace(/_/g, '').trim();
}

function getFeatureDescription(featureName, fullDesc) {
  if (!fullDesc || !featureName) return '';
  const escaped = featureName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`###\\s*${escaped}`, 'i');
  const match = fullDesc.match(regex);
  if (!match) return '';
  const startIndex = match.index + match[0].length;
  const remaining = fullDesc.substring(startIndex);
  const nextHeader = remaining.search(/###/);
  const desc = nextHeader !== -1 ? remaining.substring(0, nextHeader) : remaining;
  return cleanText(desc).substring(0, 300);
}

function featuresForClass(cls) {
  const feats = [];
  if (!cls?.table) return feats;
  const rows = cls.table.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && !l.includes('---'));
  rows.slice(1).forEach(row => {
    const cols = row.split('|').filter(c => c.trim()).map(c => c.trim());
    if (cols.length < 3) return;
    const lvl = parseInt(cols[0]);
    if (lvl <= (cls.level || 0)) {
      cols[2].split(',').map(f => f.trim()).filter(f => f && f !== '-').forEach(f => {
        feats.push({ name: f, level: lvl });
      });
    }
  });
  return feats.sort((a, b) => a.level - b.level);
}

function Accordion({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#16211F', border: '1px solid #2A332F' }}>
      <button className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{title}</span>
        </div>
        {open ? <ChevronDown size={16} style={{ color: '#F59E0B' }} /> : <ChevronRight size={16} style={{ color: '#6B6557' }} />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function RasgosTab({ character }) {
  const raceData = character.raceData;
  const classData = character.classData;
  const level = character.level || 1;

  // Multiclase: lista de clases con su nivel
  const classList = useMemo(() => {
    if (character.classes?.length) return character.classes;
    if (classData) return [{ ...classData, level }];
    return [];
  }, [character.classes, classData, level]);

  const customFeatures = useMemo(() => getCharacterCustomFeatures(character), [character]);
  const notesText = useMemo(() => getCharacterNotesText(character.abilities_text), [character.abilities_text]);

  const hasContent = raceData || classList.length > 0 || customFeatures.length > 0 || notesText;
  if (!hasContent) {
    return <p className="text-center py-12 italic" style={{ color: '#6B6557' }}>Sin información disponible</p>;
  }

  return (
    <div className="space-y-3">
      {/* RASGOS RACIALES */}
      {raceData && (
        <Accordion title={`Rasgos Raciales · ${raceData.name}`} icon={<Dna size={15} style={{ color: '#F59E0B' }} />}>
          {(raceData.traits || raceData.desc) ? (
            <p className="text-sm leading-relaxed" style={{ color: '#A89F8E', whiteSpace: 'pre-line' }}>
              {cleanText(raceData.traits || raceData.desc)}
            </p>
          ) : <p className="text-sm italic" style={{ color: '#6B6557' }}>Sin descripción</p>}
          <div className="flex gap-3 mt-3">
            {raceData.speed && (
              <div className="px-3 py-2 rounded-lg" style={{ background: '#1E2A28' }}>
                <p className="label-caps">Velocidad</p>
                <p className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{raceData.speed} ft</p>
              </div>
            )}
            {raceData.vision && (
              <div className="px-3 py-2 rounded-lg" style={{ background: '#1E2A28' }}>
                <p className="label-caps">Visión</p>
                <p className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{raceData.vision}</p>
              </div>
            )}
          </div>
        </Accordion>
      )}

      {/* COMPETENCIAS */}
      {classList.length > 0 && (
        <Accordion title="Competencias" icon={<Shield size={15} style={{ color: '#F59E0B' }} />}>
          {classList.map((cls, ci) => (
            <div key={cls.slug || ci} className={ci > 0 ? 'mt-4 pt-4' : ''} style={ci > 0 ? { borderTop: '1px solid #2A332F' } : {}}>
              <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: '#C8A36A' }}>
                {cls.name} {cls.level ? `· Nv ${cls.level}` : ''}
              </p>
              {cls.prof_armor && <div className="flex justify-between py-1.5 text-xs"><span style={{ color: '#6B6557' }}>Armaduras</span><span style={{ color: '#EDE6D8' }}>{cleanText(cls.prof_armor)}</span></div>}
              {cls.prof_weapons && <div className="flex justify-between py-1.5 text-xs" style={{ borderTop: '1px solid #2A332F' }}><span style={{ color: '#6B6557' }}>Armas</span><span style={{ color: '#EDE6D8' }}>{cleanText(cls.prof_weapons)}</span></div>}
              {cls.prof_saving_throws && <div className="flex justify-between py-1.5 text-xs" style={{ borderTop: '1px solid #2A332F' }}><span style={{ color: '#6B6557' }}>Salvaciones</span><span style={{ color: '#EDE6D8' }}>{cleanText(cls.prof_saving_throws)}</span></div>}
              <div className="flex gap-3 mt-2">
                {cls.hit_dice && <div className="px-3 py-1.5 rounded-lg text-xs text-center" style={{ background: '#1E2A28' }}><p className="label-caps">Dado de Golpe</p><p className="font-bold mt-0.5" style={{ color: '#EDE6D8' }}>{cls.hit_dice}</p></div>}
                {cls.spellcasting_ability && <div className="px-3 py-1.5 rounded-lg text-xs text-center" style={{ background: '#1E2A28' }}><p className="label-caps">Conjuro</p><p className="font-bold mt-0.5" style={{ color: '#A855F7' }}>{cls.spellcasting_ability.toUpperCase()}</p></div>}
              </div>
            </div>
          ))}
        </Accordion>
      )}

      {/* HABILIDADES DE CLASE POR NIVEL */}
      {classList.map((cls, ci) => {
        const feats = featuresForClass(cls);
        if (!feats.length) return null;
        return (
          <Accordion key={cls.slug || ci} title={`Habilidades · ${cls.name}`} icon={<Zap size={15} style={{ color: '#F59E0B' }} />} defaultOpen>
            <div className="space-y-2">
              {feats.map((feat, fi) => {
                const desc = getFeatureDescription(feat.name, cls.desc || '');
                return (
                  <div key={fi} className="p-3 rounded-xl" style={{ background: '#1E2A28', border: '1px solid #2A332F' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{feat.name}</p>
                      <span className="label-caps" style={{ color: '#C8A36A' }}>Nv.{feat.level}</span>
                    </div>
                    {desc && <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B6557' }}>{desc}</p>}
                  </div>
                );
              })}
            </div>
          </Accordion>
        );
      })}

      {/* RASGOS CUSTOM */}
      {customFeatures.length > 0 && (
        <Accordion title="Rasgos Custom" icon={<VenetianMask size={15} style={{ color: '#E06A9A' }} />} defaultOpen>
          <div className="space-y-2">
            {customFeatures.map((feat, index) => (
              <div key={`${feat.name}-${index}`} className="p-3 rounded-xl" style={{ background: '#1E2A28', border: '1px solid #2A332F' }}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{feat.name}</p>
                  {feat.kind ? <span className="label-caps" style={{ color: '#E06A9A' }}>{feat.kind}</span> : null}
                </div>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: '#A89F8E' }}>{feat.description}</p>
                {feat.resource ? (
                  <p className="text-[10px] mt-2 font-black uppercase tracking-wider" style={{ color: '#C8A36A' }}>{feat.resource}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Accordion>
      )}

      {/* NOTAS LIBRES */}
      {notesText && (
        <Accordion title="Notas" icon={<BookOpen size={15} style={{ color: '#C8A36A' }} />} defaultOpen>
          <p className="text-sm leading-relaxed" style={{ color: '#A89F8E', whiteSpace: 'pre-line' }}>{notesText}</p>
        </Accordion>
      )}
    </div>
  );
}

// ─── HechizosTab ──────────────────────────────────────────────
function HechizosTab({ character }) {
  const { socket } = useSocket();
  const [classSpells, setClassSpells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('known');
  const [selected, setSelected] = useState(null);

  const knownSlugs    = useMemo(() => character.spells_known    || [], [character.spells_known]);
  const preparedSlugs = useMemo(() => character.spells_prepared || [], [character.spells_prepared]);
  const spellSlots    = character.spell_slots || {};

  // Fetch class spells — listener must be registered BEFORE emit (server may respond from cache)
  useEffect(() => {
    if (!socket) return;
    const slugs = character.classes?.length
      ? character.classes.map(c => c.slug)
      : (character.class_slug ? [character.class_slug] : (character.class ? [character.class] : []));
    if (!slugs.length) return;

    setLoading(true);
    const handle = (spells) => {
      setClassSpells(spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)));
      setLoading(false);
    };
    socket.on('class-spells-result', handle);
    socket.emit('get-class-spells', { class_names: slugs });
    return () => socket.off('class-spells-result', handle);
  }, [socket, character.class_slug, character.class, character.classes]);

  const knownSpells    = classSpells.filter(s => knownSlugs.includes(s.slug));
  const preparedSpells = classSpells.filter(s => preparedSlugs.includes(s.slug));

  const hasPrepared = preparedSlugs.length > 0;
  const activeList  = tab === 'known' ? knownSpells : preparedSpells;

  const hasSlots  = Object.keys(spellSlots).length > 0;
  const hasSpells = knownSlugs.length > 0 || preparedSlugs.length > 0;

  if (!hasSpells && !loading) {
    return <p className="text-center py-12 italic" style={{ color: '#6B6557' }}>Sin hechizos</p>;
  }

  return (
    <div className="space-y-4">
      {/* Spell slots */}
      {hasSlots && (
        <div>
          <p className="label-caps mb-2" style={{ color: '#A855F7' }}>Espacios de hechizo</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(spellSlots).map(([lvl, slots]) => {
              const rem = typeof slots === 'object' ? (slots.remaining ?? slots.total ?? 0) : slots;
              const tot = typeof slots === 'object' ? (slots.total ?? rem) : slots;
              return (
                <div key={lvl} className="flex flex-col items-center px-3 py-2 rounded-xl"
                  style={{ background: '#1E2A28', border: '1px solid rgba(168,85,247,0.3)' }}>
                  <span style={{ fontSize: 9, color: '#A855F7', fontWeight: 700, textTransform: 'uppercase' }}>Nv.{lvl}</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: rem > 0 ? '#EDE6D8' : '#6B6557' }}>{rem}</span>
                  <span style={{ fontSize: 9, color: '#6B6557' }}>/{tot}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab toggle */}
      {hasPrepared && (
        <div className="flex gap-2">
          {[['known', `Conocidos (${knownSlugs.length})`], ['prepared', `Preparados (${preparedSlugs.length})`]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap"
              style={tab === id
                ? { background: 'rgba(168,85,247,0.15)', color: '#A855F7', border: '1px solid rgba(168,85,247,0.3)' }
                : { color: '#6B6557', border: '1px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#A855F7', borderTopColor: 'transparent' }} />
        </div>
      ) : activeList.length === 0 ? (
        <p className="text-center py-8 italic" style={{ color: '#6B6557' }}>
          {knownSlugs.length > 0 ? 'Cargando hechizos…' : 'Sin hechizos en esta lista'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {activeList.map(spell => (
            <button key={spell.slug} onClick={() => setSelected(s => s?.slug === spell.slug ? null : spell)}
              className="p-3 rounded-xl text-left w-full"
              style={selected?.slug === spell.slug
                ? { background: '#1E2A28', border: '1px solid rgba(168,85,247,0.4)' }
                : { background: '#16211F', border: '1px solid #2A332F' }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold" style={{ color: '#EDE6D8' }}>{spell.name}</p>
                <span className="label-caps shrink-0" style={{ color: '#A855F7' }}>Nv.{spell.level}</span>
              </div>
              {spell.school && <p className="text-xs mt-0.5 uppercase tracking-wide font-semibold" style={{ color: '#6B6557' }}>{spell.school}</p>}
              {selected?.slug === spell.slug && (
                <div className="mt-2 space-y-1 text-xs" style={{ color: '#A89F8E' }}>
                  {spell.casting_time && <p><span style={{ color: '#6B6557' }}>Tiempo: </span>{spell.casting_time}</p>}
                  {spell.range        && <p><span style={{ color: '#6B6557' }}>Alcance: </span>{spell.range}</p>}
                  {spell.duration     && <p><span style={{ color: '#6B6557' }}>Duración: </span>{spell.duration}</p>}
                  {spell.desc         && <p className="mt-1 leading-relaxed line-clamp-4">{spell.desc}</p>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MobileStatsTab (Principal en mobile) ─────────────────────
function MobileStatsTab({ character, onRoll }) {
  return <StatsOverviewTab character={character} onRoll={onRoll} className="space-y-5 pb-8 pt-2" />;
}

// ─── Header + TabBar ──────────────────────────────────────────
function CharacterHeader({ character }) {
  const hp = character.hp ?? 0; const maxHp = character.maxHp ?? 1;
  const hpPct = maxHp > 0 ? hp / maxHp : 0;
  const hpCol = hpColor(hp, maxHp);
  const critical = hpPct < 0.25;
  return (
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-full overflow-hidden shrink-0" style={{ border: '2px solid #8A6A3B', background: '#1E2A28' }}>
        {character.image_url ? <img src={character.image_url} alt={character.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><User size={22} style={{ color: '#6B6557' }} /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-lg truncate" style={{ color: '#EDE6D8' }}>{character.name}</p>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#C8A36A' }}>{character.race} {character.class}</p>
        <p className="text-xs" style={{ color: '#6B6557' }}>Nivel {character.level}</p>
      </div>
      <div className="flex flex-col gap-1.5 items-end shrink-0">
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black" style={{ border: `1px solid ${hpCol}`, background: '#1E2A28' }}>
          {critical ? <HeartCrack size={12} style={{ color: hpCol }} /> : <Heart size={12} style={{ color: hpCol }} />}
          <span style={{ color: hpCol }}>{hp}/{maxHp}</span>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black" style={{ border: '1px solid #8A6A3B', background: '#1E2A28' }}>
          <Coins size={12} style={{ color: '#F59E0B' }} />
          <span style={{ color: '#F59E0B' }}>{(character.gold ?? 0).toLocaleString('es')}</span>
        </div>
      </div>
    </div>
  );
}

function TabBar({ active, setActive }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {TABS.map(({ id, label, Icon }) => (
        <button key={id} onClick={() => setActive(id)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap"
          style={active === id
            ? { background: '#16211F', border: '1px solid #8A6A3B', color: '#C8A36A' }
            : { background: '#1E2A28', border: '1px solid #2A332F', color: '#6B6557' }}>
          <Icon size={13} />{label}
        </button>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────
export default function CharacterSheet({ character }) {
  const [activeTab, setActiveTab] = useState('stats');
  const [rollTarget, setRollTarget] = useState(null);
  if (!character) return null;
  const isDesktopStats = activeTab === 'stats';

  const TabContent = ({ tab }) => {
    if (tab === 'stats')     return <StatsOverviewTab character={character} onRoll={setRollTarget} />;
    if (tab === 'inventory') return <InventorySection character={character} />;
    if (tab === 'social')    return <RasgosTab character={character} />;
    if (tab === 'magic')     return <SpellsManager character={character} />;
    return null;
  };

  return (
    <>
      {/* ── DESKTOP ─────────────────────────────────────────────── */}
      <div className="hidden md:block" style={{ minHeight: '100vh', background: '#0F1518' }}>
        {isDesktopStats ? (
          <div className="p-6">
            <div className="max-w-6xl mx-auto">
              <div className="mb-5"><TabBar active={activeTab} setActive={setActiveTab} /></div>
              <DesktopStatsTab character={character} onRoll={setRollTarget} />
            </div>
          </div>
        ) : (
          <div className="flex gap-0" style={{ minHeight: '100vh', alignItems: 'flex-start' }}>
            <div className="shrink-0 p-5 space-y-5" style={{
              width: 320, position: 'sticky', top: 0, maxHeight: '100vh', overflowY: 'auto',
              background: '#0D1A18', borderRight: '1px solid #2A332F',
            }}>
              <CharacterHeader character={character} />
              <StatsSidebar character={character} onRoll={setRollTarget} />
            </div>
            <div className="flex-1 min-w-0 p-6">
              <div className="mb-5"><TabBar active={activeTab} setActive={setActiveTab} /></div>
              <TabContent tab={activeTab} />
            </div>
          </div>
        )}
      </div>

      {/* ── MOBILE ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:hidden" style={{ background: '#0F1518' }}>
        <div className="px-4 py-3 sticky top-0 z-20" style={{ background: '#16211F', borderBottom: '1px solid #5A4424' }}>
          <CharacterHeader character={character} />
        </div>
        <div className="overflow-x-auto no-scrollbar py-2 px-4" style={{ background: '#0F1518', borderBottom: '1px solid #2A332F' }}>
          <TabBar active={activeTab} setActive={setActiveTab} />
        </div>
        <div className="px-4 py-4 pb-8">
          {activeTab === 'stats'
            ? <MobileStatsTab character={character} onRoll={setRollTarget} />
            : <TabContent tab={activeTab} />}
        </div>
      </div>

      <RollModal roll={rollTarget} onClose={() => setRollTarget(null)} />
    </>
  );
}
