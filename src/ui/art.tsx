/** Arte procedural em SVG: sem imagens externas, sem ativos de terceiros. */
import { hashString } from '../domain/rng';
import type { ChestKind, Position, Rarity } from '../domain/types';
import { CHEST_COLOR, POSITION_COLOR, RARITY_COLOR } from './theme';

export function Shield({ name, colors, size = 44 }: { name: string; colors: [string, string]; size?: number }) {
  const h = hashString(name);
  const pattern = h % 3;
  const [a, b] = colors;
  return (
    <svg className="shield" width={size} height={size * 1.12} viewBox="0 0 48 54" role="img" aria-label={`Escudo ${name}`}>
      <defs>
        <clipPath id={`clip-${h}`}>
          <path d="M24 2 L44 9 V26 C44 39 35 47 24 52 C13 47 4 39 4 26 V9 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${h})`}>
        <rect x="0" y="0" width="48" height="54" fill={a} />
        {pattern === 0 ? <rect x="0" y="18" width="48" height="12" fill={b} /> : null}
        {pattern === 1 ? <path d="M0 0 H24 V54 H0 Z" fill={b} opacity="0.85" /> : null}
        {pattern === 2 ? <path d="M0 40 L48 10 V20 L0 50 Z" fill={b} opacity="0.9" /> : null}
      </g>
      <path d="M24 2 L44 9 V26 C44 39 35 47 24 52 C13 47 4 39 4 26 V9 Z" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="2" />
      <circle cx="24" cy="26" r="6" fill={b} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
    </svg>
  );
}

export function Portrait({
  name,
  hue,
  position,
  number,
  locked = false,
  size = 64,
  rarity,
}: {
  name: string;
  hue: number;
  position: Position;
  number?: number;
  locked?: boolean;
  size?: number;
  rarity?: Rarity;
}) {
  const skin = `hsl(${(hue * 7) % 40 + 18}, 55%, ${58 + (hue % 14)}%)`;
  const kit = `hsl(${hue}, 62%, 46%)`;
  const hair = `hsl(${(hue * 3) % 360}, 30%, 18%)`;
  const ring = rarity ? RARITY_COLOR[rarity] : POSITION_COLOR[position];
  return (
    <svg
      className={`portrait ${locked ? 'is-locked' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={locked ? 'Silhueta de atleta não desbloqueado' : `Retrato de ${name}`}
    >
      <circle cx="32" cy="32" r="31" fill={locked ? '#2a2f36' : `hsl(${hue}, 35%, 24%)`} stroke={ring} strokeWidth="2" />
      {locked ? (
        <g fill="#6b7280">
          <circle cx="32" cy="24" r="9" />
          <path d="M14 56 C16 40 48 40 50 56 Z" />
        </g>
      ) : (
        <g>
          <path d="M14 58 C16 42 48 42 50 58 Z" fill={kit} />
          <rect x="27" y="36" width="10" height="8" fill={skin} />
          <circle cx="32" cy="26" r="10" fill={skin} />
          <path d="M22 24 C22 14 42 14 42 24 C40 19 24 19 22 24 Z" fill={hair} />
          {number ? <text x="32" y="56" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{number}</text> : null}
        </g>
      )}
    </svg>
  );
}

export function ChestArt({ kind, size = 56, open = false }: { kind: ChestKind; size?: number; open?: boolean }) {
  const color = CHEST_COLOR[kind];
  return (
    <svg className="chest-art" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`Baú ${kind}`}>
      <rect x="8" y="26" width="48" height="28" rx="4" fill="#6d4c41" stroke="#3e2723" strokeWidth="2" />
      <path d={open ? 'M8 26 L14 8 L50 8 L56 26 Z' : 'M8 26 Q32 12 56 26 Z'} fill="#8d6e63" stroke="#3e2723" strokeWidth="2" />
      <rect x="28" y="30" width="8" height="10" rx="2" fill={color} stroke="#3e2723" strokeWidth="1.5" />
      <rect x="8" y="36" width="48" height="3" fill={color} opacity="0.8" />
    </svg>
  );
}

export function BallIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#fff" stroke="#222" strokeWidth="1" />
      <path d="M10 5 L13.5 7.5 L12.2 11.6 H7.8 L6.5 7.5 Z" fill="#222" />
    </svg>
  );
}
