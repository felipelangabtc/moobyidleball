/** Biomas (divisões/temporadas) com identidade visual própria. Ciclam após o último. */
import type { ChestKind } from '../domain/types';

export interface BiomeDef {
  id: string;
  name: string;
  subtitle: string;
  grass: [string, string];
  sky: string;
  accent: string;
  chest: ChestKind;
  stadium: string;
  ricochetBoardColor: string;
}

export const BIOMES: BiomeDef[] = [
  {
    id: 'varzea',
    name: 'Várzea Esperança',
    subtitle: 'Campo de terra e torcida de lona',
    grass: ['#3f7d2c', '#4d9236'],
    sky: '#cfe8c0',
    accent: '#f5c542',
    chest: 'escola',
    stadium: 'Campo da Esperança',
    ricochetBoardColor: '#8d6e63',
  },
  {
    id: 'litoral',
    name: 'Litoral Maré Alta',
    subtitle: 'Vento de sal e arquibancada de madeira',
    grass: ['#2e7d5b', '#3b9470'],
    sky: '#bfe6f2',
    accent: '#4fc3f7',
    chest: 'escola',
    stadium: 'Arena da Maré',
    ricochetBoardColor: '#4fc3f7',
  },
  {
    id: 'serra',
    name: 'Serra Pedra Branca',
    subtitle: 'Estádio de rocha e neblina fria',
    grass: ['#3a6b4d', '#468159'],
    sky: '#d3dfe9',
    accent: '#b0bec5',
    chest: 'estadio',
    stadium: 'Anfiteatro da Pedra',
    ricochetBoardColor: '#90a4ae',
  },
  {
    id: 'metropole',
    name: 'Metrópole Neon',
    subtitle: 'Refletores e outdoors que nunca apagam',
    grass: ['#1d5c4e', '#246f5e'],
    sky: '#1a2236',
    accent: '#ff4fa3',
    chest: 'estadio',
    stadium: 'Estádio Neon Central',
    ricochetBoardColor: '#ff4fa3',
  },
  {
    id: 'cerrado',
    name: 'Cerrado Ouro',
    subtitle: 'Sol de fim de tarde e poeira dourada',
    grass: ['#6f8f2f', '#7fa037'],
    sky: '#ffe3b3',
    accent: '#ff8a3d',
    chest: 'ouro',
    stadium: 'Arena do Cerrado',
    ricochetBoardColor: '#ff8a3d',
  },
  {
    id: 'vulcao',
    name: 'Ilha Vulcânica',
    subtitle: 'Cinzas, lava e a torcida mais barulhenta',
    grass: ['#4a2f2a', '#5b3a33'],
    sky: '#3d1c17',
    accent: '#ff5252',
    chest: 'ouro',
    stadium: 'Caldeirão Vulcânico',
    ricochetBoardColor: '#ff5252',
  },
];

export function biomeFor(index: number): BiomeDef {
  return BIOMES[index % BIOMES.length] as BiomeDef;
}
