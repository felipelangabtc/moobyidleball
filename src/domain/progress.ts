/**
 * Missões diárias/semanais e conquistas. Missões são sorteadas de forma
 * determinística por dia/semana (mesmo dia = mesmas missões) e acompanham o
 * progresso desde o início do período.
 */
import { ACHIEVEMENTS, DAILY_MISSIONS, WEEKLY_MISSIONS, type AchievementDef, type CounterKey, type MissionDef } from '../data/goals';
import { MISSIONS } from './balance';
import { createRng, hashString } from './rng';

export interface MissionsState {
  dayKey: string;
  weekKey: string;
  daily: string[];
  weekly: string[];
  progress: Record<string, number>;
  claimed: Record<string, boolean>;
  lossPayoutsToday: number;
  challengeCoinsToday: number;
}

export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Chave da semana: data da segunda-feira que inicia a semana. */
export function localWeekKey(date: Date): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return localDayKey(copy);
}

export function pickMissions<T extends MissionDef>(pool: readonly T[], count: number, key: string): string[] {
  const rng = createRng(hashString(`missions:${key}`));
  const ids = pool.map((m) => m.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
  }
  return ids.slice(0, count);
}

export function emptyMissions(now: Date): MissionsState {
  const dayKey = localDayKey(now);
  const weekKey = localWeekKey(now);
  return {
    dayKey,
    weekKey,
    daily: pickMissions(DAILY_MISSIONS, MISSIONS.dailyCount, `day:${dayKey}`),
    weekly: pickMissions(WEEKLY_MISSIONS, MISSIONS.weeklyCount, `week:${weekKey}`),
    progress: {},
    claimed: {},
    lossPayoutsToday: 0,
    challengeCoinsToday: 0,
  };
}

/** Renova as missões quando o dia muda (diárias) e quando a semana muda (semanais). */
export function rolloverMissions(state: MissionsState, now: Date): MissionsState {
  const dayKey = localDayKey(now);
  const weekKey = localWeekKey(now);
  if (dayKey === state.dayKey && weekKey === state.weekKey) return state;

  const keepWeekly = weekKey === state.weekKey;
  const next = emptyMissions(now);
  const progress: Record<string, number> = {};
  const claimed: Record<string, boolean> = {};
  if (keepWeekly) {
    for (const id of state.weekly) {
      if (state.progress[id] !== undefined) progress[id] = state.progress[id] ?? 0;
      if (state.claimed[id]) claimed[id] = true;
    }
    return {
      ...next,
      weekKey,
      weekly: state.weekly,
      progress,
      claimed,
    };
  }
  return next;
}

export function missionById(id: string): MissionDef | undefined {
  return [...DAILY_MISSIONS, ...WEEKLY_MISSIONS].find((m) => m.id === id);
}

/** Aplica um incremento de contador a todas as missões ativas que o utilizam. */
export function advanceMissions(state: MissionsState, counter: CounterKey, amount: number): MissionsState {
  if (amount <= 0) return state;
  const progress = { ...state.progress };
  for (const id of [...state.daily, ...state.weekly]) {
    const def = missionById(id);
    if (!def || def.counter !== counter) continue;
    if (state.claimed[id]) continue;
    progress[id] = Math.min(def.target, (progress[id] ?? 0) + amount);
  }
  return { ...state, progress };
}

export function missionProgress(state: MissionsState, id: string): number {
  return state.progress[id] ?? 0;
}

export function missionDone(state: MissionsState, id: string): boolean {
  const def = missionById(id);
  return Boolean(def) && missionProgress(state, id) >= (def?.target ?? Infinity);
}

/** Conquistas desbloqueadas por contadores e recordes. */
export function newlyUnlockedAchievements(
  counters: Record<CounterKey, number>,
  records: { bestWave: number; maxStars: number; maxLevel: number },
  already: Record<string, number>,
): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => {
    if (already[a.id] !== undefined) return false;
    const c = a.condition;
    if ('counter' in c) return (counters[c.counter] ?? 0) >= c.target;
    return records[c.stat] >= c.target;
  });
}

export function achievementProgress(def: AchievementDef, counters: Record<CounterKey, number>, records: { bestWave: number; maxStars: number; maxLevel: number }): number {
  const c = def.condition;
  if ('counter' in c) return Math.min(c.target, counters[c.counter] ?? 0);
  return Math.min(c.target, records[c.stat]);
}
