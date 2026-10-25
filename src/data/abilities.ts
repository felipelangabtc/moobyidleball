/** Habilidades especiais. Ativam por gatilho, com recarga (em minutos) e limite por partida. */

export type AbilityTrigger = 'shot' | 'defend' | 'save' | 'pass' | 'corner' | 'counter';

export interface AbilityDef {
  id: string;
  name: string;
  trigger: AbilityTrigger;
  description: string;
  /** Efeito principal: ajuste aditivo de probabilidade ou de qualidade. */
  value: number;
  cooldownMinutes: number;
  maxUsesPerMatch: number;
  activationChance: number;
  limit: string;
}

export const ABILITIES: Record<string, AbilityDef> = {
  longRange: {
    id: 'longRange',
    name: 'Chute de Longe',
    trigger: 'shot',
    description: 'Ao finalizar, aumenta a chance de gol do chute.',
    value: 0.06,
    cooldownMinutes: 12,
    maxUsesPerMatch: 3,
    activationChance: 0.35,
    limit: 'Recarga de 12 min; até 3 usos por partida.',
  },
  wall: {
    id: 'wall',
    name: 'Muralha',
    trigger: 'defend',
    description: 'Ao defender, reduz a chance de gol do adversário.',
    value: 0.05,
    cooldownMinutes: 10,
    maxUsesPerMatch: 3,
    activationChance: 0.3,
    limit: 'Recarga de 10 min; até 3 usos por partida.',
  },
  ironHands: {
    id: 'ironHands',
    name: 'Mão Firme',
    trigger: 'save',
    description: 'Aumenta a chance de defesa do goleiro em finalizações.',
    value: 0.07,
    cooldownMinutes: 8,
    maxUsesPerMatch: 4,
    activationChance: 0.4,
    limit: 'Recarga de 8 min; até 4 usos por partida.',
  },
  maestro: {
    id: 'maestro',
    name: 'Maestro',
    trigger: 'pass',
    description: 'Eleva a qualidade das construções e aumenta a chance de ataques.',
    value: 0.08,
    cooldownMinutes: 9,
    maxUsesPerMatch: 3,
    activationChance: 0.35,
    limit: 'Recarga de 9 min; até 3 usos por partida.',
  },
  aerial: {
    id: 'aerial',
    name: 'Cabeceio Aéreo',
    trigger: 'corner',
    description: 'Em escanteios e cruzamentos, aumenta a chance de cabeceio.',
    value: 0.05,
    cooldownMinutes: 10,
    maxUsesPerMatch: 2,
    activationChance: 0.45,
    limit: 'Recarga de 10 min; até 2 usos por partida.',
  },
  counterBurst: {
    id: 'counterBurst',
    name: 'Contra-ataque Relâmpago',
    trigger: 'counter',
    description: 'Ao recuperar a bola, pode transformar a jogada em contra-ataque imediato.',
    value: 0.1,
    cooldownMinutes: 11,
    maxUsesPerMatch: 2,
    activationChance: 0.4,
    limit: 'Recarga de 11 min; até 2 usos por partida.',
  },
  curler: {
    id: 'curler',
    name: 'Efeito Perfeito',
    trigger: 'shot',
    description: 'Chutes com curva ganham precisão e cruzam melhor a trajetória.',
    value: 0.04,
    cooldownMinutes: 7,
    maxUsesPerMatch: 4,
    activationChance: 0.3,
    limit: 'Recarga de 7 min; até 4 usos por partida.',
  },
  reader: {
    id: 'reader',
    name: 'Leitura de Jogo',
    trigger: 'defend',
    description: 'Antecipa passes adversários, reduzindo a chance de ataque perigoso.',
    value: 0.04,
    cooldownMinutes: 6,
    maxUsesPerMatch: 4,
    activationChance: 0.35,
    limit: 'Recarga de 6 min; até 4 usos por partida.',
  },
  rebound: {
    id: 'rebound',
    name: 'Sobra Certeira',
    trigger: 'shot',
    description: 'Aproveita rebotes: chutes após defesa têm mais chance de gol.',
    value: 0.05,
    cooldownMinutes: 9,
    maxUsesPerMatch: 3,
    activationChance: 0.35,
    limit: 'Recarga de 9 min; até 3 usos por partida.',
  },
  cross: {
    id: 'cross',
    name: 'Cruzamento Preciso',
    trigger: 'pass',
    description: 'Cruzamentos mais precisos elevam o perigo na área.',
    value: 0.06,
    cooldownMinutes: 8,
    maxUsesPerMatch: 3,
    activationChance: 0.35,
    limit: 'Recarga de 8 min; até 3 usos por partida.',
  },
  leader: {
    id: 'leader',
    name: 'Voz de Comando',
    trigger: 'pass',
    description: 'Motiva o time: aumenta a moral durante a partida e a chance de construir ataques.',
    value: 0.03,
    cooldownMinutes: 15,
    maxUsesPerMatch: 2,
    activationChance: 0.5,
    limit: 'Recarga de 15 min; até 2 usos por partida.',
  },
  sweeper: {
    id: 'sweeper',
    name: 'Cobertura Total',
    trigger: 'defend',
    description: 'Ao errar a marcação, outro defensor cobre e reduz o perigo.',
    value: 0.06,
    cooldownMinutes: 12,
    maxUsesPerMatch: 2,
    activationChance: 0.4,
    limit: 'Recarga de 12 min; até 2 usos por partida.',
  },
};

export function abilityById(id: string | null | undefined): AbilityDef | null {
  if (!id) return null;
  return ABILITIES[id] ?? null;
}
