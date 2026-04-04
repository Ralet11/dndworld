module.exports = [
    // --- ARMAS (Weapons) ---
    // Simple Melee
    { name: 'Daga', type: 'Arma', rarity: 'Común', weight: 1, level: 0, description: '1d4 perforante. Sutil, arrojadiza (20/60), ligera.' },
    { name: 'Maza', type: 'Arma', rarity: 'Común', weight: 4, level: 0, description: '1d6 contundente. Simple pero efectiva.' },
    { name: 'Bastón', type: 'Arma', rarity: 'Común', weight: 4, level: 0, description: '1d6 contundente. Versátil (1d8).' },
    { name: 'Lanza', type: 'Arma', rarity: 'Común', weight: 3, level: 0, description: '1d6 perforante. Arrojadiza (20/60), versátil (1d8).' },

    // Martial Melee
    { name: 'Espada Larga', type: 'Arma', rarity: 'Común', weight: 3, level: 1, description: '1d8 cortante. Versátil (1d10).' },
    { name: 'Espada Corta', type: 'Arma', rarity: 'Común', weight: 2, level: 1, description: '1d6 cortante. Sutil, ligera.' },
    { name: 'Espadón', type: 'Arma', rarity: 'Común', weight: 6, level: 1, description: '2d6 cortante. Pesada, a dos manos.' },
    { name: 'Hacha de Batalla', type: 'Arma', rarity: 'Común', weight: 4, level: 1, description: '1d8 cortante. Versátil (1d10).' },
    { name: 'Martillo de Guerra', type: 'Arma', rarity: 'Común', weight: 2, level: 1, description: '1d8 contundente. Versátil (1d10).' },
    { name: 'Estoque', type: 'Arma', rarity: 'Común', weight: 2, level: 1, description: '1d8 perforante. Sutil.' },

    // Ranged
    { name: 'Arco Corto', type: 'Arma', rarity: 'Común', weight: 2, level: 1, description: '1d6 perforante. Munición (80/320), a dos manos.' },
    { name: 'Arco Largo', type: 'Arma', rarity: 'Común', weight: 2, level: 1, description: '1d8 perforante. Munición (150/600), pesada, a dos manos.' },
    { name: 'Ballesta Ligera', type: 'Arma', rarity: 'Común', weight: 5, level: 1, description: '1d8 perforante. Munición (80/320), carga, a dos manos.' },

    // --- ARMADURAS (Armor) ---
    // Light
    { name: 'Armadura Acolchada', type: 'Armadura', rarity: 'Común', weight: 8, level: 1, description: 'CA 11 + Des. Desventaja en Sigilo.', stat_bonuses: { ac: 11 } },
    { name: 'Armadura de Cuero', type: 'Armadura', rarity: 'Común', weight: 10, level: 1, description: 'CA 11 + Des.', stat_bonuses: { ac: 11 } },
    { name: 'Cuero Tachonado', type: 'Armadura', rarity: 'Común', weight: 13, level: 2, description: 'CA 12 + Des.', stat_bonuses: { ac: 12 } },

    // Medium
    { name: 'Cota de Malla (Camisa)', type: 'Armadura', rarity: 'Común', weight: 20, level: 2, description: 'CA 13 + Des (max 2).', stat_bonuses: { ac: 13 } },
    { name: 'Coraza', type: 'Armadura', rarity: 'Común', weight: 20, level: 3, description: 'CA 14 + Des (max 2).', stat_bonuses: { ac: 14 } },
    { name: 'Media Placa', type: 'Armadura', rarity: 'Común', weight: 40, level: 3, description: 'CA 15 + Des (max 2). Desventaja en Sigilo.', stat_bonuses: { ac: 15 } },

    // Heavy
    { name: 'Cota de Anillas', type: 'Armadura', rarity: 'Común', weight: 40, level: 1, description: 'CA 14. Desventaja en Sigilo.', stat_bonuses: { ac: 14 } },
    { name: 'Cota de Malla', type: 'Armadura', rarity: 'Común', weight: 55, level: 2, description: 'CA 16. FUE 13. Desventaja en Sigilo.', stat_bonuses: { ac: 16 } },
    { name: 'Armadura de Placas', type: 'Armadura', rarity: 'Raro', weight: 65, level: 5, description: 'CA 18. FUE 15. Desventaja en Sigilo.', stat_bonuses: { ac: 18 } },

    // Shields
    { name: 'Escudo', type: 'Armadura', rarity: 'Común', weight: 6, level: 1, description: '+2 CA.', stat_bonuses: { ac: 2 } },

    // --- OBJETOS MÁGICOS (Magic Items) ---
    // Potions
    { name: 'Poción de Curación', type: 'Consumible', rarity: 'Común', weight: 0.5, level: 1, description: 'Cura 2d4+2 HP.', use_effects: { heal: '2d4+2' } },
    { name: 'Poción de Curación Mayor', type: 'Consumible', rarity: 'Poco Común', weight: 0.5, level: 3, description: 'Cura 4d4+4 HP.', use_effects: { heal: '4d4+4' } },
    { name: 'Poción de Curación Superior', type: 'Consumible', rarity: 'Raro', weight: 0.5, level: 6, description: 'Cura 8d4+8 HP.', use_effects: { heal: '8d4+8' } },
    { name: 'Poción de Invisibilidad', type: 'Consumible', rarity: 'Muy Raro', weight: 0.5, level: 5, description: 'Te vuelves invisible por 1 hora.' },
    { name: 'Poción de Fuerza de Gigante', type: 'Consumible', rarity: 'Raro', weight: 0.5, level: 4, description: 'Tu FUE aumenta a 21 por 1 hora.' },

    // Scrolls
    { name: 'Pergamino: Identificar', type: 'Consumible', rarity: 'Común', weight: 0.1, level: 1, description: 'Lanza el hechizo Identificar.' },
    { name: 'Pergamino: Bola de Fuego', type: 'Consumible', rarity: 'Raro', weight: 0.1, level: 5, description: 'Lanza el hechizo Bola de Fuego (Nv 3).' },
    { name: 'Pergamino: Revivir', type: 'Consumible', rarity: 'Muy Raro', weight: 0.1, level: 5, description: 'Lanza el hechizo Revivir.' },

    // Wondrous Items
    { name: 'Bolsa de Contemplación', type: 'Objeto Mágico', rarity: 'Poco Común', weight: 15, level: 2, description: 'Interior extradimensional que puede contener hasta 500 libras.' },
    { name: 'Capa de Protección', type: 'Objeto Mágico', rarity: 'Poco Común', weight: 3, level: 3, description: 'Otorga +1 a la CA y Tiros de Salvación.', stat_bonuses: { ac: 1, saves: 1 } },
    { name: 'Botas de Velocidad', type: 'Objeto Mágico', rarity: 'Raro', weight: 2, level: 5, description: 'Dobla tu velocidad de movimiento y otorga desventaja a ataques de oportunidad.' },
    { name: 'Gafas de la Noche', type: 'Objeto Mágico', rarity: 'Poco Común', weight: 0.5, level: 2, description: 'Otorga visión en la oscuridad de 60 pies.' },
    { name: 'Piedra de la Buena Suerte', type: 'Objeto Mágico', rarity: 'Poco Común', weight: 0, level: 3, description: '+1 a Tiros de Habilidad y Salvación.', stat_bonuses: { skills: 1, saves: 1 } },
    { name: 'Anillo de Protección', type: 'Objeto Mágico', rarity: 'Raro', weight: 0, level: 4, description: '+1 a la CA y Tiros de Salvación.', stat_bonuses: { ac: 1, saves: 1 } },

    // Magic Weapons
    { name: 'Espada Larga +1', type: 'Arma', rarity: 'Poco Común', weight: 3, level: 3, description: 'Arma mágica. +1 al ataque y daño.' },
    { name: 'Daga del Veneno', type: 'Arma', rarity: 'Raro', weight: 1, level: 5, description: 'Puede envenenar al objetivo (CD 15 CON o 2d10 daño veneno).' },
    { name: 'Matagigantes', type: 'Arma', rarity: 'Raro', weight: 4, level: 6, description: 'Hacha o Espada. +2d6 daño extra contra gigantes.' },

    // --- MATERIAL DE AVENTURAS (Adventuring Gear) ---
    { name: 'Mochila', type: 'Otro', rarity: 'Común', weight: 5, level: 0, description: 'Capacidad para llevar equipo.' },
    { name: 'Cuerda de Seda (50 pies)', type: 'Otro', rarity: 'Común', weight: 5, level: 1, description: 'Resistente y ligera.' },
    { name: 'Antorcha', type: 'Consumible', rarity: 'Común', weight: 1, level: 0, description: 'Arde por 1 hora. Ilumina 20 pies radio brillante.' },
    { name: 'Raciones (1 día)', type: 'Consumible', rarity: 'Común', weight: 2, level: 0, description: 'Comida seca para viajar.' },
    { name: 'Kit de Sanador', type: 'Consumible', rarity: 'Común', weight: 3, level: 1, description: 'Contiene vendas y ungüentos (10 usos). Estabiliza sin tirar.' },
    { name: 'Herramientas de Ladrón', type: 'Otro', rarity: 'Común', weight: 1, level: 1, description: 'Necesarias para abrir cerraduras y desactivar trampas.' },
    { name: 'Símbolo Sagrado', type: 'Otro', rarity: 'Común', weight: 1, level: 1, description: 'Canalizador para clérigos y paladines.' },
    { name: 'Libro de Hechizos', type: 'Otro', rarity: 'Común', weight: 3, level: 1, description: 'Esencial para magos.' },
    { name: 'Componentes de Hechizos', type: 'Consumible', rarity: 'Común', weight: 2, level: 1, description: 'Bolsa con polvos y materiales comunes.' }
];
