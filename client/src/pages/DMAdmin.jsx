import { useState, useEffect, useRef } from 'react';
import API_URL from '../config';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Upload, Send, Heart, Map as MapIcon, Shield, Scroll, Skull, Sword, UserPlus, Package, Plus, Dices, X, Image as ImageIcon, Eye } from 'lucide-react';
import { MapContainer, ImageOverlay, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const partyIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616412.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
});

export default function DMAdmin({ partyStats, sharedMedia, partyPosition, socket }) {
    const [activeTab, setActiveTab] = useState('dashboard');

    // Data States
    const [allItems, setAllItems] = useState([]);
    const [allPlayers, setAllPlayers] = useState([]);
    const [allQuests, setAllQuests] = useState([]);
    const [allNpcs, setAllNpcs] = useState([]);

    // Form States
    const [imageUrl, setImageUrl] = useState('');
    const [caption, setCaption] = useState('');
    const [npcForm, setNpcForm] = useState({ name: '', race: 'Monstruo', class: 'NPC', hp_max: 10, ac_base: 10 });
    const [questForm, setQuestForm] = useState({ title: '', description: '', rewards: '{}', targetId: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [itemFilter, setItemFilter] = useState('combate');
    const [randomLevel, setRandomLevel] = useState(1);
    const [foundRandomResult, setFoundRandomResult] = useState(null);
    const [editingCharacter, setEditingCharacter] = useState(null);
    const [showMapModal, setShowMapModal] = useState(false); // New Map Modal State
    const fileInputRef = useRef(null);

    useEffect(() => {
        // Initial Fetch
        socket.emit('get-all-players');

        socket.emit('get-all-items');
        socket.emit('get-all-qs');
        socket.emit('get-all-npcs');

        // Listeners
        socket.on('all-players', setAllPlayers);
        socket.on('all-items', setAllItems);
        socket.on('all-quests', setAllQuests); // This might need update if we want "all quests"
        socket.on('all-npcs', setAllNpcs);

        return () => {
            socket.off('all-players');
            socket.off('all-items');
            socket.off('all-quests');
            socket.off('all-npcs');
        };
    }, [socket]);

    const [isUploading, setIsUploading] = useState(false);

    const handleStopSharing = (e) => {
        e.preventDefault();
        socket.emit('stop-sharing-image');
    };

    const handleShare = (e) => {
        e.preventDefault();
        if (!imageUrl) return;
        socket.emit('share-image', { url: imageUrl, caption });
        setImageUrl('');
        setCaption('');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.url) {
                setImageUrl(data.url);
            }
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Falló la subida: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const updateHp = (characterId, newHp) => {
        socket.emit('update-hp', { characterId, newHp: parseInt(newHp) });
    };

    const updatePosition = (pos) => {
        socket.emit('update-position', pos);
    };

    const handleAssignItem = (itemId, characterId) => {
        if (!characterId) return;
        socket.emit('assign-item', { characterId, itemId });
    };

    const handleCreateNpc = (e) => {
        e.preventDefault();
        socket.emit('create-npc', npcForm);
        setNpcForm({ name: '', race: 'Monstruo', class: 'NPC', hp_max: 10, ac_base: 10 });
    };

    const handleCreateQuest = (e) => {
        e.preventDefault();
        if (!questForm.targetId) return;
        const rewards = JSON.parse(questForm.rewards || '{}');

        // Parse objectives
        const objectives = (questForm.objectivesText || '').split('\n').filter(line => line.trim() !== '').map((text, idx) => ({
            id: idx + 1,
            text: text.trim(),
            completed: false
        }));

        socket.emit('create-assign-quest', {
            characterId: questForm.targetId,
            title: questForm.title,
            description: questForm.description,
            rewards,
            objectives,
            level: randomLevel || 1
        });
        setQuestForm({ title: '', description: '', rewards: '{}', targetId: '', objectivesText: '' });
    };

    const tabs = [
        { id: 'dashboard', label: 'Control', icon: MapIcon },
        { id: 'items', label: 'Items', icon: Package },
        { id: 'quests', label: 'Misiones', icon: Scroll },
        { id: 'npcs', label: 'NPCs', icon: Skull },
    ];

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-xl gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-accent-gold italic">CONTROL MAESTRO</h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Gestión de Campaña v2.1</p>
                </div>

                <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id
                                ? 'bg-accent-gold text-slate-950 shadow-lg shadow-accent-gold/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="hidden md:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-accent-gold/10 border border-accent-gold/20">
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-neon animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-sm font-black text-accent-neon uppercase tracking-tighter">Sincronizado</span>
                </div>
            </header>

            <AnimatePresence>
                {editingCharacter && (
                    <CharacterEditorModal
                        character={editingCharacter}
                        onClose={() => setEditingCharacter(null)}
                        socket={socket}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {foundRandomResult && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setFoundRandomResult(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-900 border border-accent-gold/30 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative ring-1 ring-accent-gold/20"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6 text-center space-y-4">
                                <div className="absolute top-2 right-2">
                                    <button onClick={() => setFoundRandomResult(null)} className="p-1 rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="w-16 h-16 rounded-full bg-accent-gold/10 flex items-center justify-center mx-auto border border-accent-gold/30">
                                    <Dices className="w-8 h-8 text-accent-gold animate-bounce" />
                                </div>

                                {foundRandomResult.type === 'error' ? (
                                    <>
                                        <h3 className="text-xl font-black text-accent-crimson tracking-tight">¡Nada Encontrado!</h3>
                                        <p className="text-sm text-slate-400">{foundRandomResult.message}</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-accent-gold/70">
                                            {foundRandomResult.type === 'item' ? 'Item Random Hallado' : 'Misión Random Hallada'} (Lvl {randomLevel})
                                        </div>
                                        <h3 className="text-xl font-black text-white tracking-tight">{foundRandomResult.data.name || foundRandomResult.data.title}</h3>
                                        <p className="text-xs text-slate-400 italic line-clamp-3">"{foundRandomResult.data.description}"</p>

                                        {foundRandomResult.type === 'item' && (
                                            <div className="bg-slate-950 p-3 rounded-lg border border-white/5">
                                                <select
                                                    className="w-full bg-transparent text-xs outline-none text-slate-300"
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            handleAssignItem(foundRandomResult.data.id, e.target.value);
                                                            setFoundRandomResult(null);
                                                        }
                                                    }}
                                                >
                                                    <option value="">-- Asignar y Cerrar --</option>
                                                    {partyStats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {foundRandomResult.type === 'quest' && (
                                            <div className="bg-slate-950 p-3 rounded-lg border border-white/5">
                                                <select
                                                    className="w-full bg-transparent text-xs outline-none text-slate-300"
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            setQuestForm({
                                                                title: foundRandomResult.data.title,
                                                                description: foundRandomResult.data.description,
                                                                rewards: JSON.stringify(foundRandomResult.data.rewards || {}),
                                                                targetId: e.target.value
                                                            });
                                                            setFoundRandomResult(null);
                                                        }
                                                    }}
                                                >
                                                    <option value="">-- Cargar en Formulario --</option>
                                                    {partyStats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-6"
                    >

                        {/* Party Status Section */}
                        <section>
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Users className="text-accent-gold" size={18} /> Héroes y Aliados
                                </h2>
                                <button
                                    onClick={() => setShowMapModal(true)}
                                    className="bg-accent-gold text-slate-950 px-4 py-2 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-yellow-400 transition-all flex items-center gap-2"
                                >
                                    <MapIcon size={16} /> Abrir Mapa
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {partyStats.map(character => (
                                    <motion.div
                                        key={character.id}
                                        layoutId={character.id}
                                        onClick={() => setEditingCharacter(character)}
                                        className={`
                                            relative p-4 rounded-2xl border cursor-pointer group overflow-hidden transition-all
                                            ${character.hp <= character.maxHp * 0.2 ? 'bg-red-900/20 border-red-500/50' : 'bg-slate-900/50 border-white/5 hover:bg-white/10 hover:border-accent-gold/30'}
                                        `}
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full border-2 overflow-hidden ${character.hp <= 0 ? 'border-slat-700 grayscale' : 'border-accent-gold/50'}`}>
                                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${character.name}`} alt={character.name} className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <div className="font-black text-sm text-white group-hover:text-accent-gold transition-colors">{character.name}</div>
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase">{character.class} {character.level}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase">Percepción</div>
                                                <div className="text-sm font-black text-white">{character.passivePerception}</div>
                                            </div>
                                        </div>

                                        {/* Stats Row */}
                                        <div className="mt-4 grid grid-cols-3 gap-2 relative z-10">
                                            <div className="bg-slate-950/50 rounded p-1 text-center border border-white/5">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase">CA</div>
                                                <div className="text-xs font-black text-blue-400">{character.ac}</div>
                                            </div>
                                            <div className="bg-slate-950/50 rounded p-1 text-center border border-white/5">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase">Inic</div>
                                                <div className="text-xs font-black text-yellow-500">{character.initiative >= 0 ? '+' : ''}{character.initiative}</div>
                                            </div>
                                            <div className="bg-slate-950/50 rounded p-1 text-center border border-white/5">
                                                <div className="text-[9px] font-bold text-slate-500 uppercase">Vel</div>
                                                <div className="text-xs font-black text-green-500">{character.speed}</div>
                                            </div>
                                        </div>

                                        {/* HP Bar */}
                                        <div className="mt-4 relative z-10" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                                                <span className={character.hp <= character.maxHp * 0.2 ? 'text-red-500 animate-pulse' : 'text-slate-400'}>Puntos de Golpe</span>
                                                <span className="text-white">{character.hp} / {character.maxHp}</span>
                                            </div>
                                            <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                                                <motion.div
                                                    className={`h-full ${character.hp <= character.maxHp * 0.2 ? 'bg-red-500' : 'bg-green-500'}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(character.hp / character.maxHp) * 100}%` }}
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                defaultValue={character.hp}
                                                onBlur={(e) => updateHp(character.id, e.target.value)}
                                                className="w-full mt-2 bg-slate-950/50 border border-white/5 rounded px-2 py-1 text-xs font-bold text-center focus:border-accent-gold outline-none"
                                                placeholder="Modificar HP..."
                                            />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        {/* Media Gallery Section */}
                        <section className="glass-panel p-6 border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <ImageIcon className="text-accent-gold" size={18} /> Galería Multimedia
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Upload Form */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-500">URL de Imagen</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={imageUrl}
                                                onChange={e => setImageUrl(e.target.value)}
                                                className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold"
                                                placeholder="https://..."
                                            />
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="px-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-white transition-colors disabled:opacity-50"
                                                title="Subir desde PC"
                                            >
                                                {isUploading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload size={14} />}
                                            </button>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-500">Descripción</label>
                                        <input
                                            value={caption}
                                            onChange={e => setCaption(e.target.value)}
                                            className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold"
                                            placeholder="Ej: El Castillo Oscuro"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleShare}
                                            disabled={!imageUrl}
                                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Upload size={14} /> Subir y Mostrar
                                        </button>
                                        <button
                                            onClick={handleStopSharing}
                                            className="px-4 py-2 bg-red-900/50 hover:bg-red-600 border border-red-500/30 text-white rounded-lg flex items-center justify-center transition-colors"
                                            title="Dejar de Compartir (Ocultar a jugadores)"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Recent Images List */}
                                <div className="lg:col-span-2 space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Recientes (Clic para volver a mostrar)</label>
                                    <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                                        {sharedMedia.map((media, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => socket.emit('share-image', media)}
                                                className="min-w-[120px] w-[120px] h-[120px] relative rounded-xl overflow-hidden cursor-pointer group border border-white/10 hover:border-accent-gold"
                                            >
                                                <img src={media.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/80 p-1">
                                                    <p className="text-[9px] font-bold text-white truncate text-center">{media.caption || 'IMG'}</p>
                                                </div>
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                                    <Users className="text-accent-gold drop-shadow-lg" size={24} />
                                                </div>
                                            </div>
                                        ))}
                                        {sharedMedia.length === 0 && (
                                            <div className="flex items-center justify-center w-full text-[10px] text-slate-600 italic">No hay imágenes recientes.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                    </motion.div>
                )
                }

                {
                    activeTab === 'items' && (
                        <motion.div
                            key="items"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="grid grid-cols-1 gap-6"
                        >
                            <div className="glass-panel p-6">
                                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                                    <h2 className="text-xl font-black text-accent-gold uppercase tracking-widest">Items & Tesoros ({allItems.length})</h2>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex bg-slate-950/50 border border-white/10 rounded-lg p-1 items-center gap-2">
                                            <span className="text-[10px] font-black uppercase text-slate-500 pl-2">Lvl</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={randomLevel}
                                                onChange={e => setRandomLevel(parseInt(e.target.value))}
                                                className="w-12 bg-transparent text-center font-bold text-sm outline-none text-white border-l border-white/10"
                                            />
                                            <button
                                                onClick={() => {
                                                    const candidates = allItems.filter(i => (i.level || 1) === randomLevel);
                                                    if (candidates.length === 0) {
                                                        setFoundRandomResult({ type: 'error', message: `No hay items de nivel ${randomLevel}` });
                                                        return;
                                                    }
                                                    const winner = candidates[Math.floor(Math.random() * candidates.length)];
                                                    setFoundRandomResult({ type: 'item', data: winner });
                                                }}
                                                className="p-1.5 bg-accent-gold text-slate-950 rounded hover:bg-yellow-400 transition-colors"
                                                title="Generar Random"
                                            >
                                                <Dices className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <input
                                            type="text"
                                            placeholder="Buscar item..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="bg-slate-950/50 border border-white/10 px-4 py-2 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Item Category Tabs */}
                                <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 overflow-x-auto no-scrollbar gap-1 mb-6">
                                    {[
                                        { id: 'combate', label: 'Combate', icon: Sword },
                                        { id: 'magico', label: 'Mágico', icon: Send }, // Using Send as Sparkles replacement
                                        { id: 'consumible', label: 'Consumibles', icon: Heart },
                                        { id: 'otros', label: 'Otros', icon: Package }
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setItemFilter(f.id)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all
                                        ${itemFilter === f.id
                                                    ? 'bg-accent-gold text-slate-950 shadow-lg scale-100'
                                                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                                        >
                                            <f.icon className="w-4 h-4" />
                                            <span>{f.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {allItems
                                        .filter(item => {
                                            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
                                            const matchesType = (() => {
                                                switch (itemFilter) {
                                                    case 'combate': return ['Arma', 'Armadura'].includes(item.type);
                                                    case 'magico': return ['Artefacto', 'Objeto Mágico', 'Varita', 'Pergamino'].includes(item.type);
                                                    case 'consumible': return item.type === 'Consumible';
                                                    case 'otros': return !['Arma', 'Armadura', 'Consumible', 'Artefacto', 'Objeto Mágico', 'Varita', 'Pergamino'].includes(item.type);
                                                    default: return true;
                                                }
                                            })();
                                            return matchesSearch && matchesType;
                                        })
                                        .map(item => (
                                            <div key={item.id} className="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col justify-between gap-4">
                                                <div>
                                                    <div className="flex justify-between">
                                                        <h3 className="font-bold">{item.name}</h3>
                                                        <span className={`text-[10px] px-2 py-1 rounded bg-slate-950 border border-white/10 ${item.rarity === 'Legendario' ? 'text-accent-gold' : 'text-slate-400'}`}>{item.type}</span>
                                                    </div>
                                                    <div className="text-[9px] font-mono text-slate-600 mt-1 uppercase">Lvl {item.level || 1}</div>
                                                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">{item.description}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <select
                                                        className="bg-slate-950 text-xs py-2 px-2 rounded flex-1 border border-white/10"
                                                        onChange={(e) => {
                                                            if (e.target.value) handleAssignItem(item.id, e.target.value);
                                                            e.target.value = ''; // Reset
                                                        }}
                                                    >
                                                        <option value="">-- Asignar a... --</option>
                                                        {partyStats.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </motion.div>
                    )
                }

                {
                    activeTab === 'quests' && (
                        <motion.div
                            key="quests"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                        >
                            <div className="glass-panel p-6 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-black text-accent-gold uppercase tracking-widest">Nueva Misión</h2>
                                    <div className="flex bg-slate-950/50 border border-white/10 rounded-lg p-1 items-center gap-2">
                                        <span className="text-[10px] font-black uppercase text-slate-500 pl-2">Lvl</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={randomLevel}
                                            onChange={e => setRandomLevel(parseInt(e.target.value))}
                                            className="w-8 bg-transparent text-center font-bold text-sm outline-none text-white border-l border-white/10"
                                        />
                                        <button
                                            onClick={() => {
                                                const candidates = allQuests.filter(q => (q.level || 1) === randomLevel);
                                                if (candidates.length === 0) {
                                                    setFoundRandomResult({ type: 'error', message: `No hay misiones de nivel ${randomLevel}` });
                                                    return;
                                                }
                                                const winner = candidates[Math.floor(Math.random() * candidates.length)];
                                                setFoundRandomResult({ type: 'quest', data: winner });
                                            }}
                                            className="p-1.5 bg-accent-gold text-slate-950 rounded hover:bg-yellow-400 transition-colors"
                                            title="Generar Random"
                                        >
                                            <Dices className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <form onSubmit={handleCreateQuest} className="space-y-4">
                                    <input
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-sm"
                                        placeholder="Título de la Misión"
                                        value={questForm.title}
                                        onChange={e => setQuestForm({ ...questForm, title: e.target.value })}
                                        required
                                    />
                                    <textarea
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-sm h-24"
                                        placeholder="Descripción de la tarea..."
                                        value={questForm.description}
                                        onChange={e => setQuestForm({ ...questForm, description: e.target.value })}
                                    />

                                    {/* Objectives Input */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Objetivos (Uno por línea)</label>
                                        <textarea
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-sm h-20"
                                            placeholder="Matar al Rey Rata&#10;Volver a la taberna"
                                            value={questForm.objectivesText || ''}
                                            onChange={e => setQuestForm({ ...questForm, objectivesText: e.target.value })}
                                        />
                                    </div>

                                    <select
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-sm font-bold text-accent-gold"
                                        value={questForm.targetId}
                                        onChange={e => setQuestForm({ ...questForm, targetId: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar Asignación...</option>
                                        <option value="party" className="text-accent-neon font-black">⚔️ PARTY COMPLETA</option>
                                        <option disabled>──────────────</option>
                                        {partyStats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <button className="w-full py-3 bg-accent-gold text-slate-950 font-bold rounded-lg uppercase tracking-wide text-xs shadow-lg shadow-accent-gold/20 hover:bg-yellow-400 transition-all">
                                        Asignar Misión
                                    </button>
                                </form>
                            </div>

                            <div className="lg:col-span-2 glass-panel p-6">
                                <h2 className="text-lg font-black text-white uppercase tracking-widest mb-4">Misiones Activas</h2>
                                <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                                    {allQuests.filter(q => q.status !== 'Completada').map(q => (
                                        <div key={q.id} className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-accent-gold text-sm uppercase tracking-wide flex items-center gap-2">
                                                        {q.title}
                                                        <span className="text-[9px] bg-slate-950 px-1.5 py-0.5 rounded text-slate-400">Lvl {q.level || 1}</span>
                                                    </h4>
                                                    <p className="text-xs text-slate-400 mt-1">{q.description}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[9px] font-bold uppercase block text-slate-500">Asignada a</span>
                                                    <span className="text-xs font-bold text-white">{q.Character?.name || 'Desconocido'}</span>
                                                </div>
                                            </div>

                                            {/* Objectives List */}
                                            {q.objectives && q.objectives.length > 0 && (
                                                <div className="bg-slate-950/50 rounded-lg p-2 space-y-1">
                                                    {q.objectives.map((obj, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                                            <input
                                                                type="checkbox"
                                                                checked={obj.completed}
                                                                onChange={(e) => {
                                                                    socket.emit('update-quest-progress', {
                                                                        questId: q.id,
                                                                        objectiveId: obj.id,
                                                                        completed: e.target.checked
                                                                    });
                                                                }}
                                                                className="accent-accent-neon w-3 h-3 cursor-pointer"
                                                            />
                                                            <span className={obj.completed ? 'opacity-50 line-through text-slate-500' : 'text-slate-300'}>
                                                                {obj.text}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex justify-end pt-2 border-t border-white/5">
                                                <button
                                                    onClick={() => {
                                                        if (confirm('¿Marcar misión como completada?')) {
                                                            socket.emit('update-quest-progress', { questId: q.id, isQuestComplete: true });
                                                        }
                                                    }}
                                                    className="text-[10px] font-bold uppercase tracking-widest text-accent-neon hover:text-white flex items-center gap-1 transition-colors"
                                                >
                                                    <Shield className="w-3 h-3" /> Completar Misión
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )
                }

                {
                    activeTab === 'npcs' && (
                        <motion.div
                            key="npcs"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                        >
                            <div className="glass-panel p-6 space-y-6">
                                <h2 className="text-lg font-black text-accent-gold uppercase tracking-widest">Crear NPC</h2>
                                <form onSubmit={handleCreateNpc} className="space-y-4">
                                    <input className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-sm" placeholder="Nombre" value={npcForm.name} onChange={e => setNpcForm({ ...npcForm, name: e.target.value })} required />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-sm" placeholder="Raza" value={npcForm.race} onChange={e => setNpcForm({ ...npcForm, race: e.target.value })} />
                                        <input className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-sm" placeholder="Clase/Tipo" value={npcForm.class} onChange={e => setNpcForm({ ...npcForm, class: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="number" className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-sm" placeholder="HP Max" value={npcForm.hp_max} onChange={e => setNpcForm({ ...npcForm, hp_max: e.target.value })} />
                                        <input type="number" className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-sm" placeholder="CA Base" value={npcForm.ac_base} onChange={e => setNpcForm({ ...npcForm, ac_base: e.target.value })} />
                                    </div>
                                    <button className="w-full py-3 bg-accent-crimson text-white font-bold rounded-lg uppercase tracking-wide text-xs">Generar NPC</button>
                                </form>
                            </div>
                            <div className="lg:col-span-2 glass-panel p-6">
                                <h2 className="text-lg font-black text-white uppercase tracking-widest mb-4">Directorio de NPCs</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {allNpcs.map(npc => (
                                        <div key={npc.id} className="bg-white/5 border border-white/5 p-4 rounded-xl relative group hover:bg-white/10 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-lg">{npc.name}</h4>
                                                    <p className="text-xs text-accent-gold/70 font-bold uppercase">{npc.race} • {npc.class}</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-accent-crimson flex items-center gap-1 justify-end">
                                                        <Heart className="w-3 h-3" /> {npc.hp_current}/{npc.hp_max}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-bold mt-1">AC {npc.ac_base}</div>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                                                <input
                                                    type="number"
                                                    className="w-20 bg-slate-950/50 border border-white/10 rounded px-2 py-1 text-xs"
                                                    defaultValue={npc.hp_current}
                                                    onBlur={(e) => updateHp(npc.id, e.target.value)}
                                                />
                                                <button className="text-[10px] uppercase font-bold text-slate-400 hover:text-white ml-auto">Editar</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )
                }
            </AnimatePresence >
        </div >
    );
}

function MapComponent({ partyPosition, onPositionChange }) {
    const bounds = [[0, 0], [100, 100]];

    function LocationSelector() {
        useMapEvents({
            click(e) {
                onPositionChange({ x: e.latlng.lng, y: e.latlng.lat });
            },
        });
        return null;
    }

    function RecenterMap({ pos }) {
        const map = useMap();
        useEffect(() => {
            map.panTo([pos.y, pos.x]);
        }, [pos]);
        return null;
    }

    return (
        <MapContainer
            crs={L.CRS.Simple}
            bounds={bounds}
            className="h-full w-full"
            zoom={2}
            minZoom={1}
            maxZoom={4}
        >
            <ImageOverlay url="/map.jpg" bounds={bounds} />
            <Marker position={[partyPosition.y, partyPosition.x]} icon={partyIcon} />
            <LocationSelector />
            <RecenterMap pos={partyPosition} />
        </MapContainer>
    );
}

function CharacterEditorModal({ character, onClose, socket }) {
    const [form, setForm] = useState({
        name: character.name,
        race: character.race,
        class: character.class,
        level: character.level,
        hp_current: character.hp,
        hp_max: character.maxHp || character.hp,
        ac_base: character.ac || 10,
        speed: parseInt(character.speed) || 30,
        abilityScores: character.attributes || character.stats || { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }
    });

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleStatChange = (stat, value) => {
        setForm(prev => ({
            ...prev,
            abilityScores: { ...prev.abilityScores, [stat]: parseInt(value) }
        }));
    };

    const handleSave = () => {
        socket.emit('update-character-full', {
            characterId: character.id,
            diff: form
        });
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900 border border-accent-gold/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                    <h2 className="text-xl font-black text-accent-gold uppercase tracking-widest flex items-center gap-2">
                        <UserPlus className="w-5 h-5" /> Editor de Personaje
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Nombre</label>
                            <input value={form.name} onChange={e => handleChange('name', e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 font-bold text-white" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">Raza</label>
                                <input value={form.race} onChange={e => handleChange('race', e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">Clase</label>
                                <input value={form.class} onChange={e => handleChange('class', e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">Nivel</label>
                                <input type="number" value={form.level} onChange={e => handleChange('level', e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-accent-gold" />
                            </div>
                        </div>
                    </div>

                    {/* Vitals */}
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Signos Vitales</h3>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-accent-crimson">HP Actual</label>
                                <input type="number" value={form.hp_current} onChange={e => handleChange('hp_current', e.target.value)} className="w-full bg-slate-950 border border-accent-crimson/30 rounded-lg px-3 py-2 text-sm font-black text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-slate-500">HP Máx</label>
                                <input type="number" value={form.hp_max} onChange={e => handleChange('hp_max', e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-blue-400">Clase Armadura</label>
                                <input type="number" value={form.ac_base} onChange={e => handleChange('ac_base', e.target.value)} className="w-full bg-slate-950 border border-blue-500/30 rounded-lg px-3 py-2 text-sm font-black text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-yellow-400">Velocidad</label>
                                <input type="number" value={form.speed} onChange={e => handleChange('speed', e.target.value)} className="w-full bg-slate-950 border border-yellow-500/30 rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Ability Scores */}
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Atributos Base</h3>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                            {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => (
                                <div key={stat} className="bg-slate-950 p-2 rounded-lg border border-white/10 text-center space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 block">{stat}</label>
                                    <input
                                        type="number"
                                        value={form.abilityScores[stat.toLowerCase()] || form.abilityScores[stat] || 10}
                                        onChange={e => {
                                            // Handle both cases locally to be safe, though usually lower in frontend state
                                            const val = e.target.value;
                                            const key = Object.keys(form.abilityScores).find(k => k.toUpperCase() === stat) || stat.toLowerCase();
                                            handleStatChange(key, val);
                                        }}
                                        className="w-full bg-transparent text-center font-black text-xl outline-none focus:text-accent-gold"
                                    />
                                    <div className="text-[9px] text-slate-600 font-bold uppercase">
                                        Mod: {Math.floor(((form.abilityScores[stat.toLowerCase()] || form.abilityScores[stat] || 10) - 10) / 2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-slate-950/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Cancelar</button>
                    <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-accent-gold text-slate-950 text-xs font-black uppercase tracking-wider hover:bg-yellow-400 shadow-lg shadow-accent-gold/20 transition-all">Guardar Cambios</button>
                </div>
            </motion.div>
        </motion.div>
    );
}
