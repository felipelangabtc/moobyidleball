/**
 * Estimativa de dificuldade: roda a mesma simulação várias vezes com seeds
 * diferentes e conta vitórias, empates e derrotas. Usada na prévia da partida.
 */
import type { ArenaId, MatchTeam } from '../domain/types';
import { simulateMatch } from './engine';

export interface WinEstimate {
  samples: number;
  win: number;
  draw: number;
  loss: number;
  averageGoalsFor: number;
  averageGoalsAgainst: number;
}

export function estimateOutcome(
  home: MatchTeam,
  away: MatchTeam,
  options: { requiresWinner: boolean; arena: ArenaId },
  samples = 120,
  baseSeed = 1337,
): WinEstimate {
  let win = 0;
  let draw = 0;
  let loss = 0;
  let gf = 0;
  let ga = 0;
  for (let i = 0; i < samples; i++) {
    const report = simulateMatch(home, away, baseSeed + i * 7919, options);
    gf += report.score[0];
    ga += report.score[1];
    if (report.winner === 'home') win++;
    else if (report.winner === 'away') loss++;
    else if (options.requiresWinner) loss++;
    else draw++;
  }
  return {
    samples,
    win: Math.round((win / samples) * 100),
    draw: Math.round((draw / samples) * 100),
    loss: Math.round((loss / samples) * 100),
    averageGoalsFor: Math.round((gf / samples) * 10) / 10,
    averageGoalsAgainst: Math.round((ga / samples) * 10) / 10,
  };
}
