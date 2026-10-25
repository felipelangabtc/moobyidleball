/**
 * Baús: tabelas de raridade, validação das probabilidades, proteção (pity),
 * conversão de duplicatas em fragmentos e abertura de baús.
 *
 * Este módulo é o único responsável por sortear conteúdo. Em modo local ele
 * roda no navegador; a regra está isolada para que, com um backend, a mesma
 * lógica seja executada no servidor.
 */
import { ATHLETE_TEMPLATES } from '../data/athletes';
import { ITEM_TEMPLATES } from '../data/items';
import { CHEST_RARITY_WEIGHTS, CHESTS, FRAGMENTS_FROM_DUPLICATE, PITY } from './balance';
import { createAthlete } from './athletes';
import { RARITIES, type Athlete, type ChestKind, type Item, type Rarity } from './types';
import { createRng, type Rng } from './rng';

export interface PityState {
  sinceEpic: number;
  sinceLegend: number;
}

export const INITIAL_PITY: PityState = { sinceEpic: 0, sinceLegend: 0 };

export type ChestRollKind = 'athlete' | 'item';

export interface ChestRoll {
  kind: ChestRollKind;
  rarity: Rarity;
  pityForced: 'epic' | 'legend' | null;
  athlete?: Athlete;
  templateId: string;
  item?: Item;
  duplicateFragments: number;
  duplicate: boolean;
}

export interface ChestOpenResult {
  kind: ChestKind;
  rolls: ChestRoll[];
  coins: number;
  gems: number;
  fragments: number;
  pity: PityState;
}

export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}

/** Valida que todas as tabelas somam 100 e que os baús existem. Retorna lista de erros. */
export function validateChestTables(): string[] {
  const errors: string[] = [];
  for (const kind of Object.keys(CHEST_RARITY_WEIGHTS) as ChestKind[]) {
    const weights = CHEST_RARITY_WEIGHTS[kind];
    const total = RARITIES.reduce((sum, r) => sum + weights[r], 0);
    if (Math.abs(total - 100) > 1e-9) errors.push(`Baú ${kind}: probabilidades somam ${total}, esperado 100.`);
    for (const r of RARITIES) {
      if (weights[r] < 0) errors.push(`Baú ${kind}: peso negativo em ${r}.`);
    }
    const chest = CHESTS[kind];
    if (Math.abs(chest.athleteChance + chest.itemChance - 1) > 1e-9) {
      errors.push(`Baú ${kind}: chance de atleta e item deve somar 1.`);
    }
    if (chest.rolls < 1) errors.push(`Baú ${kind}: precisa de pelo menos um sorteio.`);
  }
  for (const r of RARITIES) {
    if (!ATHLETE_TEMPLATES.some((t) => t.rarity === r)) {
      errors.push(`Não há atletas com raridade ${r}.`);
    }
    if (!ITEM_TEMPLATES.some((t) => t.rarity === r)) {
      errors.push(`Não há itens com raridade ${r}.`);
    }
  }
  return errors;
}

/**
 * Pesos efetivos considerando o pity. Quando o contador de épico atinge o limite,
 * o sorteio fica restrito a épico ou superior; o mesmo vale para lendário.
 */
export function effectiveWeights(kind: ChestKind, pity: PityState): { weights: Record<Rarity, number>; forced: 'epic' | 'legend' | null } {
  const base = CHEST_RARITY_WEIGHTS[kind];
  if (pity.sinceLegend >= PITY.legendAfter) {
    return {
      weights: { common: 0, rare: 0, epic: 0, legend: 90, mythic: 10 },
      forced: 'legend',
    };
  }
  if (pity.sinceEpic >= PITY.epicAfter) {
    const restricted: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legend: 0, mythic: 0 };
    let total = 0;
    for (const r of RARITIES) {
      if (rarityRank(r) >= rarityRank('epic')) {
        restricted[r] = base[r];
        total += base[r];
      }
    }
    if (total <= 0) restricted.epic = 1;
    else for (const r of RARITIES) restricted[r] = (restricted[r] / total) * 100;
    return { weights: restricted, forced: 'epic' };
  }
  return { weights: { ...base }, forced: null };
}

/** Probabilidade de cada raridade num sorteio, para exibição ao jogador. */
export function chestOdds(kind: ChestKind, pity: PityState): Array<{ rarity: Rarity; percent: number }> {
  const { weights } = effectiveWeights(kind, pity);
  return RARITIES.map((rarity) => ({ rarity, percent: round2(weights[rarity]) }));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function pickRarity(weights: Record<Rarity, number>, rng: Rng): Rarity {
  return rng.weighted(RARITIES.map((r) => [r, weights[r]] as const));
}

export function athleteTemplatesOf(rarity: Rarity): typeof ATHLETE_TEMPLATES {
  return ATHLETE_TEMPLATES.filter((t) => t.rarity === rarity);
}

export function itemTemplatesOf(rarity: Rarity): typeof ITEM_TEMPLATES {
  return ITEM_TEMPLATES.filter((t) => t.rarity === rarity);
}

export interface OpenContext {
  ownedTemplates: ReadonlySet<string>;
  nextId: number;
  now: number;
  rng: Rng;
}

/**
 * Abre um baú. Retorna resultados, moedas, fragmentos e o novo estado de pity.
 * Duplicatas de atletas são convertidas em fragmentos (regra sempre exibida antes da compra).
 */
export function openChest(kind: ChestKind, pity: PityState, ctx: OpenContext): ChestOpenResult {
  const config = CHESTS[kind];
  const rng = ctx.rng;
  const owned = new Set(ctx.ownedTemplates);
  let state = { ...pity };
  const rolls: ChestRoll[] = [];

  for (let i = 0; i < config.rolls; i++) {
    const { weights, forced } = effectiveWeights(kind, state);
    const rarity = pickRarity(weights, rng);
    const wantAthlete = rng.chance(config.athleteChance);
    const kindRoll: ChestRollKind = wantAthlete ? 'athlete' : 'item';

    let roll: ChestRoll;
    if (kindRoll === 'athlete') {
      const pool = athleteTemplatesOf(rarity);
      const template = rng.pick(pool);
      const duplicate = owned.has(template.id);
      const duplicateFragments = duplicate ? FRAGMENTS_FROM_DUPLICATE[rarity] : 0;
      let athlete: Athlete | undefined;
      if (!duplicate) {
        athlete = createAthlete(template.id, rng.fork(`athlete-${ctx.nextId}-${i}`), ctx.now + i);
        ctx.nextId += 1;
        owned.add(template.id);
      }
      roll = {
        kind: 'athlete',
        rarity,
        pityForced: forced,
        templateId: template.id,
        athlete,
        duplicate,
        duplicateFragments,
      };
    } else {
      const pool = itemTemplatesOf(rarity);
      const template = rng.pick(pool);
      roll = {
        kind: 'item',
        rarity,
        pityForced: forced,
        templateId: template.id,
        item: {
          id: `itm-${ctx.now.toString(36)}-${ctx.nextId}-${i}`,
          templateId: template.id,
          slot: template.slot,
          rarity,
          level: 1,
          bonus: { ...template.bonus },
          obtainedAt: ctx.now,
        },
        duplicate: false,
        duplicateFragments: 0,
      };
      ctx.nextId += 1;
    }

    rolls.push(roll);
    state = advancePity(state, rarity);
  }

  const coins = rng.int(config.coinsRange[0], config.coinsRange[1]);
  const gems = rng.chance(0.15) ? rng.int(1, 3) : 0;
  const fragments = rng.int(config.fragmentsRange[0], config.fragmentsRange[1]) + rolls.reduce((sum, r) => sum + r.duplicateFragments, 0);

  return { kind, rolls, coins, gems, fragments, pity: state };
}

export function advancePity(pity: PityState, rarity: Rarity): PityState {
  const epicOrHigher = rarityRank(rarity) >= rarityRank('epic');
  const legendOrHigher = rarityRank(rarity) >= rarityRank('legend');
  return {
    sinceEpic: epicOrHigher ? 0 : pity.sinceEpic + 1,
    sinceLegend: legendOrHigher ? 0 : pity.sinceLegend + 1,
  };
}

/** Simulação de uma amostra grande para o relatório de probabilidades e para testes. */
export function sampleChestDistribution(kind: ChestKind, samples: number, seed = 7): Record<Rarity, number> {
  const rng = createRng(seed);
  const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legend: 0, mythic: 0 };
  let pity = INITIAL_PITY;
  for (let i = 0; i < samples; i++) {
    const { weights } = effectiveWeights(kind, pity);
    const rarity = pickRarity(weights, rng);
    counts[rarity] += 1;
    pity = advancePity(pity, rarity);
  }
  for (const r of RARITIES) counts[r] = (counts[r] / samples) * 100;
  return counts;
}
