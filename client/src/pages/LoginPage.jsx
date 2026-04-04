import React from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Sword, Sparkles, Crown } from 'lucide-react';

export default function LoginPage({ characters, onSelect }) {

    // Helper to pick an icon based on class (simple heuristic)
    const getClassIcon = (className) => {
        const c = (className || '').toLowerCase();
        if (c.includes('guerrero') || c.includes('fighter') || c.includes('barbaro')) return <Sword size={32} />;
        if (c.includes('paladin') || c.includes('clérigo')) return <Shield size={32} />;
        if (c.includes('mago') || c.includes('sorcerer') || c.includes('warlock')) return <Sparkles size={32} />;
        if (c.includes('rogue') || c.includes('picaro')) return <User size={32} />;
        return <Crown size={32} />;
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent-gold/10 via-slate-950 to-slate-950 z-0 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="z-10 text-center mb-12 space-y-2"
            >
                <div className="flex items-center justify-center gap-3 text-accent-gold mb-4">
                    <Crown size={24} />
                    <span className="text-xs font-black tracking-[0.4em] uppercase">D&D World</span>
                    <Crown size={24} />
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 tracking-tighter">
                    ELIGE TU LEYENDA
                </h1>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                    La aventura aguarda. Selecciona tu personaje para conectarte a la sesión.
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl w-full z-10">
                {characters.map((char) => (
                    <motion.button
                        key={char.id}
                        onClick={() => onSelect(char.id)}
                        whileHover={{ scale: 1.02, translateY: -5 }}
                        whileTap={{ scale: 0.98 }}
                        className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-gold/50 rounded-xl p-6 transition-all duration-300 text-left overflow-hidden ring-1 ring-white/5"
                    >
                        {/* Hover Gradient Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-accent-gold/0 via-transparent to-transparent group-hover:from-accent-gold/5 transition-all duration-500" />

                        <div className="flex items-start justify-between mb-4 relative z-10">
                            <div className="p-3 bg-slate-900/50 rounded-lg group-hover:bg-accent-gold/10 group-hover:text-accent-gold transition-colors text-slate-400 border border-white/5">
                                {getClassIcon(char.class)}
                            </div>
                            <div className="bg-slate-950/50 px-2 py-1 rounded text-[10px] font-mono text-slate-500 border border-white/5">
                                NVL {char.level || 1}
                            </div>
                        </div>

                        <div className="relative z-10 space-y-1">
                            <h2 className="text-xl font-bold text-slate-100 group-hover:text-accent-gold transition-colors">
                                {char.name}
                            </h2>
                            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                                {char.race} {char.class}
                            </p>
                        </div>

                        {/* Decoration lines */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-gold/0 to-transparent group-hover:via-accent-gold/50 transition-all duration-500" />
                    </motion.button>
                ))}
            </div>

            <div className="mt-12 text-[10px] text-slate-600 font-mono z-10">
                SERVERS ONLINE • SESSION ACTIVE
            </div>
        </div>
    );
}
