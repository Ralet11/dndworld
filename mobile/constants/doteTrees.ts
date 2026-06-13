/**
 * Árboles de dote del Sistema de Armaduras 2025 (secciones 5-7 del doc, ampliado
 * a 3 opciones por umbral). Solo referencia — los efectos NO se automatizan.
 * Al alcanzar 5/10/15/20 puntos en un árbol, el jugador elige UNA de tres
 * opciones (A/B/C) en ese umbral. La elección se guarda en el personaje.
 *
 * Atributos asociados (tema): Espíritu ↔ CAR+SAB · Agilidad ↔ INT+DES ·
 * Aguante ↔ FUE+CON. (No suman puntos: los puntos vienen solo del equipo.)
 */

export type Dote = { name: string; desc: string };
export type DoteOption = 'a' | 'b' | 'c';
export type DoteTier = { th: number; a: Dote; b: Dote; c: Dote };
export type DoteTree = {
    key: 'agilidad' | 'aguante' | 'espiritu';
    name: string;
    blurb: string;
    attrs: string; // atributos asociados (tema)
    tiers: DoteTier[];
};

export const DOTE_TREES: DoteTree[] = [
    {
        key: 'agilidad',
        name: 'Agilidad',
        blurb: 'Movilidad, esquive y golpes de oportunidad.',
        attrs: 'INT + DES',
        tiers: [
            {
                th: 5,
                a: { name: 'Paso veloz', desc: 'Movimiento +3m permanente. El terreno difícil no reduce tu velocidad si te moviste menos de la mitad del movimiento ese turno.' },
                b: { name: 'Sombra', desc: 'Ventaja en Sigilo y Percepción pasiva +2. 1/turno: moverte sin provocar ataques de oportunidad si te moviste menos de media velocidad.' },
                c: { name: 'Reflejos felinos', desc: '+2 a la iniciativa y a las salvaciones de Destreza. No podés ser sorprendido si estás consciente.' },
            },
            {
                th: 10,
                a: { name: 'Evasión', desc: 'Daño de área = 0 con salvación DES exitosa; solo la mitad si fallás. No funciona si estás incapacitado.' },
                b: { name: 'Reflejo', desc: 'Gastar reacción para un segundo intento de esquive por turno (el 2º dado es siempre 1d4). Solo si el primer esquive del turno fue exitoso.' },
                c: { name: 'Acrobacia de combate', desc: '1/turno podés moverte a través del espacio de un enemigo; si lo hacés, ganás +2 CA contra él hasta el fin de tu turno.' },
            },
            {
                th: 15,
                a: { name: 'Contragolpe', desc: 'Al esquivar con éxito: reacción para atacar al atacante con ventaja, si está en alcance de tu arma.' },
                b: { name: 'Espectro', desc: 'Acción bonus para volverte etéreo hasta fin de turno; atravesás criaturas y objetos. 5 daño de fuerza si terminás dentro de un sólido. Usos: MOD DES por DL.' },
                c: { name: 'Velocidad cegadora', desc: 'Tu velocidad se duplica durante el primer turno de cada combate. Ventaja en ataques contra enemigos que todavía no actuaron.' },
            },
            {
                th: 20,
                a: { name: 'Forma del viento', desc: 'Inmune a ataques de oportunidad. 1/turno en tu movimiento: teletransportarte hasta 9m; si aparecés adyacente a un enemigo podés atacar. 1/DL.' },
                b: { name: 'Mil cortes', desc: 'Cada esquive exitoso inflige 1d6 + MOD DES al atacante sin tirada (tipo del arma equipada, o cortante si no hay).' },
                c: { name: 'Danza de la muerte', desc: 'Si esquivás al menos un ataque durante el turno de un enemigo, tu próximo ataque contra él es un crítico automático. 1/DL.' },
            },
        ],
    },
    {
        key: 'aguante',
        name: 'Aguante',
        blurb: 'Resistencia, supervivencia y protección de aliados.',
        attrs: 'FUE + CON',
        tiers: [
            {
                th: 5,
                a: { name: 'Piel dura', desc: 'Reduce 2 puntos de daño físico (contundente, cortante, perforante) por golpe recibido (mín. 1), tras calcular resistencias.' },
                b: { name: 'Imparable', desc: 'Ignorás terreno difícil no mágico. Empujes de 1.5m o menos no te mueven. Ventaja en salvaciones de CON para mantener concentración.' },
                c: { name: 'Constitución férrea', desc: '+5 PG máximos. Ventaja en salvaciones contra veneno y enfermedad; resistencia al daño por veneno.' },
            },
            {
                th: 10,
                a: { name: 'Segunda vida', desc: 'Al caer a 0 PG: reacción para quedar en 1 PG. Ganás 2d10 + MOD CON PG temporales hasta el próximo DL. 1/DL.' },
                b: { name: 'Fortaleza', desc: 'Ventaja en todas las salvaciones de CON. Al recibir curación tirás 1d6 adicional (1d8 si la fuente sos vos).' },
                c: { name: 'Provocar', desc: 'Acción bonus para marcar a un enemigo a 9m; mientras esté marcado, tiene desventaja en ataques que no sean contra vos. 1/descanso corto.' },
            },
            {
                th: 15,
                a: { name: 'Indomable', desc: 'Inmune a Asustado y Paralizado. +2 a salvaciones de SAB e INT. 1/descanso corto: si fallás una salvación de CON o FUE, podés elegir que sea un éxito.' },
                b: { name: 'Muro viviente', desc: 'No podés ser empujado ni derribado involuntariamente. Zona de amenaza +1.5m. Reacción: absorbés hasta 5 de daño dirigido a un aliado adyacente. 2/DL.' },
                c: { name: 'Represalia', desc: 'Cada vez que un enemigo adyacente te golpea con un ataque cuerpo a cuerpo, recibe daño contundente igual a tu MOD CON.' },
            },
            {
                th: 20,
                a: { name: 'Inquebrantable', desc: 'Resistencia a daño físico no mágico. Inmune a muerte instantánea. Ventaja en tiradas de muerte. Con 20 natural: recuperás 1 PG y te movés 1.5m.' },
                b: { name: 'Coloso', desc: 'Ataques CaC aplican sangrado (1d4 necrótico al inicio del turno del objetivo, CD 14 CON para frenar). Acción bonus: reducís el daño recibido en MOD CON×2 la primera vez por turno, 1 min. 1/DL.' },
                c: { name: 'Bastión', desc: 'Mientras estés por encima de la mitad de tus PG, reducís todo el daño recibido en 5. Los aliados a 1.5m reducen el daño que reciben en 2.' },
            },
        ],
    },
    {
        key: 'espiritu',
        name: 'Espíritu',
        blurb: 'Magia, potenciación de hechizos y liderazgo.',
        attrs: 'CAR + SAB',
        tiers: [
            {
                th: 5,
                a: { name: 'Canalizar', desc: '1/DL al lanzar un hechizo, Potenciarlo: CD+2, maximizar un dado de daño, o duración ×2 (máx. 1h). A nivel 11: 2 usos por DL.' },
                b: { name: 'Presencia radiante', desc: 'Ventaja en Persuasión e Intimidación. CD de hechizos de encantamiento +2. Si un PNJ hostil falla una salvación de SAB contra un hechizo social, queda encantado 1 minuto.' },
                c: { name: 'Chispa arcana', desc: 'Una vez por turno, al impactar con un hechizo o ataque mágico, +1d6 de daño del tipo del hechizo.' },
            },
            {
                th: 10,
                a: { name: 'Resonancia arcana', desc: '1/DL antes de lanzar, declarar Resonancia: ese hechizo ignora resistencias a su tipo (inmunidad → resistencia). No funciona contra artefactos divinos.' },
                b: { name: 'Escudo arcano', desc: 'Reacción al recibir daño mágico: reducir 1d10 + MOD de conjuración. Usos por DL: mitad del MOD de Espíritu total, redondeado arriba.' },
                c: { name: 'Inspiración', desc: 'Acción bonus para dar a un aliado a 9m un d6 de inspiración que puede sumar a una tirada antes de saber el resultado. Usos: MOD de Espíritu por DL.' },
            },
            {
                th: 15,
                a: { name: 'Explosión de espíritu', desc: '1/DL antes de tirar el daño de un hechizo: hace su daño máximo automáticamente. Si afecta a varios, solo el primero recibe el máximo.' },
                b: { name: 'Vínculo de espíritu', desc: 'Acción bonus para vincular con un aliado tocado. Mientras estén a 9m, puede usar cualquier dote de Espíritu desbloqueado (1 uso/dote/DL). Se rompe si se desmaya o a más de 18m.' },
                c: { name: 'Maestría elemental', desc: 'Elegí un tipo de daño elemental. Tus hechizos de ese tipo ignoran 5 puntos de resistencia y suman +1 a su CD.' },
            },
            {
                th: 20,
                a: { name: 'Ascensión', desc: 'Acción bonus 1/DL. Durante 1 min: sin componentes V/S, CD+2, ignorás resistencias (no inmunidades), emitís luz brillante 3m. Al terminar: aturdido hasta el inicio de tu próximo turno.' },
                b: { name: 'Eco arcano', desc: 'Reacción al terminar de lanzar un hechizo nivel 1-3: se repite al inicio de tu próximo turno sobre el mismo objetivo sin gastar espacio. No puede Potenciarse ni Explotarse.' },
                c: { name: 'Avatar arcano', desc: '1/DL acción: durante 1 min, tus hechizos de daño de un solo objetivo golpean a un objetivo adicional a elección dentro del alcance (mitad de daño al segundo).' },
            },
        ],
    },
];
