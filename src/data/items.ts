/** Equipamentos originais. Bônus são planos e escalam com o nível do item (ver economy.ts). */
import type { AttributeBonus, ItemSlot, Rarity } from '../domain/types';

export interface ItemTemplate {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: Rarity;
  bonus: AttributeBonus;
  flavor: string;
}

export const ITEM_TEMPLATES: ItemTemplate[] = [
  { id: 'boots-field', name: 'Chuteira de Campo', slot: 'boots', rarity: 'common', bonus: { pace: 2, acceleration: 2 }, flavor: 'Leve, simples e pronta para qualquer gramado.' },
  { id: 'boots-thunder', name: 'Chuteira Trovão', slot: 'boots', rarity: 'rare', bonus: { acceleration: 4, pace: 3 }, flavor: 'Solado rígido para arrancadas explosivas.' },
  { id: 'boots-crystal', name: 'Chuteira Cristal', slot: 'boots', rarity: 'epic', bonus: { pace: 5, dribbling: 3, curve: 2 }, flavor: 'Cravas translúcidas que estalam quando a bola sai curvada.' },
  { id: 'boots-solar', name: 'Chuteira Solar', slot: 'boots', rarity: 'legend', bonus: { pace: 6, acceleration: 6, finishing: 3 }, flavor: 'Brilha no segundo tempo, dizem os torcedores.' },
  { id: 'boots-myth', name: 'Chuteira Mítica do Farol', slot: 'boots', rarity: 'mythic', bonus: { pace: 8, acceleration: 7, dribbling: 5, finishing: 4 }, flavor: 'Guiou gerações de atacantes pela neblina.' },

  { id: 'gloves-training', name: 'Luvas de Treino', slot: 'gloves', rarity: 'common', bonus: { reflexes: 2, distribution: 1 }, flavor: 'Aderência básica para o dia a dia.' },
  { id: 'gloves-panther', name: 'Luvas Pantera', slot: 'gloves', rarity: 'rare', bonus: { reflexes: 4, positioning: 2 }, flavor: 'Agarram até as bolas mais traiçoeiras.' },
  { id: 'gloves-abyss', name: 'Luvas Abissais', slot: 'gloves', rarity: 'epic', bonus: { reflexes: 6, positioning: 3, distribution: 2 }, flavor: 'Escuras como a noite, precisas como um relógio.' },
  { id: 'gloves-titan', name: 'Luvas Titânicas', slot: 'gloves', rarity: 'legend', bonus: { reflexes: 8, positioning: 5, distribution: 4 }, flavor: 'Forjadas com a lenda de um goleiro esquecido.' },
  { id: 'gloves-myth', name: 'Luvas do Último Muro', slot: 'gloves', rarity: 'mythic', bonus: { reflexes: 10, positioning: 6, distribution: 5, leadership: 3 }, flavor: 'Quem as veste nunca deixa a área sem resposta.' },

  { id: 'armband-simple', name: 'Braçadeira Simples', slot: 'armband', rarity: 'common', bonus: { leadership: 2 }, flavor: 'Faixa de tecido, mas com muita história.' },
  { id: 'armband-captain', name: 'Braçadeira do Capitão', slot: 'armband', rarity: 'rare', bonus: { leadership: 4, discipline: 2 }, flavor: 'Costurada à mão por torcedores de três cidades.' },
  { id: 'armband-gold', name: 'Braçadeira Dourada', slot: 'armband', rarity: 'epic', bonus: { leadership: 6, discipline: 3, versatility: 2 }, flavor: 'Transmite confiança para os companheiros.' },
  { id: 'armband-legend', name: 'Braçadeira Ancestral', slot: 'armband', rarity: 'legend', bonus: { leadership: 8, discipline: 4, versatility: 3 }, flavor: 'Símbolo de quem já levou a faixa a finais.' },
  { id: 'armband-myth', name: 'Braçadeira da Fundação', slot: 'armband', rarity: 'mythic', bonus: { leadership: 10, discipline: 6, versatility: 5 }, flavor: 'A primeira braçadeira que o clube já usou.' },

  { id: 'kit-vest', name: 'Colete de Treino', slot: 'kit', rarity: 'common', bonus: { stamina: 2, strength: 1 }, flavor: 'Colete leve para treinos de cadência.' },
  { id: 'kit-prep', name: 'Kit de Preparação', slot: 'kit', rarity: 'rare', bonus: { stamina: 4, strength: 2 }, flavor: 'Reúne suplemento, faixa e roupa térmica.' },
  { id: 'kit-high', name: 'Kit Alta Performance', slot: 'kit', rarity: 'epic', bonus: { stamina: 5, strength: 3, versatility: 2 }, flavor: 'Tecidos inteligentes que controlam o suor.' },
  { id: 'kit-endless', name: 'Kit Fôlego Infinito', slot: 'kit', rarity: 'legend', bonus: { stamina: 8, strength: 4, versatility: 3 }, flavor: 'Nunca cansa quem o veste, pelo menos na fantasia.' },
  { id: 'kit-myth', name: 'Kit da Maratona Eterna', slot: 'kit', rarity: 'mythic', bonus: { stamina: 10, strength: 6, versatility: 4, discipline: 2 }, flavor: 'Lendário desde a primeira temporada do clube.' },
];

export const ITEM_BY_ID = new Map(ITEM_TEMPLATES.map((item) => [item.id, item]));

export function itemTemplate(id: string): ItemTemplate | undefined {
  return ITEM_BY_ID.get(id);
}
