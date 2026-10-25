import { useId } from 'react';
import { FORMATIONS } from '../domain/football';
import type { ArenaId, FormationId, MatchSide, Trail } from '../domain/types';
import { arenaBumpers } from '../sim/ricochet';
import { clamp } from '../domain/rng';

export interface PitchPlayer {
  id: string;
  number: number;
  label: string;
  side: MatchSide;
  highlight?: boolean;
}

export interface PitchProps {
  homeColors: [string, string];
  awayColors: [string, string];
  homeFormation: FormationId;
  awayFormation: FormationId;
  homePlayers: PitchPlayer[];
  awayPlayers: PitchPlayer[];
  ball: { x: number; y: number };
  attackingSide: MatchSide | null;
  trails?: Trail[];
  arena?: ArenaId;
  grass?: [string, string];
  flash?: boolean;
  minute?: number;
  className?: string;
  label: string;
}

/** Posição de cada jogador no campo (0–100 x 0–60), com deslocamento leve em direção à bola. */
export function playerPositions(formation: FormationId, side: MatchSide, ball: { x: number; y: number }, minute: number): Array<{ x: number; y: number }> {
  const slots = FORMATIONS[formation as FormationId].slots;
  const shiftX = clamp((ball.x - 50) * 0.16, -6, 6);
  const shiftY = clamp((ball.y - 30) * 0.1, -3, 3);
  return slots.map((slot, i) => {
    const baseX = side === 'home' ? slot.x : 100 - slot.x;
    const baseY = slot.y * 0.6;
    const wobble = Math.sin(minute * 0.7 + i * 1.9) * 0.9;
    const wobbleY = Math.cos(minute * 0.5 + i * 1.3) * 0.7;
    return {
      x: clamp(baseX + shiftX * 0.8 + wobble, 2, 98),
      y: clamp(baseY + shiftY * 0.6 + wobbleY, 3, 57),
    };
  });
}

export function Pitch(props: PitchProps) {
  const id = useId().replace(/:/g, '');
  const bumpers = props.arena === 'ricochet' ? arenaBumpers() : [];
  const [g1, g2] = props.grass ?? ['#3f7d2c', '#4d9236'];
  const homePos = playerPositions(props.homeFormation, 'home', props.ball, props.minute ?? 0);
  const awayPos = playerPositions(props.awayFormation, 'away', props.ball, props.minute ?? 0);

  return (
    <div className={`pitch-wrap ${props.flash ? 'is-flash' : ''} ${props.className ?? ''}`}>
      <svg viewBox="0 0 100 60" className="pitch" role="img" aria-label={props.label} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id={`stripes-${id}`} width="10" height="60" patternUnits="userSpaceOnUse">
            <rect width="5" height="60" fill={g1} />
            <rect x="5" width="5" height="60" fill={g2} />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100" height="60" fill={`url(#stripes-${id})`} />
        <g className="pitch-lines" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.35">
          <rect x="1" y="1" width="98" height="58" />
          <line x1="50" y1="1" x2="50" y2="59" />
          <circle cx="50" cy="30" r="8" />
          <circle cx="50" cy="30" r="0.5" fill="#fff" />
          <rect x="1" y="14" width="13" height="32" />
          <rect x="86" y="14" width="13" height="32" />
          <rect x="1" y="22" width="5" height="16" />
          <rect x="94" y="22" width="5" height="16" />
          <path d="M14 26 A4 4 0 0 1 14 34" />
          <path d="M86 26 A4 4 0 0 0 86 34" />
        </g>
        <g className="goals" fill="rgba(255,255,255,0.9)">
          <rect x="-1" y="26" width="2" height="8" />
          <rect x="99" y="26" width="2" height="8" />
        </g>

        {bumpers.map((b, i) => (
          <line key={`b-${i}`} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} className="bumper" />
        ))}

        {(props.trails ?? []).map((trail, i) => {
          const points = trail.points.map(([x, y]) => `${trail.side === 'home' ? x : 100 - x},${y}`).join(' ');
          return (
            <g key={`t-${i}`} className={`trail trail-${trail.outcome}`}>
              <polyline points={points} />
            </g>
          );
        })}

        {props.awayPlayers.map((p, i) => (
          <Player key={`a-${p.id}`} x={awayPos[i]?.x ?? 0} y={awayPos[i]?.y ?? 0} color={props.awayColors[0]} text={props.awayColors[1]} player={p} />
        ))}
        {props.homePlayers.map((p, i) => (
          <Player key={`h-${p.id}`} x={homePos[i]?.x ?? 0} y={homePos[i]?.y ?? 0} color={props.homeColors[0]} text={props.homeColors[1]} player={p} />
        ))}

        <g className="ball" transform={`translate(${props.ball.x} ${props.ball.y})`}>
          <circle r="1.25" fill="#fff" stroke="#111" strokeWidth="0.25" />
          <path d="M0 -0.7 L0.7 -0.2 L0.4 0.6 H-0.4 L-0.7 -0.2 Z" fill="#111" />
        </g>
        {props.attackingSide ? (
          <text x={props.attackingSide === 'home' ? 97 : 3} y="3" textAnchor={props.attackingSide === 'home' ? 'end' : 'start'} className="attack-tag">
            ataque
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function Player({ x, y, color, text, player }: { x: number; y: number; color: string; text: string; player: PitchPlayer }) {
  return (
    <g className={`player ${player.highlight ? 'is-highlight' : ''}`} transform={`translate(${x} ${y})`}>
      <title>{player.label}</title>
      {/* sombra */}
      <ellipse cx="0" cy="2.6" rx="2.4" ry="0.7" fill="rgba(0,0,0,0.25)" />
      {/* pernas */}
      <rect x="-1.1" y="0.6" width="0.9" height="2.2" rx="0.3" fill="#1a1a1a" />
      <rect x="0.2" y="0.6" width="0.9" height="2.2" rx="0.3" fill="#1a1a1a" />
      {/* corpo (camisa) */}
      <path d="M-2.2 0.6 L-1.6 -2.2 L1.6 -2.2 L2.2 0.6 Z" fill={color} stroke={text} strokeWidth="0.25" />
      {/* braços */}
      <rect x="-2.7" y="-1.6" width="0.7" height="2.4" rx="0.3" fill={color} />
      <rect x="2.0" y="-1.6" width="0.7" height="2.4" rx="0.3" fill={color} />
      {/* cabeça */}
      <circle cx="0" cy="-3.0" r="1.5" fill="#f1c27d" stroke="#1a1a1a" strokeWidth="0.2" />
      {/* número */}
      <text y="-0.2" textAnchor="middle" fontSize="1.9" fontWeight="800" fill={text}>
        {player.number}
      </text>
    </g>
  );
}
