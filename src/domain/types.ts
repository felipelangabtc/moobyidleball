/** Tipos centrais do domínio. Nenhum dado de interface deve vazar para cá. */

export const ATTRIBUTE_KEYS = [
  'finishing',
  'passing',
  'vision',
  'dribbling',
  'control',
  'pace',
  'acceleration',
  'strength',
  'stamina',
  'positioning',
  'marking',
  'tackling',
  'heading',
  'reflexes',
  'distribution',
  'precision',
  'curve',
  'discipline',
  'leadership',
  'versatility',
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;
export type AttributeBonus = Partial<Record<AttributeKey, number>>;

export const POSITIONS = ['GK', 'CB', 'FB', 'DM', 'CM', 'W', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];

export const RARITIES = ['common', 'rare', 'epic', 'legend', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const FORMATION_IDS = ['4-3-3', '4-4-2', '3-5-2', '5-3-2'] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

export const TACTIC_IDS = ['posse', 'contra', 'pressao', 'bloco', 'lateral', 'direto'] as const;
export type TacticId = (typeof TACTIC_IDS)[number];

export const CHEST_KINDS = ['escola', 'estadio', 'ouro'] as const;
export type ChestKind = (typeof CHEST_KINDS)[number];

export const ITEM_SLOTS = ['boots', 'gloves', 'armband', 'kit'] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

export const CLUB_UPGRADE_IDS = ['trainingCenter', 'youthAcademy', 'medical', 'stadium', 'storage'] as const;
export type ClubUpgradeId = (typeof CLUB_UPGRADE_IDS)[number];

export const TRAINING_FOCUS_IDS = ['attack', 'defense', 'physical', 'technique', 'keeper', 'leadership'] as const;
export type TrainingFocus = (typeof TRAINING_FOCUS_IDS)[number];

export type AthleteStatus = 'ready' | 'injured';

export interface AthleteTemplate {
  id: string;
  name: string;
  nationality: string;
  position: Position;
  secondary: Position[];
  rarity: Rarity;
  ability: string;
  shape: Partial<Record<AttributeKey, number>>;
  traits: string[];
  bio: string;
  hue: number;
}

export interface Athlete {
  id: string;
  templateId: string;
  potential: number;
  base: Attributes;
  level: number;
  xp: number;
  stars: number;
  energy: number;
  morale: number;
  status: AthleteStatus;
  injuryMatches: number;
  trainingBonus: AttributeBonus;
  matches: number;
  goals: number;
  assists: number;
  saves: number;
  bestRating: number;
  obtainedAt: number;
}

export interface Item {
  id: string;
  templateId: string;
  slot: ItemSlot;
  rarity: Rarity;
  level: number;
  bonus: AttributeBonus;
  obtainedAt: number;
}

export interface Opponent {
  name: string;
  city: string;
  mascot: string;
  colors: [string, string];
  formation: FormationId;
  tactic: TacticId;
  players: SimPlayer[];
  targetOvr: number;
}

/** Jogador já resolvido para simulação (cópia imutável do estado). */
export interface SimPlayer {
  id: string;
  name: string;
  position: Position;
  slotPosition: Position;
  shortName: string;
  attrs: Attributes;
  fit: number;
  ovr: number;
  energy: number;
  morale: number;
  ability: string | null;
  traits: string[];
  captain: boolean;
  number: number;
}

export interface Lineup {
  formation: FormationId;
  tactic: TacticId;
  slots: Array<string | null>;
  captainId: string | null;
}

export type MatchSide = 'home' | 'away';
export type ArenaId = 'pitch' | 'ricochet';

export type MatchEventKind =
  | 'kickoff'
  | 'attack'
  | 'pass'
  | 'tackle'
  | 'foul'
  | 'yellow'
  | 'red'
  | 'shot'
  | 'save'
  | 'miss'
  | 'post'
  | 'block'
  | 'corner'
  | 'penalty'
  | 'goal'
  | 'ability'
  | 'injury'
  | 'ricochet'
  | 'halftime'
  | 'extra'
  | 'fulltime'
  | 'shootout';

export interface MatchEvent {
  minute: number;
  kind: MatchEventKind;
  side: MatchSide | 'neutral';
  text: string;
  playerIds: string[];
  x: number;
  y: number;
  score: [number, number];
}

export interface Trail {
  minute: number;
  side: MatchSide;
  points: Array<[number, number]>;
  outcome: 'goal' | 'direct' | 'out';
  bounces: number;
}

export interface PlayerMatchStat {
  rating: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  tackles: number;
  fouls: number;
  yellow: number;
  red: number;
  injured: boolean;
  severe: boolean;
  minutes: number;
  energyEnd: number;
}

export interface TeamMatchStats {
  possession: number;
  shots: number;
  onTarget: number;
  corners: number;
  fouls: number;
  yellow: number;
  red: number;
  saves: number;
  ricochets: number;
}

export interface MatchTeam {
  name: string;
  city: string;
  mascot: string;
  colors: [string, string];
  formation: FormationId;
  tactic: TacticId;
  ovr: number;
  players: SimPlayer[];
}

export interface MatchReport {
  seed: number;
  arena: ArenaId;
  home: MatchTeam;
  away: MatchTeam;
  score: [number, number];
  shootout: [number, number] | null;
  extraTime: boolean;
  winner: MatchSide | null;
  events: MatchEvent[];
  trails: Trail[];
  stats: Record<MatchSide, TeamMatchStats>;
  playerStats: Record<string, PlayerMatchStat>;
  goalMinutes: Array<{ minute: number; side: MatchSide; scorer: string; kind: 'normal' | 'penalty' | 'ricochet' }>;
}

export interface MatchOptions {
  requiresWinner: boolean;
  arena: ArenaId;
  medicalLevel?: number;
  crowdBonus?: number;
}
