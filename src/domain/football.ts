/**
 * Regras de futebol: posições, pesos de atributos por posição, formações,
 * táticas e a matriz de vantagens entre táticas e formações.
 */
import type { AttributeKey, FormationId, Position, TacticId } from './types';
export type { FormationId, TacticId };

export const POSITION_LABEL: Record<Position, string> = {
  GK: 'Goleiro',
  CB: 'Zagueiro',
  FB: 'Lateral',
  DM: 'Volante',
  CM: 'Meio-campista',
  W: 'Ponta',
  ST: 'Atacante',
};

export const POSITION_SHORT: Record<Position, string> = {
  GK: 'GOL',
  CB: 'ZAG',
  FB: 'LAT',
  DM: 'VOL',
  CM: 'MEI',
  W: 'PON',
  ST: 'ATA',
};

/**
 * Pesos por posição (escala relativa). OVR da posição = média ponderada
 * dos atributos efetivos. Documentado no README.
 */
export const POSITION_WEIGHTS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  GK: { reflexes: 3, distribution: 1.5, positioning: 2, precision: 0.5, stamina: 0.5, discipline: 0.6 },
  CB: { marking: 3, tackling: 2.5, positioning: 2.5, heading: 2, strength: 2, pace: 1, passing: 0.8, discipline: 0.6 },
  FB: { pace: 2, acceleration: 1.5, marking: 2, tackling: 1.5, passing: 1.5, stamina: 1.5, dribbling: 0.8, positioning: 1.2 },
  DM: { tackling: 2.5, marking: 2, passing: 2, vision: 1.8, stamina: 2, positioning: 2, strength: 1.2, control: 1 },
  CM: { passing: 2.5, vision: 2.2, control: 2, stamina: 2, tackling: 1, positioning: 1.2, finishing: 0.6, dribbling: 0.8 },
  W: { pace: 2.5, acceleration: 2, dribbling: 2.5, finishing: 1.4, precision: 1, passing: 1, stamina: 1, curve: 0.8 },
  ST: { finishing: 3, positioning: 2, heading: 1.5, pace: 1.5, acceleration: 1.2, control: 1, precision: 1.5, strength: 1 },
};

/** Atributos fortes e fracos de um atleta para uma posição (para a ficha). */
export function relevantAttributes(position: Position): AttributeKey[] {
  return Object.entries(POSITION_WEIGHTS[position])
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 6)
    .map(([key]) => key as AttributeKey);
}

export interface FormationSlot {
  position: Position;
  x: number;
  y: number;
}

export interface FormationDef {
  id: FormationId;
  label: string;
  description: string;
  slots: FormationSlot[];
  midBonus: number;
  defBonus: number;
  attackBonus: number;
}

const GK: FormationSlot = { position: 'GK', x: 6, y: 50 };

import { FORMATION_IDS, TACTIC_IDS } from './types';
export { FORMATION_IDS, TACTIC_IDS };
export const FORMATIONS: Record<FormationId, FormationDef> = {
  '4-3-3': {
    id: '4-3-3',
    label: '4-3-3',
    description: 'Ataque pelas pontas e pressão constante. Bom contra linhas baixas.',
    slots: [
      GK,
      { position: 'FB', x: 22, y: 12 },
      { position: 'CB', x: 18, y: 32 },
      { position: 'CB', x: 18, y: 68 },
      { position: 'FB', x: 22, y: 88 },
      { position: 'DM', x: 38, y: 50 },
      { position: 'CM', x: 46, y: 32 },
      { position: 'CM', x: 46, y: 68 },
      { position: 'W', x: 72, y: 14 },
      { position: 'ST', x: 78, y: 50 },
      { position: 'W', x: 72, y: 86 },
    ],
    midBonus: 0,
    defBonus: 0,
    attackBonus: 0.03,
  },
  '4-4-2': {
    id: '4-4-2',
    label: '4-4-2',
    description: 'Equilibrada e compacta. Sem grandes fraquezas, sem grandes destaques.',
    slots: [
      GK,
      { position: 'FB', x: 22, y: 12 },
      { position: 'CB', x: 18, y: 32 },
      { position: 'CB', x: 18, y: 68 },
      { position: 'FB', x: 22, y: 88 },
      { position: 'W', x: 44, y: 12 },
      { position: 'CM', x: 40, y: 36 },
      { position: 'CM', x: 40, y: 64 },
      { position: 'W', x: 44, y: 88 },
      { position: 'ST', x: 74, y: 36 },
      { position: 'ST', x: 74, y: 64 },
    ],
    midBonus: 0.01,
    defBonus: 0.01,
    attackBonus: 0,
  },
  '3-5-2': {
    id: '3-5-2',
    label: '3-5-2',
    description: 'Domina o meio-campo com cinco homens. Laterais exigem muito fôlego.',
    slots: [
      GK,
      { position: 'CB', x: 18, y: 26 },
      { position: 'CB', x: 16, y: 50 },
      { position: 'CB', x: 18, y: 74 },
      { position: 'FB', x: 40, y: 10 },
      { position: 'DM', x: 36, y: 40 },
      { position: 'CM', x: 46, y: 50 },
      { position: 'DM', x: 36, y: 60 },
      { position: 'FB', x: 40, y: 90 },
      { position: 'ST', x: 74, y: 36 },
      { position: 'ST', x: 74, y: 64 },
    ],
    midBonus: 0.04,
    defBonus: -0.01,
    attackBonus: 0,
  },
  '5-3-2': {
    id: '5-3-2',
    label: '5-3-2',
    description: 'Bloco defensivo sólido para proteger a vantagem e sair em contra-ataque.',
    slots: [
      GK,
      { position: 'FB', x: 22, y: 10 },
      { position: 'CB', x: 16, y: 30 },
      { position: 'CB', x: 14, y: 50 },
      { position: 'CB', x: 16, y: 70 },
      { position: 'FB', x: 22, y: 90 },
      { position: 'CM', x: 42, y: 30 },
      { position: 'DM', x: 36, y: 50 },
      { position: 'CM', x: 42, y: 70 },
      { position: 'ST', x: 72, y: 36 },
      { position: 'ST', x: 72, y: 64 },
    ],
    midBonus: 0,
    defBonus: 0.04,
    attackBonus: -0.02,
  },
};

export interface TacticDef {
  id: TacticId;
  label: string;
  description: string;
  possession: number;
  attack: number;
  defense: number;
  energyCost: number;
  turnover: number;
  wings: number;
  direct: number;
}

export const TACTICS: Record<TacticId, TacticDef> = {
  posse: {
    id: 'posse',
    label: 'Posse de bola',
    description: 'Controla o ritmo com passes curtos. Mais posse, menos energia gasta, ataques mais lentos.',
    possession: 0.06,
    attack: 1,
    defense: 1,
    energyCost: 1,
    turnover: 0,
    wings: 0,
    direct: 0,
  },
  contra: {
    id: 'contra',
    label: 'Contra-ataque',
    description: 'Cede a bola e explora espaços. Cresce quando recupera a posse.',
    possession: -0.07,
    attack: 1.05,
    defense: 1.02,
    energyCost: 0.9,
    turnover: 0.06,
    wings: 0,
    direct: 0.02,
  },
  pressao: {
    id: 'pressao',
    label: 'Pressão alta',
    description: 'Sufoca a saída de bola adversária, mas cansa mais e deixa espaço atrás.',
    possession: 0.02,
    attack: 1,
    defense: 1.08,
    energyCost: 1.35,
    turnover: 0.08,
    wings: 0,
    direct: 0,
  },
  bloco: {
    id: 'bloco',
    label: 'Bloco defensivo',
    description: 'Fecha os espaços centrais. Sofre pouco, mas cria menos chances.',
    possession: -0.1,
    attack: 0.92,
    defense: 1.12,
    energyCost: 0.8,
    turnover: 0,
    wings: 0,
    direct: 0,
  },
  lateral: {
    id: 'lateral',
    label: 'Jogo pelas laterais',
    description: 'Ataca pelas pontas com cruzamentos. Eficiente contra blocos baixos.',
    possession: 0,
    attack: 1.02,
    defense: 0.97,
    energyCost: 1.05,
    turnover: 0,
    wings: 0.12,
    direct: 0,
  },
  direto: {
    id: 'direto',
    label: 'Jogo direto',
    description: 'Bola longa para o atacante. Chutes rápidos, porém menos precisos.',
    possession: -0.08,
    attack: 1.06,
    defense: 1,
    energyCost: 1,
    turnover: 0.02,
    wings: 0,
    direct: 0.1,
  },
};

/**
 * Vantagem da tática A (linha) contra a tática B (coluna), como fração
 * somada à força de ataque de A. Valores positivos favorecem A.
 */
const MATCHUP: Record<TacticId, Record<TacticId, number>> = {
  posse: { posse: 0, contra: 0.03, pressao: -0.06, bloco: -0.04, lateral: 0, direto: 0.04 },
  contra: { posse: 0.05, contra: 0, pressao: 0.04, bloco: -0.06, lateral: 0.02, direto: -0.03 },
  pressao: { posse: 0.08, contra: -0.07, pressao: 0, bloco: 0.02, lateral: 0.03, direto: 0.03 },
  bloco: { posse: 0.05, contra: 0.06, pressao: -0.04, bloco: 0, lateral: -0.05, direto: 0.04 },
  lateral: { posse: 0.01, contra: -0.01, pressao: -0.02, bloco: 0.07, lateral: 0, direto: -0.02 },
  direto: { posse: -0.03, contra: 0.03, pressao: -0.05, bloco: -0.04, lateral: 0.02, direto: 0 },
};

export function tacticMatchup(attacker: TacticId, defender: TacticId): number {
  return MATCHUP[attacker][defender];
}

/**
 * Fator de encaixe de um atleta numa posição de formação.
 * Posição principal = 1; secundária = 0.96; fora da posição depende da versatilidade.
 */
export function fitFactor(athlete: { position: Position; secondary: Position[] }, slot: Position, versatility: number): number {
  if (athlete.position === slot) return 1;
  if (athlete.secondary.includes(slot)) return 0.96;
  const sameLine = lineOf(athlete.position) === lineOf(slot);
  const base = sameLine ? 0.9 : 0.84;
  return base + 0.12 * (versatility / 100);
}

export function lineOf(position: Position): 'def' | 'mid' | 'att' | 'gk' {
  switch (position) {
    case 'GK':
      return 'gk';
    case 'CB':
    case 'FB':
      return 'def';
    case 'DM':
    case 'CM':
      return 'mid';
    default:
      return 'att';
  }
}

export function lineupSlotsFor(formation: FormationId): FormationSlot[] {
  return FORMATIONS[formation].slots;
}
