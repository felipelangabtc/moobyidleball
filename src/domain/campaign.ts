/**
 * Campanha: estrutura de fases, dificuldade, recompensas, regra de derrota,
 * metas de temporada e progressão. Tudo aqui é determinístico e testável.
 *
 * Estrutura:
 * - Cada bioma é uma temporada com 12 fases.
 * - Fases múltiplas de 4 são "mini-chefes" (mata-mata: exigem vencedor).
 * - Fase 12, 24, ... é o "chefe de temporada" (mata-mata).
 * - Fases 3, 9, 15, ... são "arena de placas" (física de ricochete nos chutes).
 */
import { CAMPAIGN, CHESTS, MATCH } from './balance';
import { biomeFor, type BiomeDef } from '../data/biomes';
import { CHEST_KINDS, type ChestKind } from './types';

export type PhaseKind = 'normal' | 'mini' | 'boss' | 'ricochet';

export interface PhaseInfo {
  number: number;
  kind: PhaseKind;
  season: number;
  seasonIndex: number;
  biome: BiomeDef;
  inSeasonIndex: number;
  requiresWinner: boolean;
  arena: 'pitch' | 'ricochet';
  label: string;
  targetOvr: number;
  bonus: number;
}

export function phaseKindOf(n: number): PhaseKind {
  if (n % CAMPAIGN.bossEvery === 0) return 'boss';
  if (n % CAMPAIGN.miniEvery === 0) return 'mini';
  if (n % CAMPAIGN.ricochetEvery === CAMPAIGN.ricochetOffset) return 'ricochet';
  return 'normal';
}

export function kindLabel(kind: PhaseKind): string {
  switch (kind) {
    case 'boss':
      return 'Chefe de temporada';
    case 'mini':
      return 'Mini-chefe';
    case 'ricochet':
      return 'Arena de placas';
    default:
      return 'Partida de liga';
  }
}

/**
 * Curva de dificuldade: OVR alvo = base + linear·n + quadrático·n², com teto.
 * Chefes recebem bônus; mini-chefes e arenas recebem bônus menores.
 */
export function opponentOvrFor(n: number, kind: PhaseKind): number {
  const curve = CAMPAIGN.opponentCurve;
  const raw = curve.base + curve.linear * n + curve.quadratic * n * n;
  const bonus = kind === 'boss' ? CAMPAIGN.bossBonus : kind === 'mini' ? CAMPAIGN.miniBonus : kind === 'ricochet' ? 2 : 0;
  return Math.round(Math.min(curve.cap, raw + bonus));
}

export function phaseInfo(n: number): PhaseInfo {
  const safe = Math.max(1, Math.floor(n));
  const kind = phaseKindOf(safe);
  const seasonIndex = Math.floor((safe - 1) / CAMPAIGN.phasesPerBiome);
  const inSeasonIndex = ((safe - 1) % CAMPAIGN.phasesPerBiome) + 1;
  const biome = biomeFor(seasonIndex);
  const bonus = kind === 'boss' ? CAMPAIGN.bossBonus : kind === 'mini' ? CAMPAIGN.miniBonus : kind === 'ricochet' ? 2 : 0;
  return {
    number: safe,
    kind,
    season: seasonIndex + 1,
    seasonIndex,
    biome,
    inSeasonIndex,
    requiresWinner: kind === 'boss' || kind === 'mini',
    arena: kind === 'ricochet' ? 'ricochet' : 'pitch',
    label: `Fase ${safe}`,
    targetOvr: opponentOvrFor(safe, kind),
    bonus,
  };
}

/** Modificador de recompensa por repetição. Vitórias repetidas rendem cada vez menos. */
export function repeatFactor(timesWon: number): number {
  return Math.max(CAMPAIGN.repeatFloor, 1 / (1 + CAMPAIGN.repeatDecay * timesWon));
}

export type MatchOutcome = 'win' | 'draw' | 'loss';

export interface PhaseRewards {
  coins: number;
  clubXp: number;
  tokens: number;
  fragments: number;
  chest: ChestKind | null;
  itemChance: number;
  firstWin: boolean;
  repeatFactor: number;
  description: string;
}

/**
 * Recompensas de uma partida de campanha.
 * - vitória: escala com a fase, com multiplicador de chefe/mini-chefe e repetição.
 * - empate (só em fases de liga): recompensa reduzida, sem avanço.
 * - derrota: consolação pequena, com piso mínimo.
 */
export function phaseRewards(info: PhaseInfo, outcome: MatchOutcome, timesWonBefore: number): PhaseRewards {
  const base = 80 + 22 * info.number;
  const kindMult = info.kind === 'boss' ? CAMPAIGN.bossMultiplier : info.kind === 'mini' ? CAMPAIGN.miniMultiplier : 1;
  const repeat = repeatFactor(timesWonBefore);
  const firstWin = outcome === 'win' && timesWonBefore === 0;

  if (outcome === 'win') {
    const coins = Math.round(base * kindMult * repeat);
    return {
      coins,
      clubXp: Math.round((25 + 4 * info.number) * repeat),
      tokens: 3,
      fragments: firstWin ? 10 + info.number : Math.round(2 * repeat),
      chest: firstWin ? chestForPhase(info) : null,
      itemChance: 0.25 * repeat,
      firstWin,
      repeatFactor: repeat,
      description: firstWin ? 'Primeira vitória: recompensa completa e baú.' : `Vitória repetida (${Math.round(repeat * 100)}% da recompensa).`,
    };
  }
  if (outcome === 'draw') {
    return {
      coins: Math.round(base * kindMult * CAMPAIGN.drawRewardFactor * repeat),
      clubXp: Math.round(12 + 2 * info.number),
      tokens: 2,
      fragments: 0,
      chest: null,
      itemChance: 0,
      firstWin: false,
      repeatFactor: repeat,
      description: 'Empate: sem avanço. Recompensa reduzida.',
    };
  }
  return {
    coins: Math.max(CAMPAIGN.lossRewardMin, Math.round(base * CAMPAIGN.lossRewardFactor)),
    clubXp: 8,
    tokens: 1,
    fragments: 0,
    chest: null,
    itemChance: 0,
    firstWin: false,
    repeatFactor: 1,
    description: 'Derrota: consolação. Você voltará uma fase.',
  };
}

/** Baú de primeira vitória: segue o tipo do bioma; chefes sobem um degrau. */
export function chestForPhase(info: PhaseInfo): ChestKind {
  const order = CHEST_KINDS;
  const base = order.indexOf(info.biome.chest);
  const bump = info.kind === 'boss' ? 1 : 0;
  return order[Math.min(order.length - 1, base + bump)] ?? 'escola';
}

export interface CampaignState {
  activePhase: number;
  highestCleared: number;
  wins: Record<string, number>;
  losses: Record<string, number>;
  draws: Record<string, number>;
}

export const INITIAL_CAMPAIGN: CampaignState = {
  activePhase: 1,
  highestCleared: 0,
  wins: {},
  losses: {},
  draws: {},
};

export function isUnlocked(state: CampaignState, n: number): boolean {
  return n <= state.highestCleared + 1;
}

/**
 * Regra de progressão após uma partida de campanha.
 * - Vitória na fase mais avançada desbloqueada: avança para a próxima.
 * - Vitória em revanche: a fase ativa não muda.
 * - Empate: nada muda (repete a fase).
 * - Derrota: volta uma fase, sem descer abaixo da primeira (fase 1).
 */
export function applyPhaseResult(state: CampaignState, n: number, outcome: MatchOutcome): CampaignState {
  const key = String(n);
  const next: CampaignState = {
    ...state,
    wins: { ...state.wins },
    losses: { ...state.losses },
    draws: { ...state.draws },
  };
  if (outcome === 'win') {
    next.wins[key] = (next.wins[key] ?? 0) + 1;
    if (n > state.highestCleared) {
      next.highestCleared = n;
      next.activePhase = n + 1;
    } else {
      next.activePhase = state.activePhase;
    }
  } else if (outcome === 'draw') {
    next.draws[key] = (next.draws[key] ?? 0) + 1;
  } else {
    next.losses[key] = (next.losses[key] ?? 0) + 1;
    next.activePhase = Math.max(1, n - 1);
  }
  return next;
}

export function timesWon(state: CampaignState, n: number): number {
  return state.wins[String(n)] ?? 0;
}

/** Metas de temporada (por bioma). */
export interface SeasonGoal {
  id: 'wins8' | 'goals25' | 'boss';
  title: string;
  description: string;
  target: number;
  reward: { coins: number; tokens?: number; fragments?: number; chest?: boolean };
}

export const SEASON_GOALS: SeasonGoal[] = [
  { id: 'wins8', title: 'Vencer 8 partidas', description: 'Vença 8 partidas de campanha nesta temporada.', target: 8, reward: { coins: 500, tokens: 4 } },
  { id: 'goals25', title: 'Marcar 25 gols', description: 'Marque 25 gols de campanha nesta temporada.', target: 25, reward: { coins: 400, fragments: 15 } },
  { id: 'boss', title: 'Conquistar o chefe', description: 'Vença o chefe de temporada.', target: 1, reward: { coins: 800, chest: true } },
];

export interface SeasonProgress {
  wins: number;
  goals: number;
  bossDone: boolean;
  claimed: string[];
}

export const EMPTY_SEASON: SeasonProgress = { wins: 0, goals: 0, bossDone: false, claimed: [] };

export function seasonGoalProgress(progress: SeasonProgress, goal: SeasonGoal): number {
  if (goal.id === 'wins8') return progress.wins;
  if (goal.id === 'goals25') return progress.goals;
  return progress.bossDone ? 1 : 0;
}

export function seasonGoalDone(progress: SeasonProgress, goal: SeasonGoal): boolean {
  return seasonGoalProgress(progress, goal) >= goal.target;
}

export function seasonLabel(seasonIndex: number): string {
  const biome = biomeFor(seasonIndex);
  return `Temporada ${seasonIndex + 1} · ${biome.name}`;
}

/** Valor de um baú em moedas, para previsão de recompensas. */
export function chestCoinAverage(kind: ChestKind): number {
  const [min, max] = CHESTS[kind].coinsRange;
  return (min + max) / 2;
}

export function regulationMinutes(): number {
  return MATCH.minutes;
}
