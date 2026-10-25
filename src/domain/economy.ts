/**
 * Economia e progressão: treino, melhorias do clube, equipamentos, fusão e
 * reciclagem, capacidade de inventário e receita idle. Funções puras que
 * retornam novos valores; o estado da aplicação é alterado apenas na store.
 */
import { CLUB_UPGRADES, ECONOMY, IDLE, LEVEL, TRAINING } from './balance';
import { trainingPointsAvailable } from './athletes';
import { TRAINING_FOCUS_IDS, type Athlete, type AttributeBonus, type AttributeKey, type ClubUpgradeId, type Item, type ItemSlot, type TrainingFocus } from './types';
import { clamp, type Rng } from './rng';
import { itemTemplate } from '../data/items';

export interface ClubUpgradeLevels {
  trainingCenter: number;
  youthAcademy: number;
  medical: number;
  stadium: number;
  storage: number;
}

export const INITIAL_UPGRADES: ClubUpgradeLevels = {
  trainingCenter: 1,
  youthAcademy: 0,
  medical: 0,
  stadium: 0,
  storage: 0,
};

/* ---------- Efeitos das melhorias (fonte única para lógica e textos) ---------- */

export const upgradeEffects = {
  trainingCenterCapBonus: (level: number) => level * LEVEL.capPerTrainingCenterLevel,
  trainingPointChance: (level: number) => level * 0.04,
  trainingCostDiscount: (level: number) => clamp(1 - level * 0.04, 0.6, 1),
  youthFragmentMultiplier: (level: number) => 1 + level * 0.1,
  youthFragmentsPerWin: (level: number) => level,
  medicalInjuryFactor: (level: number) => 1 - level * 0.08,
  medicalSeverityFactor: (level: number) => 1 - level * 0.1,
  stadiumIdleMultiplier: (level: number) => 1 + level * IDLE.coinsPerStadiumLevel,
  stadiumMatchCoinMultiplier: (level: number) => 1 + level * 0.05,
  storageCapacity: (level: number) => level * ECONOMY.inventoryPerStorageLevel,
} as const;

/** Nível do clube: a cada nível, o XP exigido cresce quadraticamente (60 × (nível − 1)²). */
export function clubLevelFor(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1);
}

/** XP mínimo para alcançar um nível de clube. */
export function clubXpFor(level: number): number {
  return 60 * Math.max(0, level - 1) ** 2;
}

/** Custo para subir de `currentLevel` para `currentLevel + 1`, e o nível de clube exigido. */
export function upgradeCost(id: ClubUpgradeId, currentLevel: number): { coins: number; requiredClubLevel: number } | null {
  const def = CLUB_UPGRADES[id];
  if (currentLevel >= def.maxLevel) return null;
  return {
    coins: Math.round(def.baseCost * def.costGrowth ** currentLevel),
    requiredClubLevel: currentLevel + 1,
  };
}

/** Texto do efeito atual de uma melhoria, para o nível informado. */
export function upgradeEffect(id: ClubUpgradeId, level: number): string {
  switch (id) {
    case 'trainingCenter':
      return `Teto de nível +${upgradeEffects.trainingCenterCapBonus(level)} · chance de ponto extra no treino ${Math.round(upgradeEffects.trainingPointChance(level) * 100)}% · custo -${Math.round((1 - upgradeEffects.trainingCostDiscount(level)) * 100)}%`;
    case 'youthAcademy':
      return `Fragmentos de baús +${Math.round((upgradeEffects.youthFragmentMultiplier(level) - 1) * 100)}% · +${upgradeEffects.youthFragmentsPerWin(level)} fragmento por vitória`;
    case 'medical':
      return `Chance de lesão -${Math.round((1 - upgradeEffects.medicalInjuryFactor(level)) * 100)}% · gravidade -${Math.round((1 - upgradeEffects.medicalSeverityFactor(level)) * 100)}%`;
    case 'stadium':
      return `Receita idle +${Math.round((upgradeEffects.stadiumIdleMultiplier(level) - 1) * 100)}% · moedas de partida +${Math.round((upgradeEffects.stadiumMatchCoinMultiplier(level) - 1) * 100)}%`;
    case 'storage':
      return `Capacidade do inventário +${upgradeEffects.storageCapacity(level)} itens`;
  }
}

export function upgradeBenefitNext(id: ClubUpgradeId, level: number): string {
  if (level >= CLUB_UPGRADES[id].maxLevel) return 'Nível máximo';
  return upgradeEffect(id, level + 1);
}

/** Retorno esperado do Estádio: horas de receita idle para recuperar o custo em moedas. */
export function stadiumPaybackHours(level: number, incomePerHour: number): number | null {
  const cost = upgradeCost('stadium', level);
  if (!cost) return null;
  const gainPerHour = incomePerHour * (upgradeEffects.stadiumIdleMultiplier(level + 1) - upgradeEffects.stadiumIdleMultiplier(level)) / upgradeEffects.stadiumIdleMultiplier(level);
  return gainPerHour <= 0 ? null : Math.ceil(cost.coins / gainPerHour);
}

export function inventoryCapacity(storageLevel: number): number {
  return ECONOMY.defaultInventory + upgradeEffects.storageCapacity(storageLevel);
}

export function inventoryWarning(count: number, capacity: number): string | null {
  if (count >= capacity) return 'Inventário cheio. Funda ou recicle itens antes de abrir mais baús.';
  if (count >= capacity * ECONOMY.inventoryWarnRatio) {
    return `Inventário quase cheio (${count}/${capacity}). Melhore o Almoxarifado ou recicle itens.`;
  }
  return null;
}

/* ---------- Treino ---------- */

export function trainingCost(level: number, trainingCenterLevel: number): number {
  const base = TRAINING.coinsBase * level ** TRAINING.coinsExponent;
  return Math.max(10, Math.round(base * upgradeEffects.trainingCostDiscount(trainingCenterLevel)));
}

export interface TrainResult {
  ok: boolean;
  reason?: string;
  athlete?: Athlete;
  points: Partial<Record<AttributeKey, number>>;
  coins: number;
}

export function focusAttributesOpen(athlete: Athlete, focus: TrainingFocus): AttributeKey[] {
  return TRAINING.focusAttributes[focus].filter((key) => (athlete.trainingBonus[key] ?? 0) < TRAINING.maxBonusPerAttribute);
}

/**
 * Treino: gasta moedas e uma ficha e distribui 1 a 3 pontos na família do foco escolhido.
 * Cada atributo recebe no máximo `maxBonusPerAttribute` pontos de treino.
 */
export function trainAthlete(
  athlete: Athlete,
  focus: TrainingFocus,
  rng: Rng,
  trainingCenterLevel: number,
  coinsAvailable: number,
  tokensAvailable: number,
): TrainResult {
  const coins = trainingCost(athlete.level, trainingCenterLevel);
  if (tokensAvailable < TRAINING.tokensPerSession) return { ok: false, reason: 'Você precisa de uma ficha de treino.', points: {}, coins };
  if (coinsAvailable < coins) return { ok: false, reason: `Faltam ${coins - coinsAvailable} moedas para este treino.`, points: {}, coins };
  if (trainingPointsAvailable(athlete.trainingBonus) === 0) {
    return { ok: false, reason: 'Este atleta já atingiu o limite de treino.', points: {}, coins };
  }
  const open = focusAttributesOpen(athlete, focus);
  if (open.length === 0) return { ok: false, reason: 'Este foco já está no limite. Escolha outro.', points: {}, coins };

  const bonus = { ...athlete.trainingBonus };
  const points: Partial<Record<AttributeKey, number>> = {};
  const extraPoint = rng.chance(upgradeEffects.trainingPointChance(trainingCenterLevel)) ? 1 : 0;
  const total = rng.int(TRAINING.pointsRange[0], TRAINING.pointsRange[1]) + extraPoint;
  for (let i = 0; i < total; i++) {
    const candidates = focusAttributesOpen({ ...athlete, trainingBonus: bonus }, focus);
    if (candidates.length === 0) break;
    const key = rng.pick(candidates);
    bonus[key] = (bonus[key] ?? 0) + 1;
    points[key] = (points[key] ?? 0) + 1;
  }
  return { ok: true, athlete: { ...athlete, trainingBonus: bonus }, points, coins };
}

export function focusLabel(focus: TrainingFocus): string {
  switch (focus) {
    case 'attack':
      return 'Ataque';
    case 'defense':
      return 'Defesa';
    case 'physical':
      return 'Físico';
    case 'technique':
      return 'Técnica';
    case 'keeper':
      return 'Goleiro';
    case 'leadership':
      return 'Liderança';
  }
}

export const FOCUS_OPTIONS: readonly TrainingFocus[] = TRAINING_FOCUS_IDS;

/* ---------- Itens ---------- */

/** Bônus de um item no nível atual: cresce 15% do bônus base por nível acima do primeiro. */
export function itemBonusAtLevel(item: Pick<Item, 'bonus' | 'level'>): AttributeBonus {
  const scale = 1 + (ECONOMY.itemBonusPerLevel / 10) * (item.level - 1);
  const out: AttributeBonus = {};
  for (const [key, value] of Object.entries(item.bonus) as Array<[AttributeKey, number]>) {
    out[key] = Math.round(value * scale);
  }
  return out;
}

export function itemName(item: Pick<Item, 'templateId'>): string {
  return itemTemplate(item.templateId)?.name ?? 'Item desconhecido';
}

export interface FuseResult {
  ok: boolean;
  reason?: string;
  item?: Item;
  consumedIds: string[];
}

/** Funde N itens idênticos (mesmo modelo e nível) em um de nível superior. */
export function fuseItems(items: Item[], ids: string[], now: number, suffix: string): FuseResult {
  if (ids.length !== ECONOMY.fusionCount || new Set(ids).size !== ids.length) {
    return { ok: false, reason: `Selecione ${ECONOMY.fusionCount} itens diferentes.`, consumedIds: [] };
  }
  const picked = ids.map((id) => items.find((i) => i.id === id));
  if (picked.some((i) => !i)) return { ok: false, reason: 'Algum item selecionado não existe mais.', consumedIds: [] };
  const list = picked as Item[];
  const first = list[0];
  if (!first) return { ok: false, reason: 'Nenhum item selecionado.', consumedIds: [] };
  if (!list.every((i) => i.templateId === first.templateId && i.level === first.level)) {
    return { ok: false, reason: 'Os itens precisam ser do mesmo modelo e nível.', consumedIds: [] };
  }
  if (first.level >= ECONOMY.maxItemLevel) return { ok: false, reason: 'Este item já está no nível máximo.', consumedIds: [] };
  const fused: Item = {
    ...first,
    id: `itm-${now.toString(36)}-f${suffix}`,
    level: first.level + 1,
    obtainedAt: now,
  };
  return { ok: true, item: fused, consumedIds: ids };
}

export function recycleValue(item: Pick<Item, 'rarity' | 'level'>): number {
  return Math.round(ECONOMY.recycleCoinsPerRarity[item.rarity] * (1 + 0.5 * (item.level - 1)));
}

export function slotLabel(slot: ItemSlot): string {
  switch (slot) {
    case 'boots':
      return 'Chuteiras';
    case 'gloves':
      return 'Luvas';
    case 'armband':
      return 'Braçadeira';
    case 'kit':
      return 'Kit de treino';
  }
}

export type EquipMap = Record<string, Partial<Record<ItemSlot, string>>>;

/** Equipar: um item por slot por atleta; cada item só pode estar equipado em um atleta. */
export function equipItem(equipped: EquipMap, athleteId: string, item: Item, items: Item[]): { equipped: EquipMap; swappedOutId: string | null; error?: string } {
  if (!items.some((i) => i.id === item.id)) return { equipped: equipped, swappedOutId: null, error: 'Item não encontrado no inventário.' };
  const next: EquipMap = {};
  for (const [aid, slots] of Object.entries(equipped)) {
    next[aid] = {};
    for (const [slot, id] of Object.entries(slots) as Array<[ItemSlot, string]>) {
      if (id !== item.id) next[aid]![slot] = id;
    }
  }
  const current = next[athleteId] ?? {};
  const swappedOutId = current[item.slot] ?? null;
  current[item.slot] = item.id;
  next[athleteId] = current;
  return { equipped: next, swappedOutId };
}

export function unequipItem(equipped: EquipMap, athleteId: string, slot: ItemSlot): EquipMap {
  const next: EquipMap = {};
  for (const [aid, slots] of Object.entries(equipped)) next[aid] = { ...slots };
  const entry = next[athleteId];
  if (entry) delete entry[slot];
  return next;
}

/* ---------- Idle ---------- */

export function idleCoinsPerHour(clubLevel: number, stadiumLevel: number): number {
  const base = IDLE.baseCoinsPerHour + IDLE.coinsPerClubLevel * (clubLevel - 1);
  return Math.round(base * upgradeEffects.stadiumIdleMultiplier(stadiumLevel));
}

export function idleCapHours(youthLevel: number): number {
  return Math.min(IDLE.maxCapHours, IDLE.baseCapHours + IDLE.capHoursPerYouthLevel * youthLevel);
}
