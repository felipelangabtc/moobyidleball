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
        label="Modos de Campaign"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'mapa', label: 'Mapa de fases', icon: Trophy },
          { id: 'torneio', label: 'Torneio de sobrevivência', icon: Swords },
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
        Vitórias liberam a próxima fase. Empates não avançam nas partidas de liga. Derrotas voltam uma fase, mas nunca abaixo da primeira. Revanches pagam menos a cada vitória repetida, para evitar farm infinito.
      </Tip>

      <Panel title="Caminho" eyebrow="Fases" id="path" className="path-panel">
        <ol className="path" aria-label="Fases da Campaign">
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
                  aria-label={open ? `Fase ${n}, ${kindLabel(pInfo.kind)}${cleared ? ', vencida' : ''}` : `Fase ${n} bloqueada`}
                  onClick={() => setSelected(n)}
                >
                  {open ? <Icon aria-hidden="true" size={18} /> : <Lock aria-hidden="true" size={16} />}
                  <span className="node-num">{n}</span>
                  {cleared ? <span className="node-check" aria-hidden="true">✓</span> : null}
                </button>
                <span className="node-label">{open ? kindLabel(pInfo.kind) : 'Bloqueada'}</span>
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel title={`Fase ${selected}`} eyebrow={info.biome.name} id="phase-detail" actions={<Pill>{kindLabel(info.kind)}</Pill>}>
        {!unlocked ? (
          <EmptyState title="Fase bloqueada" icon={Lock}>
            Vença a fase {campaign.highestCleared + 1} para desbloquear esta.
          </EmptyState>
        ) : (
          <>
            <p className="muted">{info.biome.subtitle} · {info.biome.stadium}</p>
            <dl className="kv">
              <div><dt>OVR do adversário</dt><dd>{info.targetOvr}</dd></div>
              <div><dt>Regra</dt><dd>{info.requiresWinner ? 'Vitória obrigatória (prorrogação e pênaltis)' : 'Empate permitido (sem avanço)'}</dd></div>
              <div><dt>Arena</dt><dd>{info.arena === 'ricochet' ? 'Placas de ricochete' : 'Campo tradicional'}</dd></div>
              <div><dt>Vezes vencida</dt><dd>{won}</dd></div>
            </dl>
            <h3 className="section-title">Possíveis recompensas</h3>
            <ul className="list-plain">
              <li>Vitória: {fmt(winRewards.coins)} Coins · {fmt(winRewards.clubXp)} XP · {winRewards.tokens} fichas · {winRewards.fragments} Fragments{winRewards.firstWin ? ' · baú na primeira vitória' : ''}</li>
              {!info.requiresWinner ? <li>Empate: {fmt(drawRewards.coins)} Coins (sem avanço)</li> : null}
              <li>Derrota: {fmt(lossRewards.coins)} Coins de consolação · volta uma fase</li>
            </ul>
            {info.kind === 'boss' ? <p className="muted small">Chefe: vencê-lo conclui a temporada {info.season} e libera o próximo bioma.</p> : null}
            <p className="muted small">{winRewards.description}</p>
            <div className="row wrap">
              <Button
                variant="primary"
                icon={Swords}
                disabled={problems.length > 0}
                onClick={() => {
                  const res = setActivePhase(selected);
                  if (!res.ok) return toast(res.error ?? 'Não foi possível escolher a fase.', 'warning');
                  setCampaignTab('mapa');
                  go('prep');
                }}
              >
                Preparar partida
              </Button>
              <Button variant="ghost" onClick={() => setActivePhase(selected)} disabled={campaign.activePhase === selected}>
                Definir como fase ativa
              </Button>
            </div>
            {problems.length > 0 ? <p className="muted small">Ajuste a escalação para jogar: {problems[0]}</p> : null}
          </>
        )}
      </Panel>

      <Panel title="Metas da temporada" eyebrow={seasonLabel(seasonIndex)} id="season-goals">
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
        <p className="muted small">Ao concluir a temporada, o próximo bioma abre novas fases, com novo visual e adversários mais fortes. Seu Squad é mantido.</p>
      </Panel>

      <Panel title="Chefes e eventos" eyebrow="Regras especiais" id="special">
        <ul className="list-plain">
          <li><Crown aria-hidden="true" size={16} /> Chefe a cada {CAMPAIGN.bossEvery} fases: vitória obrigatória, dificuldade alta, recompensa de baú maior.</li>
          <li><Flame aria-hidden="true" size={16} /> Mini-chefe a cada {CAMPAIGN.miniEvery} fases: vitória obrigatória, recompensa intermediária.</li>
          <li><Zap aria-hidden="true" size={16} /> Arena de placas a cada {CAMPAIGN.ricochetEvery} fases: chutes são calculados com física de ricochete.</li>
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
      <Tip topic="challenge" title="Torneio de sobrevivência">
        Enfrente ondas de adversários cada vez mais fortes. Uma derrota encerra a sequência, mas seu melhor recorde fica salvo. Marcos a cada {CHALLENGE.milestoneEvery} ondas rendem baús.
      </Tip>
      <div className="grid-2">
        <Panel title="Sua sequência" eyebrow="Torneio" id="survival-status">
          <dl className="kv">
            <div><dt>Onda atual</dt><dd>{game.challenge.wave}</dd></div>
            <div><dt>Melhor recorde</dt><dd>{game.records.bestWave}</dd></div>
            <div><dt>Próxima onda</dt><dd>OVR {nextOvr}</dd></div>
            <div><dt>Coins da onda</dt><dd>{fmt(nextCoins)} (limite diário: {fmt(CHALLENGE.coinsDailyCap)})</dd></div>
          </dl>
          <div className="row wrap">
            {!game.challenge.active ? (
              <Button
                variant="primary"
                icon={Swords}
                onClick={() => {
                  start();
                  toast('Torneio iniciado. Boa sorte!', 'success');
                }}
              >
                Iniciar torneio
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  icon={Swords}
                  disabled={problems.length > 0}
                  onClick={() => {
                    const res = playMatch({ kind: 'challenge' });
                    if (!res.ok) toast(res.error ?? 'Não foi possível iniciar a onda.', 'warning');
                    else useNav.getState().go('match');
                  }}
                >
                  Jogar onda {nextWave}
                </Button>
                <Button variant="ghost" onClick={() => stop()}>Encerrar torneio</Button>
              </>
            )}
          </div>
          {problems.length > 0 ? <p className="muted small">Escalação: {problems[0]}</p> : null}
        </Panel>
        <Panel title="Marcos" eyebrow="Recompensas" id="milestones">
          <ul className="list-plain">
            {milestones.map((m) => {
              const done = game.challenge.milestones.includes(m);
              return (
                <li key={m} className="row">
                  <ChestArt kind={m >= 20 ? 'ouro' : m >= 10 ? 'estadio' : 'escola'} size={36} />
                  <span className="grow">Onda {m}</span>
                  {done ? <Pill color="var(--ok)">conquistado</Pill> : <Pill>pendente</Pill>}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
      {game.challenge.wave === 0 && game.challenge.best > 0 ? (
        <EmptyState title="A sequência acabou" icon={Target}>
          Seu melhor recorde foi onda {game.records.bestWave}. Inicie um novo torneio quando quiser tentar de novo.
        </EmptyState>
      ) : null}
      <p className="muted small">{plural(game.challenge.milestones.length, 'marco conquistado', 'marcos conquistados')}.</p>
    </div>
  );
}
