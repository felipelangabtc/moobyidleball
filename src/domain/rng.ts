/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 * Todas as decisões de partidas, baús e geração de conteúdo passam por aqui,
 * para que um mesmo seed sempre produza o mesmo resultado (replays e testes).
 */
export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T;
  gauss(mean?: number, sd?: number): number;
  fork(salt: string): Rng;
  readonly seed: number;
}

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: number | string): Rng {
  const base = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  let state = base;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    seed: base,
    next,
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      if (hi < lo) return lo;
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    range(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: lista vazia');
      return items[Math.floor(next() * items.length)] as T;
    },
    weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
      const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
      if (total <= 0) throw new Error('rng.weighted: pesos inválidos');
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= Math.max(0, weight);
        if (roll < 0) return value;
      }
      return (entries[entries.length - 1] as readonly [T, number])[0];
    },
    gauss(mean = 0, sd = 1) {
      const u = Math.max(next(), 1e-12);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    fork(salt) {
      return createRng((base ^ hashString(salt)) >>> 0);
    },
  };
  return rng;
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
