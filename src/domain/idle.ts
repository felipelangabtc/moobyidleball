/**
 * Receita idle e recompensas offline.
 *
 * Regras:
 * - A receita acumula apenas em moedas, XP de clube e fichas de treino.
 * - Nunca avança fase, nunca declara vitória e nunca concede atletas.
 * - O acúmulo é limitado por horas (cresce com a Academia Juvenil, máx. 12h).
 * - Relógio que retrocede gera 0 e reancora o marco de tempo.
 * - Intervalos absurdos são limitados (máx. 14 dias antes do limite de horas).
 * - Cada coleta reinicia o marco; coletar duas vezes seguidas não duplica nada.
 *
 * Observação de segurança: sem servidor, um usuário com acesso ao armazenamento
 * local pode editar o save. Ver README (limites de segurança).
 */
import { IDLE } from './balance';
import { idleCapHours, idleCoinsPerHour } from './economy';

export interface IdleInput {
  lastCollectedAt: number;
  now: number;
  clubLevel: number;
  stadiumLevel: number;
  youthLevel: number;
}

export interface IdleSummary {
  elapsedMs: number;
  hours: number;
  cappedHours: number;
  cappedByLimit: boolean;
  coins: number;
  clubXp: number;
  tokens: number;
  incomePerHour: number;
  reason: 'ok' | 'clock-rewind' | 'too-short' | 'empty';
}

export function computeIdle(input: IdleInput): IdleSummary {
  const incomePerHour = idleCoinsPerHour(input.clubLevel, input.stadiumLevel);
  const cap = idleCapHours(input.youthLevel);
  const rawMs = input.now - input.lastCollectedAt;

  if (!Number.isFinite(rawMs) || rawMs < 0) {
    return zero(incomePerHour, 'clock-rewind');
  }
  if (rawMs < IDLE.minElapsedSeconds * 1000) {
    return zero(incomePerHour, 'too-short');
  }

  const maxMs = IDLE.maxElapsedHours * 3_600_000;
  const boundedMs = Math.min(rawMs, maxMs);
  const hours = boundedMs / 3_600_000;
  const cappedHours = Math.min(hours, cap);
  const cappedByLimit = hours > cap;

  const coins = Math.floor(cappedHours * incomePerHour);
  const clubXp = Math.floor(cappedHours * IDLE.clubXpPerHour);
  const tokens = Math.floor(cappedHours * IDLE.tokensPerHourBase);

  if (coins === 0 && clubXp === 0 && tokens === 0) return zero(incomePerHour, 'empty');

  return {
    elapsedMs: rawMs,
    hours: round2(hours),
    cappedHours: round2(cappedHours),
    cappedByLimit,
    coins,
    clubXp,
    tokens,
    incomePerHour,
    reason: 'ok',
  };
}

function zero(incomePerHour: number, reason: IdleSummary['reason']): IdleSummary {
  return {
    elapsedMs: 0,
    hours: 0,
    cappedHours: 0,
    cappedByLimit: false,
    coins: 0,
    clubXp: 0,
    tokens: 0,
    incomePerHour,
    reason,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}
