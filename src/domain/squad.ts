/**
 * Elenco: escalação automática, validação de escalação e montagem do time
 * que entra em campo. Também gera adversários determinísticos por fase.
 */
import { ABILITIES } from '../data/abilities';
import { templateById } from '../data/athletes';
import { CITY_NAMES, KIT_PALETTES, MASCOTS, OPPONENT_FIRST_NAMES, OPPONENT_LAST_NAMES } from '../data/names';
import { createOpponentAttributes, effectiveAttributes, simPlayerFrom, slotRating } from './athletes';
import { FORMATIONS } from './football';
import type { EquipMap } from './economy';
import { createRng, hashString, type Rng } from './rng';
import { TACTIC_IDS, type Athlete, type FormationId, type Item, type Lineup, type MatchTeam, type Opponent, type Position, type SimPlayer, type TacticId } from './types';

export interface SquadContext {
  athletes: Athlete[];
  items: Item[];
  equipped: EquipMap;
}

export function equippedItemsFor(athleteId: string, ctx: Pick<SquadContext, 'items' | 'equipped'>): Item[] {
  const slots = ctx.equipped[athleteId] ?? {};
  const ids = Object.values(slots).filter((id): id is string => typeof id === 'string');
  return ctx.items.filter((item) => ids.includes(item.id));
}

export function athleteTemplate(athlete: Athlete) {
  return templateById(athlete.templateId);
}

export function athleteDisplayName(athlete: Athlete): string {
  return athleteTemplate(athlete)?.name ?? 'Atleta';
}

export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${(parts[0] ?? '').charAt(0)}. ${parts.slice(1).join(' ')}`;
}

/** Nota de um atleta numa posição de formação (já considera encaixe). */
export function athleteSlotOvr(athlete: Athlete, slot: Position, ctx: Pick<SquadContext, 'items' | 'equipped'>): number {
  const template = athleteTemplate(athlete);
  if (!template) return 0;
  const attrs = effectiveAttributes(athlete, equippedItemsFor(athlete.id, ctx));
  return slotRating(attrs, template, slot);
}

/**
 * Escalação automática: para cada posição (goleiro primeiro), escolhe o atleta
 * disponível com maior nota no slot. Lesionados ficam de fora.
 */
export function autoLineup(formation: FormationId, ctx: SquadContext, tactic: TacticId = 'posse'): Lineup {
  const slots = FORMATIONS[formation as FormationId].slots;
  const available = ctx.athletes.filter((a) => a.status !== 'injured');
  const used = new Set<string>();
  const result: Array<string | null> = Array.from({ length: slots.length }, () => null);
  const order = slots.map((slot, index) => ({ slot, index })).sort((a, b) => (a.slot.position === 'GK' ? -1 : b.slot.position === 'GK' ? 1 : 0));
  for (const { slot, index } of order) {
    let best: { id: string; score: number } | null = null;
    for (const athlete of available) {
      if (used.has(athlete.id)) continue;
      const score = athleteSlotOvr(athlete, slot.position, ctx) + athlete.energy * 0.02 + athlete.morale * 0.01;
      if (!best || score > best.score) best = { id: athlete.id, score };
    }
    if (best) {
      result[index] = best.id;
      used.add(best.id);
    }
  }
  const captain = pickCaptain(result, ctx);
  return { formation, tactic, slots: result, captainId: captain };
}

function pickCaptain(slots: Array<string | null>, ctx: SquadContext): string | null {
  let best: { id: string; score: number } | null = null;
  for (const id of slots) {
    if (!id) continue;
    const a = ctx.athletes.find((x) => x.id === id);
    if (!a) continue;
    const leadership = effectiveAttributes(a, equippedItemsFor(a.id, ctx)).leadership;
    if (!best || leadership > best.score) best = { id, score: leadership };
  }
  return best?.id ?? null;
}

export interface LineupIssue {
  message: string;
}

export function validateLineup(lineup: Lineup, ctx: SquadContext): LineupIssue[] {
  const issues: LineupIssue[] = [];
  const formation = FORMATIONS[lineup.formation];
  if (!formation) issues.push({ message: 'Formação inválida.' });
  if (!TACTIC_IDS.includes(lineup.tactic)) issues.push({ message: 'Tática inválida.' });
  if (lineup.slots.length !== (formation?.slots.length ?? 11)) issues.push({ message: 'A escalação precisa de 11 posições.' });
  const filled = lineup.slots.filter((s): s is string => Boolean(s));
  if (filled.length !== lineup.slots.length) issues.push({ message: 'Preencha todas as posições da formação.' });
  if (new Set(filled).size !== filled.length) issues.push({ message: 'Um atleta não pode ocupar duas posições.' });
  for (const id of filled) {
    const athlete = ctx.athletes.find((a) => a.id === id);
    if (!athlete) issues.push({ message: 'Um atleta escalado não existe mais.' });
    else if (athlete.status === 'injured') issues.push({ message: `${athleteDisplayName(athlete)} está lesionado.` });
  }
  if (lineup.captainId && !filled.includes(lineup.captainId)) issues.push({ message: 'O capitão precisa estar escalado.' });
  return issues;
}

/** Monta o time do jogador já resolvido para simulação. */
export function buildPlayerTeam(name: string, city: string, mascot: string, colors: [string, string], lineup: Lineup, ctx: SquadContext): MatchTeam {
  const slots = FORMATIONS[lineup.formation as FormationId].slots;
  const players: SimPlayer[] = [];
  slots.forEach((slot, index) => {
    const id = lineup.slots[index];
    const athlete = ctx.athletes.find((a) => a.id === id);
    const template = athlete ? athleteTemplate(athlete) : undefined;
    if (!athlete || !template) return;
    const attrs = effectiveAttributes(athlete, equippedItemsFor(athlete.id, ctx));
    players.push(simPlayerFrom({
      id: athlete.id,
      name: template.name,
      position: template.position,
      slotPosition: slot.position,
      shortName: shortName(template.name),
      attrs,
      secondary: template.secondary,
      energy: athlete.energy,
      morale: athlete.morale,
      ability: template.ability,
      traits: template.traits,
      captain: athlete.id === lineup.captainId,
      number: index + 1,
    }));
  });
  return {
    name,
    city,
    mascot,
    colors,
    formation: lineup.formation,
    tactic: lineup.tactic,
    ovr: round1(average(players.map((p) => p.ovr))),
    players,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

const OPPONENT_ABILITY_POOL = Object.keys(ABILITIES);

/** Gera um adversário determinístico para uma fase ou onda de desafio. */
export function generateOpponent(seedKey: string, targetOvr: number, rng?: Rng): Opponent {
  const r = rng ?? createRng(hashString(seedKey));
  const city = r.pick(CITY_NAMES);
  const mascot = r.pick(MASCOTS);
  const colors = r.pick(KIT_PALETTES);
  const formation = r.weighted([
    ['4-3-3', 3],
    ['4-4-2', 3],
    ['3-5-2', 2],
    ['5-3-2', 2],
  ] as const satisfies ReadonlyArray<readonly [FormationId, number]>);
  const tactic = r.pick(TACTIC_IDS);
  const slots = FORMATIONS[formation as FormationId].slots;
  const players: SimPlayer[] = slots.map((slot, index) => {
    const ovr = Math.max(20, Math.min(99, Math.round(targetOvr + r.gauss(0, 2))));
    const attrs = createOpponentAttributes(slot.position, ovr, r);
    const first = r.pick(OPPONENT_FIRST_NAMES);
    const last = r.pick(OPPONENT_LAST_NAMES);
    const fullName = `${first} ${last}`;
    const ability = r.chance(0.3) ? r.pick(OPPONENT_ABILITY_POOL) : null;
    return simPlayerFrom({
      id: `${seedKey}-p${index}`,
      name: fullName,
      position: slot.position,
      slotPosition: slot.position,
      shortName: shortName(fullName),
      attrs,
      secondary: [],
      energy: 100,
      morale: 60,
      ability,
      traits: [],
      captain: index === 4,
      number: index + 1,
    });
  });
  const ovr = round1(average(players.map((p) => p.ovr)));
  return {
    name: `${city} ${mascot}`,
    city,
    mascot,
    colors,
    formation,
    tactic,
    players,
    targetOvr: ovr,
  };
}

export function opponentToMatchTeam(opp: Opponent): MatchTeam {
  return {
    name: opp.name,
    city: opp.city,
    mascot: opp.mascot,
    colors: opp.colors,
    formation: opp.formation,
    tactic: opp.tactic,
    ovr: opp.targetOvr,
    players: opp.players,
  };
}

