/**
 * Missões (diárias/semanais) e conquistas. Cada evento de jogo incrementa
 * contadores vitalícios; missões acompanham o delta desde o início do período.
 */

export const COUNTER_KEYS = [
  'matches',
  'wins',
  'draws',
  'losses',
  'goals',
  'goalsConceded',
  'cleanSheets',
  'saves',
  'chests',
  'athletes',
  'items',
  'trainings',
  'upgrades',
  'fusions',
  'idleClaims',
  'coinsEarned',
  'phasesCleared',
  'bosses',
  'ricochetGoals',
  'challengeWaves',
  'legendPulls',
  'mythicPulls',
  'missionsDone',
] as const;

export type CounterKey = (typeof COUNTER_KEYS)[number];

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  counter: CounterKey;
  target: number;
  reward: { coins: number; tokens?: number; fragments?: number; clubXp?: number };
}

export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'd-play3', title: 'Dia de jogo', description: 'Dispute 3 partidas.', counter: 'matches', target: 3, reward: { coins: 150, tokens: 2 } },
  { id: 'd-win2', title: 'Duas de duas', description: 'Vença 2 partidas.', counter: 'wins', target: 2, reward: { coins: 220, tokens: 2 } },
  { id: 'd-goals5', title: 'Ataque afiado', description: 'Marque 5 gols.', counter: 'goals', target: 5, reward: { coins: 180, fragments: 6 } },
  { id: 'd-chest1', title: 'Caixa surpresa', description: 'Abra 1 baú.', counter: 'chests', target: 1, reward: { coins: 120, tokens: 1 } },
  { id: 'd-train2', title: 'Treino em dia', description: 'Treine 2 atletas.', counter: 'trainings', target: 2, reward: { coins: 140, tokens: 2 } },
  { id: 'd-idle', title: 'Coleta da torcida', description: 'Colete a receita idle 1 vez.', counter: 'idleClaims', target: 1, reward: { coins: 100, clubXp: 10 } },
  { id: 'd-clean', title: 'Portão fechado', description: 'Vença sem sofrer gols.', counter: 'cleanSheets', target: 1, reward: { coins: 200, tokens: 1 } },
  { id: 'd-saves', title: 'Mão santa', description: 'Acumule 8 defesas de goleiros.', counter: 'saves', target: 8, reward: { coins: 160, fragments: 4 } },
];

export const WEEKLY_MISSIONS: MissionDef[] = [
  { id: 'w-wins10', title: 'Temporada de vitórias', description: 'Vença 10 partidas.', counter: 'wins', target: 10, reward: { coins: 900, tokens: 6, clubXp: 40 } },
  { id: 'w-matches15', title: 'Calendário cheio', description: 'Dispute 15 partidas.', counter: 'matches', target: 15, reward: { coins: 700, tokens: 4 } },
  { id: 'w-goals20', title: 'Chuva de gols', description: 'Marque 20 gols.', counter: 'goals', target: 20, reward: { coins: 800, fragments: 25 } },
  { id: 'w-chests5', title: 'Garimpo semanal', description: 'Abra 5 baús.', counter: 'chests', target: 5, reward: { coins: 600, fragments: 15, tokens: 3 } },
  { id: 'w-wave10', title: 'Sobrevivente', description: 'Vença 10 ondas no Torneio de Sobrevivência.', counter: 'challengeWaves', target: 10, reward: { coins: 1000, tokens: 5 } },
  { id: 'w-fusion1', title: 'Alquimia', description: 'Funda 1 conjunto de itens.', counter: 'fusions', target: 1, reward: { coins: 500, clubXp: 30 } },
];

export type AchievementCondition = { counter: CounterKey; target: number } | { stat: 'bestWave' | 'maxStars' | 'maxLevel'; target: number };

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  condition: AchievementCondition;
  reward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a-first-win', title: 'Primeiro apito', description: 'Vença sua primeira partida.', condition: { counter: 'wins', target: 1 }, reward: 150 },
  { id: 'a-ten-wins', title: 'Dez vitórias', description: 'Acumule 10 vitórias.', condition: { counter: 'wins', target: 10 }, reward: 300 },
  { id: 'a-fifty-wins', title: 'Cinquenta triunfos', description: 'Acumule 50 vitórias.', condition: { counter: 'wins', target: 50 }, reward: 900 },
  { id: 'a-goals50', title: 'Máquina de gols', description: 'Marque 50 gols no total.', condition: { counter: 'goals', target: 50 }, reward: 400 },
  { id: 'a-clean10', title: 'Muralha de aço', description: 'Mantenha 10 jogos sem sofrer gol.', condition: { counter: 'cleanSheets', target: 10 }, reward: 350 },
  { id: 'a-chests20', title: 'Colecionador', description: 'Abra 20 baús.', condition: { counter: 'chests', target: 20 }, reward: 400 },
  { id: 'a-legend', title: 'Lenda à vista', description: 'Obtenha um atleta lendário.', condition: { counter: 'legendPulls', target: 1 }, reward: 500 },
  { id: 'a-mythic', title: 'Mítico', description: 'Obtenha um atleta mítico.', condition: { counter: 'mythicPulls', target: 1 }, reward: 1500 },
  { id: 'a-star5', title: 'Cinco estrelas', description: 'Leve um atleta a 5 estrelas.', condition: { stat: 'maxStars', target: 5 }, reward: 800 },
  { id: 'a-level20', title: 'Experiente', description: 'Leve um atleta ao nível 20.', condition: { stat: 'maxLevel', target: 20 }, reward: 400 },
  { id: 'a-boss', title: 'Caçador de chefes', description: 'Vença um chefe de temporada.', condition: { counter: 'bosses', target: 1 }, reward: 600 },
  { id: 'a-wave10', title: 'Sobrevivência nível 1', description: 'Chegue à onda 10 do Torneio.', condition: { stat: 'bestWave', target: 10 }, reward: 500 },
  { id: 'a-wave25', title: 'Sobrevivência nível 2', description: 'Chegue à onda 25 do Torneio.', condition: { stat: 'bestWave', target: 25 }, reward: 1200 },
  { id: 'a-ricochet5', title: 'Mestre das placas', description: 'Marque 5 gols de ricochete.', condition: { counter: 'ricochetGoals', target: 5 }, reward: 500 },
  { id: 'a-fusion5', title: 'Alquimista', description: 'Funda 5 conjuntos de itens.', condition: { counter: 'fusions', target: 5 }, reward: 350 },
  { id: 'a-upgrades10', title: 'Clube em obras', description: 'Compre 10 melhorias do clube.', condition: { counter: 'upgrades', target: 10 }, reward: 700 },
  { id: 'a-idle10', title: 'Torcida fiel', description: 'Faça 10 coletas idle.', condition: { counter: 'idleClaims', target: 10 }, reward: 300 },
  { id: 'a-squad25', title: 'Elenco de respeito', description: 'Reúna 25 atletas.', condition: { counter: 'athletes', target: 25 }, reward: 600 },
  { id: 'a-train30', title: 'Preparador', description: 'Treine atletas 30 vezes.', condition: { counter: 'trainings', target: 30 }, reward: 400 },
];
