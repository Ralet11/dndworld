import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Briefcase, Sparkles, Dices, Map as MapIcon,
    Navigation, Crosshair, Scroll, Sword, Target, Link as LinkIcon,
    ShieldCheck, Heart, Zap, Waves, Activity, Shield, Image as ImageIcon,
    X, ChevronRight, LogOut, BookOpen, Upload
} from 'lucide-react';
import API_URL from '../config';
import { MapContainer, ImageOverlay, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with React
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
    popupAnchor: [0, -32],
});

export default function PlayerBoard({ sharedMedia = [], character, partyPosition = { x: 50, y: 50 }, socket, onLogout }) {
    const [activeTab, setActiveTab] = useState('stats');
    const [showDice, setShowDice] = useState(false);
    const [lastRoll, setLastRoll] = useState(null);
    const [notification, setNotification] = useState(null);
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

    useEffect(() => {
        if (socket) {
            socket.on('notification', (data) => {
                setNotification(data);
                // Auto-clear simple notifications, keep complex ones (like quest completion) until clicked? 
                // For now, auto-clear after 5s for all to avoid getting stuck
                setTimeout(() => setNotification(null), 5000);
            });
        }
        return () => {
            if (socket) socket.off('notification');
        };
    }, [socket]);

    if (!character) return (
        <div className="flex flex-col items-center justify-center h-screen space-y-4">
            <div className="w-12 h-12 border-4 border-accent-gold border-t-transparent rounded-full animate-spin"></div>
            <p className="text-accent-gold font-bold animate-pulse">Sincronizando con el DM...</p>
        </div>
    );

    const rollDice = (sides) => {
        const result = Math.floor(Math.random() * sides) + 1;
        setLastRoll({ sides, result });
        setShowDice(true);
        setTimeout(() => setShowDice(false), 3000);
    };

    return (
        <div className="min-h-screen bg-background text-slate-100 pb-24 overflow-x-hidden flex flex-col">
            {/* Sticky Header */}
            <header className="sticky top-0 z-30 glass-panel !rounded-t-none border-x-0 border-t-0 p-4 pb-3 bg-slate-900/90 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="relative shrink-0 group cursor-pointer" onClick={() => setIsAvatarModalOpen(true)}>
                        <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-accent-gold overflow-hidden relative">
                            {character.image_url ? (
                                <img
                                    src={character.image_url}
                                    alt="Portrait"
                                    className="w-full h-full object-cover transition-transform duration-300"
                                    style={{
                                        transform: `scale(${character.image_scale || 1}) translate(${character.image_offset_x || 0}%, ${character.image_offset_y || 0}%)`
                                    }}
                                />
                            ) : (
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${character.name || 'default'}`} alt="Portrait" />
                            )}

                            {/* Overlay on hover */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <ImageIcon size={14} className="text-white" />
                            </div>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onLogout(); }}
                            className="absolute -bottom-1 -right-1 bg-slate-800 text-slate-400 p-1 rounded-full border border-white/10 hover:bg-slate-700 hover:text-white transition-colors z-10"
                        >
                            <LogOut size={10} />
                        </button>
                    </div>

                    <AnimatePresence>
                        {isAvatarModalOpen && (
                            <AvatarEditorModal
                                character={character}
                                isOpen={isAvatarModalOpen}
                                onClose={() => setIsAvatarModalOpen(false)}
                                socket={socket}
                            />
                        )}
                    </AnimatePresence>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-bold text-lg truncate tracking-tight">{character.name || 'Viajero'}</h1>
                        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-accent-gold/70 truncate">
                            {character.race} {character.class}
                        </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                        <div className="text-xl font-black text-accent-crimson flex items-center gap-1 leading-none mb-1">
                            <span className="text-[10px] opacity-50 uppercase">HP</span> {character.hp || 0}<span className="text-sm opacity-30">/{character.maxHp || 0}</span>
                        </div>
                        <div className="stat-bar-container w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="stat-bar-fill h-full bg-accent-crimson shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-all duration-500" style={{ width: `${Math.min(100, ((character.hp || 0) / (character.maxHp || 1)) * 100)}%` }} />
                        </div>
                    </div>
                </div>
            </header >

            {/* Content Area */}
            < main className={`flex-1 ${activeTab === 'map' ? 'p-0' : 'p-4'} max-w-lg mx-auto w-full`
            }>
                <AnimatePresence mode="wait">
                    {activeTab === 'stats' && <StatsTab key="stats" character={character} rollDice={rollDice} socket={socket} />}
                    {activeTab === 'eq' && <EquipmentTab key="eq" equipment={character.equipment || {}} characterId={character.id} socket={socket} />}
                    {activeTab === 'inv' && <InventoryTab key="inv" inventory={character.inventory || []} characterId={character.id} socket={socket} equipment={character.equipment} />}
                    {activeTab === 'abilities' && <AbilitiesTab key="abilities" characterId={character.id} initialText={character.abilities_text} socket={socket} />}
                    {activeTab === 'quests' && <QuestsTab key="quests" quests={character.quests || []} />}
                    {activeTab === 'allies' && <AlliesTab key="allies" characterId={character.id} socket={socket} />}
                    {activeTab === 'gallery' && <GalleryTab key="gallery" sharedMedia={sharedMedia} />}
                    {activeTab === 'map' && <MapTab key="map" partyPosition={partyPosition} />}
                </AnimatePresence>
            </main >

            {/* Notification Overlay */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -50, scale: 0.9 }}
                        className="fixed top-24 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none"
                    >
                        <div className={`
                            pointer-events-auto max-w-sm w-full shadow-2xl rounded-2xl p-6 border backdrop-blur-md relative overflow-hidden
                            ${notification.type === 'quest_success'
                                ? 'bg-slate-900/95 border-accent-gold ring-2 ring-accent-gold/50'
                                : notification.type === 'objective_success'
                                    ? 'bg-slate-900/95 border-accent-neon ring-1 ring-accent-neon/50'
                                    : notification.type === 'new_quest'
                                        ? 'bg-slate-900/95 border-blue-500 ring-2 ring-blue-500/50'
                                        : 'bg-slate-900/90 border-white/10'}
                        `}>
                            {/* Background decoration */}
                            <div className="absolute top-0 right-0 p-10 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

                            <button onClick={() => setNotification(null)} className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white"><X size={14} /></button>

                            <div className="flex flex-col items-center text-center gap-3">
                                {notification.type === 'quest_success' && (
                                    <div className="w-12 h-12 rounded-full bg-accent-gold/20 flex items-center justify-center text-accent-gold animate-bounce">
                                        <ShieldCheck size={24} />
                                    </div>
                                )}
                                {notification.type === 'objective_success' && (
                                    <div className="w-10 h-10 rounded-full bg-accent-neon/20 flex items-center justify-center text-accent-neon">
                                        <Target size={20} />
                                    </div>
                                )}
                                {notification.type === 'new_quest' && (
                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 animate-pulse">
                                        <Scroll size={24} />
                                    </div>
                                )}

                                <div>
                                    {notification.type === 'quest_success' && (
                                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-gold mb-1">Misión Completada</div>
                                    )}
                                    {notification.type === 'objective_success' && (
                                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-neon mb-1">Objetivo Cumplido</div>
                                    )}
                                    {notification.type === 'new_quest' && (
                                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-1">Nueva Misión</div>
                                    )}
                                    <div className="text-lg font-bold text-white leading-tight">
                                        {notification.text}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dice Result Overlay */}
            <AnimatePresence>
                {showDice && lastRoll && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: -50 }}
                        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-6"
                    >
                        <div className="glass-panel p-8 flex flex-col items-center bg-accent-gold/30 border-accent-gold shadow-[0_0_60px_rgba(250,204,21,0.4)] ring-4 ring-accent-gold/10">
                            <Dices className="text-accent-gold w-14 h-14 mb-3 animate-bounce" />
                            <div className="text-xs uppercase font-black tracking-[0.3em] text-accent-gold/70 mb-1">Realidad d{lastRoll.sides}</div>
                            <div className="text-7xl font-black text-white drop-shadow-2xl">{lastRoll.result}</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence >

            {/* Bottom Navigation */}
            < nav className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-6 pt-2 h-20 bg-gradient-to-t from-background via-background to-transparent pointer-events-none" >
                <div className="glass-panel h-full flex items-center justify-around px-1 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-white/5 bg-slate-900/80 pointer-events-auto overflow-x-auto no-scrollbar">
                    <NavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<User size={18} />} label="Ficha" />
                    <NavButton active={activeTab === 'eq'} onClick={() => setActiveTab('eq')} icon={<ShieldCheck size={18} />} label="Equipo" />
                    <NavButton active={activeTab === 'inv'} onClick={() => setActiveTab('inv')} icon={<Briefcase size={18} />} label="Items" />
                    <NavButton active={activeTab === 'quests'} onClick={() => setActiveTab('quests')} icon={<Scroll size={18} />} label="Misiones" />
                    <NavButton active={activeTab === 'allies'} onClick={() => setActiveTab('allies')} icon={<User size={18} />} label="Aliados" /> {/* Added Allies Button */}
                    <NavButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<MapIcon size={18} />} label="Mapa" />
                    <NavButton active={activeTab === 'abilities'} onClick={() => setActiveTab('abilities')} icon={<BookOpen size={18} />} label="Habilidades" />
                    <NavButton active={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} icon={<ImageIcon size={18} />} label="Galería" />
                </div>
            </nav >
        </div >
    );
}

function NavButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-1 transition-all duration-300 min-w-[56px] ${active ? 'text-accent-gold scale-110' : 'text-slate-500 hover:text-slate-300'}`}
        >
            <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-accent-gold/20' : ''}`}>
                {icon}
            </div>
            <span className="text-[8px] font-black uppercase tracking-tighter truncate w-full text-center">{label}</span>
        </button>
    );
}

function StatsTab({ character, rollDice, socket }) {
    const attributes = character.stats || character.attributes || {};
    const saves = character.savingThrows || {};

    const handleToggleSkill = (skillName) => {
        if (socket) {
            socket.emit('toggle-skill-proficiency', { characterId: character.id, skillName });
        }
    };

    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-5">
            {/* Header Vitals - Keep compact */}
            <div className="grid grid-cols-4 gap-2">
                <MetricCard small label="CA" value={character.ac || 10} icon={<Shield size={12} />} color="text-blue-400" />
                <MetricCard small label="INIC" value={(character.initiative || 0) >= 0 ? `+${character.initiative || 0}` : character.initiative} icon={<Zap size={12} />} color="text-accent-gold" />
                <MetricCard small label="VEL" value={`${character.speed || 30}'`} icon={<Waves size={12} />} color="text-white" />
                <MetricCard small label="PROF" value={`+${character.proficiencyBonus || 2}`} icon={<Target size={12} />} color="text-accent-neon" />
            </div>

            {/* Main Attributes - The Focus */}
            <div className="grid grid-cols-2 gap-3">
                {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((attr) => {
                    const val = attributes[attr] || 10;
                    const mod = Math.floor((val - 10) / 2);
                    const labelMap = { str: 'FUERZA', dex: 'DESTREZA', con: 'CONSTITUCIÓN', int: 'INTELIGENCIA', wis: 'SABIDURÍA', cha: 'CARISMA' };

                    return (
                        <motion.div
                            key={attr}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => rollDice(20)}
                            className="glass-panel p-4 relative overflow-hidden group hover:bg-white/5 cursor-pointer border-white/10 active:border-accent-gold/50 transition-colors"
                        >
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{labelMap[attr]}</div>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-4xl font-black tracking-tighter ${mod >= 0 ? 'text-white' : 'text-accent-crimson'}`}>
                                    {mod >= 0 ? `+${mod}` : mod}
                                </span>
                            </div>
                            <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-slate-950/50 border border-white/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-slate-400">{val}</span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Proficiencies & Skills Section */}
            <div className="glass-panel p-4 space-y-4 bg-slate-900/40">
                {/* Compact Saving Throws */}
                <div className="space-y-2">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                        <ShieldCheck size={10} /> Salvaciones
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(saves).map(([key, data]) => (
                            <div
                                key={key}
                                onClick={(e) => { e.stopPropagation(); rollDice(20); }}
                                className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold border flex items-center gap-1 cursor-pointer transition-colors
                                ${data.proficient
                                        ? 'bg-accent-crimson/10 border-accent-crimson/30 text-accent-crimson hover:bg-accent-crimson/20'
                                        : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}
                            >
                                <span>{key}</span>
                                <span className={data.proficient ? 'text-white' : ''}>{data.mod >= 0 ? `+${data.mod}` : data.mod}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full h-px bg-white/5" />

                {/* Skills List */}
                <div className="space-y-1">
                    <div className="flex justify-between items-end mb-2">
                        <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                            <Sparkles size={10} /> Habilidades
                        </h3>
                        <div className="text-[9px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded">
                            PERCEPCIÓN PASIVA: <span className="text-white font-bold">{character.passivePerception || 10}</span>
                        </div>
                    </div>

                    <div className="space-y-0.5 max-h-[300px] overflow-y-auto pr-3 custom-scrollbar">
                        {(character.skills || []).map((skill, i) => (
                            <div key={i} className="flex justify-between items-center py-2 px-1 hover:bg-white/5 rounded cursor-pointer group transition-colors" onClick={() => rollDice(20)}>
                                <div className="flex items-center gap-2">
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleSkill(skill.name);
                                        }}
                                        className={`w-3 h-3 rounded-full border-2 border-transparent transition-all cursor-pointer hover:scale-125
                                        ${skill.proficient
                                                ? 'bg-accent-neon shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                                : 'bg-slate-800 hover:border-slate-500'}`}
                                        title="Click to toggle Proficiency"
                                    />
                                    <span className={`text-xs font-bold tracking-tight ${skill.proficient ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                                        {skill.name} <span className="text-[9px] text-slate-600 font-normal ml-1 uppercase">{skill.attr || ''}</span>
                                    </span>
                                </div>
                                <span className={`text-xs font-black ${skill.proficient ? 'text-accent-neon' : 'text-slate-600 group-hover:text-slate-500'}`}>
                                    {skill.bonus >= 0 ? `+${skill.bonus}` : skill.bonus}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function QuestsTab({ quests }) {
    const [selectedQuest, setSelectedQuest] = useState(null);

    const getTypeColor = (type) => {
        switch (type.toLowerCase()) {
            case 'epica': return 'text-accent-gold border-accent-gold';
            case 'personal': return 'text-accent-crimson border-accent-crimson';
            case 'cadena': return 'text-accent-neon border-accent-neon';
            default: return 'text-blue-400 border-blue-400';
        }
    };

    const getQuestIcon = (type) => {
        switch (type.toLowerCase()) {
            case 'epica': return <Sword size={16} />;
            case 'personal': return <Target size={16} />;
            case 'cadena': return <LinkIcon size={16} />;
            default: return <Scroll size={16} />;
        }
    };

    return (
        <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                {quests.map((quest) => (
                    <div
                        key={quest.id}
                        onClick={() => setSelectedQuest(quest)}
                        className="glass-panel p-4 space-y-3 relative overflow-hidden group hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.98]"
                    >
                        <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 opacity-5 group-hover:opacity-10 transition-opacity`}>
                            {getQuestIcon(quest.type)}
                        </div>

                        <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                                <div className={`inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getTypeColor(quest.type)} bg-black/20`}>
                                    {getQuestIcon(quest.type)}
                                    {quest.type}
                                </div>
                                <h4 className="font-bold text-slate-100 tracking-tight">{quest.title}</h4>
                            </div>
                            <div className={`text-[10px] font-black uppercase tracking-widest ${quest.status === 'completada' ? 'text-accent-neon' : quest.status === 'bloqueada' ? 'text-slate-600' : 'text-accent-gold'}`}>
                                {quest.status}
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed italic border-l-2 border-white/5 pl-3 line-clamp-2">
                            "{quest.description}"
                        </p>
                    </div>
                ))}
                {quests.length === 0 && (
                    <div className="py-20 text-center opacity-30 italic text-sm">No hay misiones activas en tu bitácora...</div>
                )}
            </motion.div>

            {/* Quest Details Modal */}
            <AnimatePresence>
                {selectedQuest && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        onClick={() => setSelectedQuest(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-0 right-0 p-4 z-10">
                                <button onClick={() => setSelectedQuest(null)} className="p-2 rounded-full bg-black/20 text-white hover:bg-white/10">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="space-y-2">
                                    <div className={`inline-flex items-center gap-1.5 border px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getTypeColor(selectedQuest.type)} bg-black/20`}>
                                        {getQuestIcon(selectedQuest.type)}
                                        {selectedQuest.type}
                                    </div>
                                    <h2 className="text-2xl font-black text-white tracking-tight leading-none">{selectedQuest.title}</h2>
                                    <div className={`text-xs font-bold uppercase tracking-widest ${selectedQuest.status === 'completada' ? 'text-accent-neon' : 'text-accent-gold'}`}>
                                        Status: {selectedQuest.status}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 italic text-slate-300 text-sm leading-relaxed">
                                        "{selectedQuest.description}"
                                    </div>

                                    {selectedQuest.objectives && (
                                        <div className="space-y-2">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Objetivos</h3>
                                            <div className="space-y-1">
                                                {selectedQuest.objectives.map((obj, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                        <ChevronRight size={14} className="mt-1 text-accent-gold" />
                                                        <span>{obj}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedQuest.rewards && (
                                        <div className="space-y-2">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recompensas</h3>
                                            <div className="flex gap-2 flex-wrap">
                                                {Array.isArray(selectedQuest.rewards) ? (
                                                    selectedQuest.rewards.map((reward, i) => (
                                                        <div key={i} className="px-2 py-1 bg-accent-gold/10 border border-accent-gold/20 rounded text-[10px] font-bold text-accent-gold uppercase tracking-wider">
                                                            {typeof reward === 'object' ? JSON.stringify(reward) : reward}
                                                        </div>
                                                    ))
                                                ) : typeof selectedQuest.rewards === 'string' ? (
                                                    <div className="px-2 py-1 bg-accent-gold/10 border border-accent-gold/20 rounded text-[10px] font-bold text-accent-gold uppercase tracking-wider">
                                                        {selectedQuest.rewards}
                                                    </div>
                                                ) : (
                                                    <div className="px-2 py-1 bg-accent-gold/10 border border-accent-gold/20 rounded text-[10px] font-bold text-accent-gold uppercase tracking-wider">
                                                        {/* Fallback for objects */}
                                                        {JSON.stringify(selectedQuest.rewards)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function MapTab({ partyPosition }) {
    const bounds = [[0, 0], [100, 100]];
    const locations = [
        { name: 'Prontera', pos: [65, 25], desc: 'La gran ciudadela puerto sobre el acantilado.' },
        { name: 'Bosque de acero', pos: [75, 55], desc: 'Un bosque mecánico donde los árboles son de metal y engranajes.' },
        { name: 'Pantano Hachoverde', pos: [50, 40], desc: 'Un humedal denso y ponzoñoso bajo la sombra de Prontera.' },
        { name: 'Costa Oscura', pos: [35, 20], desc: 'Puerto caído en desgracia, ahora una ruina reclamada por restos de barcos.' },
        { name: 'Campamento Faucepiedra', pos: [50, 75], desc: 'Asentamiento minero en el corazón de un cráter volcánico.' },
        { name: 'Paso de Thanemor', pos: [85, 85], desc: 'Cruento paso de montaña perpetuamente cubierto de nieve.' },
        { name: 'Brisamar', pos: [15, 60], desc: 'Puerto fantasma del sur, envuelto en una niebla eterna.' },
    ];

    function RecenterMap({ pos }) {
        const map = useMap();
        useEffect(() => {
            map.setView([pos.y, pos.x], map.getZoom());
        }, [pos]);
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-[calc(100vh-250px)] w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative"
        >
            <MapContainer
                crs={L.CRS.Simple}
                bounds={bounds}
                className="h-full w-full bg-slate-950"
                zoom={2}
                minZoom={1}
                maxZoom={4}
            >
                <ImageOverlay url="/map.jpg" bounds={bounds} />
                {locations.map((loc, i) => (
                    <Marker key={i} position={loc.pos}>
                        <Popup>
                            <div className="p-1">
                                <h4 className="font-bold text-slate-900 border-b mb-1">{loc.name}</h4>
                                <p className="text-xs text-slate-600 italic">{loc.desc}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
                <Marker position={[partyPosition.y, partyPosition.x]} icon={partyIcon}>
                    <Popup className="party-popup">
                        <div className="p-2 flex items-center gap-2">
                            <Navigation className="text-accent-gold w-4 h-4" />
                            <span className="font-black text-sm uppercase tracking-wider text-slate-950">Tu Grupo Aquí</span>
                        </div>
                    </Popup>
                </Marker>
                <RecenterMap pos={partyPosition} />
            </MapContainer>
            <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
                <div className="glass-panel p-3 bg-slate-900/60 backdrop-blur-md flex items-center gap-2 border-white/10">
                    <Crosshair className="text-accent-gold w-4 h-4 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sincronizado</span>
                </div>
            </div>
        </motion.div>
    );
}

function EquipmentTab({ equipment, characterId, socket }) {
    const [selectedItem, setSelectedItem] = useState(null);

    if (!equipment) return <div className="p-4 text-center text-slate-500">Sin equipo</div>;

    const slots = [
        { key: 'helmet', label: 'Cabeza', icon: <User size={18} /> },
        { key: 'chest', label: 'Torso', icon: <ShieldCheck size={18} /> },
        { key: 'primary_weapon', label: 'Mano P.', icon: <Sword size={18} /> },
        { key: 'secondary_weapon', label: 'Mano S.', icon: <ShieldCheck size={18} /> },
        { key: 'shoulders', label: 'Hombros', icon: <Zap size={18} /> },
        { key: 'gloves', label: 'Manos', icon: <Activity size={18} /> },
        { key: 'boots', label: 'Pies', icon: <Navigation size={18} /> },
        { key: 'back', label: 'Espalda', icon: <Shield size={18} /> },
        { key: 'ring_1', label: 'Anillo 1', icon: <Sparkles size={18} /> },
        { key: 'ring_2', label: 'Anillo 2', icon: <Sparkles size={18} /> },
    ];

    const handleUnequip = (slotKey) => {
        if (socket) {
            socket.emit('unequip-item', { characterId, slot: slotKey });
            setSelectedItem(null);
        }
    };

    return (
        <>
            <div className="grid grid-cols-2 gap-3 p-2">
                {slots.map(({ key, label, icon }) => {
                    const item = equipment[key];
                    return (
                        <div
                            key={key}
                            onClick={() => item && setSelectedItem({ ...item, slotKey: key })}
                            className={`glass-panel p-3 flex flex-col items-center justify-center min-h-[100px] text-center relative group transition-all duration-300
                            ${item ? 'cursor-pointer hover:bg-white/5 border-accent-gold/20 hover:border-accent-gold/50' : 'opacity-60'}`}
                        >
                            <div className={`text-accent-gold mb-2 ${item ? 'opacity-100 scale-110' : 'opacity-30'}`}>{icon}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">{label}</div>
                            {item ? (
                                <>
                                    <div className="text-sm font-bold text-white leading-tight line-clamp-2 px-1">{item.name}</div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUnequip(key);
                                        }}
                                        className="absolute top-1 right-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-full p-1 opacity-100 transition-all z-10"
                                        title="Desequipar"
                                    >
                                        <X size={12} />
                                    </button>
                                </>
                            ) : (
                                <div className="text-xs text-slate-700 italic">Vacío</div>
                            )}
                        </div>
                    );
                })}
            </div>

            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
                        onClick={() => setSelectedItem(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="glass-panel w-full max-w-sm p-0 overflow-hidden relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-gradient-to-b from-slate-800 to-slate-900 p-6 text-center relative">
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                                <div className="w-16 h-16 mx-auto bg-slate-950 rounded-xl border border-accent-gold/30 flex items-center justify-center mb-4 text-accent-gold shadow-lg">
                                    <ShieldCheck size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{selectedItem.name}</h3>
                                <div className="text-xs uppercase tracking-widest text-accent-gold font-bold">{selectedItem.type} • {selectedItem.rarity}</div>
                            </div>

                            <div className="p-6 space-y-4 bg-slate-950/50">
                                <p className="text-sm text-slate-300 italic text-center leading-relaxed">
                                    "{selectedItem.description || 'Sin descripción disponible.'}"
                                </p>

                                {selectedItem.stat_bonuses && Object.keys(selectedItem.stat_bonuses).length > 0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(selectedItem.stat_bonuses).map(([stat, val]) => (
                                            <div key={stat} className="bg-white/5 p-2 rounded text-center border border-white/5">
                                                <div className="text-[10px] uppercase text-slate-500 font-bold">{stat}</div>
                                                <div className="text-lg font-bold text-accent-gold">{val > 0 ? `+${val}` : val}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    onClick={() => handleUnequip(selectedItem.slotKey)}
                                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <X size={16} /> Desequipar Objeto
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}



function InventoryTab({ inventory, characterId, socket, equipment }) {
    const [subTab, setSubTab] = useState('all');

    // Helper to check if item is equipped
    const isEquipped = (itemId) => {
        if (!equipment) return false;
        // Check all values in equipment object (excluding ID/ForeignKeys if flattened, but usually it's nested objects or plain objects)
        // Based on backend, equipment has `[slot]_id` but the `equipment` object passed here is likely the populated model which has `[slot]: { id: ... }`
        // We need to check if any of the slot objects have this ID.
        return Object.values(equipment).some(val => val && val.id === itemId);
    };

    const categories = [
        { id: 'all', label: 'Todo' },
        { id: 'combat', label: 'Combate' },
        { id: 'magic', label: 'Mágico' },
        { id: 'consumable', label: 'Consumibles' },
        { id: 'other', label: 'Otros' }
    ];

    const filteredInventory = inventory.filter(item => {
        if (subTab === 'all') return true;
        if (subTab === 'combat') return item.type === 'Arma' || item.type === 'Armadura';
        if (subTab === 'magic') return item.type === 'Objeto Mágico' || item.name.includes('Pergamino') || item.name.includes('Varita');
        if (subTab === 'consumable') return item.type === 'Consumible';
        if (subTab === 'other') return !['Arma', 'Armadura', 'Objeto Mágico', 'Consumible'].includes(item.type);
        return true;
    });

    return (
        <div className="space-y-4">
            {/* Sub-tabs Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSubTab(cat.id)}
                        className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider whitespace-nowrap transition-colors
                        ${subTab === cat.id
                                ? 'bg-accent-gold text-slate-900'
                                : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Inventory List */}
            <div className="space-y-2">
                {filteredInventory.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-xs italic">
                        No hay objetos en esta categoría.
                    </div>
                ) : (
                    filteredInventory.map((item) => {
                        const equipped = isEquipped(item.id);
                        return (
                            <div key={item.id} className="glass-panel p-3 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded flex items-center justify-center ${item.type === 'Obj. Mágico' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-500'}`}>
                                        {item.type === 'Arma' ? <Sword size={14} /> :
                                            item.type === 'Armadura' ? <Shield size={14} /> :
                                                item.type === 'Consumible' ? <Heart size={14} /> : <Briefcase size={14} />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-200">{item.name}</div>
                                        <div className="text-[10px] text-slate-500 uppercase">{item.rarity} • {item.type}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {(item.CharacterInventory?.quantity > 1 || item.type === 'Consumible') && (
                                        <div className="px-1.5 py-0.5 rounded bg-slate-950/50 border border-white/10 text-[10px] text-slate-400 font-mono">
                                            x{item.CharacterInventory?.quantity || 1}
                                        </div>
                                    )}

                                    {item.type === 'Consumible' ? (
                                        <button
                                            onClick={() => socket.emit('use-item', { characterId, itemId: item.id })}
                                            className="px-3 py-1 bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold text-[10px] font-bold uppercase tracking-wider rounded border border-accent-gold/30 transition-colors"
                                        >
                                            Usar
                                        </button>
                                    ) : (
                                        equipped ? (
                                            <div className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider rounded border border-green-500/30 flex items-center gap-1">
                                                <ShieldCheck size={10} /> Equipado
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => socket.emit('equip-item', { characterId, itemId: item.id })}
                                                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded border border-white/10 transition-colors"
                                            >
                                                Equipar
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function AlliesTab({ characterId, socket }) {
    const [allies, setAllies] = useState([]);

    useEffect(() => {
        if (socket) {
            socket.emit('get-my-npcs', characterId);
            socket.on('my-npcs', (data) => setAllies(data));
        }
        return () => {
            if (socket) socket.off('my-npcs');
        };
    }, [socket, characterId]);

    const handleToggle = (npcId) => {
        socket.emit('toggle-npc-active', { characterId, npcId });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-2">
                <User size={16} /> Mis Aliados
            </h3>

            {allies.length === 0 ? (
                <div className="glass-panel p-6 text-center text-slate-500 italic">
                    <p>No tienes aliados contratados.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {allies.map(npc => (
                        <div key={npc.id} className={`glass-panel p-4 flex items-center justify-between transition-all ${npc.is_active ? 'border-accent-gold bg-accent-gold/10' : 'border-white/5'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full border-2 overflow-hidden ${npc.is_active ? 'border-accent-gold' : 'border-slate-700 grayscale'}`}>
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${npc.name}`} alt={npc.name} />
                                </div>
                                <div>
                                    <h4 className={`font-bold text-lg leading-none ${npc.is_active ? 'text-accent-gold' : 'text-slate-300'}`}>{npc.name}</h4>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{npc.race} {npc.class} • Nvl {npc.level}</p>
                                    <div className="flex gap-2 mt-1 text-[10px] text-slate-400">
                                        <span className="bg-slate-950/50 px-1 rounded">HP: {npc.hp_current}/{npc.hp_max}</span>
                                        <span className="bg-slate-950/50 px-1 rounded">CA: {npc.ac_base}</span>
                                    </div>
                                    {npc.is_active && <span className="text-[9px] text-green-400 font-black uppercase tracking-widest animate-pulse mt-1 block">Aventurando</span>}
                                </div>
                            </div>

                            <button
                                onClick={() => handleToggle(npc.is_active ? null : npc.id)}
                                className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all
                                ${npc.is_active
                                        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30'
                                        : 'bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold border border-accent-gold/30'}`}
                            >
                                {npc.is_active ? 'Desactivar' : 'Activar'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function AbilitiesTab({ characterId, initialText, socket }) {
    const [text, setText] = useState(initialText || '');
    const [isSaving, setIsSaving] = useState(false);

    // Sync with external updates (e.g. from DM)
    useEffect(() => {
        setText(initialText || '');
    }, [initialText]);

    // Debounced save
    useEffect(() => {
        const timer = setTimeout(() => {
            if (text !== initialText && socket) {
                setIsSaving(true);
                socket.emit('update-abilities-text', { characterId, text });
                setTimeout(() => setIsSaving(false), 1000);
            }
        }, 1000); // 1 second debounce

        return () => clearTimeout(timer);
    }, [text, characterId, socket, initialText]);

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                    <BookOpen size={16} /> Habilidades y Talentos
                </h3>
                {isSaving && (
                    <span className="text-[10px] uppercase font-bold text-accent-gold animate-pulse">Guardando...</span>
                )}
            </div>

            <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-gold">Custom para el cheat</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Usa una seccion <code className="text-accent-gold">## Custom</code> y dentro bloques como <code className="text-accent-gold">### Furia Sombria</code>,
                    <code className="text-accent-gold"> Tipo: Bonus</code> y la descripcion. Lo de afuera sigue siendo solo notas.
                </p>
            </div>

            <div className="flex-1 glass-panel p-0 overflow-hidden relative group">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full h-[60vh] bg-transparent border-0 resize-none p-5 text-slate-300 focus:text-white placeholder:text-slate-600 focus:ring-0 leading-relaxed custom-scrollbar text-sm font-mono"
                    placeholder={"Escribe aqui tus notas.\n\n## Custom\n### Furia Sombria\nTipo: Bonus\nGanas un ataque extra cuando entras en trance."}
                />
                <div className="absolute bottom-2 right-2 text-[10px] text-slate-700 pointer-events-none group-focus-within:text-slate-500 transition-colors">
                    Sincronizado con el DM
                </div>
            </div>
        </motion.div>
    );
}

function AvatarEditorModal({ character, isOpen, onClose, socket }) {
    const [scale, setScale] = useState(character.image_scale || 1);
    const [offsetX, setOffsetX] = useState(character.image_offset_x || 0);
    const [offsetY, setOffsetY] = useState(character.image_offset_y || 0);
    const [previewUrl, setPreviewUrl] = useState(character.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${character.name}`);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            setPreviewUrl(data.url);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Error al subir la imagen');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = () => {
        if (socket) {
            socket.emit('update-character-image', {
                characterId: character.id,
                imageUrl: previewUrl,
                scale,
                offsetX,
                offsetY
            });
        }
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-bold text-white">Editar Avatar</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Preview Area */}
                    <div className="flex justify-center">
                        <div className="w-40 h-40 rounded-full border-4 border-accent-gold/30 shadow-2xl overflow-hidden relative bg-slate-800">
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-full object-cover transition-transform duration-100"
                                style={{ transform: `scale(${scale}) translate(${offsetX}%, ${offsetY}%)` }}
                            />
                            {isUploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent-gold" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Upload Button */}
                    <div className="flex justify-center">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-slate-300 transition-colors"
                        >
                            <Upload size={16} />
                            Subir Nueva Imagen
                        </button>
                    </div>

                    {/* Controls */}
                    <div className="space-y-3 bg-black/20 p-4 rounded-xl">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase text-slate-500 font-bold">
                                <span>Zoom</span>
                                <span>{scale.toFixed(1)}x</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.1"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent-gold"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase text-slate-500 font-bold">
                                <span>Panorámica X</span>
                                <span>{offsetX}%</span>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                value={offsetX}
                                onChange={(e) => setOffsetX(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent-gold"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] uppercase text-slate-500 font-bold">
                                <span>Panorámica Y</span>
                                <span>{offsetY}%</span>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                value={offsetY}
                                onChange={(e) => setOffsetY(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-accent-gold"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <button
                        onClick={handleSave}
                        className="w-full py-3 bg-accent-gold text-slate-900 font-bold uppercase tracking-widest rounded-lg hover:bg-yellow-400 transition-colors shadow-lg shadow-accent-gold/20"
                    >
                        Guardar Cambios
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function GalleryTab({ sharedMedia }) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 gap-4">
            <AnimatePresence>
                {sharedMedia.map((m, i) => (
                    <motion.div key={m.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel overflow-hidden border-white/10 group">
                        <div className="aspect-video relative overflow-hidden">
                            <img src={m.url} alt={m.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        </div>
                        <div className="p-4 bg-slate-900">
                            <p className="text-sm font-bold text-slate-200 tracking-tight">{m.caption}</p>
                            <p className="text-[10px] text-slate-500 font-medium uppercase mt-1">Recibido {new Date(m.timestamp).toLocaleTimeString()}</p>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
            {sharedMedia.length === 0 && <div className="py-20 text-center opacity-30 italic text-sm">Esperando revelaciones del DM...</div>}
        </motion.div>
    );
}

function MetricCard({ label, value, icon, color, small }) {
    return (
        <div className={`glass-panel flex items-center justify-between bg-white/5 border-white/10 ${small ? 'p-3' : 'p-3.5'}`}>
            <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 leading-none">{label}</span>
                <div className={`text-2xl font-black ${color} leading-none mt-1`}>{value}</div>
            </div>
            <div className={`rounded-xl bg-black/40 ${color} border border-current/20 shadow-inner flex items-center justify-center ${small ? 'p-1' : 'p-2.5'}`}>
                {icon}
            </div>
        </div>
    );
}
