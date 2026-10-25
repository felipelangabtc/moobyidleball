import {
  Award,
  Crown,
  Dumbbell,
  Footprints,
  Hand,
  Package,
  Shield,
  Shirt,
  Sparkles,
  Star,
  Sun,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Item } from '../domain/types';
import { itemName } from '../domain/economy';
import { ITEM_TEMPLATES } from '../data/items';

const BY_NAME: Record<string, LucideIcon> = {
  'Chuteira de Campo': Footprints,
  'Chuteira Trovão': Zap,
  'Chuteira Cristal': Sparkles,
  'Chuteira Solar': Sun,
  'Chuteira Mítica do Farol': Star,
  'Luvas de Treino': Hand,
  'Luvas Pantera': Hand,
  'Luvas Abissais': Hand,
  'Luvas Titânicas': Crown,
  'Luvas do Último Muro': Shield,
  'Braçadeira Simples': Award,
  'Braçadeira do Capitão': Crown,
  'Braçadeira Dourada': Award,
  'Braçadeira Ancestral': Crown,
  'Braçadeira da Fundação': Award,
  'Colete de Treino': Shirt,
  'Kit de Preparação': Dumbbell,
  'Kit Alta Performance': Dumbbell,
  'Kit Fôlego Infinito': Wind,
  'Kit da Maratona Eterna': Wind,
};

const BY_SLOT: Record<string, LucideIcon> = {
  boots: Footprints,
  gloves: Hand,
  armband: Award,
  kit: Shirt,
};

export function itemIcon(item: Pick<Item, 'templateId'>): LucideIcon {
  const name = itemName(item);
  if (BY_NAME[name]) return BY_NAME[name];
  const template = ITEM_TEMPLATES.find((t) => t.id === item.templateId);
  if (template && BY_SLOT[template.slot]) return BY_SLOT[template.slot] as LucideIcon;
  return Package;
}

export { Package };
