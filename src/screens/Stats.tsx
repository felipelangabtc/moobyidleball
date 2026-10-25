import { BarChart3, Coins, History, Trophy } from 'lucide-react';
import { useGame, outcomeLabel } from '../state/store';
import { useT } from '../i18n';
import { Panel, Stat, Tip } from '../ui/common';
import { clock, fmt } from '../ui/theme';
import { seasonLabel, SEASON_GOALS, seasonGoalProgress, EMPTY_SEASON, phaseInfo } from '../domain/campaign';
import { clubLevelFor } from '../domain/economy';
import { CAMPAIGN } from '../domain/balance';

export function Stats() {
  const t = useT();
  const game = useGame((s) => s.game);
  const c = game.counters;
  const level = clubLevelFor(game.resources.clubXp);
  const info = phaseInfo(game.campaign.activePhase);
  const seasonProgress = game.seasons[String(info.seasonIndex)] ?? EMPTY_SEASON;
  const cleared = Object.keys(game.campaign.wins).length;
  const winRate = c.matches > 0 ? Math.round((c.wins / c.matches) * 100) : 0;

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{t('stats.title')}</p>
          <h1>{t('stats.title')}</h1>
        </div>
      </header>
      <Tip topic="stats" title="Seu histórico">
        Números vitalícios do Club. O histórico mostra as últimas partidas; a Campaign e o Tournament têm metas próprias por temporada.
      </Tip>

      <div className="grid-stats">
        <Stat label="Partidas" value={fmt(c.matches)} hint={`${c.wins}V · ${c.draws}E · ${c.losses}D (${winRate}% de vitórias)`} icon={Trophy} />
        <Stat label="Gols" value={`${fmt(c.goals)} x ${fmt(c.goalsConceded)}`} hint="Marcados x sofridos" icon={BarChart3} />
        <Stat label="Jogos sem sofrer gol" value={fmt(c.cleanSheets)} hint={`${c.saves} defesas de goleiro`} />
        <Stat label="Coins ganhas" value={fmt(c.coinsEarned)} icon={Coins} hint={`Idle: ${fmt(game.idle.totalCollected)}`} />
        <Stat label="Club" value={`Nível ${level}`} hint={`${fmt(game.resources.clubXp)} XP`} />
        <Stat label="Baús abertos" value={fmt(c.chests)} hint={`${c.legendPulls} lendário(s) · ${c.mythicPulls} mítico(s)`} />
        <Stat label="Atletas obtidos" value={fmt(c.athletes)} hint={`Squad atual: ${game.athletes.length}`} />
        <Stat label="Melhor Wave" value={game.records.bestWave} hint="Tournament de sobrevivência" />
      </div>

      <div className="grid-2">
        <Panel title="Campaign" eyebrow={seasonLabel(info.seasonIndex)} id="campaign-stats">
          <dl className="kv">
            <div><dt>Phase ativa</dt><dd>{game.campaign.activePhase}</dd></div>
            <div><dt>Maior Phase Cleared</dt><dd>{game.campaign.highestCleared}</dd></div>
            <div><dt>Phases com alguma vitória</dt><dd>{cleared}</dd></div>
            <div><dt>Bosss vencidos</dt><dd>{c.bosses}</dd></div>
          </dl>
          <h3 className="section-title">Metas desta temporada</h3>
          <ul className="list-plain small">
            {SEASON_GOALS.map((g) => (
              <li key={g.id}>{g.title}: {Math.min(seasonGoalProgress(seasonProgress, g), g.target)}/{g.target} {seasonProgress.claimed.includes(g.id) ? '✓' : ''}</li>
            ))}
          </ul>
          <p className="muted small">Mini-Bosss a cada {CAMPAIGN.miniEvery} Phases; Bosss a cada {CAMPAIGN.bossEvery}.</p>
        </Panel>

        <Panel title="Histórico recente" eyebrow="Últimas partidas" id="history" actions={<History aria-hidden="true" size={18} />}>
          {game.history.length === 0 ? (
            <p className="muted small">Nenhuma partida ainda. Sua primeira vitória está a um apito de distância.</p>
          ) : (
            <ol className="history">
              {game.history.slice(0, 30).map((h) => (
                <li key={h.id} className={`history-item is-${h.outcome}`}>
                  <span className="history-score">{h.score[0]} x {h.score[1]}{h.shootout ? ` (${h.shootout[0]}-${h.shootout[1]} pên.)` : ''}</span>
                  <span className="grow">
                    <strong>{h.opponentName}</strong>
                    <span className="muted small"> · {h.label} · {clock(h.at)}</span>
                  </span>
                  <span className="small">{outcomeLabel(h.outcome)} · +{fmt(h.coins)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
