/**
 * Física de ricochete da arena de placas.
 *
 * Coordenadas no referencial do atacante: x de 0 a 100 (gol adversário em x = 100),
 * y de 0 a 60. Integração semi-implícita com passo fixo (sem dependência do
 * tempo real), velocidade limitada, atrito linear e reflexão com coeficiente de
 * restituição. Como a simulação é determinística, o mesmo chute sempre gera a
 * mesma trajetória, e a interface apenas desenha o resultado já calculado.
 */
import { RICOCHET } from '../domain/balance';
import { clamp, type Rng } from '../domain/rng';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ShotParams {
  startX: number;
  startY: number;
  finishing: number;
  strength: number;
  precision: number;
  curve: number;
  direct: boolean;
  bumpers?: readonly Segment[];
}

export type ShotOutcome = 'goal' | 'direct' | 'out';

export interface ShotResult {
  outcome: ShotOutcome;
  bounces: number;
  points: Array<[number, number]>;
  endX: number;
  endY: number;
  steps: number;
  maxSpeed: number;
}

/** Espelha as placas para ambos os gols, de modo que a arena seja simétrica. */
export function arenaBumpers(): Segment[] {
  const base = RICOCHET.bumpers.map((b) => ({ x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 }));
  const mirror = base.map((b) => ({ x1: 100 - b.x1, y1: b.y1, x2: 100 - b.x2, y2: b.y2 }));
  return [...base, ...mirror];
}

/** Distância de um ponto ao segmento e o ponto mais próximo sobre o segmento. */
export function closestPointOnSegment(px: number, py: number, s: Segment): { x: number; y: number; d: number } {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - s.x1) * dx + (py - s.y1) * dy) / len2, 0, 1);
  const cx = s.x1 + dx * t;
  const cy = s.y1 + dy * t;
  return { x: cx, y: cy, d: Math.hypot(px - cx, py - cy) };
}

/** Simula um chute. Não depende de relógio; toda a aleatoriedade vem do RNG. */
export function simulateShot(params: ShotParams, rng: Rng): ShotResult {
  const cfg = RICOCHET;
  const bumpers = params.bumpers ?? arenaBumpers();
  const aimSpread = 1.5 + (1 - params.precision / 100) * 7 + (params.direct ? 1.5 : 0);
  const aimY = clamp(cfg.height / 2 + rng.gauss(0, aimSpread), -6, cfg.height + 6);

  const dirX = cfg.width - params.startX;
  const dirY = aimY - params.startY;
  const dirLen = Math.hypot(dirX, dirY) || 1;
  const speed0 = clamp(40 + params.strength * 0.2 + params.finishing * 0.12, 45, 72);
  let vx = (dirX / dirLen) * speed0;
  let vy = (dirY / dirLen) * speed0;

  const curveAccel = 10 * (params.curve / 100);
  const curveSign = Math.sign(cfg.height / 2 - params.startY) || 1;

  const r = cfg.ballRadius;
  let x = params.startX;
  let y = clamp(params.startY, r, cfg.height - r);
  let bounces = 0;
  let maxSpeed = Math.hypot(vx, vy);
  const points: Array<[number, number]> = [[round1(x), round1(y)]];
  let t = 0;
  let outcome: ShotOutcome = 'out';
  let steps = 0;

  for (steps = 1; steps <= cfg.maxSteps; steps++) {
    const dt = cfg.dt;
    t += dt;

    const damp = Math.max(0, 1 - cfg.friction * dt);
    vx *= damp;
    vy *= damp;
    if (t < cfg.curveDuration) {
      vy += curveSign * curveAccel * dt;
    }
    const speed = Math.hypot(vx, vy);
    if (speed > cfg.maxSpeed) {
      vx = (vx / speed) * cfg.maxSpeed;
      vy = (vy / speed) * cfg.maxSpeed;
    }
    maxSpeed = Math.max(maxSpeed, Math.hypot(vx, vy));

    x += vx * dt;
    y += vy * dt;

    if (y < r) {
      y = 2 * r - y;
      vy = Math.abs(vy) * cfg.restitution;
      bounces++;
    } else if (y > cfg.height - r) {
      y = 2 * (cfg.height - r) - y;
      vy = -Math.abs(vy) * cfg.restitution;
      bounces++;
    }

    for (const bumper of bumpers) {
      const hit = closestPointOnSegment(x, y, bumper);
      if (hit.d < r) {
        let nx = x - hit.x;
        let ny = y - hit.y;
        if (hit.d < 1e-6) {
          nx = -(bumper.y2 - bumper.y1);
          ny = bumper.x2 - bumper.x1;
        }
        const nLen = Math.hypot(nx, ny) || 1;
        nx /= nLen;
        ny /= nLen;
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          vx -= (1 + cfg.restitution) * vn * nx;
          vy -= (1 + cfg.restitution) * vn * ny;
          bounces++;
        }
        x = hit.x + nx * (r + 0.01);
        y = hit.y + ny * (r + 0.01);
      }
    }

    y = clamp(y, r, cfg.height - r);
    if (steps % 4 === 0) points.push([round1(x), round1(y)]);

    if (x >= cfg.width) {
      const inMouth = y >= cfg.goalTop && y <= cfg.goalBottom;
      outcome = inMouth ? (bounces > 0 ? 'goal' : 'direct') : 'out';
      points.push([round1(cfg.width), round1(y)]);
      break;
    }
    if (x <= 0) {
      points.push([0, round1(y)]);
      break;
    }
    if (Math.hypot(vx, vy) < cfg.minSpeed) break;
  }

  return {
    outcome,
    bounces,
    points,
    endX: round1(x),
    endY: round1(y),
    steps,
    maxSpeed: round1(maxSpeed),
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Multiplicador de chance de gol conforme o resultado físico do chute. */
export function ricochetMultiplier(outcome: ShotOutcome): number {
  if (outcome === 'goal') return RICOCHET.multipliers.goal;
  if (outcome === 'direct') return RICOCHET.multipliers.direct;
  return RICOCHET.multipliers.out;
}
