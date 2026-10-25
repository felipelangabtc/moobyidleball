import { useState } from 'react';
import { Crown, Flame, Lock, Shield as ShieldIcon, Swords, Target, Trophy, Zap } from 'lucide-react';
import { useGame } from '../state/store';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Bar, Button, EmptyState, Panel, Pill, Tabs, Tip } from '../ui/common';
import { fmt, plural } from '../ui/theme';
import {
  EMPTY_SEASON,
  SEASON_GOALS,
  isUnlocked,
  kindLabel,
  opponentOvrFor,
  phaseInfo,
  phaseRewards,
  seasonGoalProgress,
  seasonLabel,
  timesWon,
  type CampaignState,
  type PhaseKind,
} from '../domain/campaign';
import { CAMPAIGN, CHALLENGE, PITY } from '../domain/balance';
import { lineupProblems } from '../state/matchFlow';
import { ChestArt } from '../ui/art';
import { CHEST_NAME_PT } from '../domain/labels';
import { biomeChestFor } from '../state/clubIdentity';

const KIND_ICON: Record<PhaseKind, typeof Trophy> = {
  normal: ShieldIcon,
  mini: Flame,
  boss: Crown,
  ricochet: Zap,
};

export function Campaign() {
  const tab = useNav((s) => s.campaignTab);
  const setTab = useNav((s) => s.setCampaignTab);
  const t = useT();
  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{t('campaign.title')}</p>
          <h1>{t('campaign.map')}</h1>
        </div>
      </header>
      <Tabs
        label="Campaign modes"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'mapa', label: 'Mapa de Phases', icon: Trophy },
          { id: 'torneio', label: 'Tournament de sobrevivência', icon: Swords },
        ]}
      />
      {tab === 'mapa' ? <CampaignMap /> : <Survival />}
    </div>
  );
}

function CampaignMap() {
  const game = useGame((s) => s.game);
  const setActivePhase = useGame((s) => s.setActivePhase);
  const toast = useGame((s) => s.toast);
  const go = useNav((s) => s.go);
  const setCampaignTab = useNav((s) => s.setCampaignTab);
  const [selected, setSelected] = useState<number>(game.campaign.activePhase);

  const campaign: CampaignState = game.campaign;
  const visibleTo = campaign.highestCleared + 3;
  const phases = Array.from({ length: Math.max(visibleTo, 4) }, (_, i) => i + 1);
  const info = phaseInfo(selected);
  const unlocked = isUnlocked(campaign, selected);
  const won = timesWon(campaign, selected);
  const winRewards = phaseRewards(info, 'win', won);
  const drawRewards = phaseRewards(info, 'draw', won);
  const lossRewards = phaseRewards(info, 'loss', won);
  const problems = lineupProblems(game);
  const seasonIndex = info.seasonIndex;
  const seasonKey = String(seasonIndex);
  const progress = game.seasons[seasonKey] ?? EMPTY_SEASON;

  return (
    <div className="campaign-layout">
      <Tip topic="campaign" title="Como funciona o mapa">
        Vitórias liberam a próxima Phase. Draws não avançam nas partidas de liga. Defeats voltam uma Phase, mas nunca abaixo da primeira. Revanches pagam menos a cada vitória repetida, para evitar farm infinito.
      </Tip>

      <Panel title="Path" eyebrow="Phases" id="path" className="path-panel">
        <ol className="path" aria-label="Phases da Campaign">
          {phases.map((n) => {
            const pInfo = phaseInfo(n);
            const open = isUnlocked(campaign, n);
            const cleared = (campaign.wins[String(n)] ?? 0) > 0;
            const Icon = KIND_ICON[pInfo.kind];
            const isActive = campaign.activePhase === n;
            const newSeason = n > 1 && (n - 1) % CAMPAIGN.phasesPerBiome === 0;
            return (
              <li key={n} className={`path-item ${open ? '' : 'is-locked'} ${isActive ? 'is-active' : ''}`}>
                {newSeason ? <p className="season-divider">{seasonLabel(pInfo.seasonIndex)}</p> : null}
                <button
                  type="button"
                  className={`node node-${pInfo.kind} ${cleared ? 'is-cleared' : ''}`}
                  disabled={!open}
                  aria-pressed={selected === n}
                  aria-label={open ? `Phase ${n}, ${kindLabel(pInfo.kind)}${cleared ? ', Cleared' : ''}` : `Phase ${n} Locked`}
                  onClick={() => setSelected(n)}
                >
                  {open ? <Icon aria-hidden="true" size={18} /> : <Lock aria-hidden="true" size={16} />}
                  <span className="node-num">{n}</span>
                  {cleared ? <span className="node-check" aria-hidden="true">✓</span> : null}
                </button>
                <span className="node-label">{open ? kindLabel(pInfo.kind) : 'Locked'}</span>
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel title={`Phase ${selected}`} eyebrow={info.biome.name} id="phase-detail" actions={<Pill>{kindLabel(info.kind)}</Pill>}>
        {!unlocked ? (
          <EmptyState title="Phase Locked" icon={Lock}>
            Vença a Phase {campaign.highestCleared + 1} to unlock this.
          </EmptyState>
        ) : (
          <>
            <p className="muted">{info.biome.subtitle} · {info.biome.stadium}</p>
            <dl className="kv">
              <div><dt>OVR do adversário</dt><dd>{info.targetOvr}</dd></div>
              <div><dt>Rule</dt><dd>{info.requiresWinner ? 'Vitória obrigatória (prorrogação e pênaltis)' : 'Draw permitido (sem avanço)'}</dd></div>
              <div><dt>Arena</dt><dd>{info.arena === 'ricochet' ? 'Ricochet plates' : 'Traditional field'}</dd></div>
              <div><dt>Vezes Cleared</dt><dd>{won}</dd></div>
            </dl>
            <h3 className="section-title">Possíveis Rewards</h3>
            <ul className="list-plain">
              <li>Vitória: {fmt(winRewards.coins)} Coins · {fmt(winRewards.clubXp)} XP · {winRewards.tokens} tokens · {winRewards.fragments} Fragments{winRewards.firstWin ? ' · baú na primeira vitória' : ''}</li>
              {!info.requiresWinner ? <li>Draw: {fmt(drawRewards.coins)} Coins (sem avanço)</li> : null}
              <li>Defeat: {fmt(lossRewards.coins)} Coins de consolação · go back one phase</li>
            </ul>
            {info.kind === 'boss' ? <p className="muted small">Boss: vencê-lo conclui a temporada {info.season} e libera o próximo bioma.</p> : null}
            <p className="muted small">{winRewards.description}</p>
            <div className="row wrap">
              <Button
                variant="primary"
                icon={Swords}
                disabled={problems.length > 0}
                onClick={() => {
                  const res = setActivePhase(selected);
                  if (!res.ok) return toast(res.error ?? 'Não foi possível escolher a Phase.', 'warning');
                  setCampaignTab('mapa');
                  go('prep');
                }}
              >
                Prepare match
              </Button>
              <Button variant="ghost" onClick={() => setActivePhase(selected)} disabled={campaign.activePhase === selected}>
                Set as active phase
              </Button>
            </div>
            {problems.length > 0 ? <p className="muted small">Ajuste a escalação para jogar: {problems[0]}</p> : null}
          </>
        )}
      </Panel>

      <Panel title="Season goals" eyebrow={seasonLabel(seasonIndex)} id="season-goals">
        <ul className="list-plain goals">
          {SEASON_GOALS.map((goal) => {
            const value = seasonGoalProgress(progress, goal);
            const done = progress.claimed.includes(goal.id);
            return (
              <li key={goal.id}>
                <div className="grow">
                  <strong>{goal.title}</strong> {done ? <Pill color="var(--ok)">concluída</Pill> : null}
                  <Bar value={Math.min(value, goal.target)} max={goal.target} label={goal.title} />
                  <p className="muted small">
                    {Math.min(value, goal.target)}/{goal.target} · recompensa: {fmt(goal.reward.coins)} Coins
                    {goal.reward.chest ? ` + ${CHEST_NAME_PT[biomeChestFor(seasonIndex)]}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="muted small">When completing the season, o próximo bioma abre novas Phases, com novo visual e adversários mais fortes. Seu Squad é mantido.</p>
      </Panel>

      <Panel title="Bosss e eventos" eyebrow="Rules especiais" id="special">
        <ul className="list-plain">
          <li><Crown aria-hidden="true" size={16} /> Boss a cada {CAMPAIGN.bossEvery} Phases: vitória obrigatória, high difficulty, recompensa de baú maior.</li>
          <li><Flame aria-hidden="true" size={16} /> Mini-Boss a cada {CAMPAIGN.miniEvery} Phases: vitória obrigatória, recompensa intermediária.</li>
          <li><Zap aria-hidden="true" size={16} /> Ricochet Arena every {CAMPAIGN.ricochetEvery} Phases: chutes são calculados com física de ricochete.</li>
          <li><Target aria-hidden="true" size={16} /> Pity: após {PITY.epicAfter} sorteios sem épico, o próximo é garantido (em baús).</li>
        </ul>
      </Panel>
    </div>
  );
}

function Survival() {
  const game = useGame((s) => s.game);
  const start = useGame((s) => s.startChallenge);
  const stop = useGame((s) => s.stopChallenge);
  const playMatch = useGame((s) => s.startMatch);
  const toast = useGame((s) => s.toast);
  const problems = lineupProblems(game);
  const nextWave = game.challenge.wave + 1;
  const nextOvr = opponentOvrFor(nextWave + 6, 'normal');
  const nextCoins = Math.min(CHALLENGE.coinsBase + CHALLENGE.coinsPerWave * nextWave, Math.max(0, CHALLENGE.coinsDailyCap - game.missions.challengeCoinsToday));
  const milestones = [5, 10, 15, 20, 25, 30];

  return (
    <div className="stack">
      <Tip topic="challenge" title="Tournament de sobrevivência">
        Enfrente Waves de adversários cada vez mais fortes. Uma Defeat encerra a sequência, mas seu Best record fica salvo. Milestones a cada {CHALLENGE.milestoneEvery} Waves rendem baús.
      </Tip>
      <div className="grid-2">
        <Panel title="Sua sequência" eyebrow="torneio" id="survival-status">
          <dl className="kv">
            <div><dt>Wave atual</dt><dd>{game.challenge.wave}</dd></div>
            <div><dt>Best record</dt><dd>{game.records.bestWave}</dd></div>
            <div><dt>Próxima Wave</dt><dd>OVR {nextOvr}</dd></div>
            <div><dt>Coins da Wave</dt><dd>{fmt(nextCoins)} (limite diário: {fmt(CHALLENGE.coinsDailyCap)})</dd></div>
          </dl>
          <div className="row wrap">
            {!game.challenge.active ? (
              <Button
                variant="primary"
                icon={Swords}
                onClick={() => {
                  start();
                  toast('Tournament iniciado. Boa sorte!', 'success');
                }}
              >
                Iniciar Tournament
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  icon={Swords}
                  disabled={problems.length > 0}
                  onClick={() => {
                    const res = playMatch({ kind: 'challenge' });
                    if (!res.ok) toast(res.error ?? 'Não foi possível iniciar a Wave.', 'warning');
                    else useNav.getState().go('match');
                  }}
                >
                  Jogar Wave {nextWave}
                </Button>
                <Button variant="ghost" onClick={() => stop()}>Encerrar Tournament</Button>
              </>
            )}
          </div>
          {problems.length > 0 ? <p className="muted small">Escalação: {problems[0]}</p> : null}
        </Panel>
        <Panel title="Milestones" eyebrow="Rewards" id="milestones">
          <ul className="list-plain">
            {milestones.map((m) => {
              const done = game.challenge.milestones.includes(m);
              return (
                <li key={m} className="row">
                  <ChestArt kind={m >= 20 ? 'ouro' : m >= 10 ? 'estadio' : 'escola'} size={36} />
                  <span className="grow">Wave {m}</span>
                  {done ? <Pill color="var(--ok)">conquered</Pill> : <Pill>pending</Pill>}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
      {game.challenge.wave === 0 && game.challenge.best > 0 ? (
        <EmptyState title="A sequência acabou" icon={Target}>
          Your best record was wave {game.records.bestWave}. Inicie um novo Tournament quando quiser tentar de novo.
        </EmptyState>
      ) : null}
      <p className="muted small">{plural(game.challenge.milestones.length, 'milestone conquered', 'Milestones conquereds')}.</p>
    </div>
  );
}
