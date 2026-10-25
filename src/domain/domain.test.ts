import { describe, expect, it } from 'vitest';
import { CHEST_RARITY_WEIGHTS, PITY, POTENTIAL_RANGE } from './balance';
import { advancePity, effectiveWeights, INITIAL_PITY, openChest, sampleChestDistribution, validateChestTables } from './chests';
import { applyPhaseResult, INITIAL_CAMPAIGN, phaseInfo, phaseKindOf, phaseRewards, repeatFactor } from './campaign';
import { computeIdle } from './idle';
import { createRng } from './rng';
import { equipItem, fuseItems, trainAthlete, trainingCost, upgradeCost, clubLevelFor, itemBonusAtLevel } from './economy';
import { createAthlete, addAthleteXp, levelCap, starUpCost, xpForNextLevel } from './athletes';
import { ATHLETE_TEMPLATES } from '../data/athletes';
import { ITEM_TEMPLATES } from '../data/items';
import { localWeekKey, pickMissions, rolloverMissions, emptyMissions } from './progress';
import { DAILY_MISSIONS } from '../data/goals';
import type { Item } from './types';

describe('baús e probabilidades', () => {
  it('tabelas de raridade somam 100 e os modelos cobrem todas as raridades', () => {
    expect(validateChestTables()).toEqual([]);
    for (const weights of Object.values(CHEST_RARITY_WEIGHTS)) {
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(100, 6);
    }
  });

  it('amostragem se aproxima das probabilidades declaradas', () => {
    const dist = sampleChestDistribution('escola', 20000, 11);
    expect(dist.common).toBeGreaterThan(66);
    expect(dist.common).toBeLessThan(74);
    expect(dist.rare).toBeGreaterThan(21);
    expect(dist.rare).toBeLessThan(27);
  });

  it('pity de épico força raridade épica ou superior após o limite', () => {
    const pity = { sinceEpic: PITY.epicAfter, sinceLegend: 0 };
    const { weights, forced } = effectiveWeights('escola', pity);
    expect(forced).toBe('epic');
    expect(weights.common).toBe(0);
    expect(weights.rare).toBe(0);
    expect(weights.epic + weights.legend + weights.mythic).toBeCloseTo(100, 6);
  });

  it('pity de lendário é o mais forte', () => {
    const { weights, forced } = effectiveWeights('ouro', { sinceEpic: 0, sinceLegend: PITY.legendAfter });
    expect(forced).toBe('legend');
    expect(weights.legend + weights.mythic).toBeCloseTo(100, 6);
  });

  it('contadores de pity resetam ao sortear a raridade correspondente', () => {
    let p = { ...INITIAL_PITY };
    p = advancePity(p, 'common');
    expect(p.sinceEpic).toBe(1);
    p = advancePity(p, 'epic');
    expect(p.sinceEpic).toBe(0);
    expect(p.sinceLegend).toBe(2);
  });

  it('abrir baú converte duplicatas em fragmentos e não cria atleta repetido', () => {
    const owned = new Set(ATHLETE_TEMPLATES.map((t) => t.id));
    const rng = createRng(21);
    const result = openChest('ouro', INITIAL_PITY, { ownedTemplates: owned, nextId: 1, now: 1000, rng });
    const athletes = result.rolls.filter((r) => r.kind === 'athlete');
    expect(athletes.every((r) => r.duplicate && !r.athlete)).toBe(true);
    expect(result.fragments).toBeGreaterThan(0);
  });

  it('abertura sem duplicatas cria atletas com potencial dentro da faixa da raridade', () => {
    const rng = createRng(33);
    const result = openChest('ouro', INITIAL_PITY, { ownedTemplates: new Set(), nextId: 1, now: 1000, rng });
    for (const roll of result.rolls) {
      if (roll.athlete) {
        const [min, max] = POTENTIAL_RANGE[roll.rarity];
        expect(roll.athlete.potential).toBeGreaterThanOrEqual(min);
        expect(roll.athlete.potential).toBeLessThanOrEqual(max);
      }
    }
  });

  it('todas as raridades têm atletas e itens disponíveis', () => {
    const rarities = ['common', 'rare', 'epic', 'legend', 'mythic'] as const;
    for (const r of rarities) {
      expect(ATHLETE_TEMPLATES.some((t) => t.rarity === r)).toBe(true);
      expect(ITEM_TEMPLATES.some((t) => t.rarity === r)).toBe(true);
    }
  });
});

describe('campanha', () => {
  it('tipos de fase seguem a ordem: chefe a cada 12, mini a cada 4, arena a cada 6 (deslocada)', () => {
    expect(phaseKindOf(12)).toBe('boss');
    expect(phaseKindOf(24)).toBe('boss');
    expect(phaseKindOf(8)).toBe('mini');
    expect(phaseKindOf(3)).toBe('ricochet');
    expect(phaseKindOf(9)).toBe('ricochet');
    expect(phaseKindOf(5)).toBe('normal');
  });

  it('dificuldade cresce de forma monotônica e respeita o teto', () => {
    let last = 0;
    for (let n = 1; n <= 80; n++) {
      const info = phaseInfo(n);
      if (info.kind === 'normal') {
        expect(info.targetOvr).toBeGreaterThanOrEqual(last);
        last = info.targetOvr;
      }
      expect(info.targetOvr).toBeLessThanOrEqual(95);
    }
  });

  it('derrota volta uma fase e não desce abaixo da primeira', () => {
    let state = { ...INITIAL_CAMPAIGN, activePhase: 5, highestCleared: 4 };
    state = applyPhaseResult(state, 5, 'loss');
    expect(state.activePhase).toBe(4);
    let early = { ...INITIAL_CAMPAIGN, activePhase: 1 };
    early = applyPhaseResult(early, 1, 'loss');
    expect(early.activePhase).toBe(1);
  });

  it('vitória na fase mais avançada desbloqueia a próxima', () => {
    const state = applyPhaseResult({ ...INITIAL_CAMPAIGN, activePhase: 1 }, 1, 'win');
    expect(state.highestCleared).toBe(1);
    expect(state.activePhase).toBe(2);
  });

  it('empate não avança e não altera a fase ativa', () => {
    const state = applyPhaseResult({ ...INITIAL_CAMPAIGN, activePhase: 2, highestCleared: 1 }, 2, 'draw');
    expect(state.activePhase).toBe(2);
    expect(state.highestCleared).toBe(1);
  });

  it('recompensas por repetição diminuem e têm piso', () => {
    expect(repeatFactor(0)).toBe(1);
    expect(repeatFactor(1)).toBeLessThan(repeatFactor(0));
    expect(repeatFactor(100)).toBeGreaterThanOrEqual(0.2);
    const info = phaseInfo(2);
    const first = phaseRewards(info, 'win', 0);
    const repeat = phaseRewards(info, 'win', 5);
    expect(first.firstWin).toBe(true);
    expect(first.chest).not.toBeNull();
    expect(repeat.firstWin).toBe(false);
    expect(repeat.chest).toBeNull();
    expect(repeat.coins).toBeLessThan(first.coins);
  });

  it('derrota sempre dá consolação mínima', () => {
    const r = phaseRewards(phaseInfo(3), 'loss', 0);
    expect(r.coins).toBeGreaterThanOrEqual(15);
  });
});

describe('economia e progressão', () => {
  it('custo de treino cresce com o nível e diminui com o Centro de Treinamento', () => {
    expect(trainingCost(10, 1)).toBeGreaterThan(trainingCost(2, 1));
    expect(trainingCost(10, 5)).toBeLessThan(trainingCost(10, 1));
  });

  it('treino respeita fichas, moedas e o limite de bônus por atributo', () => {
    const rng = createRng(8);
    const athlete = createAthlete('nico-ferrolho', rng, 1);
    const noTokens = trainAthlete(athlete, 'keeper', rng, 1, 99999, 0);
    expect(noTokens.ok).toBe(false);
    const noCoins = trainAthlete(athlete, 'keeper', rng, 1, 0, 5);
    expect(noCoins.ok).toBe(false);
    let current = athlete;
    for (let i = 0; i < 80; i++) {
      const r = trainAthlete(current, 'keeper', rng, 1, 1e9, 1);
      if (!r.ok || !r.athlete) break;
      current = r.athlete;
    }
    for (const v of Object.values(current.trainingBonus)) {
      expect(v).toBeLessThanOrEqual(12);
    }
  });

  it('upgrades exigem nível de clube e aumentam o custo', () => {
    const a = upgradeCost('stadium', 0);
    const b = upgradeCost('stadium', 1);
    expect(a?.requiredClubLevel).toBe(1);
    expect(b?.requiredClubLevel).toBe(2);
    expect((b?.coins ?? 0)).toBeGreaterThan(a?.coins ?? 0);
    expect(upgradeCost('stadium', 5)).toBeNull();
  });

  it('nível do clube cresce com a experiência', () => {
    expect(clubLevelFor(0)).toBe(1);
    expect(clubLevelFor(60)).toBe(2);
    expect(clubLevelFor(10000)).toBeGreaterThan(clubLevelFor(100));
  });

  it('XP de atleta respeita o teto de nível', () => {
    const rng = createRng(2);
    let athlete = createAthlete('nico-ferrolho', rng, 1);
    const cap = levelCap(athlete.stars, 0);
    const res = addAthleteXp(athlete, 1e9, cap);
    expect(res.athlete.level).toBe(cap);
    expect(xpForNextLevel(1)).toBeGreaterThan(0);
    athlete = res.athlete;
    expect(starUpCost(1)).toBe(40);
    expect(starUpCost(5)).toBeNull();
  });

  it('fusão exige três itens iguais e produz nível superior', () => {
    const base = (id: string): Item => ({
      id,
      templateId: 'gloves-training',
      slot: 'gloves',
      rarity: 'common',
      level: 1,
      bonus: { reflexes: 2 },
      obtainedAt: 1,
    });
    const items = [base('a'), base('b'), base('c')];
    const ok = fuseItems(items, ['a', 'b', 'c'], 5, 'x');
    expect(ok.ok).toBe(true);
    expect(ok.item?.level).toBe(2);
    const wrong = fuseItems([...items, { ...base('d'), level: 2 }], ['a', 'b', 'd'], 5, 'y');
    expect(wrong.ok).toBe(false);
  });

  it('equipar troca o item do mesmo slot e tira o item de outro atleta', () => {
    const boots: Item = { id: 'i1', templateId: 'boots-field', slot: 'boots', rarity: 'common', level: 1, bonus: { pace: 2 }, obtainedAt: 1 };
    const boots2: Item = { ...boots, id: 'i2' };
    let equipped: Record<string, Partial<Record<'boots', string>>> = {};
    equipped = equipItem(equipped, 'a1', boots, [boots, boots2]).equipped;
    const second = equipItem(equipped, 'a2', boots, [boots, boots2]);
    expect(second.equipped['a1']?.boots).toBeUndefined();
    expect(second.equipped['a2']?.boots).toBe('i1');
  });

  it('bônus de item cresce com o nível e continua positivo', () => {
    const base: Item = { id: 'x', templateId: 'boots-field', slot: 'boots', rarity: 'common', level: 1, bonus: { pace: 2 }, obtainedAt: 1 };
    expect(itemBonusAtLevel(base).pace).toBe(2);
    expect((itemBonusAtLevel({ ...base, level: 5 }).pace ?? 0)).toBeGreaterThan(2);
  });

  it('modelos de atletas têm ids únicos', () => {
    const ids = ATHLETE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('camada idle', () => {
  const base = { lastCollectedAt: 0, now: 0, clubLevel: 2, stadiumLevel: 0, youthLevel: 0 };

  it('não gera nada em intervalos curtos', () => {
    const r = computeIdle({ ...base, now: 10_000 });
    expect(r.coins).toBe(0);
  });

  it('limita o acúmulo pelo teto de horas', () => {
    const r = computeIdle({ ...base, now: 48 * 3_600_000 });
    expect(r.cappedByLimit).toBe(true);
    expect(r.cappedHours).toBeLessThanOrEqual(12);
  });

  it('relógio que retrocede gera zero', () => {
    const r = computeIdle({ ...base, lastCollectedAt: 1_000_000_000, now: 1_000 });
    expect(r.coins).toBe(0);
    expect(r.reason).toBe('clock-rewind');
  });

  it('valores inválidos não geram recompensa', () => {
    const r = computeIdle({ ...base, now: Number.NaN });
    expect(r.coins).toBe(0);
  });

  it('idle nunca concede fase ou atleta', () => {
    const r = computeIdle({ ...base, now: 3_600_000 });
    expect(Object.keys(r).sort()).not.toContain('phase');
    expect(Object.keys(r).sort()).not.toContain('athletes');
  });
});

describe('missões', () => {
  it('sorteio diário é determinístico para o mesmo dia', () => {
    const a = pickMissions(DAILY_MISSIONS, 3, 'day:2026-01-01');
    const b = pickMissions(DAILY_MISSIONS, 3, 'day:2026-01-01');
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
  });

  it('rollover troca missões diárias quando o dia muda', () => {
    const d1 = new Date(2026, 0, 5, 12);
    const d2 = new Date(2026, 0, 6, 12);
    const state = emptyMissions(d1);
    const next = rolloverMissions(state, d2);
    expect(next.dayKey).not.toBe(state.dayKey);
  });

  it('chave semanal começa na segunda-feira', () => {
    const wed = new Date(2026, 0, 7);
    expect(localWeekKey(wed)).toBe('2026-01-05');
  });
});
