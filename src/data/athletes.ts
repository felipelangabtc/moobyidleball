/**
 * Modelos de atletas fictícios. Cada modelo tem raridade fixa; a instância
 * sorteada recebe potencial dentro da faixa da raridade (ver balance.ts).
 * "shape" define a silhueta de atributos (valores de -1 a 1 em torno do potencial).
 */
import type { AthleteTemplate } from '../domain/types';

export const ATHLETE_TEMPLATES: AthleteTemplate[] = [
  // ---- Comuns ----
  { id: 'nico-ferrolho', name: 'Nico Ferrolho', nationality: 'Terra Verde', position: 'GK', secondary: [], rarity: 'common', ability: 'ironHands', shape: { reflexes: 1, positioning: 0.5, distribution: 0.3 }, traits: ['Cauteloso'], bio: 'Goleiro da várzea que aprendeu a ler chutes olhando para os pés do atacante.', hue: 210 },
  { id: 'ivo-marabo', name: 'Ivo Marabó', nationality: 'Vale do Sol', position: 'CB', secondary: ['DM'], rarity: 'common', ability: 'sweeper', shape: { marking: 1, strength: 0.8, heading: 0.6 }, traits: ['Disciplinado'], bio: 'Zagueiro de braço firme que nunca sai do lugar sem motivo.', hue: 25 },
  { id: 'bento-lira', name: 'Bento Lira', nationality: 'Costa Azul', position: 'CB', secondary: ['FB'], rarity: 'common', ability: 'reader', shape: { tackling: 0.8, positioning: 0.6 }, traits: ['Cauteloso'], bio: 'Filho de pescador, antecipa passes como quem prevê a maré.', hue: 195 },
  { id: 'rafa-lusco', name: 'Rafa Lusco', nationality: 'Ilhas Azuis', position: 'FB', secondary: ['W'], rarity: 'common', ability: 'cross', shape: { pace: 0.8, stamina: 0.7, passing: 0.4 }, traits: ['Fôlego'], bio: 'Lateral de ida e volta incansável, sobe no ataque sem pedir licença.', hue: 140 },
  { id: 'duda-ferrante', name: 'Duda Ferrante', nationality: 'Montanha Alta', position: 'FB', secondary: ['CB'], rarity: 'common', ability: 'wall', shape: { marking: 0.6, stamina: 0.8 }, traits: ['Coração de leão'], bio: 'Marcação colada e coração enorme para cada divididinha.', hue: 330 },
  { id: 'caio-mendes', name: 'Caio Mendes', nationality: 'Litoral Norte', position: 'DM', secondary: ['CM'], rarity: 'common', ability: 'wall', shape: { tackling: 0.8, stamina: 0.6 }, traits: ['Coração de leão'], bio: 'Rouba bolas com sorriso e distribui com simplicidade.', hue: 10 },
  { id: 'teo-varginha', name: 'Teo Varginha', nationality: 'Serra Dourada', position: 'DM', secondary: ['CB'], rarity: 'common', ability: 'reader', shape: { positioning: 0.7, vision: 0.4 }, traits: ['Cauteloso'], bio: 'Joga de cabeça erguida e fecha a entrada da área com calma.', hue: 260 },
  { id: 'lucca-brandao', name: 'Lucca Brandão', nationality: 'Terra Verde', position: 'CM', secondary: ['DM'], rarity: 'common', ability: 'maestro', shape: { passing: 1, vision: 0.6 }, traits: ['Ousado'], bio: 'Organiza o jogo com passes curtos e uma paciência que impressiona.', hue: 150 },
  { id: 'gael-sormani', name: 'Gael Sormani', nationality: 'Vale do Sol', position: 'CM', secondary: ['W'], rarity: 'common', ability: 'leader', shape: { control: 0.8, stamina: 0.5 }, traits: ['Capitão nato'], bio: 'Não faz muito alarde, mas sempre aparece onde a bola vai cair.', hue: 40 },
  { id: 'yuri-tavares', name: 'Yuri Tavares', nationality: 'Costa Azul', position: 'W', secondary: ['ST'], rarity: 'common', ability: 'curler', shape: { pace: 0.8, dribbling: 0.9 }, traits: ['Ousado'], bio: 'Driblador de rua, cresceu jogando em quadras improvisadas.', hue: 290 },
  { id: 'iago-pacheco', name: 'Iago Pacheco', nationality: 'Ilhas Azuis', position: 'W', secondary: ['FB'], rarity: 'common', ability: 'cross', shape: { acceleration: 0.8, dribbling: 0.6 }, traits: ['Fôlego'], bio: 'Velocidade de sobra e cruzamentos que procuram a cabeça dos centroavantes.', hue: 185 },
  { id: 'enzo-quintela', name: 'Enzo Quintela', nationality: 'Montanha Alta', position: 'ST', secondary: ['W'], rarity: 'common', ability: 'rebound', shape: { finishing: 0.9, positioning: 0.5 }, traits: ['Ousado'], bio: 'Vive de sobras na área e de chutes que ninguém esperava.', hue: 350 },

  // ---- Raros ----
  { id: 'mateus-corvo', name: 'Mateus Corvo', nationality: 'Litoral Norte', position: 'GK', secondary: [], rarity: 'rare', ability: 'ironHands', shape: { reflexes: 0.8, distribution: 0.7 }, traits: ['Disciplinado'], bio: 'Saídas de gol precisas e um talento para defender pênaltis.', hue: 220 },
  { id: 'otavio-brenner', name: 'Otávio Brenner', nationality: 'Serra Dourada', position: 'CB', secondary: ['DM'], rarity: 'rare', ability: 'wall', shape: { marking: 0.8, strength: 0.7 }, traits: ['Coração de leão'], bio: 'Vem das categorias de base e não recua diante de nenhum atacante.', hue: 30 },
  { id: 'henrique-sa', name: 'Henrique Sá', nationality: 'Montanha Alta', position: 'CB', secondary: ['FB'], rarity: 'rare', ability: 'sweeper', shape: { tackling: 0.7, heading: 0.5 }, traits: ['Disciplinado'], bio: 'Cobertura inteligente e cabeça fria nos minutos finais.', hue: 205 },
  { id: 'leandro-quirino', name: 'Leandro Quirino', nationality: 'Vale do Sol', position: 'FB', secondary: ['DM'], rarity: 'rare', ability: 'cross', shape: { stamina: 0.6, pace: 0.6, passing: 0.5 }, traits: ['Fôlego'], bio: 'Pulmão de pedra, cruza bem e toma conta do lado direito.', hue: 120 },
  { id: 'rubens-ayala', name: 'Rubens Ayala', nationality: 'Costa Azul', position: 'FB', secondary: ['W'], rarity: 'rare', ability: 'curler', shape: { pace: 0.7, dribbling: 0.5 }, traits: ['Ousado'], bio: 'Velocista que sobe pela linha e surpreende com finalizações de longe.', hue: 170 },
  { id: 'bruno-caldas', name: 'Bruno Caldas', nationality: 'Terra Verde', position: 'DM', secondary: ['CB'], rarity: 'rare', ability: 'reader', shape: { tackling: 0.9, positioning: 0.5 }, traits: ['Disciplinado'], bio: 'Desarmes limpos e uma leitura de jogo que lembra um veterano.', hue: 15 },
  { id: 'samir-vellos', name: 'Samir Vellos', nationality: 'Ilhas Azuis', position: 'DM', secondary: ['CM'], rarity: 'rare', ability: 'wall', shape: { positioning: 0.6, stamina: 0.6 }, traits: ['Fôlego'], bio: 'Corre o campo inteiro e cobre buracos que ninguém percebe.', hue: 240 },
  { id: 'pedro-almeirao', name: 'Pedro Almeirão', nationality: 'Serra Dourada', position: 'CM', secondary: ['DM'], rarity: 'rare', ability: 'maestro', shape: { passing: 0.8, vision: 0.8 }, traits: ['Ousado'], bio: 'Enxerga o espaço antes da bola chegar e entrega no pé certo.', hue: 65 },
  { id: 'nuno-fagundes', name: 'Nuno Fagundes', nationality: 'Montanha Alta', position: 'CM', secondary: ['W'], rarity: 'rare', ability: 'leader', shape: { control: 0.9, leadership: 0.4 }, traits: ['Capitão nato'], bio: 'Controle de bola impecável e voz firme no vestiário.', hue: 35 },
  { id: 'joaquim-sertao', name: 'Joaquim Sertão', nationality: 'Litoral Norte', position: 'W', secondary: ['ST'], rarity: 'rare', ability: 'counterBurst', shape: { pace: 0.9, acceleration: 0.6 }, traits: ['Ousado'], bio: 'Sai em disparada quando o time recupera a bola.', hue: 300 },
  { id: 'caetano-varela', name: 'Caetano Varela', nationality: 'Costa Azul', position: 'W', secondary: ['FB'], rarity: 'rare', ability: 'cross', shape: { dribbling: 0.9, passing: 0.4 }, traits: ['Ousado'], bio: 'Dribles curtos e um cruzamento que encontra sempre o alvo.', hue: 195 },
  { id: 'ronan-dantas', name: 'Ronan Dantas', nationality: 'Vale do Sol', position: 'ST', secondary: ['W'], rarity: 'rare', ability: 'longRange', shape: { finishing: 0.9, heading: 0.4 }, traits: ['Ousado'], bio: 'Chutou de fora para desempatar três partidas da temporada passada.', hue: 0 },

  // ---- Épicos ----
  { id: 'teodoro-azevedo', name: 'Teodoro Azevedo', nationality: 'Terra Verde', position: 'GK', secondary: [], rarity: 'epic', ability: 'ironHands', shape: { reflexes: 1, positioning: 0.6 }, traits: ['Frio sob pressão'], bio: 'Mãos de aço e nervos de ferro em decisões de pênalti.', hue: 200 },
  { id: 'rodrigo-pires', name: 'Rodrigo Pires', nationality: 'Serra Dourada', position: 'CB', secondary: ['FB'], rarity: 'epic', ability: 'wall', shape: { marking: 0.9, heading: 0.7 }, traits: ['Capitão nato'], bio: 'Líder da defesa, cabeceia tudo que chega na área.', hue: 45 },
  { id: 'vicente-loureiro', name: 'Vicente Loureiro', nationality: 'Ilhas Azuis', position: 'FB', secondary: ['W'], rarity: 'epic', ability: 'cross', shape: { pace: 0.9, stamina: 0.5 }, traits: ['Fôlego'], bio: 'Velocidade de atleta e cruzamentos que viram gols.', hue: 160 },
  { id: 'abel-quintana', name: 'Abel Quintana', nationality: 'Montanha Alta', position: 'DM', secondary: ['CM'], rarity: 'epic', ability: 'reader', shape: { tackling: 0.8, vision: 0.6 }, traits: ['Disciplinado'], bio: 'Interceptações cirúrgicas e uma compostura que irrita os adversários.', hue: 250 },
  { id: 'miguel-sarmento', name: 'Miguel Sarmento', nationality: 'Litoral Norte', position: 'CM', secondary: ['DM'], rarity: 'epic', ability: 'maestro', shape: { passing: 1, vision: 1 }, traits: ['Ousado'], bio: 'Cérebro do meio-campo, dita o ritmo de cada partida.', hue: 55 },
  { id: 'eduardo-vilar', name: 'Eduardo Vilar', nationality: 'Costa Azul', position: 'CM', secondary: ['W'], rarity: 'epic', ability: 'leader', shape: { control: 0.9, stamina: 0.7 }, traits: ['Coração de leão'], bio: 'Pulmões gigantes e um gol decisivo a cada duas temporadas.', hue: 310 },
  { id: 'icaro-monteiro', name: 'Ícaro Monteiro', nationality: 'Vale do Sol', position: 'W', secondary: ['ST'], rarity: 'epic', ability: 'counterBurst', shape: { pace: 1, dribbling: 0.8 }, traits: ['Ousado'], bio: 'Relâmpago no contra-ataque, impossível de alcançar em corrida.', hue: 275 },
  { id: 'heitor-lacerda', name: 'Heitor Lacerda', nationality: 'Montanha Alta', position: 'ST', secondary: ['W'], rarity: 'epic', ability: 'longRange', shape: { finishing: 1, precision: 0.6 }, traits: ['Ousado'], bio: 'Finaliza de primeira e nunca hesita diante do gol.', hue: 5 },

  // ---- Lendários ----
  { id: 'aurelio-rosado', name: 'Aurélio Rosado', nationality: 'Terra Verde', position: 'GK', secondary: [], rarity: 'legend', ability: 'ironHands', shape: { reflexes: 1, positioning: 0.8, distribution: 0.8 }, traits: ['Frio sob pressão'], bio: 'Lenda de muitas temporadas, quase impossível de bater.', hue: 215 },
  { id: 'gaspar-ventura', name: 'Gaspar Ventura', nationality: 'Serra Dourada', position: 'CB', secondary: ['DM'], rarity: 'legend', ability: 'wall', shape: { marking: 1, strength: 0.9 }, traits: ['Capitão nato'], bio: 'Muralha de tradição, comanda a defesa com voz e exemplo.', hue: 28 },
  { id: 'tomas-quevedo', name: 'Tomás Quevedo', nationality: 'Montanha Alta', position: 'DM', secondary: ['CM'], rarity: 'legend', ability: 'reader', shape: { tackling: 1, passing: 0.7 }, traits: ['Disciplinado'], bio: 'Lê o jogo antes da jogada começar e desarma no tempo certo.', hue: 235 },
  { id: 'ezequiel-rocha', name: 'Ezequiel Rocha', nationality: 'Litoral Norte', position: 'CM', secondary: ['DM'], rarity: 'legend', ability: 'maestro', shape: { vision: 1, passing: 1 }, traits: ['Ousado'], bio: 'Enxerga corredores invisíveis e transforma qualquer lançamento em ataque.', hue: 60 },
  { id: 'dario-fontenele', name: 'Dário Fontenele', nationality: 'Costa Azul', position: 'ST', secondary: ['W'], rarity: 'legend', ability: 'rebound', shape: { finishing: 1, heading: 0.6 }, traits: ['Coração de leão'], bio: 'Artilheiro que sobrevive a qualquer marcação e sempre encontra o caminho.', hue: 345 },

  // ---- Míticos ----
  { id: 'serafim-luz', name: 'Serafim Luz', nationality: 'Ilhas Azuis', position: 'W', secondary: ['ST'], rarity: 'mythic', ability: 'curler', shape: { dribbling: 1, pace: 1, curve: 1 }, traits: ['Ousado'], bio: 'Quando a bola toca seu pé, o estádio inteiro prende a respiração.', hue: 285 },
  { id: 'clovis-anhaia', name: 'Clóvis Anhaia', nationality: 'Montanha Alta', position: 'ST', secondary: ['W'], rarity: 'mythic', ability: 'longRange', shape: { finishing: 1, positioning: 0.9, precision: 0.9 }, traits: ['Frio sob pressão'], bio: 'Frieza absoluta: cada chute parece já ter sido decidido.', hue: 10 },
  { id: 'orestes-mirante', name: 'Orestes Mirante', nationality: 'Serra Dourada', position: 'GK', secondary: [], rarity: 'mythic', ability: 'ironHands', shape: { reflexes: 1, positioning: 0.9, leadership: 0.6 }, traits: ['Capitão nato'], bio: 'Guardião lendário que comanda a área do alto do próprio gol.', hue: 225 },
];

export function templateById(id: string): AthleteTemplate | undefined {
  return ATHLETE_TEMPLATES.find((t) => t.id === id);
}
