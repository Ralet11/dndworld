/**
 * Catálogo de armas y maestrías (D&D 2024), en español. Fuente de verdad para
 * marcar un ítem como "Espada Larga" y que herede daño/propiedades/maestría.
 *
 * Maestría: cada arma tiene UNA. Su efecto se guarda en el ítem ({name, desc})
 * para que la UI lo muestre sin depender de otra tabla.
 *
 * ⚠️ Redactado desde conocimiento del PHB 2024 — verificá y corregí lo que haga falta.
 */

// ─────────────── Maestrías (8) ───────────────
const MASTERIES = {
    cleave:  { name: 'Tajo (Cleave)',     desc: 'Al impactar con un ataque del arma, podés hacer un ataque contra una segunda criatura a 1.5m de la primera y dentro del alcance. Solo en la acción de Atacar, 1 vez por turno.' },
    graze:   { name: 'Roce (Graze)',      desc: 'Si tu tirada de ataque falla, igual infligís daño igual a tu modificador de característica (del tipo del arma).' },
    nick:    { name: 'Tijera (Nick)',     desc: 'El ataque extra de la propiedad Ligera podés hacerlo como parte de la acción de Atacar (no acción adicional). 1 vez por turno.' },
    push:    { name: 'Empuje (Push)',     desc: 'Al impactar, podés empujar al objetivo (Grande o menor) hasta 3m en línea recta alejándolo de vos.' },
    sap:     { name: 'Abatir (Sap)',      desc: 'Al impactar, el objetivo tiene Desventaja en su próxima tirada de ataque antes del inicio de tu próximo turno.' },
    slow:    { name: 'Ralentizar (Slow)', desc: 'Al impactar, reducís la velocidad del objetivo en 3m hasta el inicio de tu próximo turno. 1 vez por turno.' },
    topple:  { name: 'Derribo (Topple)',  desc: 'Al impactar, el objetivo hace una salvación de Constitución (CD 8 + mod. de característica + comp.) o cae Derribado.' },
    vex:     { name: 'Hostigar (Vex)',    desc: 'Al impactar, tenés Ventaja en tu próxima tirada de ataque contra el mismo objetivo antes del fin de tu próximo turno.' },
};

// ─────────────── Armas ───────────────
// { name, category, damage, damage_type, properties, mastery }
const WEAPONS = [
    // ── Simples cuerpo a cuerpo ──
    { name: 'Garrote', category: 'Simple', damage: '1d4', damage_type: 'Contundente', properties: ['Ligera'], mastery: 'slow' },
    { name: 'Daga', category: 'Simple', damage: '1d4', damage_type: 'Perforante', properties: ['Sutil', 'Ligera', 'Arrojadiza (6/18m)'], mastery: 'nick' },
    { name: 'Garrote Grande', category: 'Simple', damage: '1d8', damage_type: 'Contundente', properties: ['A dos manos'], mastery: 'push' },
    { name: 'Hacha de Mano', category: 'Simple', damage: '1d6', damage_type: 'Cortante', properties: ['Ligera', 'Arrojadiza (6/18m)'], mastery: 'vex' },
    { name: 'Jabalina', category: 'Simple', damage: '1d6', damage_type: 'Perforante', properties: ['Arrojadiza (9/36m)'], mastery: 'slow' },
    { name: 'Martillo Ligero', category: 'Simple', damage: '1d4', damage_type: 'Contundente', properties: ['Ligera', 'Arrojadiza (6/18m)'], mastery: 'nick' },
    { name: 'Maza', category: 'Simple', damage: '1d6', damage_type: 'Contundente', properties: [], mastery: 'sap' },
    { name: 'Bastón', category: 'Simple', damage: '1d6', damage_type: 'Contundente', properties: ['Versátil (1d8)'], mastery: 'topple' },
    { name: 'Hoz', category: 'Simple', damage: '1d4', damage_type: 'Cortante', properties: ['Ligera'], mastery: 'nick' },
    { name: 'Lanza', category: 'Simple', damage: '1d6', damage_type: 'Perforante', properties: ['Arrojadiza (6/18m)', 'Versátil (1d8)'], mastery: 'sap' },

    // ── Simples a distancia ──
    { name: 'Dardo', category: 'Simple', damage: '1d4', damage_type: 'Perforante', properties: ['Sutil', 'Arrojadiza (6/18m)'], mastery: 'vex' },
    { name: 'Ballesta Ligera', category: 'Simple', damage: '1d8', damage_type: 'Perforante', properties: ['Munición (24/96m)', 'Recarga', 'A dos manos'], mastery: 'slow' },
    { name: 'Arco Corto', category: 'Simple', damage: '1d6', damage_type: 'Perforante', properties: ['Munición (24/96m)', 'A dos manos'], mastery: 'vex' },
    { name: 'Honda', category: 'Simple', damage: '1d4', damage_type: 'Contundente', properties: ['Munición (9/36m)'], mastery: 'slow' },

    // ── Marciales cuerpo a cuerpo ──
    { name: 'Hacha de Batalla', category: 'Marcial', damage: '1d8', damage_type: 'Cortante', properties: ['Versátil (1d10)'], mastery: 'topple' },
    { name: 'Mangual', category: 'Marcial', damage: '1d8', damage_type: 'Contundente', properties: [], mastery: 'sap' },
    { name: 'Guja', category: 'Marcial', damage: '1d10', damage_type: 'Cortante', properties: ['Pesada', 'Alcance', 'A dos manos'], mastery: 'graze' },
    { name: 'Hacha Grande', category: 'Marcial', damage: '1d12', damage_type: 'Cortante', properties: ['Pesada', 'A dos manos'], mastery: 'cleave' },
    { name: 'Espadón', category: 'Marcial', damage: '2d6', damage_type: 'Cortante', properties: ['Pesada', 'A dos manos'], mastery: 'graze' },
    { name: 'Alabarda', category: 'Marcial', damage: '1d10', damage_type: 'Cortante', properties: ['Pesada', 'Alcance', 'A dos manos'], mastery: 'cleave' },
    { name: 'Lanza de Caballería', category: 'Marcial', damage: '1d10', damage_type: 'Perforante', properties: ['Pesada', 'Alcance', 'A dos manos (salvo montado)'], mastery: 'topple' },
    { name: 'Espada Larga', category: 'Marcial', damage: '1d8', damage_type: 'Cortante', properties: ['Versátil (1d10)'], mastery: 'sap' },
    { name: 'Mazo', category: 'Marcial', damage: '2d6', damage_type: 'Contundente', properties: ['Pesada', 'A dos manos'], mastery: 'topple' },
    { name: 'Lucero del Alba', category: 'Marcial', damage: '1d8', damage_type: 'Perforante', properties: [], mastery: 'sap' },
    { name: 'Pica', category: 'Marcial', damage: '1d10', damage_type: 'Perforante', properties: ['Pesada', 'Alcance', 'A dos manos'], mastery: 'push' },
    { name: 'Estoque', category: 'Marcial', damage: '1d8', damage_type: 'Perforante', properties: ['Sutil'], mastery: 'vex' },
    { name: 'Cimitarra', category: 'Marcial', damage: '1d6', damage_type: 'Cortante', properties: ['Sutil', 'Ligera'], mastery: 'nick' },
    { name: 'Espada Corta', category: 'Marcial', damage: '1d6', damage_type: 'Perforante', properties: ['Sutil', 'Ligera'], mastery: 'vex' },
    { name: 'Tridente', category: 'Marcial', damage: '1d8', damage_type: 'Perforante', properties: ['Arrojadiza (6/18m)', 'Versátil (1d10)'], mastery: 'topple' },
    { name: 'Martillo de Guerra', category: 'Marcial', damage: '1d8', damage_type: 'Contundente', properties: ['Versátil (1d10)'], mastery: 'push' },
    { name: 'Pico de Guerra', category: 'Marcial', damage: '1d8', damage_type: 'Perforante', properties: ['Versátil (1d10)'], mastery: 'sap' },
    { name: 'Látigo', category: 'Marcial', damage: '1d4', damage_type: 'Cortante', properties: ['Sutil', 'Alcance'], mastery: 'slow' },

    // ── Marciales a distancia ──
    { name: 'Ballesta de Mano', category: 'Marcial', damage: '1d6', damage_type: 'Perforante', properties: ['Munición (9/36m)', 'Ligera', 'Recarga'], mastery: 'vex' },
    { name: 'Ballesta Pesada', category: 'Marcial', damage: '1d10', damage_type: 'Perforante', properties: ['Munición (30/120m)', 'Pesada', 'Recarga', 'A dos manos'], mastery: 'push' },
    { name: 'Arco Largo', category: 'Marcial', damage: '1d8', damage_type: 'Perforante', properties: ['Munición (45/180m)', 'Pesada', 'A dos manos'], mastery: 'slow' },
];

const WEAPON_BY_NAME = {};
WEAPONS.forEach(w => { WEAPON_BY_NAME[w.name.toLowerCase()] = w; });

/** Devuelve los campos de arma (con la maestría resuelta) para un nombre estándar. */
function weaponFields(name) {
    const w = WEAPON_BY_NAME[String(name || '').toLowerCase()];
    if (!w) return null;
    return {
        type: 'Arma',
        weapon_category: w.category,
        damage: w.damage,
        damage_type: w.damage_type,
        properties: w.properties,
        mastery: w.mastery ? { key: w.mastery, ...MASTERIES[w.mastery] } : null,
    };
}

module.exports = { MASTERIES, WEAPONS, weaponFields };
