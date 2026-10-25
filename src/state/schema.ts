/**
 * Esquema do estado salvo. Os tipos são derivados do Zod para que a validação
 * ao carregar e o tipo em TypeScript nunca divirjam.
 */
import { z } from 'zod';
import { ATTRIBUTE_KEYS, CHEST_KINDS, FORMATION_IDS, ITEM_SLOTS, POSITIONS, RARITIES, TACTIC_IDS, type Athlete, type ChestKind, type Item, type Lineup, type MatchReport } from '../domain/types';
import { COUNTER_KEYS, type CounterKey } from '../data/goals';
import { INITIAL_CAMPAIGN, type CampaignState, type SeasonProgress } from '../domain/campaign';
import { INITIAL_PITY, type PityState } from '../domain/chests';
import { INITIAL_UPGRADES, type ClubUpgradeLevels, type EquipMap } from '../domain/economy';
import { emptyMissions, type MissionsState } from '../domain/progress';
import { ECONOMY, LEVEL, SAVE_VERSION, TUTORIAL_TOPICS } from '../domain/balance';

const attrShape = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, z.number().min(0).max(120)])) as Record<(typeof ATTRIBUTE_KEYS)[number], z.ZodNumber>;
const attributesSchema = z.object(attrShape);
const bonusSchema = z.object(Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, z.number().min(-50).max(120).optional()])) as Record<(typeof ATTRIBUTE_KEYS)[number], z.ZodOptional<z.ZodNumber>>);

const rarity = z.enum(RARITIES);
const position = z.enum(POSITIONS);

export const athleteSchema = z.object({
  id: z.string().min(1).max(64),
  templateId: z.string().min(1).max(64),
  potential: z.number().min(1).max(100),
  base: attributesSchema,
  level: z.number().int().min(1).max(LEVEL.absoluteMax),
  xp: z.number().min(0),
  stars: z.number().int().min(1).max(5),
  energy: z.number().min(0).max(100),
  morale: z.number().min(0).max(100),
  status: z.enum(['ready', 'injured']),
  injuryMatches: z.number().int().min(0).max(5),
  trainingBonus: bonusSchema,
  matches: z.number().int().min(0),
  goals: z.number().int().min(0),
  assists: z.number().int().min(0),
  saves: z.number().int().min(0),
  bestRating: z.number().min(0).max(10),
  obtainedAt: z.number().min(0),
});

export const itemSchema = z.object({
  id: z.string().min(1).max(80),
  templateId: z.string().min(1).max(64),
  slot: z.enum(ITEM_SLOTS),
  rarity,
  level: z.number().int().min(1).max(ECONOMY.maxItemLevel),
  bonus: bonusSchema,
  obtainedAt: z.number().min(0),
});

const simPlayerSchema = z.object({
  id: z.string(),
  name: z.string().max(80),
  position,
  slotPosition: position,
  shortName: z.string().max(40),
  attrs: attributesSchema,
  fit: z.number().min(0).max(1.2),
  ovr: z.number().min(0).max(120),
  energy: z.number().min(0).max(100),
  morale: z.number().min(0).max(100),
  ability: z.string().nullable(),
  traits: z.array(z.string().max(40)).max(8),
  captain: z.boolean(),
  number: z.number().int().min(1).max(99),
});

const teamSchema = z.object({
  name: z.string().max(80),
  city: z.string().max(80),
  mascot: z.string().max(80),
  colors: z.tuple([z.string(), z.string()]),
  formation: z.enum(FORMATION_IDS),
  tactic: z.enum(TACTIC_IDS),
  ovr: z.number().min(0).max(120),
  players: z.array(simPlayerSchema).max(11),
});

const teamStatsSchema = z.object({
  possession: z.number().min(0).max(100),
  shots: z.number().int().min(0),
  onTarget: z.number().int().min(0),
  corners: z.number().int().min(0),
  fouls: z.number().int().min(0),
  yellow: z.number().int().min(0),
  red: z.number().int().min(0),
  saves: z.number().int().min(0),
  ricochets: z.number().int().min(0),
});

const reportSchema = z.object({
  seed: z.number(),
  arena: z.enum(['pitch', 'ricochet']),
  home: teamSchema,
  away: teamSchema,
  score: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  shootout: z.tuple([z.number().int().min(0), z.number().int().min(0)]).nullable(),
  extraTime: z.boolean(),
  winner: z.enum(['home', 'away']).nullable(),
  events: z.array(z.object({
    minute: z.number().min(0).max(200),
    kind: z.string().max(20),
    side: z.enum(['home', 'away', 'neutral']),
    text: z.string().max(300),
    playerIds: z.array(z.string()).max(4),
    x: z.number().min(-5).max(105),
    y: z.number().min(-5).max(65),
    score: z.tuple([z.number(), z.number()]),
  })).max(400),
  trails: z.array(z.object({
    minute: z.number(),
    side: z.enum(['home', 'away']),
    points: z.array(z.tuple([z.number(), z.number()])).max(400),
    outcome: z.enum(['goal', 'direct', 'out']),
    bounces: z.number().int().min(0),
  })).max(60),
  stats: z.object({
    home: teamStatsSchema,
    away: teamStatsSchema,
  }),
  playerStats: z.record(z.string(), z.object({
    rating: z.number(),
    goals: z.number(),
    assists: z.number(),
    saves: z.number(),
    shots: z.number(),
    tackles: z.number(),
    fouls: z.number(),
    yellow: z.number(),
    red: z.number(),
    injured: z.boolean(),
    severe: z.boolean(),
    minutes: z.number(),
    energyEnd: z.number(),
  })),
  goalMinutes: z.array(z.object({
    minute: z.number(),
    side: z.enum(['home', 'away']),
    scorer: z.string(),
    kind: z.enum(['normal', 'penalty', 'ricochet']),
  })),
});

export const matchRecordSchema = z.object({
  id: z.string().max(80),
  at: z.number(),
  mode: z.enum(['campaign', 'challenge']),
  phase: z.number().int().min(0).max(100000),
  kind: z.enum(['normal', 'mini', 'boss', 'ricochet', 'challenge']),
  opponentName: z.string().max(80),
  opponentOvr: z.number().min(0).max(120),
  outcome: z.enum(['win', 'draw', 'loss']),
  score: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  coins: z.number().min(0),
  clubXp: z.number().min(0),
  tokens: z.number().min(0),
  fragments: z.number().min(0),
  chest: z.enum(CHEST_KINDS).nullable(),
  itemName: z.string().nullable(),
  firstWin: z.boolean(),
  achievements: z.array(z.string()).max(20),
  levelUps: z.number().int().min(0),
  injuries: z.number().int().min(0),
  report: reportSchema,
});

export const historyEntrySchema = z.object({
  id: z.string().max(80),
  at: z.number(),
  label: z.string().max(120),
  opponentName: z.string().max(80),
  score: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
  outcome: z.enum(['win', 'draw', 'loss']),
  shootout: z.tuple([z.number().int().min(0), z.number().int().min(0)]).nullable(),
  coins: z.number().min(0),
});

export const settingsSchema = z.object({
  sound: z.boolean(),
  volume: z.number().min(0).max(1),
  reduceMotion: z.enum(['system', 'on', 'off']),
  autoLineup: z.boolean(),
  autoCollect: z.boolean(),
  autoPlay: z.boolean(),
  defaultSpeed: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  language: z.enum(['pt', 'en']),
});

const countersShape = Object.fromEntries(COUNTER_KEYS.map((k) => [k, z.number().min(0)])) as Record<CounterKey, z.ZodNumber>;

export const gameStateSchema = z.object({
  version: z.literal(SAVE_VERSION),
  clubName: z.string().min(1).max(40),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastSeenAt: z.number(),
  resources: z.object({
    coins: z.number().min(0).max(1e12),
    clubXp: z.number().min(0).max(1e12),
    tokens: z.number().min(0).max(1e9),
    fragments: z.number().min(0).max(1e12),
  }),
  upgrades: z.object({
    trainingCenter: z.number().int().min(0).max(5),
    youthAcademy: z.number().int().min(0).max(5),
    medical: z.number().int().min(0).max(5),
    stadium: z.number().int().min(0).max(5),
    storage: z.number().int().min(0).max(5),
  }),
  athletes: z.array(athleteSchema).max(400),
  items: z.array(itemSchema).max(1000),
  equipped: z.record(z.string(), z.record(z.string(), z.string())),
  lineup: z.object({
    formation: z.enum(FORMATION_IDS),
    tactic: z.enum(TACTIC_IDS),
    slots: z.array(z.string().nullable()).length(11),
    captainId: z.string().nullable(),
  }),
  chestStock: z.object({ escola: z.number().int().min(0), estadio: z.number().int().min(0), ouro: z.number().int().min(0) }),
  pity: z.object({ sinceEpic: z.number().int().min(0), sinceLegend: z.number().int().min(0) }),
  campaign: z.object({
    activePhase: z.number().int().min(1),
    highestCleared: z.number().int().min(0),
    wins: z.record(z.string(), z.number().int().min(0)),
    losses: z.record(z.string(), z.number().int().min(0)),
    draws: z.record(z.string(), z.number().int().min(0)),
  }),
  seasons: z.record(z.string(), z.object({
    wins: z.number().int().min(0),
    goals: z.number().int().min(0),
    bossDone: z.boolean(),
    claimed: z.array(z.string()),
  })),
  challenge: z.object({
    wave: z.number().int().min(0),
    best: z.number().int().min(0),
    milestones: z.array(z.number().int()),
    active: z.boolean(),
  }),
  missions: z.object({
    dayKey: z.string(),
    weekKey: z.string(),
    daily: z.array(z.string()),
    weekly: z.array(z.string()),
    progress: z.record(z.string(), z.number().min(0)),
    claimed: z.record(z.string(), z.boolean()),
    lossPayoutsToday: z.number().int().min(0),
    challengeCoinsToday: z.number().min(0),
  }),
  counters: z.object(countersShape),
  records: z.object({ bestWave: z.number().int().min(0), maxStars: z.number().int().min(1).max(5), maxLevel: z.number().int().min(1) }),
  achievements: z.record(z.string(), z.number()),
  history: z.array(historyEntrySchema).max(60),
  openings: z.array(z.object({
    id: z.string().max(80),
    at: z.number(),
    kind: z.enum(CHEST_KINDS),
    count: z.number().int().min(1).max(10),
    coins: z.number().min(0),
    fragments: z.number().min(0),
    highlights: z.array(z.string().max(120)).max(12),
  })).max(30),
  encyclopedia: z.object({
    opponents: z.array(z.string()).max(500),
    athletes: z.array(z.string()).max(200),
    items: z.array(z.string()).max(200),
  }),
  idle: z.object({ lastCollectedAt: z.number(), totalCollected: z.number().min(0) }),
  tutorials: z.record(z.string(), z.enum(['seen', 'dismissed'])),
  settings: settingsSchema,
  lastMatch: matchRecordSchema.nullable(),
  nextId: z.number().int().min(1),
});

export type GameState = z.infer<typeof gameStateSchema>;
export type TutorialTopic = (typeof TUTORIAL_TOPICS)[number];
export type MatchRecord = z.infer<typeof matchRecordSchema>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.6,
  reduceMotion: 'system',
  autoLineup: true,
  autoCollect: false,
  autoPlay: false,
  defaultSpeed: 1,
  language: 'pt',
};

export const DEFAULT_LINEUP: Lineup = {
  formation: '4-4-2',
  tactic: 'posse',
  slots: Array.from({ length: 11 }, () => null),
  captainId: null,
};

export function emptyCounters(): Record<CounterKey, number> {
  return Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0])) as Record<CounterKey, number>;
}

export function createInitialState(now: number, clubName = 'Clube Horizonte'): GameState {
  const date = new Date(now);
  return {
    version: SAVE_VERSION,
    clubName,
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
    resources: {
      coins: ECONOMY.startCoins,
      clubXp: ECONOMY.startClubXp,
      tokens: ECONOMY.startTokens,
      fragments: ECONOMY.startFragments,
    },
    upgrades: { ...INITIAL_UPGRADES } as ClubUpgradeLevels,
    athletes: [],
    items: [],
    equipped: {} as EquipMap,
    lineup: { ...DEFAULT_LINEUP, slots: [...DEFAULT_LINEUP.slots] },
    chestStock: { escola: 0, estadio: 0, ouro: 0 } satisfies Record<ChestKind, number>,
    pity: { ...INITIAL_PITY } as PityState,
    campaign: { ...INITIAL_CAMPAIGN } as CampaignState,
    seasons: {} as Record<string, SeasonProgress>,
    challenge: { wave: 0, best: 0, milestones: [], active: false },
    missions: emptyMissions(date) as MissionsState,
    counters: emptyCounters(),
    records: { bestWave: 0, maxStars: 1, maxLevel: 1 },
    achievements: {},
    history: [],
    openings: [],
    encyclopedia: { opponents: [], athletes: [], items: [] },
    idle: { lastCollectedAt: now, totalCollected: 0 },
    tutorials: {},
    settings: { ...DEFAULT_SETTINGS },
    lastMatch: null,
    nextId: 1,
  };
}

export type { Athlete, Item, Lineup, MatchReport, CounterKey };
