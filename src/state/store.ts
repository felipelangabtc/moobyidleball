/**
 * Store principal (Zustand). Cada a��o valida as regras, aplica a mudan�a por
 * meio das fun��es de dom�nio e registra o resultado. A interface n�o altera
 * o estado diretamente; ela chama estas a��es.
 */
import { create } from 'zustand';
import { ECONOMY, LEVEL, CHESTS, CLUB_UPGRADES, FRAGMENTS_FROM_DUPLICATE } from '../domain/balance';
import { addAthleteXp, athleteOvr, canStarUp, createAthlete, levelCap, starUpCost } from '../domain/athletes';
import { type Athlete, type ChestKind, type FormationId, type Item, type ItemSlot, type Rarity, type TacticId, type TrainingFocus } from '../domain/types';
import { openChest, rarityRank, type ChestRoll, type PityState } from '../domain/chests';
import {
  clubLevelFor,
  equipItem,
  fuseItems as fuseItemsDomain,
  idleCapHours,
  idleCoinsPerHour,
  inventoryCapacity,
  inventoryWarning,
  itemName,
  recycleValue,
  trainAthlete,
  unequipItem,
  upgradeCost,
  type ClubUpgradeLevels,
  type EquipMap,
} from '../domain/economy';
import { computeIdle, type IdleSummary } from '../domain/idle';
import { advanceMissions, missionById, missionDone, missionProgress, newlyUnlockedAchievements, rolloverMissions } from '../domain/progress';
import { isUnlocked } from '../domain/campaign';
import { autoLineup, athleteDisplayName, validateLineup, type SquadContext } from '../domain/squad';
import { createRng, hashString } from '../domain/rng';
import { ATHLETE_TEMPLATES, templateById } from '../data/athletes';
import { ITEM_TEMPLATES } from '../data/items';
import { ACHIEVEMENTS, type CounterKey } from '../data/goals';
import { RARITY_NAME_PT } from '../domain/labels';
import { settingsSchema, createInitialState, type GameState, type Settings } from './schema';
import { loadFromStorage, saveToStorage, exportSave, importSave, SAVE_KEY } from './persistence';
import { planMatch, playMatch, lineupProblems, squadContext, type MatchMode, type MatchPlan, type ResolvedMatch } from './matchFlow';

export type Tone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface ChestRollView extends ChestRoll {
  name: string;
}

export interface ChestOpenSummary {
  kind: ChestKind;
  count: number;
  rolls: ChestRollView[];
  coins: number;
  gems: number;
  fragments: number;
  pityBefore: PityState;
  pityAfter: PityState;
  warnings: string[];
}

export interface ActiveMatch {
  plan: MatchPlan;
  resolved: ResolvedMatch;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface GameStore {
  game: GameState;
  ready: boolean;
  saveStatus: SaveStatus;
  savedAt: number | null;
  saveError: string | null;
  loadMessage: string | null;
  toasts: Toast[];
  activeMatch: ActiveMatch | null;

  initialize: (now?: number) => void;
  persist: (now?: number) => void;
  toast: (message: string, tone?: Tone) => void;
  dismissToast: (id: number) => void;
  dismissLoadMessage: () => void;
  setSaveStatus: (status: SaveStatus, savedAt?: number | null, error?: string | null) => void;

  renameClub: (name: string) => ActionResult;
  updateSettings: (patch: Partial<Settings>) => ActionResult;
  setTutorial: (topic: string, status: 'seen' | 'dismissed' | null) => void;
  refreshPeriods: (now?: number) => void;

  setFormation: (formation: FormationId) => ActionResult;
  setTactic: (tactic: TacticId) => ActionResult;
  setLineupSlot: (index: number, athleteId: string | null) => ActionResult;
  setCaptain: (athleteId: string | null) => ActionResult;
  autoLineup: () => ActionResult;

  buyChest: (kind: ChestKind, count: number) => ActionResult<ChestOpenSummary>;
  openStockChest: (kind: ChestKind, count: number) => ActionResult<ChestOpenSummary>;

  trainAthlete: (athleteId: string, focus: TrainingFocus) => ActionResult<{ coins: number; points: Partial<Record<string, number>> }>;
  upgradeClub: (id: keyof ClubUpgradeLevels) => ActionResult;
  equip: (athleteId: string, itemId: string) => ActionResult;
  unequip: (athleteId: string, slot: ItemSlot) => ActionResult;
  fuseItems: (itemIds: string[]) => ActionResult<Item>;
  recycleItem: (itemId: string) => ActionResult<number>;
  evolveAthlete: (athleteId: string) => ActionResult<number>;
  releaseAthlete: (athleteId: string) => ActionResult<number>;

  listAthlete: (athleteId: string, price: number) => ActionResult<string>;
  listItem: (itemId: string, price: number) => ActionResult<string>;
  cancelListing: (listingId: string) => ActionResult;
  collectMarketEarnings: () => ActionResult<number>;
  buyMarketOffering: (offering: { id: string; kind: 'athlete' | 'item'; name: string; position?: string; slot?: string; rarity: 'common' | 'rare' | 'epic' | 'legend' | 'mythic'; hue: number; price: number }) => ActionResult;

  startMatch: (mode: MatchMode) => ActionResult<ResolvedMatch>;
  closeMatchView: () => void;
  setActivePhase: (phase: number) => ActionResult;
  startChallenge: () => ActionResult;
  stopChallenge: () => ActionResult;

  claimMission: (id: string) => ActionResult<{ coins: number }>;
  collectIdle: (now?: number) => ActionResult<IdleSummary>;
  idleSummary: (now?: number) => IdleSummary;

  exportSaveText: () => string;
  importSaveText: (text: string) => ActionResult;
  resetGame: () => void;
}

let toastSeq = 1;

/* ---------- helpers puros ---------- */

function ctxOf(game: GameState): SquadContext {
  return squadContext(game);
}

function templateRarity(templateId: string): Rarity {
  return templateById(templateId)?.rarity ?? 'common';
}

/** Remove refer�ncias �rf�s (atletas, itens e escala��o) ap�s qualquer mudan�a. */
export function pruneReferences(game: GameState): GameState {
  const athleteIds = new Set(game.athletes.map((a) => a.id));
  const itemIds = new Set(game.items.map((i) => i.id));
  const equipped: EquipMap = {};
  for (const [aid, slots] of Object.entries(game.equipped)) {
    if (!athleteIds.has(aid)) continue;
    const clean: Partial<Record<ItemSlot, string>> = {};
    for (const [slot, id] of Object.entries(slots) as Array<[ItemSlot, string]>) {
      if (itemIds.has(id)) clean[slot] = id;
    }
    equipped[aid] = clean;
  }
  const slots = game.lineup.slots.map((id) => (id && athleteIds.has(id) ? id : null));
  const captainId = game.lineup.captainId && slots.includes(game.lineup.captainId) ? game.lineup.captainId : null;
  return { ...game, equipped, lineup: { ...game.lineup, slots, captainId } };
}

/** Mant�m a escala��o v�lida quando a op��o "escala��o autom�tica" est� ligada. */
function maintainLineup(game: GameState): GameState {
  if (!game.settings.autoLineup) return game;
  if (lineupProblems(game).length === 0) return game;
  return { ...game, lineup: autoLineup(game.lineup.formation, ctxOf(game), game.lineup.tactic) };
}

/** Aplica conquistas pendentes (ao final de cada a��o que altera contadores). */
function applyAchievements(game: GameState, now: number): { game: GameState; unlocked: string[] } {
  const unlocked = newlyUnlockedAchievements(game.counters, game.records, game.achievements);
  if (unlocked.length === 0) return { game, unlocked: [] };
  let achievements = { ...game.achievements };
  let coins = 0;
  for (const def of unlocked) {
    achievements = { ...achievements, [def.id]: now };
    coins += def.reward;
  }
  return {
    game: {
      ...game,
      achievements,
      resources: { ...game.resources, coins: game.resources.coins + coins },
      counters: { ...game.counters, coinsEarned: game.counters.coinsEarned + coins },
    },
    unlocked: unlocked.map((a) => a.title),
  };
}

function bump(game: GameState, counter: CounterKey, amount = 1): GameState {
  return {
    ...game,
    counters: { ...game.counters, [counter]: (game.counters[counter] ?? 0) + amount },
    missions: advanceMissions(game.missions, counter, amount),
  };
}

/** Elenco inicial: doze atletas comuns, equipamentos b�sicos e escala��o autom�tica. */
export function starterGame(game: GameState, now: number): GameState {
  const starterTemplates = ['nico-ferrolho', 'ivo-marabo', 'bento-lira', 'rafa-lusco', 'duda-ferrante', 'caio-mendes', 'teo-varginha', 'lucca-brandao', 'gael-sormani', 'yuri-tavares', 'iago-pacheco', 'enzo-quintela'];
  const rng = createRng(hashString(`starter:${now}`));
  const athletes: Athlete[] = starterTemplates.map((templateId, index) => createAthlete(templateId, rng.fork(templateId), now + index));
  const items: Item[] = [
    { id: 'itm-start-1', templateId: 'boots-field', slot: 'boots', rarity: 'common', level: 1, bonus: { pace: 2, acceleration: 2 }, obtainedAt: now },
    { id: 'itm-start-2', templateId: 'armband-simple', slot: 'armband', rarity: 'common', level: 1, bonus: { leadership: 2 }, obtainedAt: now },
    { id: 'itm-start-3', templateId: 'kit-vest', slot: 'kit', rarity: 'common', level: 1, bonus: { stamina: 2, strength: 1 }, obtainedAt: now },
  ];
  const next: GameState = {
    ...game,
    athletes,
    items,
    nextId: game.nextId + athletes.length + items.length,
    encyclopedia: {
      ...game.encyclopedia,
      athletes: [...new Set(starterTemplates)],
      items: [...new Set(items.map((i) => i.templateId))],
    },
  };
  const lineup = autoLineup(next.lineup.formation, ctxOf(next), next.lineup.tactic);
  return { ...next, lineup };
}

function athleteNameOf(game: GameState, id: string): string {
  const a = game.athletes.find((x) => x.id === id);
  return a ? athleteDisplayName(a) : 'Atleta';
}

/** Valores de atributo para dar sensa��o de progress�o vis�vel no primeiro uso (OVR m�dio). */
export function squadOvr(game: GameState): number {
  const ids = game.lineup.slots.filter((s): s is string => Boolean(s));
  if (ids.length === 0) return 0;
  const sum = ids.reduce((acc, id) => {
    const a = game.athletes.find((x) => x.id === id);
    if (!a) return acc;
    const t = templateById(a.templateId);
    if (!t) return acc;
    const items = game.items.filter((i) => Object.values(game.equipped[a.id] ?? {}).includes(i.id));
    return acc + athleteOvr(a, t, items);
  }, 0);
  return Math.round((sum / ids.length) * 10) / 10;
}

/* ---------- store ---------- */

export const useGame = create<GameStore>()((set, get) => {
  const write = (game: GameState) => set({ game });

  return {
    game: createInitialState(Date.now()),
    ready: false,
    saveStatus: 'idle',
    savedAt: null,
    saveError: null,
    loadMessage: null,
    toasts: [],
    activeMatch: null,

    initialize(now = Date.now()) {
      const loaded = loadFromStorage(now);
      let game = pruneReferences(loaded.state);
      if (game.athletes.length === 0 && game.counters.matches === 0 && game.nextId === 1) {
        game = starterGame(game, now);
      }
      if (now < game.lastSeenAt) {
        game = { ...game, idle: { ...game.idle, lastCollectedAt: Math.min(game.idle.lastCollectedAt, now) } };
      }
      game = { ...game, lastSeenAt: now, missions: rolloverMissions(game.missions, new Date(now)) };
      set({ game, ready: true, loadMessage: loaded.message });
    },

    persist(now = Date.now()) {
      set({ saveStatus: 'saving' });
      const result = saveToStorage(get().game, now);
      set({
        saveStatus: result.ok ? 'saved' : 'error',
        savedAt: result.ok ? now : get().savedAt,
        saveError: result.ok ? null : (result.error ?? 'Erro ao salvar.'),
      });
    },

    setSaveStatus(status, savedAt = null, error = null) {
      set({ saveStatus: status, savedAt: savedAt ?? get().savedAt, saveError: error });
    },

    toast(message, tone = 'info') {
      const id = toastSeq++;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, message }] }));
      setTimeout(() => get().dismissToast(id), 4200);
    },

    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },

    dismissLoadMessage() {
      set({ loadMessage: null });
    },

    renameClub(name) {
      const clean = name.replace(/[<>]/g, '').trim().slice(0, 40);
      if (clean.length < 3) return { ok: false, error: 'O nome precisa ter pelo menos 3 caracteres.' };
      write({ ...get().game, clubName: clean });
      return { ok: true };
    },

    updateSettings(patch) {
      const parsed = settingsSchema.safeParse({ ...get().game.settings, ...patch });
      if (!parsed.success) return { ok: false, error: 'Configura��o inv�lida.' };
      write({ ...get().game, settings: parsed.data });
      return { ok: true };
    },

    setTutorial(topic, status) {
      const tutorials = { ...get().game.tutorials };
      if (status === null) delete tutorials[topic];
      else tutorials[topic] = status;
      write({ ...get().game, tutorials });
    },

    refreshPeriods(now = Date.now()) {
      const game = get().game;
      const missions = rolloverMissions(game.missions, new Date(now));
      if (missions !== game.missions) write({ ...game, missions });
    },

    setFormation(formation) {
      const game = get().game;
      const next = { ...game, lineup: { ...game.lineup, formation } };
      write({ ...next, lineup: autoLineup(formation, ctxOf(next), game.lineup.tactic) });
      return { ok: true };
    },

    setTactic(tactic) {
      const game = get().game;
      write({ ...game, lineup: { ...game.lineup, tactic } });
      return { ok: true };
    },

    setLineupSlot(index, athleteId) {
      const game = get().game;
      if (index < 0 || index >= game.lineup.slots.length) return { ok: false, error: 'Posi��o inv�lida.' };
      if (athleteId && !game.athletes.some((a) => a.id === athleteId)) return { ok: false, error: 'Atleta n�o encontrado.' };
      const slots = [...game.lineup.slots];
      const previous = athleteId ? slots.indexOf(athleteId) : -1;
      const displaced = slots[index] ?? null;
      if (previous !== -1 && previous !== index) slots[previous] = displaced;
      slots[index] = athleteId;
      const captainId = game.lineup.captainId && slots.includes(game.lineup.captainId) ? game.lineup.captainId : null;
      write({ ...game, lineup: { ...game.lineup, slots, captainId } });
      return { ok: true };
    },

    setCaptain(athleteId) {
      const game = get().game;
      if (athleteId && !game.lineup.slots.includes(athleteId)) return { ok: false, error: 'O capit�o precisa estar na escala��o.' };
      write({ ...game, lineup: { ...game.lineup, captainId: athleteId } });
      return { ok: true };
    },

    autoLineup() {
      const game = get().game;
      write({ ...game, lineup: autoLineup(game.lineup.formation, ctxOf(game), game.lineup.tactic) });
      return { ok: true };
    },

    buyChest(kind, count) {
      return openChests(get, kind, count, 'shop');
    },

    openStockChest(kind, count) {
      return openChests(get, kind, count, 'stock');
    },

    trainAthlete(athleteId, focus) {
      const game = get().game;
      const athlete = game.athletes.find((a) => a.id === athleteId);
      if (!athlete) return { ok: false, error: 'Atleta n�o encontrado.' };
      if (focus === 'keeper' && templateById(athlete.templateId)?.position !== 'GK') {
        return { ok: false, error: 'O foco Goleiro s� serve para goleiros.' };
      }
      const rng = createRng(hashString(`train:${athleteId}:${game.nextId}`));
      const result = trainAthlete(athlete, focus, rng, game.upgrades.trainingCenter, game.resources.coins, game.resources.tokens);
      if (!result.ok || !result.athlete) return { ok: false, error: result.reason };

      const leveled = addAthleteXp(result.athlete, LEVEL.trainingXp, levelCap(athlete.stars, game.upgrades.trainingCenter));
      let next: GameState = {
        ...game,
        resources: { ...game.resources, coins: game.resources.coins - result.coins, tokens: game.resources.tokens - 1 },
        athletes: game.athletes.map((a) => (a.id === athleteId ? leveled.athlete : a)),
        records: { ...game.records, maxLevel: Math.max(game.records.maxLevel, leveled.athlete.level) },
      };
      next = bump(next, 'trainings', 1);
      const achieved = applyAchievements(next, Date.now());
      write(achieved.game);
      if (achieved.unlocked.length) get().toast(`Conquista: ${achieved.unlocked.join(', ')}`, 'success');
      return { ok: true, data: { coins: result.coins, points: result.points } };
    },

    upgradeClub(id) {
      const game = get().game;
      const current = game.upgrades[id];
      const def = CLUB_UPGRADES[id];
      const cost = upgradeCost(id, current);
      if (!cost) return { ok: false, error: `${def.name} j� est� no n�vel m�ximo.` };
      if (clubLevelFor(game.resources.clubXp) < cost.requiredClubLevel) {
        return { ok: false, error: `Requer n�vel ${cost.requiredClubLevel} do clube.` };
      }
      if (game.resources.coins < cost.coins) return { ok: false, error: `Faltam ${cost.coins - game.resources.coins} moedas.` };
      let next: GameState = {
        ...game,
        resources: { ...game.resources, coins: game.resources.coins - cost.coins },
        upgrades: { ...game.upgrades, [id]: current + 1 },
      };
      next = bump(next, 'upgrades', 1);
      const achieved = applyAchievements(next, Date.now());
      write(achieved.game);
      get().toast(`${def.name} agora est� no n�vel ${current + 1}.`, 'success');
      return { ok: true };
    },

    equip(athleteId, itemId) {
      const game = get().game;
      const athlete = game.athletes.find((a) => a.id === athleteId);
      const item = game.items.find((i) => i.id === itemId);
      if (!athlete) return { ok: false, error: 'Atleta n�o encontrado.' };
      if (!item) return { ok: false, error: 'Item n�o encontrado.' };
      if (item.slot === 'gloves' && templateById(athlete.templateId)?.position !== 'GK') {
        return { ok: false, error: 'Luvas s� podem ser equipadas por goleiros.' };
      }
      const res = equipItem(game.equipped, athleteId, item, game.items);
      if (res.error) return { ok: false, error: res.error };
      write({ ...game, equipped: res.equipped });
      return { ok: true };
    },

    unequip(athleteId, slot) {
      const game = get().game;
      write({ ...game, equipped: unequipItem(game.equipped, athleteId, slot) });
      return { ok: true };
    },

    fuseItems(itemIds) {
      const game = get().game;
      const fused = fuseItemsDomain(game.items, itemIds, Date.now(), String(game.nextId));
      if (!fused.ok || !fused.item) return { ok: false, error: fused.reason };
      const remaining = game.items.filter((i) => !fused.consumedIds.includes(i.id));
      let next: GameState = pruneReferences({ ...game, items: [...remaining, fused.item], nextId: game.nextId + 1 });
      next = bump(next, 'fusions', 1);
      const achieved = applyAchievements(next, Date.now());
      write(achieved.game);
      get().toast(`${itemName(fused.item)} agora est� no n�vel ${fused.item.level}.`, 'success');
      return { ok: true, data: fused.item };
    },

    recycleItem(itemId) {
      const game = get().game;
      const item = game.items.find((i) => i.id === itemId);
      if (!item) return { ok: false, error: 'Item n�o encontrado.' };
      const value = recycleValue(item);
      write(pruneReferences({
        ...game,
        items: game.items.filter((i) => i.id !== itemId),
        resources: { ...game.resources, coins: game.resources.coins + value },
      }));
      return { ok: true, data: value };
    },

    evolveAthlete(athleteId) {
      const game = get().game;
      const athlete = game.athletes.find((a) => a.id === athleteId);
      if (!athlete) return { ok: false, error: 'Atleta n�o encontrado.' };
      const cost = starUpCost(athlete.stars);
      if (cost === null) return { ok: false, error: 'Este atleta j� tem 5 estrelas.' };
      if (!canStarUp(athlete, game.upgrades.trainingCenter)) {
        return { ok: false, error: `Leve o atleta ao n�vel m�ximo atual (${levelCap(athlete.stars, game.upgrades.trainingCenter)}) para evoluir.` };
      }
      if (game.resources.fragments < cost) return { ok: false, error: `Faltam ${cost - game.resources.fragments} fragmentos.` };
      const stars = athlete.stars + 1;
      let next: GameState = {
        ...game,
        athletes: game.athletes.map((a) => (a.id === athleteId ? { ...a, stars } : a)),
        resources: { ...game.resources, fragments: game.resources.fragments - cost },
        records: { ...game.records, maxStars: Math.max(game.records.maxStars, stars) },
      };
      const achieved = applyAchievements(next, Date.now());
      write(achieved.game);
      return { ok: true, data: stars };
    },

    releaseAthlete(athleteId) {
      const game = get().game;
      const athlete = game.athletes.find((a) => a.id === athleteId);
      if (!athlete) return { ok: false, error: 'Atleta n�o encontrado.' };
      if (game.lineup.slots.includes(athleteId)) return { ok: false, error: 'Tire o atleta da escala��o antes de dispens�-lo.' };
      const fragments = FRAGMENTS_FROM_DUPLICATE[templateRarity(athlete.templateId)];
      write(pruneReferences({
        ...game,
        athletes: game.athletes.filter((a) => a.id !== athleteId),
        resources: { ...game.resources, fragments: game.resources.fragments + fragments },
      }));
      return { ok: true, data: fragments };
    },

    listAthlete(athleteId, price) {
      const game = get().game;
      const athlete = game.athletes.find((a) => a.id === athleteId);
      if (!athlete) return { ok: false, error: 'Atleta n�o encontrado.' };
      if (game.lineup.slots.includes(athleteId)) return { ok: false, error: 'Tire o atleta da escala��o antes de anunciar.' };
      if (!Number.isFinite(price) || price < 1) return { ok: false, error: 'Pre�o inv�lido.' };
      const listing = { id: `mk-${game.nextId}`, kind: 'athlete' as const, refId: athleteId, price: Math.round(price), listedAt: Date.now(), soldAt: null, buyer: null };
      write({
        ...game,
        athletes: game.athletes.filter((a) => a.id !== athleteId),
        marketplace: { ...game.marketplace, listings: [listing, ...game.marketplace.listings] },
        nextId: game.nextId + 1,
      });
      const rng = createRng(hashString(`market-sale:${game.nextId}`));
      if (rng.chance(0.3 + clubLevelFor(game.resources.clubXp) * 0.05)) {
        const g = get().game;
        const idx = g.marketplace.listings.findIndex((l) => l.id === listing.id);
        if (idx >= 0) {
          const updated = [...g.marketplace.listings];
          const cur = updated[idx];
          if (cur) updated[idx] = { ...cur, soldAt: Date.now(), buyer: 'Comprador simulado' };
          write({ ...g, marketplace: { listings: updated, earnings: g.marketplace.earnings + listing.price } });
        }
      }
      return { ok: true, data: listing.id };
    },

    listItem(itemId, price) {
      const game = get().game;
      const item = game.items.find((i) => i.id === itemId);
      if (!item) return { ok: false, error: 'Item n�o encontrado.' };
      if (Object.values(game.equipped).some((s) => Object.values(s).includes(itemId))) {
        return { ok: false, error: 'Desequipe o item antes de anunciar.' };
      }
      if (!Number.isFinite(price) || price < 1) return { ok: false, error: 'Pre�o inv�lido.' };
      const listing = { id: `mk-${game.nextId}`, kind: 'item' as const, refId: itemId, price: Math.round(price), listedAt: Date.now(), soldAt: null, buyer: null };
      write({
        ...game,
        items: game.items.filter((i) => i.id !== itemId),
        marketplace: { ...game.marketplace, listings: [listing, ...game.marketplace.listings] },
        nextId: game.nextId + 1,
      });
      const rng = createRng(hashString(`market-sale:${game.nextId}`));
      if (rng.chance(0.4 + clubLevelFor(game.resources.clubXp) * 0.04)) {
        const g = get().game;
        const idx = g.marketplace.listings.findIndex((l) => l.id === listing.id);
        if (idx >= 0) {
          const updated = [...g.marketplace.listings];
          const cur = updated[idx];
          if (cur) updated[idx] = { ...cur, soldAt: Date.now(), buyer: 'Comprador simulado' };
          write({ ...g, marketplace: { listings: updated, earnings: g.marketplace.earnings + listing.price } });
        }
      }
      return { ok: true, data: listing.id };
    },

    cancelListing(listingId) {
      const game = get().game;
      const listing = game.marketplace.listings.find((l) => l.id === listingId);
      if (!listing) return { ok: false, error: 'An�ncio n�o encontrado.' };
      if (listing.soldAt) return { ok: false, error: 'Este an�ncio j� foi vendido.' };
      const remaining = game.marketplace.listings.filter((l) => l.id !== listingId);
      write({ ...game, marketplace: { ...game.marketplace, listings: remaining } });
      return { ok: true };
    },

    collectMarketEarnings() {
      const game = get().game;
      const amount = game.marketplace.earnings;
      if (amount <= 0) return { ok: false, error: 'Nenhum ganho para coletar.' };
      write({
        ...game,
        resources: { ...game.resources, coins: game.resources.coins + amount },
        marketplace: { ...game.marketplace, earnings: 0 },
      });
      return { ok: true, data: amount };
    },

    buyMarketOffering(offering) {
      const game = get().game;
      if (game.resources.coins < offering.price) return { ok: false, error: 'Moedas insuficientes.' };
      let next: GameState = { ...game, resources: { ...game.resources, coins: game.resources.coins - offering.price } };
      if (offering.kind === 'athlete') {
        const template = ATHLETE_TEMPLATES.find((t) => t.name === offering.name);
        if (template) {
          const rng = createRng(hashString(`buy:${game.nextId}`));
          const athlete = createAthlete(template.id, rng, Date.now());
          next = { ...next, athletes: [...next.athletes, athlete], nextId: next.nextId + 1 };
        }
      } else {
        const template = ITEM_TEMPLATES.find((t) => t.name === offering.name);
        if (template) {
          const item: Item = {
            id: `itm-${Date.now().toString(36)}-${game.nextId}`,
            templateId: template.id,
            slot: template.slot,
            rarity: template.rarity,
            level: 1,
            bonus: { ...template.bonus },
            obtainedAt: Date.now(),
          };
          next = { ...next, items: [...next.items, item], nextId: next.nextId + 1 };
        }
      }
      write(next);
      return { ok: true };
    },

    startMatch(mode) {
      const game = get().game;
      if (mode.kind === 'campaign' && !isUnlocked(game.campaign, mode.phase)) {
        return { ok: false, error: 'Esta fase ainda n�o est� desbloqueada.' };
      }
      if (mode.kind === 'challenge' && !game.challenge.active) {
        return { ok: false, error: 'Inicie o torneio antes de jogar uma onda.' };
      }
      const problems = lineupProblems(game);
      if (problems.length > 0) return { ok: false, error: problems[0] };

      const plan = planMatch(game, mode);
      const now = Date.now();
      const resolved = playMatch(game, plan, now);
      write(maintainLineup(resolved.state));
      const achieved = applyAchievements(get().game, now);
      if (achieved.unlocked.length > 0) write(achieved.game);
      set({ activeMatch: { plan, resolved } });
      return { ok: true, data: resolved };
    },

    closeMatchView() {
      set({ activeMatch: null });
    },

    setActivePhase(phase) {
      const game = get().game;
      if (!isUnlocked(game.campaign, phase)) return { ok: false, error: 'Fase bloqueada.' };
      write({ ...game, campaign: { ...game.campaign, activePhase: phase } });
      return { ok: true };
    },

    startChallenge() {
      const game = get().game;
      write({ ...game, challenge: { ...game.challenge, wave: 0, active: true, milestones: [] } });
      return { ok: true };
    },

    stopChallenge() {
      const game = get().game;
      write({ ...game, challenge: { ...game.challenge, active: false, wave: 0 } });
      return { ok: true };
    },

    claimMission(id) {
      const game = get().game;
      const def = missionById(id);
      if (!def) return { ok: false, error: 'Miss�o inv�lida.' };
      if (game.missions.claimed[id]) return { ok: false, error: 'Recompensa j� coletada.' };
      if (!missionDone(game.missions, id)) return { ok: false, error: 'Miss�o ainda n�o conclu�da.' };
      const r = def.reward;
      let next: GameState = {
        ...game,
        resources: {
          coins: game.resources.coins + r.coins,
          gems: game.resources.gems + (r.gems ?? 0),
          clubXp: game.resources.clubXp + (r.clubXp ?? 0),
          tokens: game.resources.tokens + (r.tokens ?? 0),
          fragments: game.resources.fragments + (r.fragments ?? 0),
        },
        missions: { ...game.missions, claimed: { ...game.missions.claimed, [id]: true } },
        counters: { ...game.counters, coinsEarned: game.counters.coinsEarned + r.coins },
      };
      next = bump(next, 'missionsDone', 1);
      const achieved = applyAchievements(next, Date.now());
      write(achieved.game);
      get().toast(`Miss�o conclu�da: ${def.title}`, 'success');
      return { ok: true, data: { coins: r.coins } };
    },

    idleSummary(now = Date.now()) {
      const game = get().game;
      return computeIdle({
        lastCollectedAt: game.idle.lastCollectedAt,
        now,
        clubLevel: clubLevelFor(game.resources.clubXp),
        stadiumLevel: game.upgrades.stadium,
        youthLevel: game.upgrades.youthAcademy,
      });
    },

    collectIdle(now = Date.now()) {
      const summary = get().idleSummary(now);
      const game = get().game;
      if (summary.coins === 0 && summary.clubXp === 0 && summary.tokens === 0) {
        const error = summary.reason === 'clock-rewind'
          ? 'O rel�gio do dispositivo foi alterado. A receita foi reiniciada a partir de agora.'
          : 'Ainda n�o h� receita para coletar.';
        if (summary.reason === 'clock-rewind') {
          write({ ...game, idle: { ...game.idle, lastCollectedAt: now } });
        }
        return { ok: false, error, data: summary };
      }
      let next: GameState = {
        ...game,
        resources: {
          ...game.resources,
          coins: game.resources.coins + summary.coins,
          clubXp: game.resources.clubXp + summary.clubXp,
          tokens: game.resources.tokens + summary.tokens,
        },
        idle: { lastCollectedAt: now, totalCollected: game.idle.totalCollected + summary.coins },
        counters: { ...game.counters, coinsEarned: game.counters.coinsEarned + summary.coins },
        lastSeenAt: now,
      };
      next = bump(next, 'idleClaims', 1);
      const achieved = applyAchievements(next, now);
      write(achieved.game);
      return { ok: true, data: summary };
    },

    exportSaveText() {
      return exportSave(get().game, Date.now());
    },

    importSaveText(text) {
      const res = importSave(text, Date.now());
      if (!res.ok) return { ok: false, error: res.error };
      set({ game: pruneReferences(res.state), loadMessage: res.message, activeMatch: null });
      return { ok: true };
    },

    resetGame() {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {
        // Sem acesso ao armazenamento: a mem�ria ainda � reiniciada.
      }
      set({ game: starterGame(createInitialState(Date.now()), Date.now()), activeMatch: null, loadMessage: null });
    },
  };
});

function openChests(get: () => GameStore, kind: ChestKind, count: number, source: 'shop' | 'stock'): ActionResult<ChestOpenSummary> {
  const game = get().game;
  if (!Number.isInteger(count) || count < 1 || count > 10) return { ok: false, error: 'Escolha de 1 a 10 ba�s.' };
  if (count > 1 && clubLevelFor(game.resources.clubXp) < 3) {
    return { ok: false, error: 'Aberturas em lote s�o liberadas no n�vel 3 do clube.' };
  }
  const price = CHESTS[kind].price * count;
  if (source === 'shop' && game.resources.coins < price) return { ok: false, error: `Faltam ${price - game.resources.coins} moedas.` };
  if (source === 'stock' && game.chestStock[kind] < count) return { ok: false, error: 'Voc� n�o tem ba�s deste tipo guardados.' };

  const now = Date.now();
  let pity = { ...game.pity };
  const pityBefore = { ...game.pity };
  const owned = new Set(game.athletes.map((a) => a.templateId));
  const ctx = { ownedTemplates: owned, nextId: game.nextId, now, rng: createRng(hashString(`chest:${game.nextId}:${now}`)) };
  let coins = 0;
  let gems = 0;
  let fragments = 0;
  const newAthletes: Athlete[] = [];
  const newItems: Item[] = [];
  const rolls: ChestRollView[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < count; i++) {
    const result = openChest(kind, pity, ctx);
    pity = result.pity;
    coins += result.coins;
    gems += result.gems;
    fragments += result.fragments;
    for (const roll of result.rolls) {
      const name = roll.kind === 'athlete'
        ? (templateById(roll.templateId)?.name ?? 'Atleta')
        : (ITEM_TEMPLATES.find((t) => t.id === roll.templateId)?.name ?? 'Item');
      if (roll.kind === 'item' && roll.item) {
        newItems.push(roll.item);
        rolls.push({ ...roll, name });
        continue;
      }
      if (roll.kind === 'athlete' && roll.athlete && game.athletes.length + newAthletes.length >= ECONOMY.rosterCap) {
        fragments += FRAGMENTS_FROM_DUPLICATE[roll.rarity];
        warnings.push('Elenco cheio: atleta convertido em fragmentos.');
        rolls.push({ ...roll, athlete: undefined, duplicate: true, duplicateFragments: FRAGMENTS_FROM_DUPLICATE[roll.rarity], name });
        continue;
      }
      if (roll.kind === 'athlete' && roll.athlete) {
        newAthletes.push(roll.athlete);
        owned.add(roll.templateId);
      } else {
        fragments += roll.duplicateFragments;
      }
      rolls.push({ ...roll, name });
    }
  }

  const capacity = inventoryCapacity(game.upgrades.storage);
  const keptItems: Item[] = [];
  let recycledCoins = 0;
  for (const item of newItems) {
    if (game.items.length + keptItems.length >= capacity) recycledCoins += recycleValue(item);
    else keptItems.push(item);
  }
  if (recycledCoins > 0) warnings.push(`Invent�rio cheio: ${recycledCoins} moedas recebidas por itens reciclados.`);
  const inventoryNote = inventoryWarning(game.items.length + keptItems.length, capacity);
  if (inventoryNote) warnings.push(inventoryNote);

  const legendPulls = newAthletes.filter((a) => templateRarity(a.templateId) === 'legend').length;
  const mythicPulls = newAthletes.filter((a) => templateRarity(a.templateId) === 'mythic').length;

  let next: GameState = {
    ...game,
    nextId: ctx.nextId,
    pity,
    resources: {
      ...game.resources,
      coins: game.resources.coins - (source === 'shop' ? price : 0) + coins + recycledCoins,
      gems: game.resources.gems + gems,
      fragments: game.resources.fragments + fragments,
    },
    chestStock: source === 'stock' ? { ...game.chestStock, [kind]: game.chestStock[kind] - count } : game.chestStock,
    athletes: [...game.athletes, ...newAthletes],
    items: [...game.items, ...keptItems],
    encyclopedia: {
      ...game.encyclopedia,
      athletes: [...new Set([...game.encyclopedia.athletes, ...newAthletes.map((a) => a.templateId)])],
      items: [...new Set([...game.encyclopedia.items, ...keptItems.map((i) => i.templateId)])],
    },
    counters: {
      ...game.counters,
      coinsEarned: game.counters.coinsEarned + coins + recycledCoins,
      athletes: game.counters.athletes + newAthletes.length,
      items: game.counters.items + keptItems.length,
      legendPulls: game.counters.legendPulls + legendPulls,
      mythicPulls: game.counters.mythicPulls + mythicPulls,
    },
  };
  next = bump(next, 'chests', count);
  const highlights = rolls
    .filter((r) => r.kind === 'athlete' || rarityRank(r.rarity) >= rarityRank('epic'))
    .map((r) => `${r.name} (${RARITY_NAME_PT[r.rarity]})`)
    .slice(0, 12);
  next = {
    ...next,
    openings: [
      { id: `op-${now.toString(36)}-${game.nextId}`, at: now, kind, count, coins, fragments, highlights },
      ...game.openings,
    ].slice(0, 30),
  };
  next = maintainLineup(next);
  const achieved = applyAchievements(next, now);
  useGame.setState({ game: achieved.game });

  return {
    ok: true,
    data: {
      kind,
      count,
      rolls,
      coins,
      gems,
      fragments,
      pityBefore,
      pityAfter: pity,
      warnings,
    },
  };
}

/* ---------- seletores usados pela interface ---------- */

export const selectors = {
  athleteOvr(game: GameState, athlete: Athlete): number {
    const template = templateById(athlete.templateId);
    if (!template) return 0;
    const items = game.items.filter((item) => Object.values(game.equipped[athlete.id] ?? {}).includes(item.id));
    return athleteOvr(athlete, template, items);
  },
  clubLevel(game: GameState): number {
    return clubLevelFor(game.resources.clubXp);
  },
  idleRate(game: GameState): number {
    return idleCoinsPerHour(clubLevelFor(game.resources.clubXp), game.upgrades.stadium);
  },
  idleCap(game: GameState): number {
    return idleCapHours(game.upgrades.youthAcademy);
  },
  inventoryCap(game: GameState): number {
    return inventoryCapacity(game.upgrades.storage);
  },
  missionStatus(game: GameState, id: string) {
    return { progress: missionProgress(game.missions, id), done: missionDone(game.missions, id), claimed: Boolean(game.missions.claimed[id]) };
  },
  achievementCount(game: GameState): { unlocked: number; total: number } {
    return { unlocked: Object.keys(game.achievements).length, total: ACHIEVEMENTS.length };
  },
  athleteName: athleteNameOf,
  validateLineup(game: GameState) {
    return validateLineup(game.lineup, ctxOf(game));
  },
  rarityRank,
  squadOvr,
};
export function outcomeLabel(outcome: 'win' | 'draw' | 'loss'): string {
  return outcome === 'win' ? 'Vitoria' : outcome === 'draw' ? 'Empate' : 'Derrota';
}
