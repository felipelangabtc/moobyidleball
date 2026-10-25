import { CheckCircle2, Gift, Lock, Trophy } from 'lucide-react';
import { useGame, selectors } from '../state/store';
import { useT } from '../i18n';
import { Bar, Button, Panel, Pill, Tip } from '../ui/common';
import { ACHIEVEMENTS, DAILY_MISSIONS, WEEKLY_MISSIONS, type MissionDef } from '../data/goals';
import { achievementProgress } from '../domain/progress';
import { fmt, dateLabel } from '../ui/theme';
import { missionById } from '../domain/progress';

export function Missions() {
  const t = useT();
  const game = useGame((s) => s.game);
  const claim = useGame((s) => s.claimMission);
  const toast = useGame((s) => s.toast);
  const counts = selectors.achievementCount(game);
  const records = { bestWave: game.records.bestWave, maxStars: game.records.maxStars, maxLevel: game.records.maxLevel };

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{t('missions.title')}</p>
          <h1>{t('missions.title')}</h1>
        </div>
        <Pill>{counts.unlocked}/{counts.total} Achievements</Pill>
      </header>

      <Tip topic="missions" title="Missões e Achievements">
        Missões diárias e semanais acompanham ações reais (partidas, gols, baús). Achievements são permanentes. Rewards são coletadas manualmente, sem espera.
      </Tip>

      <div className="grid-2">
        <MissionPanel title="Diárias" eyebrow={`Renovam em ${dateLabel(new Date(game.missions.dayKey + 'T00:00:00').getTime() + 86_400_000)}`} ids={game.missions.daily} defs={DAILY_MISSIONS} onClaim={(id) => {
          const res = claim(id);
          if (!res.ok) toast(res.error ?? 'Não foi possível coletar.', 'warning');
        }} />
        <MissionPanel title="Semanais" eyebrow="Renovam na segunda-feira" ids={game.missions.weekly} defs={WEEKLY_MISSIONS} onClaim={(id) => {
          const res = claim(id);
          if (!res.ok) toast(res.error ?? 'Não foi possível coletar.', 'warning');
        }} />
      </div>

      <Panel title="Achievements" eyebrow="Permanentes" id="achievements">
        <ul className="achievement-grid">
          {ACHIEVEMENTS.map((a) => {
            const unlockedAt = game.achievements[a.id];
            const value = achievementProgress(a, game.counters, records);
            const target = 'target' in a.condition ? a.condition.target : 1;
            return (
              <li key={a.id} className={`achievement ${unlockedAt ? 'is-unlocked' : ''}`}>
                <span className="achievement-icon" aria-hidden="true">
                  {unlockedAt ? <CheckCircle2 size={22} /> : <Lock size={18} />}
                </span>
                <div className="grow">
                  <p className="strong">{a.title}</p>
                  <p className="muted small">{a.description}</p>
                  <Bar value={value} max={target} label={a.title} color={unlockedAt ? 'var(--ok)' : 'var(--accent)'} />
                  <p className="small">
                    {unlockedAt ? `DesLocked em ${dateLabel(unlockedAt)}` : `${value}/${target}`} · recompensa {fmt(a.reward)} Coins
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
      <p className="muted small"><Trophy aria-hidden="true" size={12} /> Rewards de Achievements são creditadas automaticamente no momento em que são desLockeds.</p>
    </div>
  );
}

function MissionPanel({ title, eyebrow, ids, defs, onClaim }: { title: string; eyebrow: string; ids: string[]; defs: readonly MissionDef[]; onClaim: (id: string) => void }) {
  const game = useGame((s) => s.game);
  return (
    <Panel title={title} eyebrow={eyebrow} id={`missions-${title}`}>
      <ul className="mission-list">
        {ids.map((id) => {
          const def = missionById(id) ?? defs.find((d) => d.id === id);
          if (!def) return null;
          const status = selectors.missionStatus(game, id);
          const rewardText = [
            def.reward.coins ? `${fmt(def.reward.coins)} Coins` : null,
            def.reward.tokens ? `${def.reward.tokens} tokens` : null,
            def.reward.fragments ? `${def.reward.fragments} Fragments` : null,
            def.reward.clubXp ? `${def.reward.clubXp} XP` : null,
          ].filter(Boolean).join(' · ');
          return (
            <li key={id} className="mission-item">
              <div className="grow">
                <p className="strong">{def.title}</p>
                <p className="muted small">{def.description}</p>
                <Bar value={status.progress} max={def.target} label={def.title} color={status.done ? 'var(--ok)' : 'var(--accent)'} />
                <p className="small">{status.progress}/{def.target} · recompensa: {rewardText}</p>
              </div>
              {status.claimed ? (
                <Pill color="var(--ok)">Coletada</Pill>
              ) : (
                <Button size="sm" variant={status.done ? 'primary' : 'ghost'} icon={Gift} disabled={!status.done} onClick={() => onClaim(id)}>
                  Coletar
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
