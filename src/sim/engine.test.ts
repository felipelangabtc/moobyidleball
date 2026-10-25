import { describe, expect, it } from 'vitest';
import { createAthlete, effectiveAttributes, simPlayerFrom, slotRating } from '../domain/athletes';
import { FORMATIONS } from '../domain/football';
import { createRng } from '../domain/rng';
import { generateOpponent, buildPlayerTeam, opponentToMatchTeam, autoLineup } from '../domain/squad';
import { simulateMatch } from './engine';
import { estimateOutcome } from './estimate';
import type { Athlete, MatchTeam, MatchOptions, Item } from '../domain/types';
import type { EquipMap } from '../domain/economy';
import { ATHLETE_TEMPLATES } from '../data/athletes';

function makeSquad(seedKey: string, ovr: number) {
  const opp = generateOpponent(seedKey, ovr);
  return opponentToMatchTeam(opp);
}

function playerSquad(): MatchTeam {
  const rng = createRng(99);
  const pool = ATHLETE_TEMPLATES.filter((t) => t.rarity === 'common' || t.rarity === 'rare');
  const athletes: Athlete[] = pool.slice(0, 16).map((t, i) => createAthlete(t.id, rng.fork(t.id), 1000 + i));
  const items: Item[] = [];
  const equipped: EquipMap = {};
  const lineup = autoLineup('4-4-2', { athletes, items, equipped }, 'posse');
  return buildPlayerTeam('Teste FC', 'Teste', 'Fênix', ['#1e88e5', '#fff'], lineup, { athletes, items, equipped });
}

const options: MatchOptions = { requiresWinner: false, arena: 'pitch' };

describe('simulador de partidas', () => {
  it('é determinístico para o mesmo seed', () => {
    const home = playerSquad();
    const away = makeSquad('determinismo', 62);
    const a = simulateMatch(home, away, 42, options);
    const b = simulateMatch(home, away, 42, options);
    expect(a.score).toEqual(b.score);
    expect(a.events.length).toBe(b.events.length);
    expect(a.events.map((e) => e.text)).toEqual(b.events.map((e) => e.text));
  });

  it('mantém o placar coerente com os gols registrados', () => {
    const home = playerSquad();
    const away = makeSquad('coerencia', 60);
    for (let seed = 1; seed <= 25; seed++) {
      const r = simulateMatch(home, away, seed, options);
      const homeGoals = r.goalMinutes.filter((g) => g.side === 'home').length;
      const awayGoals = r.goalMinutes.filter((g) => g.side === 'away').length;
      expect(r.score).toEqual([homeGoals, awayGoals]);
    }
  });

  it('gera eventos em ordem cronológica e com minutos válidos', () => {
    const home = playerSquad();
    const away = makeSquad('ordem', 60);
    const r = simulateMatch(home, away, 7, options);
    let last = 0;
    for (const e of r.events) {
      expect(e.minute).toBeGreaterThanOrEqual(last);
      expect(e.minute).toBeLessThanOrEqual(120);
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(100);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThanOrEqual(60);
      last = e.minute;
    }
  });

  it('produz média de gols plausível para times de força parecida', () => {
    const home = playerSquad();
    const away = makeSquad('media', 60);
    const est = estimateOutcome(home, away, options, 80);
    expect(est.averageGoalsFor).toBeGreaterThan(0.6);
    expect(est.averageGoalsFor).toBeLessThan(3.5);
    expect(est.averageGoalsAgainst).toBeGreaterThan(0.6);
    expect(est.averageGoalsAgainst).toBeLessThan(3.5);
  });

  it('atributos e tática importam: time mais forte vence com mais frequência', () => {
    const strong = makeSquad('forte', 85);
    const weak = makeSquad('fraco', 40);
    const est = estimateOutcome(strong, weak, options, 80);
    expect(est.win).toBeGreaterThan(est.loss + 20);
  });

  it('mata-mata sempre tem vencedor (prorrogação e pênaltis quando necessário)', () => {
    const home = playerSquad();
    const away = makeSquad('mata-mata', 60);
    for (let seed = 1; seed <= 30; seed++) {
      const r = simulateMatch(home, away, seed, { requiresWinner: true, arena: 'pitch' });
      expect(r.winner).not.toBeNull();
      if (r.score[0] === r.score[1]) {
        expect(r.shootout).not.toBeNull();
      }
    }
  });

  it('arena de ricochete gera trajetórias com física válida', () => {
    const home = playerSquad();
    const away = makeSquad('placas', 60);
    let trails = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const r = simulateMatch(home, away, seed, { requiresWinner: false, arena: 'ricochet' });
      trails += r.trails.length;
      for (const t of r.trails) {
        for (const [x, y] of t.points) {
          expect(Number.isFinite(x)).toBe(true);
          expect(Number.isFinite(y)).toBe(true);
          expect(y).toBeGreaterThanOrEqual(-1);
          expect(y).toBeLessThanOrEqual(61);
        }
      }
    }
    expect(trails).toBeGreaterThan(0);
  });

  it('estatísticas de jogador ficam dentro de limites legíveis', () => {
    const home = playerSquad();
    const away = makeSquad('stats', 60);
    const r = simulateMatch(home, away, 11, options);
    for (const stat of Object.values(r.playerStats)) {
      expect(stat.rating).toBeGreaterThanOrEqual(3);
      expect(stat.rating).toBeLessThanOrEqual(10);
      expect(stat.energyEnd).toBeGreaterThanOrEqual(0);
      expect(stat.energyEnd).toBeLessThanOrEqual(100);
    }
    expect(r.stats.home.possession + r.stats.away.possession).toBe(100);
  });
});

describe('regras de atletas', () => {
  it('nota de posição usa encaixe e nunca zera fora da posição', () => {
    const rng = createRng(3);
    const athlete = createAthlete('nico-ferrolho', rng, 1);
    const attrs = effectiveAttributes(athlete);
    const primary = slotRating(attrs, { position: 'GK', secondary: [] }, 'GK');
    const outOfPosition = slotRating(attrs, { position: 'GK', secondary: [] }, 'ST');
    expect(primary).toBeGreaterThan(outOfPosition);
    expect(outOfPosition).toBeGreaterThan(0);
  });

  it('atributos efetivos respeitam o limite de 1 a 99', () => {
    const rng = createRng(4);
    const athlete = createAthlete('aurelio-rosado', rng, 1);
    const boosted = { ...athlete, level: 40, stars: 5, trainingBonus: { reflexes: 50 } };
    const attrs = effectiveAttributes(boosted);
    for (const v of Object.values(attrs)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(99);
    }
  });

  it('formações têm exatamente 11 posições', () => {
    for (const f of Object.values(FORMATIONS)) expect(f.slots).toHaveLength(11);
  });

  it('simPlayerFrom calcula o OVR no slot', () => {
    const rng = createRng(5);
    const athlete = createAthlete('enzo-quintela', rng, 1);
    const sp = simPlayerFrom({
      id: athlete.id,
      name: 'X',
      position: 'ST',
      slotPosition: 'CB',
      shortName: 'X',
      attrs: effectiveAttributes(athlete),
      secondary: ['W'],
      energy: 100,
      morale: 60,
      ability: null,
      traits: [],
      captain: false,
      number: 1,
    });
    expect(sp.ovr).toBeGreaterThan(0);
    expect(sp.fit).toBeLessThan(1);
  });
});
