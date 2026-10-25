/**
 * Persistência local: envelope versionado com checksum, migrações e recuperação.
 *
 * - O checksum (FNV-1a) detecta corrupção acidental e edição manual. Não é uma
 *   proteção criptográfica: quem controla o navegador pode recalcular o valor.
 * - Saves inválidos são copiados para uma chave de backup antes de iniciar um jogo novo.
 * - Migrações são executadas em sequência, da versão do arquivo até a atual.
 */
import { z } from 'zod';
import { SAVE_VERSION } from '../domain/balance';
import { createInitialState, gameStateSchema, DEFAULT_SETTINGS, type GameState } from './schema';

export const SAVE_KEY = 'idleball.save';
export const BACKUP_KEY = 'idleball.save.backup';
const FORMAT = 'idleball-save';

export interface LoadResult {
  state: GameState;
  status: 'new' | 'loaded' | 'migrated' | 'recovered' | 'modified';
  message: string | null;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  savedAt: number;
}

interface Envelope {
  format: string;
  version: number;
  savedAt: number;
  checksum: string;
  state: unknown;
}

export function checksumOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function encode(state: GameState, now: number): string {
  const body = JSON.stringify(state);
  const envelope: Envelope = {
    format: FORMAT,
    version: SAVE_VERSION,
    savedAt: now,
    checksum: checksumOf(body),
    state: JSON.parse(body) as unknown,
  };
  return JSON.stringify(envelope);
}

type Migration = { from: number; to: number; run: (raw: Record<string, unknown>) => Record<string, unknown> };

/**
 * v1 → v2: acrescenta configurações de automação, recordes e o contador de
 * pagamentos de derrota (que antes não existiam). Mantém todo o progresso.
 */
const MIGRATIONS: Migration[] = [
  {
    from: 1,
    to: 2,
    run: (raw) => {
      const settings = (raw.settings ?? {}) as Record<string, unknown>;
      const missions = (raw.missions ?? {}) as Record<string, unknown>;
      const resources = (raw.resources ?? {}) as Record<string, unknown>;
      return {
        ...raw,
        version: 2,
        settings: { ...DEFAULT_SETTINGS, ...settings, language: (settings.language as string) ?? 'pt' },
        resources: { coins: 800, gems: 5, clubXp: 0, tokens: 6, fragments: 0, ...resources },
        records: raw.records ?? { bestWave: 0, maxStars: 1, maxLevel: 1 },
        openings: raw.openings ?? [],
        marketplace: raw.marketplace ?? { listings: [], earnings: 0 },
        missions: { lossPayoutsToday: 0, challengeCoinsToday: 0, ...missions },
      };
    },
  },
];

function migrate(raw: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  let current = raw;
  let version = fromVersion;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) throw new Error(`Não há migração da versão ${version}.`);
    current = step.run(current);
    version = step.to;
  }
  return current;
}

const envelopeSchema = z.object({
  format: z.literal(FORMAT),
  version: z.number().int().min(1),
  savedAt: z.number(),
  checksum: z.string().length(8),
  state: z.unknown(),
});

export function serialize(state: GameState, now: number): string {
  return encode(state, now);
}

export function deserialize(text: string, now: number): LoadResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return recovered(text, now, 'O save estava ilegível (JSON inválido).');
  }
  const envelope = envelopeSchema.safeParse(parsedJson);
  if (!envelope.success) return recovered(text, now, 'O save não tem o formato esperado.');

  const env = envelope.data;
  if (env.version > SAVE_VERSION) {
    return recovered(text, now, 'O save foi criado por uma versão mais nova do jogo.');
  }
  const bodyText = JSON.stringify(env.state);
  const modified = checksumOf(bodyText) !== env.checksum;

  let raw: Record<string, unknown>;
  try {
    raw = migrate(structuredClone(env.state) as Record<string, unknown>, env.version);
  } catch (error) {
    return recovered(text, now, error instanceof Error ? error.message : 'Falha na migração do save.');
  }

  const parsed = gameStateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first ? first.path.join('.') : 'desconhecido';
    return recovered(text, now, `Dados inválidos no save (campo ${where}).`);
  }

  const migrated = env.version < SAVE_VERSION;
  const status: LoadResult['status'] = modified ? 'modified' : migrated ? 'migrated' : 'loaded';
  const message = modified
    ? 'Aviso: o save foi alterado fora do jogo. Os dados foram carregados, mas a integridade não pode ser garantida.'
    : migrated
      ? `Save atualizado da versão ${env.version} para ${SAVE_VERSION}.`
      : null;
  return { state: parsed.data, status, message };
}

function recovered(text: string, now: number, reason: string): LoadResult {
  try {
    localStorage.setItem(BACKUP_KEY, text);
  } catch {
    // Sem espaço ou acesso negado: o jogo continua, mas sem cópia.
  }
  return {
    state: createInitialState(now),
    status: 'recovered',
    message: `${reason} Uma cópia foi guardada e um novo clube foi criado.`,
  };
}

export function loadFromStorage(now: number, storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): LoadResult {
  if (!storage) return { state: createInitialState(now), status: 'new', message: 'Armazenamento local indisponível. O progresso não será salvo.' };
  let text: string | null = null;
  try {
    text = storage.getItem(SAVE_KEY);
  } catch {
    return { state: createInitialState(now), status: 'new', message: 'Não foi possível ler o armazenamento local.' };
  }
  if (!text) return { state: createInitialState(now), status: 'new', message: null };
  return deserialize(text, now);
}

export function saveToStorage(state: GameState, now: number, storage: Pick<Storage, 'setItem'> | undefined = safeStorage()): SaveResult {
  if (!storage) return { ok: false, error: 'Armazenamento local indisponível.', savedAt: now };
  try {
    storage.setItem(SAVE_KEY, serialize(state, now));
    return { ok: true, savedAt: now };
  } catch (error) {
    const message = error instanceof Error && error.name === 'QuotaExceededError'
      ? 'Espaço de armazenamento cheio. Exporte seu save e libere espaço.'
      : 'Não foi possível salvar. Verifique as permissões do navegador.';
    return { ok: false, error: message, savedAt: now };
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Exporta o save como texto (para cópia manual do jogador). */
export function exportSave(state: GameState, now: number): string {
  return serialize(state, now);
}

/** Importa um save exportado. Valida e retorna o estado ou uma mensagem de erro. */
export function importSave(text: string, now: number): { ok: true; state: GameState; message: string | null } | { ok: false; error: string } {
  const result = deserialize(text.trim(), now);
  if (result.status === 'recovered') return { ok: false, error: result.message ?? 'Save inválido.' };
  return { ok: true, state: result.state, message: result.message };
}
