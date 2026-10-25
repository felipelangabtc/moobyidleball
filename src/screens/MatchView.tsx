import { useEffect, useMemo, useRef, useState } from 'react';
import { FastForward, Pause, Play, SkipForward, Target, Trophy, Users } from 'lucide-react';
import type { ArenaId, FormationId, MatchEvent, MatchReport, MatchSide, MatchTeam, PlayerMatchStat, Trail } from '../domain/types';
import { useGame, type ActiveMatch } from '../state/store';
import { useNav } from '../ui/nav';
import { Button, EmptyState, Panel, Pill, Stat } from '../ui/common';
import { Pitch, type PitchPlayer } from '../ui/Pitch';
import { sfx, vibrate } from '../audio/sound';
import { MATCH } from '../domain/balance';
import { clamp, lerp } from '../domain/rng';
import { fmt, plural } from '../ui/theme';
import { kindLabel, isUnlocked, phaseInfo } from '../domain/campaign';
import { FORMATIONS } from '../domain/football';
import { BallIcon, Shield } from '../ui/art';
import { useReducedMotion } from '../ui/hooks';

type Phase = 'playing' | 'paused' | 'done';

interface ViewData {
  id: string;
  report: MatchReport;
  title: string;
  subtitle: string;
  arena: ArenaId;
  grass: [string, string];
  rewards: { coins: number; clubXp: number; tokens: number; fragments: number; chest: string | null; itemName: string | null; achievements: number; levelUps: number; injuries: number; outcome: 'win' | 'draw' | 'loss' };
  notes: string[];
  mode: 'campaign' | 'challenge';
  phase: number;
  kind: string;
  live: boolean;
}

export function MatchView() {
  const active = useGame((s) => s.activeMatch);
  const lastMatch = useGame((s) => s.game.lastMatch);
  const go = useNav((s) => s.go);

  const data = useMemo<ViewData | null>(() => {
    if (active) return fromActive(active);
    if (lastMatch) return fromRecord(lastMatch as unknown as any);
    return null;
  }, [active, lastMatch]);

  if (!data) {
    return (
      <div className="screen">
        <EmptyState title="Nenhuma partida para mostrar" icon={Trophy}>
          <p>Escolha uma Phase no mapa e inicie a partida.</p>
          <Button variant="primary" onClick={() => go('campaign')}>Ir para a Campaign</Button>
        </EmptyState>
      </div>
    );
  }

  return <Playback key={data.id} data={data} />;
}

function fromActive(active: ActiveMatch): ViewData {
  const { plan, resolved } = active;
  const info = plan.info;
  const title = plan.label;
  return {
    id: resolved.record.id,
    report: resolved.report as MatchReport,
    title,
    subtitle: info ? `${info.biome.name} · ${kindLabel(info.kind)}` : 'Tournament de sobrevivência',
    arena: resolved.report.arena,
    grass: info ? info.biome.grass : ['#3f7d2c', '#4d9236'],
    rewards: {
      coins: resolved.record.coins,
      clubXp: resolved.record.clubXp,
      tokens: resolved.record.tokens,
      fragments: resolved.record.fragments,
      chest: resolved.record.chest,
      itemName: resolved.record.itemName,
      achievements: resolved.record.achievements.length,
      levelUps: resolved.record.levelUps,
      injuries: resolved.record.injuries,
      outcome: resolved.outcome,
    },
    notes: resolved.notes,
    mode: plan.mode.kind,
    phase: plan.mode.kind === 'campaign' ? plan.mode.phase : plan.wave,
    kind: plan.matchKind,
    live: true,
  };
}

function fromRecord(record: any): ViewData {
  const info = record.mode === 'campaign' ? phaseInfo(record.phase) : null;
  return {
    id: record.id,
    report: record.report as MatchReport,
    title: record.mode === 'campaign' ? `Phase ${record.phase}` : `Tournament · Wave ${record.phase}`,
    subtitle: info ? `${info.biome.name} · ${kindLabel(info.kind)}` : 'Tournament de sobrevivência',
    arena: record.report.arena,
    grass: info ? info.biome.grass : ['#3f7d2c', '#4d9236'],
    rewards: {
      coins: record.coins,
      clubXp: record.clubXp,
      tokens: record.tokens,
      fragments: record.fragments,
      chest: record.chest,
      itemName: record.itemName,
      achievements: record.achievements.length,
      levelUps: record.levelUps,
      injuries: record.injuries,
      outcome: record.outcome,
    },
    notes: [],
    mode: record.mode,
    phase: record.phase,
    kind: record.kind,
    live: false,
  };
}

/** Posição da bola: interpolação linear entre o evento anterior e o próximo. */
export function ballAt(events: MatchEvent[], minute: number): { x: number; y: number; side: MatchSide | null } {
  if (events.length === 0) return { x: 50, y: 30, side: null };
  let prev: MatchEvent | null = null;
  let next: MatchEvent | null = null;
  for (const e of events) {
    if (e.minute <= minute) prev = e;
    else {
      next = e;
      break;
    }
  }
  const base = prev ?? events[0];
  if (!base) return { x: 50, y: 30, side: null };
  const side = base.side === 'home' || base.side === 'away' ? base.side : null;
  if (!next || next.minute === base.minute) return { x: base.x, y: base.y, side };
  const t = clamp((minute - base.minute) / (next.minute - base.minute), 0, 1);
  return { x: round1(lerp(base.x, next.x, t)), y: round1(lerp(base.y, next.y, t)), side };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

const SOUND_FOR: Partial<Record<MatchEvent['kind'], () => void>> = {
  kickoff: () => sfx.kickoff(),
  halftime: () => sfx.whistle(),
  fulltime: () => sfx.whistle(),
  extra: () => sfx.whistle(),
  goal: () => sfx.goal(),
  save: () => sfx.save(),
  shot: () => sfx.shot(),
  miss: () => sfx.shot(),
  post: () => sfx.shot(),
  yellow: () => sfx.card(),
  red: () => sfx.card(),
  penalty: () => sfx.warning(),
  ricochet: () => sfx.shot(),
  ability: () => sfx.select(),
  injury: () => sfx.warning(),
  shootout: () => sfx.click(),
};

function Playback({ data }: { data: ViewData }) {
  const { report } = data;
  const total = Math.max(MATCH.minutes, ...report.events.map((e) => e.minute));
  const settings = useGame((s) => s.game.settings);
  const updateSettings = useGame((s) => s.updateSettings);
  const reduced = useReducedMotion(settings.reduceMotion);
  const [minute, setMinute] = useState(data.live ? 0 : total);
  const [speed, setSpeed] = useState<number>(settings.defaultSpeed);
  const [phase, setPhase] = useState<Phase>(data.live ? 'playing' : 'done');
  const [flash, setFlash] = useState(false);
  const lastSoundIndex = useRef(-1);
  const minuteRef = useRef(minute);
  minuteRef.current = minute;
  const go = useNav((s) => s.go);
  const setCampaignTab = useNav((s) => s.setCampaignTab);
  const startMatch = useGame((s) => s.startMatch);
  const setActivePhase = useGame((s) => s.setActivePhase);
  const startChallenge = useGame((s) => s.startChallenge);
  const toast = useGame((s) => s.toast);

  const visibleEvents = useMemo(() => report.events.filter((e) => e.minute <= Math.floor(minute)), [report.events, minute]);
  const lastEvent = visibleEvents[visibleEvents.length - 1];
  const score: [number, number] = lastEvent ? lastEvent.score : [0, 0];
  const ball = ballAt(report.events, minute);
  const visibleTrails: Trail[] = report.trails.filter((t) => t.minute <= minute);
  const highlight = new Set(lastEvent?.playerIds ?? []);
  const finished = phase === 'done';
  const finalScore = report.score;

  // Relógio do jogo: 1 minuto por intervalo de MATCH.minuteMs na velocidade normal.
  useEffect(() => {
    if (phase !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const next = minuteRef.current + (dt / MATCH.minuteMs) * speed;
      if (next >= total) {
        setMinute(total);
        setPhase('done');
        return;
      }
      setMinute(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, speed, total]);

  // Sons e sinalização ao aparecer novos eventos.
  useEffect(() => {
    const idx = visibleEvents.length - 1;
    if (idx <= lastSoundIndex.current) return;
    const fresh = visibleEvents.slice(lastSoundIndex.current + 1);
    lastSoundIndex.current = idx;
    if (phase === 'done' && !data.live) return;
    for (const e of fresh) {
      if (e.kind === 'goal') {
        setFlash(true);
        vibrate([40, 40, 80]);
        window.setTimeout(() => setFlash(false), reduced ? 200 : 900);
      }
    }
    const last = fresh[fresh.length - 1];
    if (last) SOUND_FOR[last.kind]?.();
  }, [visibleEvents, phase, data.live, reduced]);

  // Modo automático: continua a Campaign após vitória; Defeat pausa o automático.
  useEffect(() => {
    if (!finished || !data.live) return;
    if (data.rewards.outcome === 'loss' && settings.autoPlay) {
      updateSettings({ autoPlay: false });
      toast('Modo automático pausado após a Defeat.', 'warning');
      return;
    }
    if (settings.autoPlay && data.mode === 'campaign' && data.rewards.outcome === 'win') {
      const timer = window.setTimeout(() => {
        const game = useGame.getState().game;
        if (!isUnlocked(game.campaign, game.campaign.activePhase)) return;
        const res = startMatch({ kind: 'campaign', phase: game.campaign.activePhase });
        if (!res.ok) {
          updateSettings({ autoPlay: false });
          toast(res.error ?? 'Automático pausado.', 'warning');
        }
      }, reduced ? 800 : 2500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [finished, data.live, data.mode, data.rewards.outcome, settings.autoPlay, startMatch, updateSettings, toast, reduced]);

  const skip = () => {
    lastSoundIndex.current = report.events.length - 1;
    setMinute(total);
    setPhase('done');
  };

  const togglePlay = () => {
    if (finished) return;
    setPhase((p) => (p === 'playing' ? 'paused' : 'playing'));
  };

  const homePlayers: PitchPlayer[] = report.home.players.map((p) => ({ id: p.id, number: p.number, label: p.name, side: 'home', highlight: highlight.has(p.id) }));
  const awayPlayers: PitchPlayer[] = report.away.players.map((p) => ({ id: p.id, number: p.number, label: p.name, side: 'away', highlight: highlight.has(p.id) }));

  return (
    <div className="screen screen-match">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{data.subtitle}</p>
          <h1>{data.title}</h1>
        </div>
        <Pill>{data.arena === 'ricochet' ? 'Arena de placas' : 'Traditional field'}</Pill>
      </header>

      <section className="scoreboard" aria-label="Placar">
        <TeamScore team={report.home} score={score[0]} />
        <div className="clock" aria-live="off">
          <p className="minute">{Math.min(total, Math.floor(minute))}&apos;</p>
          <p className="muted small">{finished ? 'Fim' : phase === 'paused' ? 'Pausado' : 'Ao vivo'}</p>
        </div>
        <TeamScore team={report.away} score={score[1]} right />
      </section>

      <div className="match-layout">
        <div className="match-field">
          <Pitch
            label={`Campo: ${report.home.name} contra ${report.away.name}`}
            homeColors={report.home.colors}
            awayColors={report.away.colors}
            homeFormation={report.home.formation}
            awayFormation={report.away.formation}
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            ball={{ x: ball.x, y: ball.y }}
            attackingSide={ball.side}
            trails={visibleTrails}
            arena={data.arena}
            grass={data.grass}
            flash={flash && !reduced}
            minute={minute}
          />
          <div className="controls" role="toolbar" aria-label="Controles da partida">
            <Button
              variant="primary"
              icon={phase === 'playing' ? Pause : Play}
              onClick={togglePlay}
              disabled={finished}
              aria-label={phase === 'playing' ? 'Pausar partida' : 'Continuar partida'}
            >
              {phase === 'playing' ? 'Pausar' : finished ? 'Encerrada' : 'Continuar'}
            </Button>
            <div className="speed" role="group" aria-label="Velocidade">
              {MATCH.speeds.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`speed-btn ${speed === v ? 'is-active' : ''}`}
                  aria-pressed={speed === v}
                  onClick={() => setSpeed(v)}
                >
                  {v}×
                </button>
              ))}
            </div>
            <Button icon={SkipForward} onClick={skip} disabled={finished}>Pular para o fim</Button>
          </div>
          <div className="progress" role="progressbar" aria-label="Andamento da partida" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.floor(minute)}>
            <div style={{ width: `${(minute / total) * 100}%` }} />
          </div>
          <p className="sr-only" aria-live="polite">
            {lastEvent && (lastEvent.kind === 'goal' || lastEvent.kind === 'save' || lastEvent.kind === 'fulltime') ? lastEvent.text : ''}
          </p>
        </div>

        <Panel title="Linha do tempo" eyebrow="Narração" id="timeline" className="timeline">
          <ol className="events" aria-label="Eventos da partida">
            {visibleEvents.slice().reverse().map((e, i) => (
              <li key={`${e.minute}-${i}-${e.text.slice(0, 12)}`} className={`event event-${e.kind} ${e.side === 'home' ? 'is-home' : e.side === 'away' ? 'is-away' : ''}`}>
                <span className="event-min">{e.minute}&apos;</span>
                <span className="event-text">{e.text}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {finished ? (
        <ResultSummary data={data} report={report} finalScore={finalScore} onNext={(action) => {
          if (action === 'next') {
            const game = useGame.getState().game;
            const nextPhase = data.phase + 1;
            if (!isUnlocked(game.campaign, nextPhase)) {
              toast('A próxima Phase ainda não está desLocked.', 'warning');
              go('campaign');
              return;
            }
            setActivePhase(nextPhase);
            setCampaignTab('mapa');
            go('prep');
          } else if (action === 'rematch') {
            if (data.mode === 'campaign') {
              const res = startMatch({ kind: 'campaign', phase: data.phase });
              if (!res.ok) toast(res.error ?? 'Não foi possível iniciar a revanche.', 'warning');
            }
          } else if (action === 'next-wave') {
            const res = startMatch({ kind: 'challenge' });
            if (!res.ok) toast(res.error ?? 'Não foi possível iniciar a Wave.', 'warning');
          } else if (action === 'new-run') {
            startChallenge();
            setCampaignTab('torneio');
            go('campaign');
          } else if (action === 'squad') {
            go('squad');
          } else if (action === 'map') {
            setCampaignTab(data.mode === 'challenge' ? 'torneio' : 'mapa');
            go('campaign');
          }
        }} />
      ) : null}
      <p className="muted small center">Relatório gerado com a semente {report.seed}. Posições são visuais; o Result é o mesmo em qualquer velocidade.</p>
    </div>
  );
}

function TeamScore({ team, score, right = false }: { team: MatchTeam; score: number; right?: boolean }) {
  return (
    <div className={`team-score ${right ? 'is-right' : ''}`}>
      <Shield name={team.name} colors={team.colors} size={44} />
      <div>
        <p className="team-name">{team.name}</p>
        <p className="muted small">{FORMATIONS[team.formation as FormationId].label} · OVR {team.ovr.toLocaleString('pt-BR')}</p>
      </div>
      <p className="score">{score}</p>
    </div>
  );
}

interface ResultProps {
  data: ViewData;
  report: MatchReport;
  finalScore: [number, number];
  onNext: (action: 'next' | 'rematch' | 'next-wave' | 'new-run' | 'squad' | 'map') => void;
}

function ResultSummary({ data, report, finalScore, onNext }: ResultProps) {
  const outcomeText = data.rewards.outcome === 'win' ? 'Vitória' : data.rewards.outcome === 'draw' ? 'Draw' : 'Defeat';
  const outcomeTone = data.rewards.outcome === 'win' ? 'var(--ok)' : data.rewards.outcome === 'draw' ? 'var(--gold)' : 'var(--danger)';
  const allPlayers = useMemo(() => {
    const rows: Array<{ id: string; name: string; side: MatchSide; stat: PlayerMatchStat }> = [];
    for (const side of ['home', 'away'] as const) {
      const team = report[side];
      for (const p of team.players) {
        const stat = report.playerStats[p.id];
        if (stat) rows.push({ id: p.id, name: p.name, side, stat });
      }
    }
    return rows.sort((a, b) => b.stat.rating - a.stat.rating).slice(0, 6);
  }, [report]);
  const isCampaign = data.mode === 'campaign';
  const canNext = isCampaign && data.rewards.outcome === 'win';

  return (
    <section className="result" aria-labelledby="result-title">
      <div className="result-hero" style={{ borderColor: outcomeTone }}>
        <p className="eyebrow">Result final</p>
        <h2 id="result-title" style={{ color: outcomeTone }}>{outcomeText}</h2>
        <p className="result-score">
          {report.home.name} {finalScore[0]} x {finalScore[1]} {report.away.name}
        </p>
        {report.shootout ? <p className="muted">Pênaltis: {report.shootout[0]} x {report.shootout[1]}</p> : null}
        {report.extraTime ? <p className="muted small">Após prorrogação.</p> : null}
      </div>

      <div className="grid-stats">
        <Stat label="Posse" value={`${report.stats.home.possession}% x ${report.stats.away.possession}%`} icon={Users} />
        <Stat label="Finalizações" value={`${report.stats.home.shots} x ${report.stats.away.shots}`} hint={`No alvo: ${report.stats.home.onTarget} x ${report.stats.away.onTarget}`} icon={Target} />
        <Stat label="Escanteios" value={`${report.stats.home.corners} x ${report.stats.away.corners}`} />
        <Stat label="Faltas e cartões" value={`${report.stats.home.fouls} x ${report.stats.away.fouls}`} hint={`Amarelos ${report.stats.home.yellow} x ${report.stats.away.yellow}`} />
      </div>

      <div className="grid-2">
        <Panel title="Rewards" eyebrow="Recebidas" id="rewards">
          <ul className="list-plain">
            <li>{fmt(data.rewards.coins)} Coins</li>
            <li>{fmt(data.rewards.clubXp)} XP de Club</li>
            <li>{data.rewards.tokens} Training tokens</li>
            <li>{data.rewards.fragments} Fragments</li>
            {data.rewards.chest ? <li>Baú recebido: {data.rewards.chest}</li> : null}
            {data.rewards.itemName ? <li>Item encontrado: {data.rewards.itemName}</li> : null}
            {data.rewards.levelUps > 0 ? <li>{plural(data.rewards.levelUps, 'nível subido', 'níveis subidos')} entre atletas</li> : null}
            {data.rewards.achievements > 0 ? <li>{plural(data.rewards.achievements, 'conquista desLocked', 'Achievements desLockeds')}</li> : null}
            {data.rewards.injuries > 0 ? <li>{plural(data.rewards.injuries, 'lesão', 'lesões')} no Your team</li> : null}
          </ul>
          {data.notes.length > 0 ? (
            <ul className="muted small">{data.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          ) : null}
        </Panel>
        <Panel title="Destaques" eyebrow="Notas dos atletas" id="ratings">
          <ul className="ratings">
            {allPlayers.map((row) => (
              <li key={row.id}>
                <span className="grow">{row.name}</span>
                <span className="muted small">{row.side === 'home' ? 'Your team' : 'Adversário'}</span>
                <strong className="rating">{row.stat.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</strong>
              </li>
            ))}
          </ul>
          {report.goalMinutes.length > 0 ? (
            <ul className="muted small">
              {report.goalMinutes.map((g, i) => (
                <li key={i}>{g.minute}&apos; · {g.side === 'home' ? report.home.name : report.away.name} ({g.kind === 'penalty' ? 'pênalti' : g.kind === 'ricochet' ? 'ricochete' : 'jogada'})</li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </div>

      <div className="result-actions" role="group" aria-label="Próximos passos">
        {canNext ? <Button variant="primary" onClick={() => onNext('next')}>Próxima Phase</Button> : null}
        {isCampaign && data.rewards.outcome !== 'win' ? <Button variant="primary" onClick={() => onNext('rematch')}>Revanche (Phase {data.phase})</Button> : null}
        {isCampaign && data.rewards.outcome === 'draw' ? <Button onClick={() => onNext('rematch')}>Jogar de novo</Button> : null}
        {!isCampaign && data.rewards.outcome === 'win' ? <Button variant="primary" onClick={() => onNext('next-wave')}>Próxima Wave</Button> : null}
        {!isCampaign && data.rewards.outcome !== 'win' ? <Button variant="primary" onClick={() => onNext('new-run')}>Novo Tournament</Button> : null}
        <Button icon={Users} onClick={() => onNext('squad')}>Voltar à escalação</Button>
        <Button icon={FastForward} onClick={() => onNext('map')}>Mapa</Button>
      </div>
      {data.rewards.outcome === 'loss' && isCampaign ? (
        <p className="muted small">Após a Defeat você voltou uma Phase. Melhore o Squad e tente a revanche quando estiver pronto.</p>
      ) : null}
      <p className="muted small"><BallIcon size={12} /> Partida resolvida: a animação apenas mostra o que já aconteceu.</p>
    </section>
  );
}
