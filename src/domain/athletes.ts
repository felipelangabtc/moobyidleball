/**
 * Regras de atletas: geração de instâncias, atributos efetivos, OVR por posição,
 * níveis, experiência e evolução de estrelas. Funções puras e determinísticas
 * (exceto geração de IDs, feita com o RNG recebido).
 */
import { ATTR_MAX, ATTR_MIN, ATTR_VARIANCE, LEVEL, POTENTIAL_RANGE, STAR_FRAGMENT_COST, STARS, TRAINING } from './balance';
import {
  ATTRIBUTE_KEYS,
  type Athlete,
  type AthleteTemplate,
  type AttributeBonus,
  type AttributeKey,
  type Attributes,
  type Item,
  type Position,
  type Rarity,
  type SimPlayer,
} from './types';
import { POSITION_WEIGHTS, fitFactor } from './football';
import { clamp, round, type Rng } from './rng';
import { templateById } from '../data/athletes';

export function emptyAttributes(value = 0): Attributes {
  const out = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) out[key] = value;
  return out;
}

export function rollPotential(rarity: Rarity, rng: Rng): number {
  const [min, max] = POTENTIAL_RANGE[rarity];
  return rng.int(min, max);
}

/** Atributos base: potencial + silhueta do modelo + variação controlada pela raridade. */
export function rollBaseAttributes(template: Pick<AthleteTemplate, 'shape' | 'rarity'>, potential: number, rng: Rng): Attributes {
  const out = emptyAttributes();
  const variance = ATTR_VARIANCE[template.rarity];
  for (const key of ATTRIBUTE_KEYS) {
    const shape = template.shape[key] ?? -0.5;
    const value = potential + 12 * shape + rng.gauss(0, variance);
    out[key] = clamp(Math.round(value), 20, ATTR_MAX);
  }
  return out;
}

export function createAthlete(templateId: string, rng: Rng, now: number): Athlete {
  const template = templateById(templateId);
  if (!template) throw new Error(`Modelo de atleta desconhecido: ${templateId}`);
  const potential = rollPotential(template.rarity, rng);
  return {
    id: `ath-${now.toString(36)}-${rng.int(1000, 9999)}`,
    templateId,
    potential,
    base: rollBaseAttributes(template, potential, rng),
    level: 1,
    xp: 0,
    stars: STARS.min,
    energy: 100,
    morale: rng.int(55, 75),
    status: 'ready',
    injuryMatches: 0,
    trainingBonus: {},
    matches: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    bestRating: 0,
    obtainedAt: now,
  };
}

/** Teto de nível: depende das estrelas e do Centro de Treinamento. */
export function levelCap(stars: number, trainingCenterLevel: number): number {
  const raw = LEVEL.baseCap + LEVEL.capPerStar * (stars - 1) + LEVEL.capPerTrainingCenterLevel * trainingCenterLevel;
  return Math.min(LEVEL.absoluteMax, raw);
}

export function xpForNextLevel(level: number): number {
  return Math.round(LEVEL.xpPerLevelBase * LEVEL.xpPerLevelGrowth ** (level - 1));
}

export interface XpResult {
  athlete: Athlete;
  levelsGained: number;
}

/** Aplica XP respeitando o teto de nível. XP excedente no teto é descartado. */
export function addAthleteXp(athlete: Athlete, amount: number, cap: number): XpResult {
  let level = athlete.level;
  let xp = athlete.xp + Math.max(0, amount);
  let gained = 0;
  while (level < cap && xp >= xpForNextLevel(level)) {
    xp -= xpForNextLevel(level);
    level += 1;
    gained += 1;
  }
  if (level >= cap) xp = 0;
  return { athlete: { ...athlete, level, xp }, levelsGained: gained };
}

export function starUpCost(stars: number): number | null {
  if (stars >= STARS.max) return null;
  return STAR_FRAGMENT_COST[stars] ?? null;
}

export function canStarUp(athlete: Athlete, trainingCenterLevel: number): boolean {
  return starUpCost(athlete.stars) !== null && athlete.level >= levelCap(athlete.stars, trainingCenterLevel);
}

export function growthMultiplier(level: number, stars: number): number {
  return (1 + LEVEL.growthPerLevel * (level - 1)) * (1 + LEVEL.growthPerStar * (stars - 1));
}

/** Atributos efetivos = base * crescimento + treino + equipamentos, limitados a [1, 99]. */
export function effectiveAttributes(athlete: Athlete, items: Item[] = []): Attributes {
  const mult = growthMultiplier(athlete.level, athlete.stars);
  const itemBonus = sumBonuses(items.map((item) => item.bonus));
  const out = emptyAttributes();
  for (const key of ATTRIBUTE_KEYS) {
    const value = athlete.base[key] * mult + (athlete.trainingBonus[key] ?? 0) + (itemBonus[key] ?? 0);
    out[key] = clamp(Math.round(value), ATTR_MIN, ATTR_MAX);
  }
  return out;
}

export function sumBonuses(list: AttributeBonus[]): AttributeBonus {
  const out: AttributeBonus = {};
  for (const bonus of list) {
    for (const key of ATTRIBUTE_KEYS) {
      const v = bonus[key];
      if (v) out[key] = (out[key] ?? 0) + v;
    }
  }
  return out;
}

/** OVR de uma posição: média ponderada pelos pesos da posição. Escala 1–99. */
export function positionRating(attrs: Attributes, position: Position): number {
  const weights = POSITION_WEIGHTS[position];
  let sum = 0;
  let total = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const w = weights[key];
    if (!w) continue;
    sum += attrs[key] * w;
    total += w;
  }
  return total === 0 ? 0 : round(sum / total, 1);
}

/** Nota no slot da formação, considerando encaixe (principal, secundária, fora). */
export function slotRating(attrs: Attributes, athlete: { position: Position; secondary: Position[] }, slot: Position): number {
  const versatility = attrs.versatility;
  return round(positionRating(attrs, slot) * fitFactor(athlete, slot, versatility), 1);
}

export function strengthsAndWeaknesses(attrs: Attributes, position: Position): { strong: AttributeKey[]; weak: AttributeKey[] } {
  const relevant = Object.keys(POSITION_WEIGHTS[position]) as AttributeKey[];
  const ranked = [...relevant].sort((a, b) => attrs[b] - attrs[a]);
  return {
    strong: ranked.slice(0, 3).filter((k) => attrs[k] >= 70),
    weak: ranked.slice(-2).filter((k) => attrs[k] < 60),
  };
}

export function athleteOvr(athlete: Athlete, template: AthleteTemplate, items: Item[]): number {
  return positionRating(effectiveAttributes(athlete, items), template.position);
}

/**
 * Gera um jogador adversário com OVR próximo do alvo na posição pedida.
 * Ajusta os atributos iterativamente para que a média ponderada fique perto do alvo.
 */
export function createOpponentAttributes(position: Position, target: number, rng: Rng): Attributes {
  const attrs = emptyAttributes();
  const weights = POSITION_WEIGHTS[position];
  for (const key of ATTRIBUTE_KEYS) {
    const bias = weights[key] ? 4 : -4;
    attrs[key] = clamp(Math.round(target + bias + rng.gauss(0, 3)), ATTR_MIN, ATTR_MAX);
  }
  for (let pass = 0; pass < 3; pass++) {
    const delta = target - positionRating(attrs, position);
    if (Math.abs(delta) < 0.5) break;
    for (const key of ATTRIBUTE_KEYS) attrs[key] = clamp(Math.round(attrs[key] + delta), ATTR_MIN, ATTR_MAX);
  }
  return attrs;
}

export function simPlayerFrom(params: {
  id: string;
  name: string;
  position: Position;
  slotPosition: Position;
  shortName: string;
  attrs: Attributes;
  secondary: Position[];
  energy: number;
  morale: number;
  ability: string | null;
  traits: string[];
  captain: boolean;
  number: number;
}): SimPlayer {
  const fit = fitFactor({ position: params.position, secondary: params.secondary }, params.slotPosition, params.attrs.versatility);
  return {
    id: params.id,
    name: params.name,
    position: params.position,
    slotPosition: params.slotPosition,
    shortName: params.shortName,
    attrs: params.attrs,
    fit,
    ovr: round(positionRating(params.attrs, params.slotPosition) * fit, 1),
    energy: params.energy,
    morale: params.morale,
    ability: params.ability,
    traits: params.traits,
    captain: params.captain,
    number: params.number,
  };
}

export function trainingPointsAvailable(bonus: AttributeBonus): number {
  return ATTRIBUTE_KEYS.reduce((sum, key) => sum + Math.max(0, TRAINING.maxBonusPerAttribute - (bonus[key] ?? 0)), 0);
}
