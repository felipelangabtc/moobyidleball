import { useMemo } from 'react';
import { Activity, ArrowRight, BarChart3, Coins, Gift, Medal, Play, Recycle, Swords, Target, Trophy, Wrench } from 'lucide-react';
import { useGame, selectors, squadOvr, outcomeLabel } from '../state/store';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Bar, Button, Panel, Pill, Stat, Tip } from '../ui/common';
import { Shield } from '../ui/art';
import { useNow } from '../ui/hooks';
import { clock, fmt, plural } from '../ui/theme';
import { isUnlocked, kindLabel, phaseInfo, phaseRewards, seasonLabel, timesWon } from '../domain/campaign';
import { computeIdle, formatDuration } from '../domain/idle';
import { clubLevelFor, idleCapHours } from '../domain/economy';
import { lineupProblems } from '../state/matchFlow';
import { clubTeamIdentity } from '../state/clubIdentity';
import { missionById } from '../domain/progress';
import { FORMATIONS, TACTICS } from '../domain/football';
import type { FormationId, TacticId } from '../domain/types';
import { ECONOMY } from '../domain/balance';

export function Home() {
  const t = useT();
  const game = useGame((s) => s.game);
  const collectIdle = useGame((s) => s.collectIdle);
  const toast = useGame((s) => s.toast);
  const updateSettings = useGame((s) => s.updateSettings);
  const go = useNav((s) => s.go);
  const openAthlete = useNav((s) => s.openAthlete);
  const setCampaignTab = useNav((s) => s.setCampaignTab);
  const now = useNow(30_000);

  const phase = game.campaign.activePhase;
  const info = phaseInfo(phase);
  const won = timesWon(game.campaign, phase);
  const rewards = phaseRewards(info, 'win', won);
  const problems = lineupProblems(game);
  const level = clubLevelFor(game.resources.clubXp);
  const pending = computeIdle({
    lastCollectedAt: game.idle.lastCollectedAt,
    now,
    clubLevel: level,
    stadiumLevel: game.upgrades.stadium,
    youthLevel: game.upgrades.youthAcademy,
  });
  const identity = clubTeamIdentity(game.clubName);
  const ovr = squadOvr(game);
  const topAthletes = useMemo(
    () => [...game.athletes].sort((a, b) => selectors.athleteOvr(game, b) - selectors.athleteOvr(game, a)).slice(0, 3),
    [game],
  );
  const cap = idleCapHours(game.upgrades.youthAcademy);
  const lastMatch = game.lastMatch;

  return (
    <div className="screen screen-home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{seasonLabel(info.seasonIndex)}</p>
          <h1 id="hero-title">{game.clubName}</h1>
          <p className="muted">
            {t('home.nextChallenge')}: <strong>{t('home.prepare', { phase })}</strong> · {kindLabel(info.kind)} · {info.biome.stadium}
          </p>
          <div className="hero-actions">
            <Button
              variant="primary"
              size="lg"
              icon={Play}
              disabled={problems.length > 0 || !isUnlocked(game.campaign, phase)}
              onClick={() => {
                setCampaignTab('mapa');
                go('prep');
              }}
            >
              {t('home.prepare', { phase })}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              icon={Swords}
              onClick={() => {
                setCampaignTab('torneio');
                go('campaign');
              }}
            >
              {t('home.survival')}
            </Button>
          </div>
          {problems.length > 0 ? (
            <div className="alert" role="alert">
              <p><strong>{t('home.incompleteLineup')}:</strong> {problems[0]}</p>
              <Button size="sm" variant="primary" onClick={() => go('squad')}>{t('home.fixLineup')}</Button>
            </div>
          ) : null}
        </div>
        <div className="hero-crest" aria-hidden="true">
          <Shield name={game.clubName} colors={identity.colors} size={96} />
        </div>
      </section>

      <Tip topic="home" title="Bem-vindo ao seu Club">
        Monte a escalação, prepare o time e acompanhe as partidas. Vitórias liberam novas fases; derrotas fazem você voltar uma fase, sem perder Squad nem items.
      </Tip>

      <div className="grid-stats" role="list" aria-label={t('res.coins')}>
        <Stat label={t('res.coins')} value={fmt(game.resources.coins)} icon={Coins} hint={`+${fmt(selectors.idleRate(game))}/h`} tone="#ffc23a" />
        <Stat label={t('res.clubXp')} value={level} icon={Medal} hint={`${fmt(game.resources.clubXp)} XP`} tone="#4fc3f7" />
        <Stat label={t('res.tokens')} value={game.resources.tokens} icon={Target} hint={t('home.tokensHint')} tone="#81c784" />
        <Stat label={t('res.fragments')} value={fmt(game.resources.fragments)} icon={Recycle} hint={t('home.fragmentsHint')} tone="#c084fc" />
      </div>

      <div className="grid-2">
        <Panel title={t('home.currentPhase')} eyebrow={t('campaign.title')} id="phase-card" actions={<Pill>{info.biome.name}</Pill>}>
          <p className="muted">
            {info.kind === 'boss'
              ? t('home.bossPhase')
              : info.kind === 'mini'
                ? t('home.miniPhase')
                : info.kind === 'ricochet'
                  ? t('home.ricochetPhase')
                  : t('home.leaguePhase')}
          </p>
          <dl className="kv">
            <div><dt>{t('prep.opponent')} OVR</dt><dd>{info.targetOvr}</dd></div>
            <div><dt>{t('home.winReward')}</dt><dd>{fmt(rewards.coins)} {t('res.coins')} · {rewards.tokens} {t('res.tokens')}</dd></div>
            <div><dt>{t('home.firstWin')}</dt><dd>{won === 0 ? t('home.firstWinAvailable') : t('home.firstWinDone')}</dd></div>
          </dl>
          <Button block icon={ArrowRight} onClick={() => { setCampaignTab('mapa'); go('campaign'); }}>
            Ver mapa da Campaign
          </Button>
        </Panel>

        <Panel title={t('home.yourTeam')} eyebrow={t('squad.title')} id="squad-card" actions={<Button size="sm" variant="ghost" onClick={() => go('squad')}>{t('common.edit')}</Button>}>
          <div className="team-summary">
            <div>
              <p className="stat-label">OVR médio</p>
              <p className="big-number">{ovr || '—'}</p>
            </div>
            <div>
              <p className="stat-label">Formação</p>
              <p className="big-number small">{FORMATIONS[game.lineup.formation as FormationId].label}</p>
            </div>
            <div>
              <p className="stat-label">Tática</p>
              <p className="big-number small">{TACTICS[game.lineup.tactic as TacticId].label}</p>
            </div>
          </div>
          <p className="muted small">
            {plural(game.athletes.length, 'atleta', 'atletas')} no Squad (limite {ECONOMY.rosterCap}).
          </p>
          <ul className="list-plain" aria-label="Destaques do Squad">
            {topAthletes.map((a) => (
              <li key={a.id}>
                <button type="button" className="link-btn" onClick={() => openAthlete(a.id)}>
                  {selectors.athleteName(game, a.id)} · OVR {selectors.athleteOvr(game, a)}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={t('home.idleIncome')} eyebrow="Idle" id="idle-card" actions={<Pill>{t('home.idleCap', { cap })}</Pill>}>
          <p className="big-number">
            {fmt(pending.coins)} <span className="small muted">{t('home.coinsAccumulated')}</span>
          </p>
          <Bar value={pending.cappedHours} max={cap} label="Acúmulo da Idle income" color="var(--gold)" />
          <p className="muted small">
            {pending.elapsedMs > 0 ? `${t('home.accumulating', { duration: formatDuration(pending.elapsedMs) })} ` : ''}
            {t('home.currentRate', { rate: fmt(selectors.idleRate(game)) })} {t('home.idleNeverAdvances')}
          </p>
          <div className="row wrap">
            <Button
              variant="primary"
              icon={Gift}
              disabled={pending.coins <= 0}
              onClick={() => {
                const res = collectIdle();
                if (res.ok && res.data) toast(`+${fmt(res.data.coins)} ${t('res.coins')} e +${res.data.clubXp} XP`, 'success');
                else if (res.error) toast(res.error, 'warning');
              }}
            >
              {t('home.collect')}
            </Button>
            <label className="inline-check">
              <input type="checkbox" checked={game.settings.autoCollect} onChange={(e) => updateSettings({ autoCollect: e.target.checked })} />
              Collect automatically on open
            </label>
          </div>
        </Panel>

        <Panel title={t('home.missionsToday')} eyebrow="Progresso verificável" id="missions-card" actions={<Button size="sm" variant="ghost" onClick={() => go('missions')}>{t('home.viewAll')}</Button>}>
          <ul className="list-plain">
            {game.missions.daily.map((id) => {
              const def = missionById(id);
              if (!def) return null;
              const status = selectors.missionStatus(game, id);
              return (
                <li key={id} className="mission-row">
                  <div className="grow">
                    <strong>{def.title}</strong>
                    <p className="muted small">{def.description}</p>
                    <Bar value={status.progress} max={def.target} label={def.title} />
                  </div>
                  <span className="small">{status.progress}/{def.target}</span>
                </li>
              );
            })}
          </ul>
        </Panel>

        {lastMatch ? (
          <Panel title={t('home.lastMatch')} eyebrow={t('match.result')} id="last-match">
            <div className="match-mini">
              <Shield name={lastMatch.opponentName} colors={identity.colors} size={48} />
              <div>
                <p className="score-big">
                  {lastMatch.score[0]} · {lastMatch.score[1]}
                </p>
                <p className="muted small">
                  {lastMatch.opponentName} · {outcomeLabel(lastMatch.outcome)} · {clock(lastMatch.at)}
                </p>
              </div>
            </div>
            <Button variant="secondary" icon={Activity} onClick={() => go('match')}>
              {t('home.viewReport')}
            </Button>
          </Panel>
        ) : null}

        <Panel title={t('home.shortcuts')} eyebrow={t('club.title')} id="shortcuts">
          <div className="shortcut-grid">
            <Button icon={Gift} onClick={() => go('chests')}>{t('nav.chests')}</Button>
            <Button icon={Wrench} onClick={() => go('club')}>{t('club.upgrades')}</Button>
            <Button icon={Trophy} onClick={() => go('missions')}>{t('missions.achievements')}</Button>
            <Button icon={BarChart3} onClick={() => go('stats')}>{t('nav.stats')}</Button>
          </div>
          <p className="muted small">{t('home.inventoryLimit', { cap: selectors.inventoryCap(game) })}</p>
        </Panel>
      </div>
    </div>
  );
}
