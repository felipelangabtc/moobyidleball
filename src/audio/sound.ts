/**
 * Efeitos sonoros sintetizados com a Web Audio API. Não há arquivos externos.
 * O contexto só é criado após um gesto do usuário (exigência dos navegadores),
 * e todo som respeita o interruptor e o volume das configurações.
 */
import type { Rarity } from '../domain/types';

interface AudioConfig {
  enabled: boolean;
  volume: number;
}

let config: AudioConfig = { enabled: true, volume: 0.6 };
let ctx: AudioContext | null = null;

export function configureAudio(next: Partial<AudioConfig>): void {
  config = { ...config, ...next, volume: clamp01(next.volume ?? config.volume) };
}

function context(): AudioContext | null {
  if (!config.enabled) return null;
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, gain: number, slideTo?: number): void {
  const ac = context();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  const t0 = ac.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  const peak = Math.max(0.0002, gain * config.volume);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(start: number, duration: number, gain: number): void {
  const ac = context();
  if (!ac) return;
  const length = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource();
  const g = ac.createGain();
  g.gain.value = gain * config.volume;
  src.buffer = buffer;
  src.connect(g).connect(ac.destination);
  src.start(ac.currentTime + start);
}

export const sfx = {
  click(): void {
    tone(660, 0, 0.06, 'square', 0.08);
  },
  select(): void {
    tone(520, 0, 0.05, 'triangle', 0.1);
  },
  warning(): void {
    tone(220, 0, 0.18, 'sawtooth', 0.08, 180);
  },
  kickoff(): void {
    tone(880, 0, 0.25, 'square', 0.12);
    tone(660, 0.25, 0.4, 'square', 0.1);
  },
  whistle(): void {
    tone(1900, 0, 0.35, 'sine', 0.12, 1700);
    tone(2050, 0.05, 0.3, 'sine', 0.06);
  },
  shot(): void {
    noise(0, 0.12, 0.25);
  },
  save(): void {
    noise(0, 0.08, 0.18);
    tone(300, 0.02, 0.1, 'triangle', 0.1);
  },
  goal(): void {
    noise(0, 0.5, 0.2);
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.45, 'triangle', 0.14));
  },
  card(): void {
    tone(440, 0, 0.12, 'square', 0.12);
    tone(440, 0.16, 0.12, 'square', 0.12);
  },
  chestOpen(): void {
    tone(330, 0, 0.12, 'triangle', 0.12, 660);
    tone(660, 0.12, 0.15, 'triangle', 0.12, 990);
  },
  reveal(rarity: Rarity): void {
    const base: Record<Rarity, number> = { common: 392, rare: 523, epic: 659, legend: 784, mythic: 988 };
    const freq = base[rarity];
    tone(freq, 0, 0.18, 'triangle', 0.14);
    tone(freq * 1.5, 0.12, 0.25, 'triangle', 0.12);
    if (rarity === 'legend' || rarity === 'mythic') tone(freq * 2, 0.26, 0.4, 'triangle', 0.1);
  },
  coins(): void {
    tone(1200, 0, 0.07, 'square', 0.07);
    tone(1600, 0.07, 0.1, 'square', 0.07);
  },
  upgrade(): void {
    [392, 523, 659].forEach((f, i) => tone(f, i * 0.1, 0.22, 'triangle', 0.12));
  },
  error(): void {
    tone(180, 0, 0.2, 'square', 0.1, 120);
  },
};

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Vibração não é essencial; ignora quando indisponível.
    }
  }
}
