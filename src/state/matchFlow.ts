/**
 * Fluxo de partida: monta o plano (adversário, arena, regras), simula e aplica o
 * resultado ao estado. Todas as recompensas são concedidas aqui, uma única vez,
 * no início da partida. A animação depois apenas exibe o relatório já calculado.
 */
import { CHALLENGE, LEVEL } from '../domain/balance';
import { addAthleteXp, levelCap } from '../domain/athletes';
import {
  EMPTY_SEASON,
  SEASON_GOALS,
  applyPhaseResult,
  opponentOvrFor,
  phaseInfo,
  phaseRewards,
  seasonGoalDone,
  timesWon,
  type MatchOutcome,
  type PhaseInfo,
  type PhaseRewards,
  type SeasonProgress,
} from '../domain/campaign';
import { INITIAL_PITY, effectiveWeights, itemTemplatesOf } from '../domain/chests';
import { inventoryCapacity, recycleValue, upgradeEffects, type EquipMap } from '../domain/economy';
import { advanceMissions, newlyUnlockedAchievements, rolloverMissions } from '../domain/progress';
import { autoLineup, buildPlayerTeam, generateOpponent, opponentToMatchTeam, validateLineup, type SquadContext } from '../domain/squad';
import { templateById } from '../data/athletes';
import { createRng, hashString, type Rng } from '../domain/rng';
import { simulateMatch } from '../sim/engine';
import type { ArenaId, Athlete, ChestKind, Item, MatchOptions, MatchReport, MatchTeam, Opponent, Rarity } from '../domain/types';
import { RARITIES } from '../domain/types';
import type { CounterKey } from '../data/goals';
import type { GameState, MatchRecord } from './schema';
import { biomeChestFor, clubTeamIdentity } from './clubIdentity';

export type MatchMode = { kind: 'campaign'; phase: number } | { kind: 'challenge' };

export interface MatchPlan {
  mode: MatchMode;
  label: string;
  matchKind: MatchRecord['kind'];
  info: PhaseInfo | null;
  wave: number;
  opponent: Opponent;
  options: MatchOptions;
  seed: number;
  arena: ArenaId;
  opponentOvr: number;
}

export interface ResolvedMatch {
  state: GameState;
  record: MatchRecord;
  report: MatchReport;
  rewards: PhaseRewards;
  achievements: string[];
  levelUps: number;
  injuries: number;
  outcome: MatchOutcome;
  notes: string[];
}

export function squadContext(state: Pick<GameState, 'athletes' | 'items' | 'equipped'>): SquadContext {
  return { athletes: state.athletes, items: state.items, equipped: state.equipped as EquipMap };
}

/** Problemas da escalação atual. Lista vazia significa que a partida pode começar. */
export function lineupProblems(state: GameState): string[] {
  return validateLineup(state.lineup, squadContext(state)).map((issue) => issue.message);
}

export function suggestedLineup(state: GameState): GameState['lineup'] {
  return autoLineup(state.lineup.formation, squadContext(state), state.lineup.tactic);
}

export function buildHomeTeam(state: GameState): MatchTeam {
  const identity = clubTeamIdentity(state.clubName);
  return buildPlayerTeam(state.clubName, identity.city, identity.mascot, identity.colors, state.lineup, squadContext(state));
}

export function planMatch(state: GameState, mode: MatchMode): MatchPlan {
  if (mode.kind === 'campaign') {
    const info = phaseInfo(mode.phase);
    const opponent = generateOpponent(`phase:${info.number}`, info.targetOvr);
    return {
      mode,
      label: `Fase ${info.number} · ${info.biome.name}`,
      matchKind: info.kind,
      info,
      wave: 0,
      opponent,
      options: {
        requiresWinner: info.requiresWinner,
        arena: info.arena,
        medicalLevel: state.upgrades.medical,
        crowdBonus: state.upgrades.stadium,
      },
      seed: hashString(`match:${state.counters.matches}:${info.number}:${state.nextId}`),
      arena: info.arena,
      opponentOvr: info.targetOvr,
    };
  }
  const wave = state.challenge.wave + 1;
  const ovr = opponentOvrFor(wave + 6, 'normal');
  const arena: ArenaId = wave % 4 === 0 ? 'ricochet' : 'pitch';
  return {
    mode,
    label: `Torneio · Onda ${wave}`,
    matchKind: 'challenge',
    info: null,
    wave,
    opponent: generateOpponent(`wave:${wave}`, ovr),
    options: { requiresWinner: true, arena, medicalLevel: state.upgrades.medical, crowdBonus: state.upgrades.stadium },
    seed: hashString(`challenge:${wave}:${state.counters.matches}:${state.nextId}`),
    arena,
    opponentOvr: ovr,
  };
}

export function outcomeOf(report: MatchReport, requiresWinner: boolean): MatchOutcome {
  if (report.winner === 'home') return 'win';
  if (report.winner === 'away') return 'loss';
  return requiresWinner ? 'loss' : 'draw';
}

/** Simula a partida e aplica o resultado. Só deve ser chamada com escalação válida. */
export function playMatch(state: GameState, plan: MatchPlan, now: number): ResolvedMatch {
  const home = buildHomeTeam(state);
  const away = opponentToMatchTeam(plan.opponent);
  const report = simulateMatch(home, away, plan.seed, plan.options);
  return applyMatchResult(state, plan, report, now);
}

const LOSS_PAYOUT_DAILY_CAP = 3;

export function applyMatchResult(state: GameState, plan: MatchPlan, report: MatchReport, now: number): ResolvedMatch {
  const rng = createRng(plan.seed).fork('rewards');
  const outcome = outcomeOf(report, plan.options.requiresWinner);
  const ourGoals = report.score[0];
  const theirGoals = report.score[1];
  const notes: string[] = [];

  const next: GameState = structuredClone(state);
  const youth = next.upgrades.youthAcademy;
  const stadium = next.upgrades.stadium;

  let rewards: PhaseRewards;
  let chestKind: ChestKind | null = null;

  if (plan.info && plan.mode.kind === 'campaign') {
    const info = plan.info;
    rewards = phaseRewards(info, outcome, timesWon(next.campaign, info.number));
    chestKind = rewards.chest;
    next.campaign = applyPhaseResult(next.campaign, info.number, outcome);

    const seasonKey = String(info.seasonIndex);
    const season: SeasonProgress = next.seasons[seasonKey] ?? { ...EMPTY_SEASON, claimed: [] };
    next.seasons = {
      ...next.seasons,
      [seasonKey]: {
        ...season,
        wins: season.wins + (outcome === 'win' ? 1 : 0),
        goals: season.goals + ourGoals,
        bossDone: season.bossDone || (info.kind === 'boss' && outcome === 'win'),
      },
    };
    const seasonResult = claimSeasonGoals(next, info.seasonIndex);
    notes.push(...seasonResult.notes);
    if (info.kind === 'boss' && outcome === 'win') next.counters.bosses += 1;
  } else {
    rewards = challengeRewards(next, plan.wave, outcome);
    if (outcome === 'win') {
      next.missions.challengeCoinsToday += rewards.coins;
      next.challenge = { ...next.challenge, wave: plan.wave, best: Math.max(next.challenge.best, plan.wave), active: true };
      next.records.bestWave = Math.max(next.records.bestWave, plan.wave);
      if (plan.wave % CHALLENGE.milestoneEvery === 0 && !next.challenge.milestones.includes(plan.wave)) {
        const milestoneChest: ChestKind = plan.wave >= 20 ? 'ouro' : plan.wave >= 10 ? 'estadio' : 'escola';
        next.chestStock = { ...next.chestStock, [milestoneChest]: next.chestStock[milestoneChest] + 1 };
        next.challenge = { ...next.challenge, milestones: [...next.challenge.milestones, plan.wave] };
        notes.push(`Marco da onda ${plan.wave}: baú ${milestoneChest} guardado.`);
      }
    } else {
      next.challenge = { ...next.challenge, wave: 0, active: false };
    }
  }

  if (outcome === 'loss') {
    next.missions.lossPayoutsToday += 1;
    if (next.missions.lossPayoutsToday > LOSS_PAYOUT_DAILY_CAP) {
      rewards = { ...rewards, coins: 0, clubXp: 0, tokens: 0, description: 'Limite diário de consolações atingido.' };
      notes.push('Limite diário de consolações atingido: nenhuma recompensa nesta derrota.');
    }
  }

  const coinsGained = Math.round(rewards.coins * upgradeEffects.stadiumMatchCoinMultiplier(stadium));
  const fragmentsGained = Math.round(rewards.fragments * upgradeEffects.youthFragmentMultiplier(youth))
    + (outcome === 'win' ? upgradeEffects.youthFragmentsPerWin(youth) : 0);
  next.resources.coins += coinsGained;
  next.resources.clubXp += rewards.clubXp;
  next.resources.tokens += rewards.tokens;
  next.resources.fragments += fragmentsGained;

  let itemName: string | null = null;
  if (outcome === 'win' && rng.chance(rewards.itemChance)) {
    const drop = dropItem(next, dropRarity(plan, next, rng), rng, now);
    itemName = drop.name;
    if (drop.recycledCoins > 0) notes.push(`Inventário cheio: item reciclado em ${drop.recycledCoins} moedas.`);
  }
  if (chestKind) {
    next.chestStock = { ...next.chestStock, [chestKind]: next.chestStock[chestKind] + 1 };
  }

  const squad = applySquadResults(next, report, outcome);
  notes.push(...squad.notes);

  next.records = {
    bestWave: next.records.bestWave,
    maxStars: Math.max(next.records.maxStars, 1, ...next.athletes.map((a) => a.stars)),
    maxLevel: Math.max(next.records.maxLevel, 1, ...next.athletes.map((a) => a.level)),
  };

  const ourSaves = squad.saves;
  const ricochetGoals = report.goalMinutes.filter((g) => g.side === 'home' && g.kind === 'ricochet').length;
  const increments: Array<[CounterKey, number]> = [
    ['matches', 1],
    ['goals', ourGoals],
    ['goalsConceded', theirGoals],
    ['saves', ourSaves],
    ['coinsEarned', coinsGained],
    ['ricochetGoals', ricochetGoals],
    [outcome === 'win' ? 'wins' : outcome === 'draw' ? 'draws' : 'losses', 1],
  ];
  if (theirGoals === 0 && outcome !== 'loss') increments.push(['cleanSheets', 1]);
  if (plan.mode.kind === 'challenge' && outcome === 'win') increments.push(['challengeWaves', 1]);
  if (rewards.firstWin) increments.push(['phasesCleared', 1]);
  for (const [key, amount] of increments) {
    next.counters[key] = (next.counters[key] ?? 0) + amount;
    next.missions = advanceMissions(next.missions, key, amount);
  }

  const unlocked = newlyUnlockedAchievements(next.counters, next.records, next.achievements);
  let achievementCoins = 0;
  for (const def of unlocked) {
    next.achievements = { ...next.achievements, [def.id]: now };
    achievementCoins += def.reward;
  }
  next.resources.coins += achievementCoins;
  next.counters.coinsEarned += achievementCoins;
  if (unlocked.length > 0) notes.push(`Conquistas: ${unlocked.map((a) => a.title).join(', ')}.`);

  if (!next.encyclopedia.opponents.includes(plan.opponent.name)) {
    next.encyclopedia = { ...next.encyclopedia, opponents: [...next.encyclopedia.opponents, plan.opponent.name] };
  }

  const id = `m-${now.toString(36)}-${next.nextId}`;
  const record: MatchRecord = {
    id,
    at: now,
    mode: plan.mode.kind,
    phase: plan.mode.kind === 'campaign' ? plan.mode.phase : plan.wave,
    kind: plan.matchKind,
    opponentName: plan.opponent.name,
    opponentOvr: plan.opponentOvr,
    outcome,
    score: report.score,
    coins: coinsGained,
    clubXp: rewards.clubXp,
    tokens: rewards.tokens,
    fragments: fragmentsGained,
    chest: chestKind,
    itemName,
    firstWin: rewards.firstWin,
    achievements: unlocked.map((a) => a.id),
    levelUps: squad.levelUps,
    injuries: squad.injuries,
    report,
  };

  next.history = [
    {
      id,
      at: now,
      label: historyLabel(plan),
      opponentName: plan.opponent.name,
      score: report.score,
      outcome,
      shootout: report.shootout,
      coins: coinsGained,
    },
    ...next.history,
  ].slice(0, 60);
  next.lastMatch = record;
  next.missions = rolloverMissions(next.missions, new Date(now));
  next.nextId += 1;
  next.updatedAt = now;
  next.lastSeenAt = now;

  return {
    state: next,
    record,
    report,
    rewards,
    achievements: unlocked.map((a) => a.id),
    levelUps: squad.levelUps,
    injuries: squad.injuries,
    outcome,
    notes,
  };
}

function historyLabel(plan: MatchPlan): string {
  if (plan.info && plan.mode.kind === 'campaign') {
    const kindText = plan.info.kind === 'boss' ? 'chefe' : plan.info.kind === 'mini' ? 'mini-chefe' : plan.info.kind === 'ricochet' ? 'arena de placas' : 'liga';
    return `Fase ${plan.info.number} · ${kindText}`;
  }
  return `Torneio · onda ${plan.wave}`;
}

function challengeRewards(state: GameState, wave: number, outcome: MatchOutcome): PhaseRewards {
  if (outcome === 'win') {
    const perWave = CHALLENGE.coinsBase + CHALLENGE.coinsPerWave * wave;
    const capLeft = Math.max(0, CHALLENGE.coinsDailyCap - state.missions.challengeCoinsToday);
    return {
      coins: Math.min(perWave, capLeft),
      clubXp: 10 + wave,
      tokens: 2,
      fragments: 2 * wave,
      chest: null,
      itemChance: 0.2,
      firstWin: false,
      repeatFactor: 1,
      description: `Onda ${wave} vencida.`,
    };
  }
  return {
    coins: 0,
    clubXp: 6,
    tokens: 1,
    fragments: 0,
    chest: null,
    itemChance: 0,
    firstWin: false,
    repeatFactor: 1,
    description: 'Fim da sequência. Seu recorde foi mantido.',
  };
}

interface SquadOutcome {
  levelUps: number;
  injuries: number;
  saves: number;
  notes: string[];
}

/** Aplica energia, moral, XP, estatísticas e lesões a todo o elenco. */
function applySquadResults(state: GameState, report: MatchReport, outcome: MatchOutcome): SquadOutcome {
  const played = new Set(state.lineup.slots.filter((s): s is string => Boolean(s)));
  const moraleShift = outcome === 'win' ? 6 : outcome === 'loss' ? -6 : 0;
  let levelUps = 0;
  let injuries = 0;
  let saves = 0;
  const notes: string[] = [];

  state.athletes = state.athletes.map((athlete): Athlete => {
    if (!played.has(athlete.id)) {
      const injuryMatches = athlete.status === 'injured' ? Math.max(0, athlete.injuryMatches - 1) : 0;
      return {
        ...athlete,
        energy: Math.min(100, athlete.energy + 25),
        injuryMatches,
        status: injuryMatches === 0 ? 'ready' : 'injured',
      };
    }
    const stat = report.playerStats[athlete.id];
    if (!stat) return athlete;
    saves += stat.saves;
    const leveled = addAthleteXp(athlete, LEVEL.matchXpBase + (outcome === 'win' ? LEVEL.matchXpWin : 0), levelCap(athlete.stars, state.upgrades.trainingCenter));
    levelUps += leveled.levelsGained;
    if (stat.injured) {
      injuries += 1;
      const name = templateById(athlete.templateId)?.name ?? 'Atleta';
      notes.push(`${name} se lesionou: fora por ${stat.severe ? 2 : 1} partida(s).`);
    }
    return {
      ...leveled.athlete,
      energy: stat.energyEnd,
      morale: clampN(athlete.morale + moraleShift + (stat.rating >= 7.5 ? 2 : 0), 0, 100),
      matches: athlete.matches + 1,
      goals: athlete.goals + stat.goals,
      assists: athlete.assists + stat.assists,
      saves: athlete.saves + stat.saves,
      bestRating: Math.max(athlete.bestRating, stat.rating),
      status: stat.injured ? 'injured' : 'ready',
      injuryMatches: stat.injured ? (stat.severe ? 2 : 1) : 0,
    };
  });
  return { levelUps, injuries, saves, notes };
}

/** Metas de temporada: concede as recompensas de cada meta concluída uma única vez. */
function claimSeasonGoals(state: GameState, seasonIndex: number): { notes: string[] } {
  const key = String(seasonIndex);
  const progress = state.seasons[key];
  if (!progress) return { notes: [] };
  const notes: string[] = [];
  const claimed = [...progress.claimed];
  for (const goal of SEASON_GOALS) {
    if (claimed.includes(goal.id) || !seasonGoalDone(progress, goal)) continue;
    claimed.push(goal.id);
    state.resources.coins += goal.reward.coins;
    state.resources.tokens += goal.reward.tokens ?? 0;
    state.resources.fragments += goal.reward.fragments ?? 0;
    if (goal.reward.chest) {
      const chest = biomeChestFor(seasonIndex);
      state.chestStock = { ...state.chestStock, [chest]: state.chestStock[chest] + 1 };
    }
    notes.push(`Meta de temporada concluída: ${goal.title}.`);
  }
  state.seasons = { ...state.seasons, [key]: { ...progress, claimed } };
  return { notes };
}

function dropRarity(plan: MatchPlan, state: GameState, rng: Rng): Rarity {
  const chest: ChestKind = plan.info ? plan.info.biome.chest : state.challenge.wave >= 20 ? 'ouro' : 'estadio';
  const { weights } = effectiveWeights(chest, INITIAL_PITY);
  return rng.weighted(RARITIES.map((r) => [r, weights[r]] as const));
}

function dropItem(state: GameState, rarity: Rarity, rng: Rng, now: number): { name: string; recycledCoins: number } {
  const template = rng.pick(itemTemplatesOf(rarity));
  if (state.items.length >= inventoryCapacity(state.upgrades.storage)) {
    const value = recycleValue({ rarity, level: 1 });
    state.resources.coins += value;
    return { name: template.name, recycledCoins: value };
  }
  const item: Item = {
    id: `itm-${now.toString(36)}-d${state.nextId}`,
    templateId: template.id,
    slot: template.slot,
    rarity,
    level: 1,
    bonus: { ...template.bonus },
    obtainedAt: now,
  };
  state.items = [...state.items, item];
  if (!state.encyclopedia.items.includes(template.id)) {
    state.encyclopedia = { ...state.encyclopedia, items: [...state.encyclopedia.items, template.id] };
  }
  return { name: template.name, recycledCoins: 0 };
}

function clampN(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
