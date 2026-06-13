/**
 * Sistema de Armaduras 2025 — construcción y validación de ítems por rareza.
 *
 * Reglas (sección 3 del doc):
 *  - Cada rareza tiene un presupuesto de puntos de poder.
 *  - El costo = Σ(stats de talento) + costo de la habilidad (si tiene).
 *  - La CA de la pieza sale de su tipo + rareza (no del presupuesto).
 *  - Una pieza tiene como máximo UNA habilidad.
 */

// CA por pieza según tipo (banda) — la rareza decide la posición dentro de la banda.
const CA_BANDS = {
    tela: [0.25, 0.50],
    cuero: [0.50, 0.75],
    malla: [1.00, 1.25],
};

// Presupuesto de puntos de poder por rareza.
const RARITY_BUDGET = {
    'Común': 0,
    'Poco Común': 3,
    'Raro': 7,
    'Épico': 12,
    'Legendario': 18,
};

// Posición dentro de la banda de CA (0 = mínimo, 1 = máximo) por rareza.
const RARITY_FACTOR = {
    'Común': 0,
    'Poco Común': 0.25,
    'Raro': 0.5,
    'Épico': 0.75,
    'Legendario': 1,
};

const ABILITY_COST = { menor: 3, mayor: 6, legendaria: 10 };
const TALENT_KEYS = ['espiritu', 'agilidad', 'aguante'];

// Pequeño catálogo del doc para el generador de loot.
const ABILITY_CATALOG = {
    menor: [
        { nombre: 'Marca del cazador', descripcion: 'Ventaja en ataques contra el último enemigo que te golpeó este combate.', tipo: 'pasivo' },
        { nombre: 'Paso silencioso', descripcion: 'No provoca sonido al moverse. +2 a tiradas de Sigilo.', tipo: 'pasivo' },
        { nombre: 'Escudo menor', descripcion: '1 vez por descanso corto: reducís 1d4 de daño de un golpe como reacción.', tipo: 'reaccion' },
        { nombre: 'Ojo de águila', descripcion: '+2 a Percepción. Sin desventaja en ataques a larga distancia.', tipo: 'pasivo' },
    ],
    mayor: [
        { nombre: 'Aura de fuego', descripcion: 'Enemigos adyacentes reciben 1d4 fuego al inicio de su turno. Toggle con acción bonus.', tipo: 'toggle' },
        { nombre: 'Regeneración menor', descripcion: 'Al inicio de tu turno recuperás 1 PG si no recibiste daño desde tu último turno.', tipo: 'pasivo' },
        { nombre: 'Sombra del asesino', descripcion: 'Tus ataques contra objetivos que no te vieron este combate hacen 2d6 extra de daño oscuro.', tipo: 'pasivo' },
        { nombre: 'Furia del berserker', descripcion: 'Al recibir un crítico: tu próximo ataque este turno tiene ventaja y +1d8 de daño.', tipo: 'pasivo' },
    ],
    legendaria: [
        { nombre: 'Paso del viento', descripcion: '1 vez por DL: teletransportarte hasta 9m como acción bonus; si aparecés adyacente a un enemigo, podés atacar.', tipo: 'activo' },
        { nombre: 'Corona de acero', descripcion: 'Mientras no te movés en tu turno: los ataques cuerpo a cuerpo contra vos tienen desventaja y sos inmune a empujes.', tipo: 'pasivo' },
        { nombre: 'Presencia del titán', descripcion: '1 vez por DL: durante 1 min, enemigos a 9m deben superar CD 14 SAB o quedar asustados (se repite en sus turnos).', tipo: 'activo' },
    ],
};

/** CA que aporta una pieza de armadura según su tipo y rareza. */
function caForType(type, rarity) {
    const band = CA_BANDS[type];
    if (!band) return null;
    const f = RARITY_FACTOR[rarity] ?? 0;
    return Math.round((band[0] + f * (band[1] - band[0])) * 100) / 100;
}

/** Costo en puntos de poder de una distribución de stats + habilidad. */
function pointCost(talents = {}, ability = null) {
    let cost = (talents.espiritu || 0) + (talents.agilidad || 0) + (talents.aguante || 0);
    if (ability && ability.tier) cost += ABILITY_COST[ability.tier] || 0;
    return cost;
}

/** Valida que una pieza no exceda el presupuesto de su rareza. */
function validateBudget(rarity, talents = {}, ability = null) {
    const budget = RARITY_BUDGET[rarity] ?? 0;
    const cost = pointCost(talents, ability);
    // Una habilidad legendaria requiere presupuesto de 12+ (épico o superior).
    if (ability && ability.tier === 'legendaria' && budget < 12) {
        return { ok: false, cost, budget, reason: 'La habilidad legendaria requiere rareza Épico o superior.' };
    }
    return { ok: cost <= budget, cost, budget };
}

/**
 * Construye (de forma DETERMINÍSTICA) una pieza de armadura validada contra su
 * presupuesto. Lanza si excede. Devuelve el objeto listo para guardar.
 */
function buildArmorPiece({ name, slot, armor_type, rarity, talent_stats = {}, ability = null, ...rest }) {
    const v = validateBudget(rarity, talent_stats, ability);
    if (!v.ok) {
        throw new Error(`Ítem "${name}" inválido: ${v.reason || `excede presupuesto (${v.cost}/${v.budget} pts)`}`);
    }
    return {
        name,
        slot,
        type: 'Armadura',
        rarity,
        armor_type,
        ca_value: caForType(armor_type, rarity),
        talent_stats: { espiritu: 0, agilidad: 0, aguante: 0, ...talent_stats },
        ability: ability ? { tier: ability.tier, ...ability } : null,
        stat_bonuses: {}, // la CA viene de ca_value, no de stat_bonuses
        ...rest,
    };
}

/** Construye un escudo (mano secundaria, CA plana +1/+2). */
function buildShield({ name, rarity = 'Común', shield_ca = 2, ...rest }) {
    return {
        name,
        slot: 'secondary_weapon',
        type: 'Armadura',
        rarity,
        armor_type: null,
        ca_value: null,
        talent_stats: {},
        ability: null,
        stat_bonuses: { ac: shield_ca },
        ...rest,
    };
}

/**
 * Generador de loot: reparte aleatoriamente el presupuesto de la rareza entre
 * una habilidad (a veces) y stats de talento. Respeta todos los límites.
 */
function rollArmorLoot({ name, slot, type, rarity }) {
    let budget = RARITY_BUDGET[rarity] ?? 0;
    let ability = null;

    // Tal vez gastar en una habilidad si alcanza (60% de probabilidad).
    const tiers = [];
    if (budget >= ABILITY_COST.menor) tiers.push('menor');
    if (budget >= ABILITY_COST.mayor) tiers.push('mayor');
    if (budget >= 12) tiers.push('legendaria'); // requiere 12+ de presupuesto
    if (tiers.length && Math.random() < 0.6) {
        const tier = tiers[Math.floor(Math.random() * tiers.length)];
        const pick = ABILITY_CATALOG[tier][Math.floor(Math.random() * ABILITY_CATALOG[tier].length)];
        ability = { tier, ...pick };
        budget -= ABILITY_COST[tier];
    }

    // Repartir lo que queda en stats de talento (máx 10 por stat).
    const talents = { espiritu: 0, agilidad: 0, aguante: 0 };
    let guard = 100;
    while (budget > 0 && guard-- > 0) {
        const k = TALENT_KEYS[Math.floor(Math.random() * TALENT_KEYS.length)];
        if (talents[k] < 10) { talents[k]++; budget--; }
        else if (TALENT_KEYS.every((t) => talents[t] >= 10)) break;
    }

    return buildArmorPiece({ name, slot, armor_type: type, rarity, talent_stats: talents, ability });
}

module.exports = {
    CA_BANDS,
    RARITY_BUDGET,
    ABILITY_COST,
    ABILITY_CATALOG,
    caForType,
    pointCost,
    validateBudget,
    buildArmorPiece,
    buildShield,
    rollArmorLoot,
};
