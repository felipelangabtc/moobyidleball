import { create } from 'zustand';

export type Screen =
  | 'home'
  | 'campaign'
  | 'prep'
  | 'match'
  | 'squad'
  | 'chests'
  | 'club'
  | 'marketplace'
  | 'missions'
  | 'encyclopedia'
  | 'stats'
  | 'settings';

export const SCREEN_LABEL: Record<Screen, string> = {
  home: 'Início',
  campaign: 'Campanha',
  prep: 'Preparação',
  match: 'Partida',
  squad: 'Elenco',
  chests: 'Baús',
  club: 'Clube',
  marketplace: 'Mercado',
  missions: 'Missões',
  encyclopedia: 'Enciclopédia',
  stats: 'Estatísticas',
  settings: 'Ajustes',
};

interface NavState {
  screen: Screen;
  campaignTab: 'mapa' | 'torneio';
  squadTab: 'escalacao' | 'elenco';
  clubTab: 'treino' | 'equipamentos' | 'melhorias' | 'clube';
  athleteId: string | null;
  go: (screen: Screen) => void;
  setCampaignTab: (tab: NavState['campaignTab']) => void;
  setSquadTab: (tab: NavState['squadTab']) => void;
  setClubTab: (tab: NavState['clubTab']) => void;
  openAthlete: (id: string | null) => void;
}

export const useNav = create<NavState>()((set) => ({
  screen: 'home',
  campaignTab: 'mapa',
  squadTab: 'escalacao',
  clubTab: 'treino',
  athleteId: null,
  go: (screen) => set({ screen }),
  setCampaignTab: (campaignTab) => set({ campaignTab }),
  setSquadTab: (squadTab) => set({ squadTab }),
  setClubTab: (clubTab) => set({ clubTab }),
  openAthlete: (athleteId) => set({ athleteId }),
}));
