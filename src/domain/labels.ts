/** Rótulos em português compartilhados por domínio e interface. */
import type { AttributeKey, ChestKind, Rarity, TrainingFocus } from './types';

export const ATTR_LABEL: Record<AttributeKey, string> = {
  finishing: 'Finalização',
  passing: 'Passe',
  vision: 'Visão',
  dribbling: 'Drible',
  control: 'Controle de bola',
  pace: 'Velocidade',
  acceleration: 'Aceleração',
  strength: 'Força',
  stamina: 'Resistência',
  positioning: 'Posicionamento',
  marking: 'Marcação',
  tackling: 'Desarme',
  heading: 'Cabeceio',
  reflexes: 'Reflexos',
  distribution: 'Reposição',
  precision: 'Precisão',
  curve: 'Efeito',
  discipline: 'Disciplina',
  leadership: 'Liderança',
  versatility: 'Versatilidade',
};

export const FOCUS_LABEL: Record<TrainingFocus, string> = {
  attack: 'Ataque',
  defense: 'Defesa',
  physical: 'Físico',
  technique: 'Técnica',
  keeper: 'Goleiro',
  leadership: 'Liderança',
};

export const RARITY_NAME_PT: Record<Rarity, string> = {
  common: 'Comum',
  rare: 'Raro',
  epic: 'Épico',
  legend: 'Lendário',
  mythic: 'Mítico',
};

export const CHEST_NAME_PT: Record<ChestKind, string> = {
  escola: 'Baú da Escolinha',
  estadio: 'Baú do Estádio',
  ouro: 'Baú de Ouro',
};
