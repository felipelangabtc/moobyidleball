/**
 * Configuração de balanceamento. Todos os números ajustáveis do jogo estão aqui.
 * Fórmulas são documentadas no README (seção "Balanceamento").
 */
import type { AttributeKey, ChestKind, ClubUpgradeId, Rarity, TrainingFocus } from './types';

export const SAVE_VERSION = 2;

export const ATTR_MIN = 1;
export const ATTR_MAX = 99;

/** Teto de nível por estrelas e por Centro de Treinamento. */
export const LEVEL = {
  baseCap: 10,
  capPerStar: 5,
  capPerTrainingCenterLevel: 4,
  absoluteMax: 40,
  xpPerLevelBase: 40,
  xpPerLevelGrowth: 1.09,
  trainingXp: 60,
  growthPerLevel: 0.018,
  growthPerStar: 0.05,
  matchXpBase: 18,
  matchXpWin: 12,
} as const;

export const STARS = { min: 1, max: 5 } as const;

/** Fragmentos necessários para subir de n estrelas para n+1. */
export const STAR_FRAGMENT_COST: Record<number, number> = { 1: 40, 2: 90, 3: 180, 4: 320 };

export const FRAGMENTS_FROM_DUPLICATE: Record<Rarity, number> = {
  common: 8,
  rare: 20,
  epic: 50,
  legend: 120,
  mythic: 250,
};

export const POTENTIAL_RANGE: Record<Rarity, readonly [number, number]> = {
  common: [40, 58],
  rare: [52, 66],
  epic: [62, 76],
  legend: [72, 86],
  mythic: [82, 94],
};

export const ATTR_VARIANCE: Record<Rarity, number> = {
  common: 4,
  rare: 4,
  epic: 3,
  legend: 3,
  mythic: 2,
};

/** Probabilidade de cada raridade em cada tipo de baú (soma sempre 100). */
export const CHEST_RARITY_WEIGHTS: Record<ChestKind, Record<Rarity, number>> = {
  escola: { common: 70, rare: 24, epic: 5.5, legend: 0.5, mythic: 0 },
  estadio: { common: 45, rare: 36, epic: 15, legend: 3.5, mythic: 0.5 },
  ouro: { common: 20, rare: 40, epic: 28, legend: 10, mythic: 2 },
};

export const PITY = {
  /** Após esta quantidade de sorteios sem épico ou superior, o próximo é garantido épico. */
  epicAfter: 25,
  /** Após esta quantidade sem lendário ou superior, o próximo é garantido lendário. */
  legendAfter: 80,
} as const;

export interface ChestConfig {
  id: ChestKind;
  name: string;
  price: number;
  rolls: number;
  athleteChance: number;
  itemChance: number;
  coinsRange: readonly [number, number];
  fragmentsRange: readonly [number, number];
  color: string;
}

export const CHESTS: Record<ChestKind, ChestConfig> = {
  escola: {
    id: 'escola',
    name: 'Baú da Escolinha',
    price: 100,
    rolls: 3,
    athleteChance: 0.6,
    itemChance: 0.4,
    coinsRange: [20, 60],
    fragmentsRange: [0, 6],
    color: '#8bc34a',
  },
  estadio: {
    id: 'estadio',
    name: 'Baú do Estádio',
    price: 150,
    rolls: 4,
    athleteChance: 0.6,
    itemChance: 0.4,
    coinsRange: [80, 220],
    fragmentsRange: [4, 16],
    color: '#4fc3f7',
  },
  ouro: {
    id: 'ouro',
    name: 'Baú de Ouro',
    price: 175,
    rolls: 5,
    athleteChance: 0.6,
    itemChance: 0.4,
    coinsRange: [220, 600],
    fragmentsRange: [10, 40],
    color: '#f5c542',
  },
};

/** Estimativa de moedas por partida, usada no painel de idle. */
export const TRAINING = {
  coinsBase: 60,
  coinsExponent: 1.2,
  tokensPerSession: 1,
  pointsRange: [1, 3] as const,
  maxBonusPerAttribute: 12,
  focusAttributes: {
    attack: ['finishing', 'dribbling', 'pace'],
    defense: ['marking', 'tackling', 'positioning'],
    physical: ['strength', 'stamina', 'acceleration'],
    technique: ['passing', 'control', 'vision'],
    keeper: ['reflexes', 'distribution', 'positioning'],
    leadership: ['leadership', 'discipline', 'versatility'],
  } as Record<TrainingFocus, readonly AttributeKey[]>,
} as const;

export const ECONOMY = {
  startCoins: 800,
  startGems: 5,
  startTokens: 6,
  startFragments: 0,
  startClubXp: 0,
  defaultInventory: 40,
  inventoryPerStorageLevel: 15,
  rosterCap: 80,
  inventoryWarnRatio: 0.85,
  recycleCoinsPerRarity: { common: 15, rare: 45, epic: 140, legend: 380, mythic: 900 } as Record<Rarity, number>,
  fusionCount: 3,
  maxItemLevel: 5,
  itemBonusPerLevel: 1.5,
  dailyCoinCap: 40000,
} as const;

/**
 * Melhorias do clube. O custo é em moedas. Para comprar o nível N, o clube precisa
 * estar no nível N do clube (experiência de clube é progresso, não moeda).
 */
export const CLUB_UPGRADES: Record<
  ClubUpgradeId,
  { name: string; description: string; maxLevel: number; baseCost: number; costGrowth: number }
> = {
  trainingCenter: {
    name: 'Centro de Treinamento',
    description: 'Aumenta o nível máximo dos atletas e reforça o treino.',
    maxLevel: 5,
    baseCost: 500,
    costGrowth: 2.1,
  },
  youthAcademy: {
    name: 'Academia Juvenil',
    description: 'Gera fragmentos extras ao abrir baús e nas vitórias.',
    maxLevel: 5,
    baseCost: 700,
    costGrowth: 2.2,
  },
  medical: {
    name: 'Departamento Médico',
    description: 'Reduz a chance de lesão e encurta a recuperação.',
    maxLevel: 5,
    baseCost: 600,
    costGrowth: 2.0,
  },
  stadium: {
    name: 'Estádio',
    description: 'Aumenta a receita idle e a torcida nas partidas.',
    maxLevel: 5,
    baseCost: 800,
    costGrowth: 2.25,
  },
  storage: {
    name: 'Almoxarifado',
    description: 'Aumenta a capacidade de itens guardados.',
    maxLevel: 5,
    baseCost: 450,
    costGrowth: 1.9,
  },
};

export const IDLE = {
  baseCoinsPerHour: 45,
  coinsPerClubLevel: 14,
  coinsPerStadiumLevel: 0.18,
  baseCapHours: 4,
  capHoursPerYouthLevel: 0.6,
  maxCapHours: 12,
  maxElapsedHours: 24 * 14,
  minElapsedSeconds: 60,
  tokensPerHourBase: 0.25,
  clubXpPerHour: 4,
} as const;

export const CAMPAIGN = {
  opponentCurve: { base: 44, linear: 0.9, quadratic: 0.01, cap: 95 },
  bossBonus: 8,
  miniBonus: 4,
  ricochetBonus: 2,
  repeatDecay: 0.25,
  repeatFloor: 0.2,
  drawRewardFactor: 0.4,
  lossRewardFactor: 0.15,
  lossRewardMin: 15,
  phasesPerBiome: 12,
  miniEvery: 4,
  bossEvery: 12,
  ricochetEvery: 6,
  ricochetOffset: 3,
  bossMultiplier: 3,
  miniMultiplier: 1.8,
} as const;

export const CHALLENGE = {
  milestoneEvery: 5,
  coinsBase: 60,
  coinsPerWave: 12,
  coinsDailyCap: 2500,
} as const;

export const MATCH = {
  minutes: 90,
  extraMinutes: 30,
  halfTime: 45,
  minuteMs: 1000,
  speeds: [1, 2, 4] as const,
  fatigue: { drainBase: 0.55, staminaFactor: 1.2, staminaDivisor: 125, recoveryHalftime: 8, factorBase: 0.82, factorSpan: 0.18 },
  morale: { base: 0.95, span: 0.1 },
  injuryRatePerMinute: 0.00007,
  severeInjuryChance: 0.2,
  injuryFactor: 0.7,
  yellowBase: 0.2,
  redOnSecondYellow: true,
  redTeamFactor: 0.9,
  shotBase: 0.28,
  shotOnTargetBase: 0.5,
  savePercentBase: 0.62,
  sequenceBase: 0.42,
  foulChance: 0.05,
  cornerChance: 0.06,
  penaltyBoxChance: 0.18,
  rewardBase: 6,
} as const;

export const RICOCHET = {
  width: 100,
  height: 60,
  goalTop: 26,
  goalBottom: 34,
  dt: 1 / 120,
  maxSteps: 480,
  restitution: 0.78,
  friction: 0.34,
  maxSpeed: 95,
  minSpeed: 6,
  ballRadius: 0.9,
  curveDuration: 0.5,
  bumpers: [
    { x1: 70, y1: 16, x2: 70, y2: 22 },
    { x1: 84, y1: 40, x2: 92, y2: 44 },
    { x1: 90, y1: 8, x2: 97, y2: 8 },
    { x1: 78, y1: 50, x2: 78, y2: 56 },
  ] as const,
  multipliers: { goal: 1.32, direct: 1.1, out: 0.55 },
} as const;

export const MISSIONS = {
  dailyCount: 3,
  weeklyCount: 2,
} as const;

export const TUTORIAL_TOPICS = [
  'home',
  'campaign',
  'match',
  'squad',
  'chests',
  'club',
  'challenge',
  'ricochet',
] as const;
