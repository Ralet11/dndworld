export const DOTE_TREES = [
  {
    key: 'agilidad',
    name: 'Agilidad',
    blurb: 'Movilidad, esquive y golpes de oportunidad.',
    tiers: [
      {
        th: 5,
        a: { name: 'Paso veloz', desc: 'Movimiento +3m permanente. El terreno dificil no reduce tu velocidad si te moviste menos de la mitad del movimiento ese turno.' },
        b: { name: 'Sombra', desc: 'Ventaja en Sigilo y Percepcion pasiva +2. 1/turno: moverte sin provocar ataques de oportunidad si te moviste menos de media velocidad.' },
        c: { name: 'Reflejos felinos', desc: '+2 a la iniciativa y a las salvaciones de Destreza. No podes ser sorprendido si estas consciente.' },
      },
      {
        th: 10,
        a: { name: 'Evasion', desc: 'Dano de area = 0 con salvacion DES exitosa; solo la mitad si fallas. No funciona si estas incapacitado.' },
        b: { name: 'Reflejo', desc: 'Gastar reaccion para un segundo intento de esquive por turno (el 2do dado es siempre 1d4). Solo si el primer esquive del turno fue exitoso.' },
        c: { name: 'Acrobacia de combate', desc: '1/turno podes moverte a traves del espacio de un enemigo; si lo haces, ganas +2 CA contra el hasta el fin de tu turno.' },
      },
      {
        th: 15,
        a: { name: 'Contragolpe', desc: 'Al esquivar con exito: reaccion para atacar al atacante con ventaja, si esta en alcance de tu arma.' },
        b: { name: 'Espectro', desc: 'Accion bonus para volverte etereo hasta fin de turno; atraviesas criaturas y objetos. 5 dano de fuerza si terminas dentro de un solido. Usos: MOD DES por DL.' },
        c: { name: 'Velocidad cegadora', desc: 'Tu velocidad se duplica durante el primer turno de cada combate. Ventaja en ataques contra enemigos que todavia no actuaron.' },
      },
      {
        th: 20,
        a: { name: 'Forma del viento', desc: 'Inmune a ataques de oportunidad. 1/turno en tu movimiento: teletransportarte hasta 9m; si apareces adyacente a un enemigo podes atacar. 1/DL.' },
        b: { name: 'Mil cortes', desc: 'Cada esquive exitoso inflige 1d6 + MOD DES al atacante sin tirada (tipo del arma equipada, o cortante si no hay).' },
        c: { name: 'Danza de la muerte', desc: 'Si esquivas al menos un ataque durante el turno de un enemigo, tu proximo ataque contra el es un critico automatico. 1/DL.' },
      },
    ],
  },
  {
    key: 'aguante',
    name: 'Aguante',
    blurb: 'Resistencia, supervivencia y proteccion de aliados.',
    tiers: [
      {
        th: 5,
        a: { name: 'Piel dura', desc: 'Reduce 2 puntos de dano fisico (contundente, cortante, perforante) por golpe recibido (min. 1), tras calcular resistencias.' },
        b: { name: 'Imparable', desc: 'Ignoras terreno dificil no magico. Empujes de 1.5m o menos no te mueven. Ventaja en salvaciones de CON para mantener concentracion.' },
        c: { name: 'Constitucion ferrea', desc: '+5 PG maximos. Ventaja en salvaciones contra veneno y enfermedad; resistencia al dano por veneno.' },
      },
      {
        th: 10,
        a: { name: 'Segunda vida', desc: 'Al caer a 0 PG: reaccion para quedar en 1 PG. Ganas 2d10 + MOD CON PG temporales hasta el proximo DL. 1/DL.' },
        b: { name: 'Fortaleza', desc: 'Ventaja en todas las salvaciones de CON. Al recibir curacion tiras 1d6 adicional (1d8 si la fuente sos vos).' },
        c: { name: 'Provocar', desc: 'Accion bonus para marcar a un enemigo a 9m; mientras este marcado, tiene desventaja en ataques que no sean contra vos. 1/descanso corto.' },
      },
      {
        th: 15,
        a: { name: 'Indomable', desc: 'Inmune a Asustado y Paralizado. +2 a salvaciones de SAB e INT. 1/descanso corto: si fallas una salvacion de CON o FUE, podes elegir que sea un exito.' },
        b: { name: 'Muro viviente', desc: 'No podes ser empujado ni derribado involuntariamente. Zona de amenaza +1.5m. Reaccion: absorbes hasta 5 de dano dirigido a un aliado adyacente. 2/DL.' },
        c: { name: 'Represalia', desc: 'Cada vez que un enemigo adyacente te golpea con un ataque cuerpo a cuerpo, recibe dano contundente igual a tu MOD CON.' },
      },
      {
        th: 20,
        a: { name: 'Inquebrantable', desc: 'Resistencia a dano fisico no magico. Inmune a muerte instantanea. Ventaja en tiradas de muerte. Con 20 natural: recuperas 1 PG y te moves 1.5m.' },
        b: { name: 'Coloso', desc: 'Ataques CaC aplican sangrado (1d4 necrotico al inicio del turno del objetivo, CD 14 CON para frenar). Accion bonus: reducis el dano recibido en MOD CON x2 la primera vez por turno, 1 min. 1/DL.' },
        c: { name: 'Bastion', desc: 'Mientras estes por encima de la mitad de tus PG, reduces todo el dano recibido en 5. Los aliados a 1.5m reducen el dano que reciben en 2.' },
      },
    ],
  },
  {
    key: 'espiritu',
    name: 'Espiritu',
    blurb: 'Magia, potenciacion de hechizos y liderazgo.',
    tiers: [
      {
        th: 5,
        a: { name: 'Canalizar', desc: '1/DL al lanzar un hechizo, Potenciarlo: CD+2, maximizar un dado de dano, o duracion x2 (max. 1h). A nivel 11: 2 usos por DL.' },
        b: { name: 'Presencia radiante', desc: 'Ventaja en Persuasion e Intimidacion. CD de hechizos de encantamiento +2. Si un PNJ hostil falla una salvacion de SAB contra un hechizo social, queda encantado 1 minuto.' },
        c: { name: 'Chispa arcana', desc: 'Una vez por turno, al impactar con un hechizo o ataque magico, +1d6 de dano del tipo del hechizo.' },
      },
      {
        th: 10,
        a: { name: 'Resonancia arcana', desc: '1/DL antes de lanzar, declarar Resonancia: ese hechizo ignora resistencias a su tipo (inmunidad -> resistencia). No funciona contra artefactos divinos.' },
        b: { name: 'Escudo arcano', desc: 'Reaccion al recibir dano magico: reducir 1d10 + MOD de conjuracion. Usos por DL: mitad del MOD de Espiritu total, redondeado arriba.' },
        c: { name: 'Inspiracion', desc: 'Accion bonus para dar a un aliado a 9m un d6 de inspiracion que puede sumar a una tirada antes de saber el resultado. Usos: MOD de Espiritu por DL.' },
      },
      {
        th: 15,
        a: { name: 'Explosion de espiritu', desc: '1/DL antes de tirar el dano de un hechizo: hace su dano maximo automaticamente. Si afecta a varios, solo el primero recibe el maximo.' },
        b: { name: 'Vinculo de espiritu', desc: 'Accion bonus para vincular con un aliado tocado. Mientras esten a 9m, puede usar cualquier dote de Espiritu desbloqueado (1 uso/dote/DL). Se rompe si se desmaya o a mas de 18m.' },
        c: { name: 'Maestria elemental', desc: 'Elegi un tipo de dano elemental. Tus hechizos de ese tipo ignoran 5 puntos de resistencia y suman +1 a su CD.' },
      },
      {
        th: 20,
        a: { name: 'Ascension', desc: 'Accion bonus 1/DL. Durante 1 min: sin componentes V/S, CD+2, ignoras resistencias (no inmunidades), emitis luz brillante 3m. Al terminar: aturdido hasta el inicio de tu proximo turno.' },
        b: { name: 'Eco arcano', desc: 'Reaccion al terminar de lanzar un hechizo nivel 1-3: se repite al inicio de tu proximo turno sobre el mismo objetivo sin gastar espacio. No puede Potenciarse ni Explotarse.' },
        c: { name: 'Avatar arcano', desc: '1/DL accion: durante 1 min, tus hechizos de dano de un solo objetivo golpean a un objetivo adicional a eleccion dentro del alcance (mitad de dano al segundo).' },
      },
    ],
  },
];
