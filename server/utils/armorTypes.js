/**
 * Catálogo de armaduras D&D 5e.
 * Cada material pertenece a una categoría (peso) fija.
 */

const ARMOR_WEIGHTS = ['ligera', 'media', 'pesada'];

// material -> categoría/peso
const MATERIAL_WEIGHT = {
    'Acolchada': 'ligera',
    'Cuero': 'ligera',
    'Cuero tachonado': 'ligera',
    'Pieles': 'media',
    'Camisa de malla': 'media',
    'Cota de escamas': 'media',
    'Coraza': 'media',
    'Media placa': 'media',
    'Cota de anillas': 'pesada',
    'Cota de malla': 'pesada',
    'Férula / Splint': 'pesada',
    'Placas': 'pesada',
    'Escudo': 'escudo',
};

const ARMOR_MATERIALS = Object.keys(MATERIAL_WEIGHT);

// Peso por defecto según el material (para autocompletar).
const weightForMaterial = (material) => MATERIAL_WEIGHT[material] || null;

module.exports = { ARMOR_WEIGHTS, ARMOR_MATERIALS, MATERIAL_WEIGHT, weightForMaterial };
