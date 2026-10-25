/**
 * Simulador de partidas automáticas.
 *
 * Modelo: a partida é dividida em minutos. Em cada minuto, a posse é sorteada
 * a partir da força do meio-campo (com ajuste tático). O time com a bola pode
 * perder o controle (desarme), construir uma jogada e finalizar. Finalizações
 * passam por uma cadeia de probabilidades explicáveis: qualidade do chute
 * (finalização, precisão, pressão, marcação), chance de acertar o gol, chance
 * de gol e defesa do goleiro. Habilidades e traços alteram etapas específicas.
 * Arenas de placas recalculam a trajetória do chute com física.
 *
 * Tudo é determinístico para um mesmo seed. O mesmo relatório alimenta a
 * animação (em qualquer velocidade) e o resultado final.
 */
import { ABILITIES, abilityById, type AbilityDef, type AbilityTrigger } from '../data/abilities';
import { MATCH } from '../domain/balance';
import { FORMATIONS, TACTICS, tacticMatchup, type TacticDef } from '../domain/football';
import { clamp, createRng, round, type Rng } from '../domain/rng';
import type {
  AttributeKey,
  MatchEvent,
  MatchEventKind,
  MatchOptions,
  MatchReport,
  MatchSide,
  MatchTeam,
  PlayerMatchStat,
  Position,
  SimPlayer,
  TeamMatchStats,
  Trail,
} from '../domain/types';
import { arenaBumpers, ricochetMultiplier, simulateShot } from './ricochet';

function attributeOf(q: { p: SimPlayer }, key: AttributeKey): number {
  return q.p.attrs[key];
}

interface PState {
  p: SimPlayer;
  side: MatchSide;
  energy: number;
  morale: number;
  injured: boolean;
  severe: boolean;
  onField: boolean;
  yellow: number;
  abilityUses: number;
  readyAt: Record<string, number>;
  stat: PlayerMatchStat;
}

interface Strength {
  attack: number;
  defense: number;
  mid: number;
  wings: number;
  gk: number;
  tactic: TacticDef;
}

interface SideState {
  side: MatchSide;
  team: MatchTeam;
  players: PState[];
  score: number;
  redCard: boolean;
  stats: TeamMatchStats;
  str: Strength;
  captain: PState | null;
}

const ZONE_WEIGHT_SHOT: Record<Position, number> = { ST: 3, W: 2, CM: 0.9, DM: 0.4, FB: 0.2, CB: 0.1, GK: 0 };
const ZONE_WEIGHT_HEADER: Record<Position, number> = { ST: 2, W: 1.2, CM: 0.8, DM: 0.5, FB: 0.5, CB: 0.4, GK: 0 };

export function fatigueFactor(energy: number): number {
  return MATCH.fatigue.factorBase + MATCH.fatigue.factorSpan * clamp(energy / 100, 0, 1);
}

export function moraleFactor(morale: number): number {
  return MATCH.morale.base + MATCH.morale.span * clamp(morale / 100, 0, 1);
}

function condition(q: PState): number {
  return fatigueFactor(q.energy) * moraleFactor(q.morale) * (q.injured ? MATCH.injuryFactor : 1);
}

function avg<T>(list: T[], fn: (item: T) => number, fallback = 40): number {
  if (list.length === 0) return fallback;
  let sum = 0;
  for (const item of list) sum += fn(item);
  return sum / list.length;
}

function computeStrength(state: SideState): Strength {
  const onField = state.players.filter((q) => q.onField);
  const byZone = (zones: Position[]) => onField.filter((q) => zones.includes(q.p.slotPosition));
  const mid = byZone(['DM', 'CM']);
  const att = byZone(['ST', 'W']);
  const def = byZone(['CB', 'FB', 'DM']);
  const wings = byZone(['FB', 'W']);
  const gk = byZone(['GK']);
  const a = attributeOf;

  const midPower = avg(mid, (q) => ((a(q, 'passing') + a(q, 'vision') + a(q, 'control') + a(q, 'positioning')) / 4) * q.p.fit * condition(q));
  const attPower = avg(att, (q) => ((a(q, 'finishing') + a(q, 'dribbling') + a(q, 'pace') + a(q, 'precision')) / 4) * q.p.fit * condition(q));
  const defPower = avg(def, (q) => ((a(q, 'marking') + a(q, 'tackling') + a(q, 'positioning') + a(q, 'strength')) / 4) * q.p.fit * condition(q));
  const wingPower = avg(wings, (q) => ((a(q, 'pace') + a(q, 'acceleration') + a(q, 'passing')) / 3) * q.p.fit * condition(q));
  const gkPower = avg(gk, (q) => (a(q, 'reflexes') * 0.6 + a(q, 'positioning') * 0.2 + a(q, 'distribution') * 0.2) * q.p.fit * condition(q), 35);

  const tactic = TACTICS[state.team.tactic] as TacticDef;
  const formation = FORMATIONS[state.team.formation] as any;
  const redFactor = state.redCard ? MATCH.redTeamFactor : 1;

  return {
    attack: (0.55 * attPower + 0.2 * wingPower + 0.25 * midPower) * tactic.attack * (1 + formation.attackBonus) * redFactor,
    defense: (0.6 * defPower + 0.25 * midPower + 0.15 * gkPower) * tactic.defense * (1 + formation.defBonus) * redFactor,
    mid: midPower * (1 + formation.midBonus) * redFactor,
    wings: wingPower * redFactor,
    gk: gkPower,
    tactic,
  };
}

export function simulateMatch(home: MatchTeam, away: MatchTeam, seed: number, options: MatchOptions): MatchReport {
  const rng = createRng(seed).fork('match');
  const sides: Record<MatchSide, SideState> = {
    home: makeSide('home', home),
    away: makeSide('away', away),
  };
  const engine = new Engine(rng, sides, options);
  return engine.run(seed, home, away);
}

function makeSide(side: MatchSide, team: MatchTeam): SideState {
  const players: PState[] = team.players.map((p) => ({
    p,
    side,
    energy: clamp(p.energy, 0, 100),
    morale: clamp(p.morale, 0, 100),
    injured: false,
    severe: false,
    onField: true,
    yellow: 0,
    abilityUses: 0,
    readyAt: {},
    stat: {
      rating: 0,
      goals: 0,
      assists: 0,
      saves: 0,
      shots: 0,
      tackles: 0,
      fouls: 0,
      yellow: 0,
      red: 0,
      injured: false,
      severe: false,
      minutes: 0,
      energyEnd: 0,
    },
  }));
  const state: SideState = {
    side,
    team,
    players,
    score: 0,
    redCard: false,
    stats: { possession: 0, shots: 0, onTarget: 0, corners: 0, fouls: 0, yellow: 0, red: 0, saves: 0, ricochets: 0 },
    str: { attack: 0, defense: 0, mid: 0, wings: 0, gk: 0, tactic: TACTICS[team.tactic] as TacticDef },
    captain: players.find((q) => q.p.captain) ?? null,
  };
  state.str = computeStrength(state);
  return state;
}

class Engine {
  private events: MatchEvent[] = [];
  private trails: Trail[] = [];
  private goalMinutes: MatchReport['goalMinutes'] = [];
  private minute = 0;

  constructor(
    private readonly rng: Rng,
    private readonly sides: Record<MatchSide, SideState>,
    private readonly options: MatchOptions,
  ) {}

  private get home(): SideState {
    return this.sides.home;
  }

  private get away(): SideState {
    return this.sides.away;
  }

  private other(side: MatchSide): SideState {
    return side === 'home' ? this.away : this.home;
  }

  run(seed: number, home: MatchTeam, away: MatchTeam): MatchReport {
    this.event(0, 'kickoff', 'neutral', `Apito inicial: ${home.name} x ${away.name} em ${home.city}.`, [], 50, 30);

    for (let m = 1; m <= MATCH.minutes; m++) {
      this.minute = m;
      this.playMinute(m);
      if (m === MATCH.halfTime) this.halftime();
    }
    this.event(MATCH.minutes, 'fulltime', 'neutral', `Fim do tempo regulamentar. ${this.scoreText()}.`, [], 50, 30);

    let shootout: [number, number] | null = null;
    let extraTime = false;
    if (this.home.score === this.away.score && this.options.requiresWinner) {
      extraTime = true;
      this.event(MATCH.minutes + 1, 'extra', 'neutral', 'Empate! Prorrogação de 30 minutos.', [], 50, 30);
      for (let m = MATCH.minutes + 1; m <= MATCH.minutes + MATCH.extraMinutes; m++) {
        this.minute = m;
        this.playMinute(m);
      }
      if (this.home.score === this.away.score) {
        shootout = this.penaltyShootout();
      }
    }

    const winner: MatchSide | null = this.home.score !== this.away.score
      ? this.home.score > this.away.score ? 'home' : 'away'
      : shootout && shootout[0] !== shootout[1] ? (shootout[0] > shootout[1] ? 'home' : 'away') : null;

    const stats = this.finalizeStats();
    const playerStats = this.collectPlayerStats(winner);

    return {
      seed,
      arena: this.options.arena,
      home: copyTeam(home),
      away: copyTeam(away),
      score: [this.home.score, this.away.score],
      shootout,
      extraTime,
      winner,
      events: this.events,
      trails: this.trails,
      stats,
      playerStats,
      goalMinutes: this.goalMinutes,
    };
  }

  private finalizeStats(): Record<MatchSide, TeamMatchStats> {
    const total = this.home.stats.possession + this.away.stats.possession;
    const homeShare = total === 0 ? 50 : Math.round((this.home.stats.possession / total) * 100);
    this.home.stats.possession = homeShare;
    this.away.stats.possession = 100 - homeShare;
    return { home: { ...this.home.stats }, away: { ...this.away.stats } };
  }

  private collectPlayerStats(winner: MatchSide | null): Record<string, PlayerMatchStat> {
    const out: Record<string, PlayerMatchStat> = {};
    for (const side of ['home', 'away'] as const) {
      for (const q of this.sides[side].players) {
        const s = q.stat;
        const result = winner === null ? 0 : winner === side ? 0.3 : -0.3;
        const base = 6 + 0.6 * s.goals + 0.4 * s.assists + 0.12 * s.saves + 0.1 * s.tackles - 0.3 * s.yellow - (s.red ? 1 : 0) + result;
        out[q.p.id] = {
          ...s,
          rating: clamp(round(base, 1), 3, 10),
          injured: q.injured,
          severe: q.severe,
          energyEnd: round(q.energy),
        };
      }
    }
    return out;
  }

  private halftime(): void {
    for (const side of ['home', 'away'] as const) {
      for (const q of this.sides[side].players) {
        q.energy = clamp(q.energy + MATCH.fatigue.recoveryHalftime, 0, 100);
      }
    }
    this.event(MATCH.halfTime, 'halftime', 'neutral', `Intervalo: ${this.scoreText()}.`, [], 50, 30);
  }

  private playMinute(m: number): void {
    this.home.str = computeStrength(this.home);
    this.away.str = computeStrength(this.away);
    this.drainEnergy();

    const H = this.home;
    const A = this.away;
    const possHome = clamp(
      0.5 + (1.2 * (H.str.mid - A.str.mid)) / Math.max(1, H.str.mid + A.str.mid) + (H.str.tactic.possession - A.str.tactic.possession) + this.rng.gauss(0, 0.03),
      0.22,
      0.78,
    );
    const attackerSide: MatchSide = this.rng.next() < possHome ? 'home' : 'away';
    const attacker = this.sides[attackerSide];
    const defender = this.other(attackerSide);
    attacker.stats.possession += 1;

    this.maybeInjuries(m);

    const ratio = this.ratioFor(attacker, defender);
    const tackleP = clamp(0.1 + defender.str.tactic.turnover + 0.25 * (0.5 - ratio), 0.06, 0.22);
    if (this.rng.chance(tackleP)) {
      const tackler = this.pickPlayer(defender, (q) => attributeOf(q, 'tackling') * q.p.fit);
      if (tackler) {
        tackler.stat.tackles += 1;
        if (this.rng.chance(0.4)) {
          this.event(m, 'tackle', defender.side, `Desarme de ${tackler.p.shortName} (${defender.team.city}).`, [tackler.p.id], ...this.pos(defender.side, 'mid'));
        }
        const counterP = defender.str.tactic.turnover > 0.04 ? 0.35 : 0.12;
        if (this.rng.chance(counterP)) {
          this.sequence(m, defender, attacker, true);
        }
      }
      return;
    }

    const seqP = clamp(MATCH.sequenceBase * (0.7 + 0.6 * ratio), 0.15, 0.8);
    if (this.rng.chance(seqP)) {
      this.sequence(m, attacker, defender, false);
    }
  }

  private drainEnergy(): void {
    for (const side of ['home', 'away'] as const) {
      const s = this.sides[side];
      for (const q of s.players) {
        if (!q.onField) continue;
        q.stat.minutes += 1;
        if (q.injured) continue;
        const drain = MATCH.fatigue.drainBase * s.str.tactic.energyCost * (MATCH.fatigue.staminaFactor - attributeOf(q, 'stamina') / MATCH.fatigue.staminaDivisor);
        const trait = q.p.traits.includes('Fôlego') ? 0.85 : 1;
        q.energy = clamp(q.energy - drain * trait, 0, 100);
      }
    }
  }

  /** Razão de domínio do ataque (0.5 = equilibrado). Comprimida para que a diferença de força não seja decisiva sozinha. */
  private ratioFor(attacker: SideState, defender: SideState): number {
    const share = attacker.str.attack / Math.max(1, attacker.str.attack + defender.str.defense);
    const base = 0.5 + 0.6 * (share - 0.5);
    const matchup = tacticMatchup(attacker.str.tactic.id, defender.str.tactic.id);
    return clamp(base + matchup, 0.05, 0.95);
  }

  private sequence(m: number, A: SideState, D: SideState, counter: boolean): void {
    let r = this.ratioFor(A, D);
    if (counter) r += 0.08;

    const maestro = this.tryAbilityFromTeam(A, 'pass', m);
    if (maestro) r += maestro.value;

    const wingLane = this.rng.chance(0.25 + A.str.tactic.wings * 2.2);
    const foulP = clamp(MATCH.foulChance * (1 + (0.5 - r) * 0.8) * (D.str.tactic.id === 'pressao' ? 1.3 : 1), 0.02, 0.12);
    if (this.rng.chance(foulP)) {
      this.foul(m, A, D, !wingLane);
      return;
    }

    if (wingLane && this.rng.chance(0.45 + 0.2 * (r - 0.5))) {
      const crosser = this.pickPlayer(A, (q) => (q.p.slotPosition === 'FB' || q.p.slotPosition === 'W' ? attributeOf(q, 'passing') + attributeOf(q, 'dribbling') : 0.5));
      const name = crosser ? crosser.p.shortName : 'o lateral';
      this.event(m, 'attack', A.side, `Jogada pela ponta de ${A.team.city}, cruzamento de ${name}.`, crosser ? [crosser.p.id] : [], ...this.pos(A.side, 'wing'));
      this.attemptShot(m, A, D, 'header', 0.9 + 0.2 * (r - 0.5));
      return;
    }

    const shotP = clamp(0.48 + 0.9 * (r - 0.5), 0.22, 0.82);
    if (this.rng.chance(shotP)) {
      if (this.rng.chance(0.35)) {
        this.event(m, 'attack', A.side, `Construção pelo meio-campo de ${A.team.city}.`, [], ...this.pos(A.side, 'mid'));
      }
      this.attemptShot(m, A, D, 'shot', 1);
      return;
    }

    if (this.rng.chance(MATCH.cornerChance)) {
      this.corner(m, A, D);
    }
  }

  private foul(m: number, A: SideState, D: SideState, central: boolean): void {
    const fouler = this.pickPlayer(D, (q) => attributeOf(q, 'tackling') * 0.5 + attributeOf(q, 'marking') * 0.5 + 10);
    if (fouler) {
      fouler.stat.fouls += 1;
      D.stats.fouls += 1;
      const yellowP = MATCH.yellowBase * (1 - attributeOf(fouler, 'discipline') / 200) * (fouler.p.traits.includes('Disciplinado') ? 0.6 : 1);
      if (this.rng.chance(yellowP)) this.card(m, D, fouler, 'yellow');
    }
    if (central && this.rng.chance(MATCH.penaltyBoxChance)) {
      this.penalty(m, A, D, fouler);
      return;
    }
    const name = fouler ? fouler.p.shortName : 'um defensor';
    this.event(m, 'foul', D.side, `Falta de ${name} em ${A.team.city}.`, fouler ? [fouler.p.id] : [], ...this.pos(A.side, 'mid'));
    if (this.rng.chance(0.2)) {
      this.attemptShot(m, A, D, 'free', 0.45);
    }
  }

  private card(m: number, side: SideState, q: PState, kind: 'yellow' | 'red'): void {
    if (kind === 'yellow') {
      q.yellow += 1;
      q.stat.yellow += 1;
      side.stats.yellow += 1;
      this.event(m, 'yellow', side.side, `Cartão amarelo para ${q.p.shortName}.`, [q.p.id], ...this.pos(side.side, 'mid'));
      if (q.yellow >= 2) this.card(m, side, q, 'red');
      return;
    }
    if (side.redCard) return;
    side.redCard = true;
    q.onField = false;
    q.stat.red += 1;
    side.stats.red += 1;
    this.event(m, 'red', side.side, `Cartão vermelho! ${q.p.shortName} deixa o campo.`, [q.p.id], ...this.pos(side.side, 'mid'));
    this.home.str = computeStrength(this.home);
    this.away.str = computeStrength(this.away);
  }

  private penalty(m: number, A: SideState, D: SideState, fouler: PState | null): void {
    const shooter = this.pickPlayer(A, (q) => attributeOf(q, 'finishing') + attributeOf(q, 'precision'));
    if (!shooter) return;
    const gk = this.gkOf(D);
    const involved = [shooter.p.id, ...(fouler ? [fouler.p.id] : [])];
    this.event(m, 'penalty', A.side, `Pênalti! ${shooter.p.shortName} vai para a cobrança.`, involved, ...this.pos(A.side, 'box'));
    shooter.stat.shots += 1;
    A.stats.shots += 1;
    const pressure = shooter.p.traits.includes('Frio sob pressão') ? 0.05 : 0;
    const pGoal = penaltyGoalChance(attributeOf(shooter, 'precision'), D.str.gk, pressure);
    if (this.rng.chance(pGoal)) {
      this.score(A, shooter, null, m, 'penalty');
      return;
    }
    A.stats.onTarget += 1;
    if (gk) {
      gk.stat.saves += 1;
      D.stats.saves += 1;
      this.event(m, 'save', D.side, `Pênalti defendido por ${gk.p.shortName}!`, [gk.p.id, shooter.p.id], ...this.pos(A.side, 'box'));
    } else {
      this.event(m, 'miss', A.side, `Pênalti perdido por ${shooter.p.shortName}.`, [shooter.p.id], ...this.pos(A.side, 'box'));
    }
  }

  private corner(m: number, A: SideState, D: SideState): void {
    A.stats.corners += 1;
    this.event(m, 'corner', A.side, `Escanteio para ${A.team.city}.`, [], ...this.pos(A.side, 'corner'));
    if (this.rng.chance(0.3)) {
      this.attemptShot(m, A, D, 'header', 0.7);
    }
  }

  private attemptShot(m: number, A: SideState, D: SideState, kind: 'shot' | 'header' | 'free', intensity: number): void {
    const header = kind === 'header';
    const shooter = this.pickPlayer(A, (q) => {
      if (header) return (attributeOf(q, 'heading') + attributeOf(q, 'positioning')) * ZONE_WEIGHT_HEADER[q.p.slotPosition] + 1;
      return (attributeOf(q, 'finishing') + attributeOf(q, 'precision') * 0.4) * ZONE_WEIGHT_SHOT[q.p.slotPosition];
    });
    if (!shooter) return;
    const gk = this.gkOf(D);
    shooter.stat.shots += 1;
    A.stats.shots += 1;

    const shooterAbility = this.tryAbilityFor(shooter, 'shot', m);
    const cornerAbility = header ? this.tryAbilityFor(shooter, 'corner', m) : null;
    const defenderAbility = this.tryDefendAbility(D, m);

    const fin = attributeOf(shooter, 'finishing');
    const prec = attributeOf(shooter, 'precision');
    const bold = shooter.p.traits.includes('Ousado') ? 0.01 : 0;

    let q = clamp(fin / 65, 0.75, 1.3) * clamp(0.7 + 0.6 * this.ratioFor(A, D), 0.7, 1.3);
    q *= clamp(65 / clamp(D.str.defense, 35, 120), 0.8, 1.2);
    q *= intensity;
    if (header) q *= clamp(attributeOf(shooter, 'heading') / 60, 0.7, 1.3) * 0.5;

    let pGoal = clamp(MATCH.shotBase * q + bold, 0.02, 0.5);
    if (shooterAbility) pGoal += shooterAbility.value;
    if (cornerAbility) pGoal += cornerAbility.value;
    if (defenderAbility) pGoal -= defenderAbility.value;

    let onTarget: boolean;
    let scoreKind: 'normal' | 'ricochet' = 'normal';
    if (this.options.arena === 'ricochet' && kind === 'shot') {
      const startX = A.side === 'home' ? 74 + this.rng.range(0, 14) : 100 - (74 + this.rng.range(0, 14));
      const shot = simulateShot(
        {
          startX: A.side === 'home' ? startX : 100 - startX,
          startY: 30 + this.rng.gauss(0, 9),
          finishing: fin,
          strength: attributeOf(shooter, 'strength'),
          precision: prec,
          curve: attributeOf(shooter, 'curve'),
          direct: A.str.tactic.id === 'direto',
          bumpers: arenaBumpers(),
        },
        this.rng,
      );
      onTarget = shot.outcome !== 'out';
      pGoal *= ricochetMultiplier(shot.outcome);
      if (shot.outcome === 'goal' && shot.bounces > 0) {
        scoreKind = 'ricochet';
        A.stats.ricochets += 1;
      }
      this.trails.push({ minute: m, side: A.side, points: shot.points, outcome: shot.outcome, bounces: shot.bounces });
      this.event(m, 'ricochet', A.side, ricochetText(shooter.p.shortName, shot.outcome, shot.bounces), [shooter.p.id], ...this.pos(A.side, 'box'));
    } else {
      onTarget = this.rng.chance(clamp(0.5 + (0.25 * (prec - 60)) / 40, 0.25, 0.85));
    }

    if (!onTarget) {
      if (this.rng.chance(0.08)) {
        this.event(m, 'post', A.side, `Na trave! ${shooter.p.shortName} quase marca.`, [shooter.p.id], ...this.pos(A.side, 'box'));
        if (this.rng.chance(0.4)) this.corner(m, A, D);
      } else if (kind !== 'header' && this.rng.chance(0.08)) {
        this.event(m, 'block', D.side, `Chute de ${shooter.p.shortName} bloqueado pela defesa.`, [shooter.p.id], ...this.pos(A.side, 'box'));
        if (this.rng.chance(0.4)) this.corner(m, A, D);
      } else {
        this.event(m, 'miss', A.side, `${shooter.p.shortName} finaliza e a bola passa longe do gol.`, [shooter.p.id], ...this.pos(A.side, 'box'));
      }
      return;
    }

    A.stats.onTarget += 1;

    if (this.rng.chance(clamp(pGoal, 0.02, 0.92))) {
      const assist = this.pickAssist(A, shooter);
      this.score(A, shooter, assist, m, scoreKind, header);
      return;
    }

    let saveP = clamp(MATCH.savePercentBase + (0.3 * (D.str.gk - 60)) / 40, 0.45, 0.93);
    const keeperAbility = gk ? this.tryAbilityFor(gk, 'save', m) : null;
    if (keeperAbility) saveP += keeperAbility.value;

    if (gk && this.rng.chance(saveP)) {
      gk.stat.saves += 1;
      D.stats.saves += 1;
      this.event(m, 'save', D.side, `Defesa de ${gk.p.shortName} em chute de ${shooter.p.shortName}!`, [gk.p.id, shooter.p.id], ...this.pos(A.side, 'box'));
      if (this.rng.chance(0.25)) this.corner(m, A, D);
      return;
    }
    this.event(m, 'post', A.side, `${shooter.p.shortName} acerta o gol, mas a bola sobra na área.`, [shooter.p.id], ...this.pos(A.side, 'box'));
  }

  private score(side: SideState, scorer: PState, assist: PState | null, m: number, kind: 'normal' | 'penalty' | 'ricochet', header = false): void {
    side.score += 1;
    scorer.stat.goals += 1;
    if (assist) assist.stat.assists += 1;
    scorer.morale = clamp(scorer.morale + 4, 0, 100);
    for (const q of side.players) {
      if (q !== scorer && q.onField) q.morale = clamp(q.morale + 1, 0, 100);
    }
    const other = this.other(side.side);
    for (const q of other.players) {
      if (!q.onField) continue;
      const captainHelps = other.captain !== null && other.captain.onField && attributeOf(other.captain, 'leadership') >= 70;
      q.morale = clamp(q.morale - (captainHelps ? 1 : 2), 0, 100);
    }
    this.goalMinutes.push({ minute: m, side: side.side, scorer: scorer.p.id, kind });

    let text: string;
    if (kind === 'penalty') text = `GOL de pênalti de ${scorer.p.shortName}!`;
    else if (kind === 'ricochet') text = `GOL por ricochete de ${scorer.p.shortName}!`;
    else if (header) text = `GOL de cabeça de ${scorer.p.shortName}!`;
    else text = `GOL de ${scorer.p.shortName}!`;
    if (assist && kind !== 'penalty') text += ` Assistência de ${assist.p.shortName}.`;
    this.event(m, 'goal', side.side, `${text} ${this.scoreText()}.`, [scorer.p.id, ...(assist ? [assist.p.id] : [])], ...this.pos(side.side, 'box'));
  }

  private pickAssist(side: SideState, scorer: PState): PState | null {
    if (!this.rng.chance(0.6)) return null;
    return this.pickPlayer(side, (q) => {
      if (q === scorer) return 0;
      return attributeOf(q, 'passing') + attributeOf(q, 'vision') + (q.p.slotPosition === 'CM' || q.p.slotPosition === 'W' ? 10 : 0);
    });
  }

  private penaltyShootout(): [number, number] {
    this.event(this.minute, 'shootout', 'neutral', 'Disputa de pênaltis!', [], 50, 30);
    const takers = (side: SideState) => side.players
      .filter((q) => q.onField && !q.injured && q.p.slotPosition !== 'GK')
      .sort((a, b) => (attributeOf(b, 'finishing') + attributeOf(b, 'precision')) - (attributeOf(a, 'finishing') + attributeOf(a, 'precision')));
    const homeTakers = takers(this.home);
    const awayTakers = takers(this.away);
    let hGoals = 0;
    let aGoals = 0;
    const kick = (side: SideState, list: PState[], opp: SideState, idx: number): boolean => {
      const taker = list[idx % Math.max(1, list.length)];
      if (!taker) return false;
      return this.shootoutKick(side, taker, opp);
    };
    for (let idx = 0; idx < 5; idx++) {
      if (kick(this.home, homeTakers, this.away, idx)) hGoals++;
      if (kick(this.away, awayTakers, this.home, idx)) aGoals++;
    }
    for (let idx = 5; hGoals === aGoals && idx < 25; idx++) {
      if (kick(this.home, homeTakers, this.away, idx)) hGoals++;
      if (kick(this.away, awayTakers, this.home, idx)) aGoals++;
    }
    if (hGoals === aGoals) {
      if (this.rng.chance(0.5)) hGoals += 1;
      else aGoals += 1;
    }
    this.event(this.minute, 'shootout', 'neutral', `Pênaltis: ${this.home.team.city} ${hGoals} x ${aGoals} ${this.away.team.city}.`, [], 50, 30);
    return [hGoals, aGoals];
  }

  private shootoutKick(side: SideState, taker: PState, opp: SideState): boolean {
    const pGoal = penaltyGoalChance(attributeOf(taker, 'precision'), opp.str.gk, 0);
    const goal = this.rng.chance(pGoal);
    const verb = goal ? 'converte' : 'erra';
    this.event(this.minute, 'shootout', side.side, `${taker.p.shortName} ${verb} o pênalti.`, [taker.p.id], 50, 30);
    return goal;
  }

  private maybeInjuries(m: number): void {
    for (const side of ['home', 'away'] as const) {
      const s = this.sides[side];
      const medical = side === 'home' ? (this.options.medicalLevel ?? 0) : 0;
      for (const q of s.players) {
        if (!q.onField || q.injured) continue;
        const p = MATCH.injuryRatePerMinute * (1 + (100 - q.energy) / 50) * (1 - 0.08 * medical);
        if (this.rng.chance(p)) {
          q.injured = true;
          q.severe = this.rng.chance(MATCH.severeInjuryChance * (1 - 0.1 * medical));
          this.event(m, 'injury', side, `${q.p.shortName} sente lesão e segue com menos rendimento.`, [q.p.id], ...this.pos(side, 'mid'));
        }
      }
    }
  }

  private gkOf(side: SideState): PState | null {
    return side.players.find((q) => q.onField && q.p.slotPosition === 'GK') ?? null;
  }

  private tryAbilityFor(q: PState, trigger: AbilityTrigger, m: number): AbilityDef | null {
    const def = abilityById(q.p.ability);
    if (!def || def.trigger !== trigger) return null;
    if (!q.onField || q.injured) return null;
    if (q.abilityUses >= def.maxUsesPerMatch) return null;
    if (m < (q.readyAt[def.id] ?? 0)) return null;
    if (!this.rng.chance(def.activationChance)) return null;
    q.abilityUses += 1;
    q.readyAt[def.id] = m + def.cooldownMinutes;
    this.event(m, 'ability', q.side, `Habilidade ativada: ${def.name} (${q.p.shortName}).`, [q.p.id], ...this.pos(q.side, 'mid'));
    return def;
  }

  private tryAbilityFromTeam(side: SideState, trigger: AbilityTrigger, m: number): AbilityDef | null {
    for (const q of side.players) {
      if (ABILITIES[q.p.ability ?? '']?.trigger !== trigger) continue;
      const def = this.tryAbilityFor(q, trigger, m);
      if (def) return def;
    }
    return null;
  }

  private tryDefendAbility(D: SideState, m: number): AbilityDef | null {
    for (const q of D.players) {
      if (ABILITIES[q.p.ability ?? '']?.trigger !== 'defend') continue;
      const def = this.tryAbilityFor(q, 'defend', m);
      if (def) return def;
    }
    return null;
  }

  private pickPlayer(side: SideState, weightFn: (q: PState) => number): PState | null {
    const candidates = side.players.filter((q) => q.onField && !q.injured);
    if (candidates.length === 0) return null;
    const weighted: Array<readonly [PState, number]> = candidates.map((q) => [q, Math.max(0.01, weightFn(q))] as const);
    return this.rng.weighted(weighted);
  }

  /** Posição em coordenadas de campo (x: 0–100 da esquerda para a direita; y: 0–60). */
  private pos(side: MatchSide | 'neutral', zone: 'mid' | 'box' | 'wing' | 'corner'): [number, number] {
    const attackingSide: MatchSide = side === 'away' ? 'away' : 'home';
    const ax = zone === 'mid' ? this.rng.range(42, 62)
      : zone === 'box' ? this.rng.range(84, 96)
        : zone === 'wing' ? this.rng.range(60, 84)
          : 98;
    const ay = zone === 'wing'
      ? (this.rng.chance(0.5) ? this.rng.range(3, 12) : this.rng.range(48, 57))
      : zone === 'corner'
        ? (this.rng.chance(0.5) ? 2 : 58)
        : this.rng.range(18, 42);
    const x = attackingSide === 'home' ? ax : 100 - ax;
    return [round(x, 1), round(ay, 1)];
  }

  private event(minute: number, kind: MatchEventKind, side: MatchSide | 'neutral', text: string, playerIds: string[], x: number, y: number): void {
    const score: [number, number] = [this.home.score, this.away.score];
    this.events.push({ minute, kind, side, text, playerIds, x, y, score });
  }

  private scoreText(): string {
    return `${this.home.team.city} ${this.home.score} x ${this.away.score} ${this.away.team.city}`;
  }
}

function penaltyGoalChance(precision: number, gkRating: number, pressure: number): number {
  return clamp(0.76 + (0.12 * (precision - 60)) / 40 - (0.12 * (gkRating - 60)) / 40 + pressure, 0.55, 0.9);
}

function ricochetText(name: string, outcome: 'goal' | 'direct' | 'out', bounces: number): string {
  if (outcome === 'goal' && bounces > 0) return `${name} chuta, a bola bate na placa e a trajetória muda rumo ao gol!`;
  if (outcome === 'direct') return `${name} chuta em linha reta na direção do gol.`;
  return `${name} chuta, mas o efeito nas placas tira a bola do alvo.`;
}

function copyTeam(team: MatchTeam): MatchTeam {
  return { ...team, players: team.players.map((p) => ({ ...p })) };
}
