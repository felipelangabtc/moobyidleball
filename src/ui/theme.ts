import type { ChestKind, Position, Rarity } from '../domain/types';

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#b0a392',
  rare: '#4fc3f7',
  epic: '#c084fc',
  legend: '#ffc23a',
  mythic: '#ff5f7e',
};

export const CHEST_COLOR: Record<ChestKind, string> = {
  escola: '#8bc34a',
  estadio: '#4fc3f7',
  ouro: '#f5c542',
};

export const POSITION_COLOR: Record<Position, string> = {
  GK: '#ffd54f',
  CB: '#90a4ae',
  FB: '#64b5f6',
  DM: '#81c784',
  CM: '#4db6ac',
  W: '#ffb74d',
  ST: '#ef5350',
};

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

export function fmt1(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function clock(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function dateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
