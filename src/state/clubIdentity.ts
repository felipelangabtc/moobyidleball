/** Identidade do clube do jogador (cidade, mascote e cores) derivada do nome. */
import { biomeFor } from '../data/biomes';
import { KIT_PALETTES, MASCOTS } from '../data/names';
import { hashString } from '../domain/rng';
import type { ChestKind } from '../domain/types';

export function clubTeamIdentity(clubName: string): { city: string; mascot: string; colors: [string, string] } {
  const h = hashString(clubName || 'Clube');
  const mascot = MASCOTS[h % MASCOTS.length] ?? 'Titãs';
  const palette = KIT_PALETTES[(h >>> 8) % KIT_PALETTES.length] ?? ['#1e88e5', '#ffffff'];
  return { city: clubName || 'Clube', mascot, colors: [palette[0] ?? '#1e88e5', palette[1] ?? '#ffffff'] };
}

/** Tipo de baú de uma temporada, conforme o bioma. */
export function biomeChestFor(seasonIndex: number): ChestKind {
  return biomeFor(seasonIndex).chest;
}
