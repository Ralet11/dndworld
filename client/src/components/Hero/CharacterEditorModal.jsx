import { useEffect, useMemo, useState } from 'react';
import { History, Save, ShieldCheck, X } from 'lucide-react';

const ABILITIES = [['STR', 'Fuerza'], ['DEX', 'Destreza'], ['CON', 'Constitución'], ['INT', 'Inteligencia'], ['WIS', 'Sabiduría'], ['CHA', 'Carisma']];
const SKILLS = ['Acrobacia', 'Arcanos', 'Atletismo', 'Engaño', 'Historia', 'Interpretación', 'Intimidación', 'Investigación', 'Juego de Manos', 'Medicina', 'Naturaleza', 'Percepción', 'Perspicacia', 'Persuasión', 'Religión', 'Sigilo', 'Supervivencia', 'Trato con Animales'];
const FIELD_LABELS = { name: 'Nombre', race: 'Raza', class: 'Clase', background: 'Trasfondo', alignment: 'Alineamiento', level: 'Nivel', xp: 'Experiencia', gold: 'Oro', hp_current: 'Vida actual', hp_max: 'Vida máxima', hp_temp: 'Vida temporal', ac_base: 'CA base', initiative_bonus: 'Iniciativa', speed: 'Velocidad', inspiration: 'Inspiración', saving_throws: 'Salvaciones', abilityScores: 'Atributos', skills: 'Competencias', notes: 'Notas', self_edit_enabled: 'Permiso de edición' };

function initialForm(character) {
  const saves = {};
  ABILITIES.forEach(([key]) => { saves[key.toLowerCase()] = Boolean(character.savingThrows?.[key.toLowerCase()]?.proficient || character.saving_throws?.[key.toLowerCase()]); });
  const skills = {};
  SKILLS.forEach(name => { skills[name] = Boolean(character.skills?.find(item => item.name === name)?.proficient); });
  const abilityScores = {};
  ABILITIES.forEach(([key]) => { abilityScores[key] = character.stats?.[key.toLowerCase()] ?? 10; });
  return {
    name: character.name || '', race: character.race || '', subrace: character.subrace || '', class: character.class || '', background: character.background || '', alignment: character.alignment || '',
    level: character.level ?? 1, xp: character.xp ?? 0, gold: character.gold ?? 0,
    hp_current: character.hp ?? 0, hp_max: character.maxHp ?? 0, hp_temp: character.hp_temp ?? 0,
    ac_base: character.ac_base ?? 10, initiative_bonus: character.initiative_bonus ?? 0, speed: character.speed ?? 30,
    inspiration: Boolean(character.inspiration), notes: character.notes || '', abilities_text: character.abilities_text || '', abilityScores, savingThrows: saves, skills,
  };
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key}: ${typeof item === 'object' ? JSON.stringify(item) : item}`).join(' · ');
  return String(value);
}

export default function CharacterEditorModal({ character, socket, isDm = false, onClose }) {
  const [form, setForm] = useState(() => initialForm(character));
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!isDm || tab !== 'logs') return;
    socket.emit('character:audit:list', { characterId: character.id, limit: 150 }, response => {
      if (response?.ok) setLogs(response.logs || []);
      else setMessage(response?.message || 'No se pudo cargar el historial.');
    });
  }, [isDm, tab, socket, character.id]);

  const tabs = useMemo(() => [...['general', 'attributes', 'skills'], ...(isDm ? ['logs'] : [])], [isDm]);
  const setField = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const save = () => {
    setSaving(true);
    setMessage('');
    socket.emit('character:update', { characterId: character.id, diff: form }, response => {
      setSaving(false);
      if (!response?.ok) return setMessage(response?.message || 'No se pudo guardar.');
      setMessage('Cambios guardados y registrados.');
    });
  };

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col border border-[#5f4b2c] bg-[#09100e] shadow-2xl" onClick={event => event.stopPropagation()}>
        <header className="min-h-16 px-5 flex items-center gap-3 border-b border-[#363329]">
          <ShieldCheck size={20} className="text-[#c7a35c]" />
          <div className="min-w-0 flex-1"><span className="game-kicker">{isDm ? 'Editor del Dungeon Master' : 'Edición autorizada'}</span><h2 className="truncate font-serif text-lg text-[#e6ddcc]">{character.name}</h2></div>
          <button onClick={onClose} className="p-2 text-[#777e77] hover:text-white"><X size={18} /></button>
        </header>
        <nav className="px-4 flex border-b border-[#2a332e] overflow-x-auto">
          {tabs.map(id => <button key={id} onClick={() => setTab(id)} className={`px-4 py-3 text-[8px] font-black uppercase tracking-widest border-b-2 ${tab === id ? 'text-[#d4b66c] border-[#b28b45]' : 'text-[#697169] border-transparent'}`}>{id === 'general' ? 'General' : id === 'attributes' ? 'Atributos' : id === 'skills' ? 'Competencias' : 'Historial'}</button>)}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'general' && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[['name', 'Nombre', 'text'], ['race', 'Raza', 'text'], ['subrace', 'Subraza', 'text'], ['class', 'Clase', 'text'], ['background', 'Trasfondo', 'text'], ['alignment', 'Alineamiento', 'text'], ['level', 'Nivel', 'number'], ['xp', 'XP', 'number'], ['gold', 'Oro', 'number'], ['hp_current', 'Vida actual', 'number'], ['hp_max', 'Vida máxima', 'number'], ['hp_temp', 'Vida temporal', 'number'], ['ac_base', 'CA base', 'number'], ['initiative_bonus', 'Iniciativa extra', 'number'], ['speed', 'Velocidad', 'number']].map(([field, label, type]) => <label key={field} className="grid gap-1"><span className="text-[7px] font-black uppercase tracking-widest text-[#777e77]">{label}</span><input type={type} value={form[field]} onChange={event => setField(field, type === 'number' ? event.target.valueAsNumber : event.target.value)} className="h-10 px-3 border border-[#354039] bg-[#070c0b] text-sm text-[#e1d8c9] outline-none focus:border-[#806636]" /></label>)}
            <label className="sm:col-span-2 lg:col-span-4 grid gap-1"><span className="text-[7px] font-black uppercase tracking-widest text-[#777e77]">Notas</span><textarea rows="4" value={form.notes} onChange={event => setField('notes', event.target.value)} className="p-3 border border-[#354039] bg-[#070c0b] text-sm text-[#e1d8c9] outline-none focus:border-[#806636]" /></label>
            <label className="sm:col-span-2 lg:col-span-4 grid gap-1"><span className="text-[7px] font-black uppercase tracking-widest text-[#777e77]">Rasgos y aptitudes</span><textarea rows="4" value={form.abilities_text} onChange={event => setField('abilities_text', event.target.value)} className="p-3 border border-[#354039] bg-[#070c0b] text-sm text-[#e1d8c9] outline-none focus:border-[#806636]" /></label>
            <label className="flex items-center gap-2 text-xs text-[#aaa294]"><input type="checkbox" checked={form.inspiration} onChange={event => setField('inspiration', event.target.checked)} /> Inspiración</label>
          </div>}
          {tab === 'attributes' && <div className="grid sm:grid-cols-2 gap-6">
            <section><h3 className="mb-3 font-serif text-[#d8c8aa]">Puntuaciones</h3><div className="grid grid-cols-3 gap-2">{ABILITIES.map(([key, label]) => <label key={key} className="p-3 grid place-items-center border border-[#354039] bg-[#0c1411]"><span className="text-[7px] uppercase text-[#8b826f]">{label}</span><input type="number" min="1" max="30" value={form.abilityScores[key]} onChange={event => setField('abilityScores', { ...form.abilityScores, [key]: event.target.valueAsNumber })} className="w-full mt-1 bg-transparent text-center font-serif text-xl text-[#eadabb] outline-none" /></label>)}</div></section>
            <section><h3 className="mb-3 font-serif text-[#d8c8aa]">Salvaciones competentes</h3><div className="grid grid-cols-2 gap-2">{ABILITIES.map(([key, label]) => <label key={key} className="min-h-11 px-3 flex items-center gap-2 border border-[#354039] bg-[#0c1411] text-xs text-[#aaa294]"><input type="checkbox" checked={form.savingThrows[key.toLowerCase()]} onChange={event => setField('savingThrows', { ...form.savingThrows, [key.toLowerCase()]: event.target.checked })} />{label}</label>)}</div></section>
          </div>}
          {tab === 'skills' && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{SKILLS.map(name => <label key={name} className="min-h-11 px-3 flex items-center gap-2 border border-[#354039] bg-[#0c1411] text-xs text-[#aaa294]"><input type="checkbox" checked={form.skills[name]} onChange={event => setField('skills', { ...form.skills, [name]: event.target.checked })} />{name}</label>)}</div>}
          {tab === 'logs' && <div className="space-y-2">{logs.length ? logs.map(log => <article key={log.id} className="p-3 border border-[#303a35] bg-[#0c1411]"><div className="flex justify-between gap-3"><strong className="text-xs text-[#d5c7ad]">{log.actor_username} <small className="text-[#8a7651]">({log.actor_role})</small></strong><time className="text-[8px] text-[#697169]">{new Date(log.createdAt).toLocaleString('es')}</time></div><p className="mt-1 text-[8px] uppercase tracking-wider text-[#897a61]">{log.source}</p><div className="mt-2 space-y-1">{Object.entries(log.changes || {}).map(([field, change]) => <p key={field} className="text-[9px] text-[#8b928b]"><b className="text-[#c4aa70]">{FIELD_LABELS[field] || field}:</b> {formatValue(change.before)} → {formatValue(change.after)}</p>)}</div></article>) : <p className="py-10 text-center text-sm text-[#697169]"><History className="mx-auto mb-2" />No hay cambios registrados todavía.</p>}</div>}
        </div>
        {tab !== 'logs' && <footer className="min-h-16 px-5 flex items-center justify-between gap-3 border-t border-[#363329]"><span className={`text-xs ${message.startsWith('Cambios') ? 'text-[#70ad7b]' : 'text-[#b76b5d]'}`}>{message}</span><button disabled={saving} onClick={save} className="h-10 px-5 flex items-center gap-2 border border-[#806636] bg-[#291c10] text-[9px] font-black uppercase tracking-widest text-[#d8b769] disabled:opacity-40"><Save size={14} />{saving ? 'Guardando...' : 'Guardar cambios'}</button></footer>}
      </div>
    </div>
  );
}
