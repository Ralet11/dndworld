import { useMemo, useRef, useState, useEffect } from 'react';
import {
  BookOpen, ChevronLeft, CircleUserRound, Heart, ImagePlus, Plus, Save,
  Search, Shield, Skull, Sparkles, Swords, Trash2, UserRound,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import API_URL from '../config';

const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const FILTERS = [
  ['todos', 'Todos'], ['enemigo', 'Enemigos'], ['amigo', 'Aliados'], ['compañero', 'Compañeros'], ['neutral', 'Neutrales'],
];

const emptyAction = () => ({
  name: '', action_type: 'acción', description: '', attack_bonus: '', damage_dice: '',
  damage_bonus: '', damage_type: '', reach: '', save_ability: '', save_dc: '',
  recharge: '', max_uses: '', is_public: false,
});

const baseNpc = () => ({
  name: '', race: 'Humanoide', class: 'NPC', npc_type: 'enemigo', level: 1,
  hp_current: 10, hp_max: 10, ac_base: 10, initiative_bonus: 0, speed: 30,
  size: 'Mediano', creature_type: 'Humanoide', challenge_rating: '', proficiency_bonus: 2,
  passive_perception: 10, image_url: '', rendered_url: '', abilities_text: '', notes: '',
  saving_throws: {}, damage_resistances: [], damage_immunities: [], damage_vulnerabilities: [],
  condition_immunities: [], senses: [], languages: [],
  abilityScores: Object.fromEntries(ABILITIES.map(key => [key, 10])), npcActions: [],
});

const listValue = value => Array.isArray(value) ? value.join(', ') : (value || '');
const cleanedList = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const modifier = value => {
  const result = Math.floor((Number(value || 10) - 10) / 2);
  return result >= 0 ? `+${result}` : String(result);
};

function toForm(npc) {
  if (!npc) return baseNpc();
  return {
    ...baseNpc(), ...npc,
    image_url: npc.image_url || '', rendered_url: npc.rendered_url || '',
    abilityScores: Object.fromEntries(ABILITIES.map(key => [key, (npc.abilityScores || []).find(score => score.ability === key)?.base_value ?? 10])),
    npcActions: (npc.npcActions || []).map(action => ({ ...emptyAction(), ...action })),
    damage_resistances: listValue(npc.damage_resistances), damage_immunities: listValue(npc.damage_immunities),
    damage_vulnerabilities: listValue(npc.damage_vulnerabilities), condition_immunities: listValue(npc.condition_immunities),
    senses: listValue(npc.senses), languages: listValue(npc.languages),
  };
}

function Field({ label, children, wide = false, hint = '' }) {
  return <label className={`npc-studio-field${wide ? ' is-wide' : ''}`}>
    <span>{label}</span>{children}{hint && <small>{hint}</small>}
  </label>;
}

function SectionTitle({ icon: Icon, title, description, action }) {
  return <div className="npc-studio-section-title">
    <span className="npc-studio-section-icon"><Icon size={18} /></span>
    <div><h3>{title}</h3><p>{description}</p></div>
    {action}
  </div>;
}

export default function NpcsPanel() {
  const { socket } = useSocket();
  const fileRef = useRef(null);
  const [npcs, setNpcs] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(baseNpc);
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);

  useEffect(() => {
    if (!socket) return undefined;
    const receive = data => setNpcs(data || []);
    socket.on('all-npcs', receive);
    socket.emit('get-all-npcs');
    return () => socket.off('all-npcs', receive);
  }, [socket]);

  const selected = npcs.find(npc => Number(npc.id) === Number(selectedId));
  useEffect(() => { setForm(toForm(selected)); setMessage(''); }, [selectedId, selected]);

  const filtered = useMemo(() => npcs.filter(npc => {
    const matchesQuery = `${npc.name} ${npc.race} ${npc.class} ${npc.npc_type}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'todos' || npc.npc_type === filter;
    return matchesQuery && matchesFilter;
  }), [filter, npcs, query]);

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const setAction = (index, patch) => set('npcActions', form.npcActions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const startNew = () => { setSelectedId(null); setForm(baseNpc()); setTab('overview'); setMessage(''); };

  const uploadImage = async file => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMessage('Elegí una imagen válida (JPG, PNG, WEBP o GIF).');
    if (file.size > 20 * 1024 * 1024) return setMessage('La imagen no puede superar 20 MB.');
    setUploadingImage(true); setMessage('');
    try {
      const body = new FormData(); body.append('image', file);
      const response = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('dnd_token')}` }, body });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.message || 'No se pudo subir la imagen.');
      set('image_url', data.url);
      setMessage('Imagen cargada. Guardá el NPC para aplicar el cambio.');
    } catch (error) { setMessage(error.message || 'No se pudo subir la imagen.'); }
    finally { setUploadingImage(false); setDraggingImage(false); }
  };

  const save = () => {
    if (!form.name.trim()) return setMessage('El NPC necesita nombre.');
    setSaving(true); setMessage('');
    const core = {
      ...form,
      hp_current: Number(form.hp_current), hp_max: Number(form.hp_max), ac_base: Number(form.ac_base),
      level: Number(form.level), initiative_bonus: Number(form.initiative_bonus), speed: Number(form.speed),
      proficiency_bonus: Number(form.proficiency_bonus), passive_perception: Number(form.passive_perception),
      saving_throws: Object.fromEntries(Object.entries(form.saving_throws || {}).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)])),
      damage_resistances: cleanedList(form.damage_resistances), damage_immunities: cleanedList(form.damage_immunities),
      damage_vulnerabilities: cleanedList(form.damage_vulnerabilities), condition_immunities: cleanedList(form.condition_immunities),
      senses: cleanedList(form.senses), languages: cleanedList(form.languages),
    };
    const complete = characterId => socket.emit('npc:save-actions', { characterId, actions: form.npcActions }, response => {
      setSaving(false);
      if (!response?.ok) setMessage(response?.message || 'No se pudieron guardar las acciones.');
      else { setSelectedId(characterId); setMessage('Cambios guardados.'); socket.emit('get-all-npcs'); }
    });
    if (selectedId) socket.emit('character:update', { characterId: selectedId, diff: core }, response => {
      if (!response?.ok) { setSaving(false); setMessage(response?.message || 'No se pudo guardar el NPC.'); }
      else complete(selectedId);
    });
    else socket.emit('create-npc', core, response => {
      if (!response?.ok || !response?.npc?.id) {
        setSaving(false); setMessage(response?.message || 'No se pudo crear el NPC.'); return;
      }
      complete(response.npc.id);
    });
  };

  const tabs = [
    ['overview', UserRound, 'Resumen'], ['combat', Swords, `Combate (${form.npcActions.length})`], ['lore', BookOpen, 'Historia'],
  ];

  return <div className="npc-studio">
    <aside className="npc-studio-roster">
      <header><div><span>Archivo del director</span><h1>Personajes</h1><p>{npcs.length} criaturas en campaña</p></div><button onClick={startNew}><Plus size={16} /> Nuevo</button></header>
      <label className="npc-studio-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre, raza o rol…" /></label>
      <div className="npc-studio-filters" aria-label="Filtrar personajes">
        {FILTERS.map(([value, label]) => <button key={value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      <div className="npc-studio-list">
        {filtered.map(npc => <button key={npc.id} className={Number(npc.id) === Number(selectedId) ? 'is-selected' : ''} onClick={() => { setSelectedId(npc.id); setTab('overview'); }}>
          <span className="npc-studio-avatar">{npc.image_url ? <img src={npc.image_url} alt="" /> : <Skull size={21} />}</span>
          <span className="npc-studio-list-copy"><strong>{npc.name}</strong><small>{npc.race || 'Criatura'} · {npc.class || npc.npc_type}</small></span>
          <span className="npc-studio-hp"><Heart size={11} /> {npc.hp_current}/{npc.hp_max}</span>
        </button>)}
        {!filtered.length && <div className="npc-studio-no-results"><Search size={22} /><strong>Sin resultados</strong><span>Probá con otro nombre o filtro.</span></div>}
      </div>
    </aside>

    <main className="npc-studio-sheet">
      <header className="npc-studio-sheetbar">
        <button className="npc-studio-back" onClick={() => setSelectedId(null)} title="Nueva ficha"><ChevronLeft size={18} /></button>
        <div><span>{selectedId ? 'Ficha de personaje' : 'Nueva criatura'}</span><h2>{form.name || 'Personaje sin nombre'}</h2></div>
        <button className="npc-studio-save" disabled={saving} onClick={save}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </header>

      {message && <p className="npc-studio-message" role="status">{message}</p>}

      <section className="npc-studio-hero">
        <button
          className={`npc-studio-portrait${draggingImage ? ' is-dragging' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={event => { event.preventDefault(); setDraggingImage(true); }}
          onDragLeave={() => setDraggingImage(false)}
          onDrop={event => { event.preventDefault(); uploadImage(event.dataTransfer.files?.[0]); }}
          title="Cambiar imagen"
        >
          {form.image_url ? <img src={form.image_url} alt={`Retrato de ${form.name || 'NPC'}`} /> : <Skull size={48} />}
          <span><ImagePlus size={15} /> {uploadingImage ? 'Subiendo…' : 'Cambiar imagen'}</span>
        </button>
        <input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => uploadImage(event.target.files?.[0])} />
        <div className="npc-studio-hero-copy">
          <div className="npc-studio-badges"><span>{form.npc_type || 'neutral'}</span><span>{form.race || 'Sin raza'}</span><span>Nivel {form.level || 1}</span></div>
          <h2>{form.name || 'Dale un nombre a esta criatura'}</h2>
          <p>{form.class || 'Sin clase'} · {form.creature_type || 'Humanoide'} · {form.size || 'Mediano'}</p>
        </div>
        <div className="npc-studio-vitals" aria-label="Estadísticas principales">
          <div><span>PG</span><strong>{form.hp_current}<small> / {form.hp_max}</small></strong></div>
          <div><span>CA</span><strong>{form.ac_base}</strong></div>
          <div><span>Velocidad</span><strong>{form.speed}<small> pies</small></strong></div>
          <div><span>Percepción</span><strong>{form.passive_perception}</strong></div>
        </div>
      </section>

      <nav className="npc-studio-tabs" role="tablist" aria-label="Secciones de la ficha">
        {tabs.map(([value, Icon, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? 'is-active' : ''} onClick={() => setTab(value)}><Icon size={17} /> {label}</button>)}
      </nav>

      <div className="npc-studio-content">
        {tab === 'overview' && <div className="npc-studio-tab-panel">
          <fieldset className="npc-studio-card">
            <legend><CircleUserRound size={18} /> Identidad</legend>
            <p className="npc-studio-card-help">La información que permite reconocer y clasificar al personaje.</p>
            <div className="npc-studio-form-grid">
              <Field label="Nombre" wide><input value={form.name} onChange={event => set('name', event.target.value)} placeholder="Nombre del personaje" /></Field>
              <Field label="Raza"><input value={form.race} onChange={event => set('race', event.target.value)} /></Field>
              <Field label="Clase o rol"><input value={form.class} onChange={event => set('class', event.target.value)} /></Field>
              <Field label="Actitud"><select value={form.npc_type} onChange={event => set('npc_type', event.target.value)}><option value="enemigo">Enemigo</option><option value="amigo">Aliado</option><option value="compañero">Compañero</option><option value="neutral">Neutral</option></select></Field>
              <Field label="Tipo de criatura"><input value={form.creature_type} onChange={event => set('creature_type', event.target.value)} /></Field>
              <Field label="Tamaño"><input value={form.size} onChange={event => set('size', event.target.value)} /></Field>
              <Field label="Nivel"><input type="number" min="1" value={form.level} onChange={event => set('level', event.target.value)} /></Field>
              <Field label="Desafío (CR)"><input value={form.challenge_rating || ''} onChange={event => set('challenge_rating', event.target.value)} placeholder="Ej. 1/2, 3, 12" /></Field>
            </div>
          </fieldset>

          <fieldset className="npc-studio-card">
            <legend><Shield size={18} /> Estadísticas esenciales</legend>
            <p className="npc-studio-card-help">Los números que el DM necesita consultar de un vistazo durante la sesión.</p>
            <div className="npc-studio-stat-grid">
              {[
                ['PG actuales', 'hp_current'], ['PG máximos', 'hp_max'], ['Clase de armadura', 'ac_base'],
                ['Iniciativa', 'initiative_bonus'], ['Velocidad', 'speed'], ['Percepción pasiva', 'passive_perception'], ['Competencia', 'proficiency_bonus'],
              ].map(([label, key]) => <Field key={key} label={label}><input type="number" value={form[key]} onChange={event => set(key, event.target.value)} /></Field>)}
            </div>
          </fieldset>

          <fieldset className="npc-studio-card">
            <legend><Sparkles size={18} /> Atributos y salvaciones</legend>
            <p className="npc-studio-card-help">Puntuación, modificador calculado y bonificador de salvación.</p>
            <div className="npc-studio-abilities">
              {ABILITIES.map(key => <div key={key} className="npc-studio-ability">
                <span>{key}</span><strong>{modifier(form.abilityScores[key])}</strong>
                <label>Puntuación<input type="number" min="1" max="30" value={form.abilityScores[key]} onChange={event => set('abilityScores', { ...form.abilityScores, [key]: event.target.value })} /></label>
                <label>Salvación<input type="number" value={form.saving_throws?.[key.toLowerCase()] ?? ''} placeholder="—" onChange={event => set('saving_throws', { ...form.saving_throws, [key.toLowerCase()]: event.target.value })} /></label>
              </div>)}
            </div>
          </fieldset>
        </div>}

        {tab === 'combat' && <div className="npc-studio-tab-panel">
          <section className="npc-studio-card">
            <SectionTitle icon={Swords} title="Acciones, rasgos y reacciones" description="Cada entrada aparece en el panel de turno y puede usar el motor de combate." action={<button className="npc-studio-add" onClick={() => set('npcActions', [...form.npcActions, emptyAction()])}><Plus size={15} /> Agregar</button>} />
            <div className="npc-studio-actions">
              {form.npcActions.map((action, index) => <article key={action.id || index}>
                <div className="npc-studio-action-head"><span>{index + 1}</span><input aria-label="Nombre de la acción" value={action.name} onChange={event => setAction(index, { name: event.target.value })} placeholder="Nombre de la habilidad o ataque" /><button onClick={() => set('npcActions', form.npcActions.filter((_, itemIndex) => itemIndex !== index))} title="Eliminar"><Trash2 size={15} /></button></div>
                <div className="npc-studio-action-grid">
                  <Field label="Tipo"><select value={action.action_type} onChange={event => setAction(index, { action_type: event.target.value })}><option>acción</option><option>bonus</option><option>reacción</option><option>rasgo</option></select></Field>
                  <Field label="Ataque"><input type="number" value={action.attack_bonus ?? ''} onChange={event => setAction(index, { attack_bonus: event.target.value })} placeholder="+0" /></Field>
                  <Field label="Daño"><input value={action.damage_dice || ''} onChange={event => setAction(index, { damage_dice: event.target.value })} placeholder="1d8" /></Field>
                  <Field label="Bonus de daño"><input type="number" value={action.damage_bonus ?? ''} onChange={event => setAction(index, { damage_bonus: event.target.value })} /></Field>
                  <Field label="Tipo de daño"><input value={action.damage_type || ''} onChange={event => setAction(index, { damage_type: event.target.value })} placeholder="Necrótico" /></Field>
                  <Field label="Alcance"><input value={action.reach || ''} onChange={event => setAction(index, { reach: event.target.value })} placeholder="5 pies" /></Field>
                  <Field label="CD salvación"><input type="number" value={action.save_dc ?? ''} onChange={event => setAction(index, { save_dc: event.target.value })} /></Field>
                  <Field label="Salvación"><input value={action.save_ability || ''} onChange={event => setAction(index, { save_ability: event.target.value })} placeholder="DEX" /></Field>
                  <Field label="Recarga"><input value={action.recharge || ''} onChange={event => setAction(index, { recharge: event.target.value })} placeholder="5–6 / descanso" /></Field>
                  <Field label="Usos máximos"><input type="number" value={action.max_uses ?? ''} onChange={event => setAction(index, { max_uses: event.target.value })} /></Field>
                  <Field label="Descripción" wide><textarea value={action.description || ''} onChange={event => setAction(index, { description: event.target.value })} placeholder="Explicá cómo funciona y cuándo puede usarse…" /></Field>
                  <label className="npc-studio-check"><input type="checkbox" checked={!!action.is_public} onChange={event => setAction(index, { is_public: event.target.checked })} /> Visible para jugadores</label>
                </div>
              </article>)}
              {!form.npcActions.length && <div className="npc-studio-empty"><Swords size={28} /><strong>Este personaje aún no tiene acciones</strong><p>Agregá ataques, pasivas, reacciones o rasgos especiales.</p><button onClick={() => set('npcActions', [emptyAction()])}><Plus size={15} /> Crear primera acción</button></div>}
            </div>
          </section>

          <fieldset className="npc-studio-card">
            <legend><Shield size={18} /> Defensas</legend>
            <p className="npc-studio-card-help">Separá múltiples valores con comas.</p>
            <div className="npc-studio-form-grid is-two-columns">
              {[['Resistencias', 'damage_resistances'], ['Inmunidades de daño', 'damage_immunities'], ['Vulnerabilidades', 'damage_vulnerabilities'], ['Inmunidades de estado', 'condition_immunities']].map(([label, key]) => <Field key={key} label={label}><input value={form[key]} onChange={event => set(key, event.target.value)} placeholder="Ninguna" /></Field>)}
            </div>
          </fieldset>
        </div>}

        {tab === 'lore' && <div className="npc-studio-tab-panel">
          <fieldset className="npc-studio-card">
            <legend><BookOpen size={18} /> Presencia en el mundo</legend>
            <p className="npc-studio-card-help">Información descriptiva y de interpretación para dirigir al personaje.</p>
            <div className="npc-studio-form-grid is-two-columns">
              <Field label="Sentidos"><input value={form.senses} onChange={event => set('senses', event.target.value)} placeholder="Visión en la oscuridad 60 pies" /></Field>
              <Field label="Idiomas"><input value={form.languages} onChange={event => set('languages', event.target.value)} placeholder="Común, élfico…" /></Field>
              <Field label="Rasgos narrativos" wide hint="Personalidad, apariencia, motivaciones y vínculos; las habilidades jugables van en Combate."><textarea value={form.abilities_text} onChange={event => set('abilities_text', event.target.value)} placeholder="¿Quién es este personaje y cómo se comporta?" /></Field>
              <Field label="Notas privadas del DM" wide hint="Sólo para secretos, planes y recordatorios del director."><textarea value={form.notes} onChange={event => set('notes', event.target.value)} placeholder="Información que los jugadores no deben conocer…" /></Field>
              <Field label="URL de imagen" wide><input value={form.image_url} onChange={event => set('image_url', event.target.value)} placeholder="https://…" /></Field>
            </div>
          </fieldset>
        </div>}
      </div>
    </main>
  </div>;
}
