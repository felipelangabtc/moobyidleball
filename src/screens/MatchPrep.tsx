import { useMemo } from 'react';
import { ArrowLeft, Play, Users, Zap } from 'lucide-react';
import { useGame } from '../state/store';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Bar, Button, Panel, Tip } from '../ui/common';
import { Shield } from '../ui/art';
import { fmt } from '../ui/theme';
import { kindLabel, phaseInfo, phaseRewards, timesWon, isUnlocked } from '../domain/campaign';
import { buildHomeTeam, lineupProblems, planMatch } from '../state/matchFlow';
import { estimateOutcome } from '../sim/estimate';
import { clubTeamIdentity } from '../state/clubIdentity';
import { FORMATIONS, TACTICS, type TacticId, TACTIC_IDS } from '../domain/football';
import { squadOvr } from '../state/store';
import { CHEST_NAME_PT } from '../domain/labels';
import { biomeChestFor } from '../state/clubIdentity';
import { FORMATION_IDS } from '../domain/types';
import { opponentToMatchTeam } from '../domain/squad';

export function MatchPrep() {
  const t = useT();
  const game = useGame((s) => s.game);
  const start = useGame((s) => s.startMatch);
  const setTactic = useGame((s) => s.setTactic);
  const setFormation = useGame((s) => s.setFormation);
  const toast = useGame((s) => s.toast);
  const go = useNav((s) => s.go);

  const phase = game.campaign.activePhase;
  const info = phaseInfo(phase);
  const won = timesWon(game.campaign, phase);
  const plan = useMemo(() => planMatch(game, { kind: 'campaign', phase }), [game, phase]);
  const problems = lineupProblems(game);
  const identity = clubTeamIdentity(game.clubName);

  const estimate = useMemo(() => {
    const home = buildHomeTeam(game);
    const away = opponentToMatchTeam(plan.opponent);
    return estimateOutcome(home, away, plan.options, 120, plan.seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.lineup, game.athletes, game.items, game.equipped, game.upgrades.medical, game.upgrades.stadium, phase, plan.seed]);

  const rewards = {
    win: phaseRewards(info, 'win', won),
    draw: phaseRewards(info, 'draw', won),
    loss: phaseRewards(info, 'loss', won),
  };
  const ourOvr = squadOvr(game);
  const unlocked = isUnlocked(game.campaign, phase);
  const seasonChest = biomeChestFor(info.seasonIndex);

  if (!unlocked) {
    return (
      <div className="screen">
        <p>Esta fase ainda está bloqueada.</p>
        <Button onClick={() => go('campaign')}>Voltar ao mapa</Button>
      </div>
    );
  }

  return (
    <div className="screen screen-prep">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{info.biome.name} · {t('prep.title')}</p>
          <h1>{t('prep.title')}</h1>
        </div>
        <Button variant="ghost" icon={ArrowLeft} onClick={() => go('campaign')}>Voltar ao mapa</Button>
      </header>

      <Tip topic="match" title="Antes do apito">
        Você não controla os lances: o time joga sozinho. Suas decisões são a escalação, a formação, a tática e o capitão. A prévia de vitória é calculada simulando esta mesma partida várias vezes.
      </Tip>

      <div className="grid-2 prep-grid">
        <Panel title="Adversário" eyebrow={kindLabel(info.kind)} id="opponent">
          <div className="opponent-head">
            <Shield name={plan.opponent.name} colors={plan.opponent.colors} size={64} />
            <div>
              <p className="opponent-name">{plan.opponent.name}</p>
              <p className="muted small">
                {FORMATIONS[plan.opponent.formation].label} · {TACTICS[plan.opponent.tactic].label}
              </p>
              <p className="muted small">OVR estimado: <strong>{info.targetOvr}</strong></p>
            </div>
          </div>
          <dl className="kv">
            <div><dt>Regra</dt><dd>{info.requiresWinner ? 'Vitória obrigatória (prorrogação e pênaltis)' : 'Empate permitido'}</dd></div>
            <div><dt>Arena</dt><dd>{plan.arena === 'ricochet' ? 'Estádio de placas (física de ricochete nos chutes)' : 'Campo tradicional'}</dd></div>
            <div><dt>Seu OVR médio</dt><dd>{ourOvr || '—'}</dd></div>
          </dl>
        </Panel>

        <Panel title="Prévia de Result" eyebrow="Simulação de 120 partidas" id="estimate">
          <p className="muted small">Quanto mais forte o Your team, maior a chance de vitória. Esta é uma estimativa: cada partida real tem variações.</p>
          <div className="estimate" role="group" aria-label="Chances estimadas">
            <EstimateRow label="Vitória" value={estimate.win} color="var(--ok)" />
            {!info.requiresWinner ? <EstimateRow label="Empate" value={estimate.draw} color="var(--gold)" /> : null}
            <EstimateRow label="Derrota" value={estimate.loss} color="var(--danger)" />
          </div>
          <p className="muted small">Gols médios: {estimate.averageGoalsFor.toLocaleString('pt-BR')} marcados · {estimate.averageGoalsAgainst.toLocaleString('pt-BR')} sofridos.</p>
        </Panel>

        <Panel title="Sua tática" eyebrow="Decisões antes da partida" id="tactic">
          <div className="form-grid">
            <label className="field">
              <span>Formação</span>
              <select value={game.lineup.formation} onChange={(e) => setFormation(e.target.value as (typeof FORMATION_IDS)[number])}>
                {FORMATION_IDS.map((f) => (
                  <option key={f} value={f}>{FORMATIONS[f].label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tática</span>
              <select value={game.lineup.tactic} onChange={(e) => setTactic(e.target.value as TacticId)}>
                {TACTIC_IDS.map((t: TacticId) => (
                  <option key={t} value={t}>{TACTICS[t].label}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">{FORMATIONS[game.lineup.formation].description}</p>
          <p className="muted small">{TACTICS[game.lineup.tactic].description}</p>
          <Button icon={Users} variant="secondary" onClick={() => go('squad')}>Editar escalação e capitão</Button>
        </Panel>

        <Panel title="Recompensas" eyebrow="Previsão" id="prep-rewards">
          <ul className="list-plain">
            <li><strong>Vitória:</strong> {fmt(rewards.win.coins)} Coins · {fmt(rewards.win.clubXp)} XP · {rewards.win.tokens} fichas · {rewards.win.fragments} Fragments</li>
            {!info.requiresWinner ? <li><strong>Empate:</strong> {fmt(rewards.draw.coins)} Coins (sem avanço)</li> : null}
            <li><strong>Derrota:</strong> {fmt(rewards.loss.coins)} Coins de consolação · volta uma fase</li>
          </ul>
          {won === 0 ? (
            <p className="alert-soft">Primeira vitória nesta fase: inclui {CHEST_NAME_PT[rewards.win.chest ?? seasonChest]}.</p>
          ) : (
            <p className="muted small">Vitórias repetidas rendem {Math.round(rewards.win.repeatFactor * 100)}% da recompensa cheia.</p>
          )}
        </Panel>
      </div>

      {problems.length > 0 ? (
        <div className="alert" role="alert">
          <p><strong>Não é possível começar:</strong></p>
          <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          <Button variant="primary" onClick={() => go('squad')}>Corrigir escalação</Button>
        </div>
      ) : null}

      <div className="prep-actions">
        <Bar value={estimate.win} label="Chance de vitória" color="var(--ok)" />
        <Button
          size="lg"
          variant="primary"
          icon={Play}
          disabled={problems.length > 0}
          onClick={() => {
            const res = start({ kind: 'campaign', phase });
            if (!res.ok) {
              toast(res.error ?? 'Não foi possível iniciar a partida.', 'error');
              return;
            }
            go('match');
          }}
        >
          Iniciar partida
        </Button>
        <p className="muted small">
          <Zap aria-hidden="true" size={14} /> A partida é resolvida automaticamente. Você pode acelerar, pular ou ver o relatório depois.
        </p>
      </div>
      <p className="muted small">Club: {game.clubName} ({identity.mascot}) · {game.athletes.length} atletas no Squad</p>
    </div>
  );
}

function EstimateRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="estimate-row">
      <span>{label}</span>
      <Bar value={value} label={`${label}: ${value}%`} color={color} />
      <strong>{value}%</strong>
    </div>
  );
}
