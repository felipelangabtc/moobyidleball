import { useState } from 'react';
import { Swords, Trophy, Gem, Play, AlertTriangle } from 'lucide-react';
import { useGame } from '../state/store';
import { Button, EmptyState, Panel, Tabs, Tip } from '../ui/common';
import { fmt } from '../ui/theme';
import { generateOpponent, opponentToMatchTeam } from '../domain/squad';
import { simulateMatch } from '../sim/engine';
import { buildHomeTeam, lineupProblems } from '../state/matchFlow';
import type { MatchReport } from '../domain/types';

type Mode = 'friendly' | 'gems';

export function Online() {
  const [mode, setMode] = useState<Mode>('friendly');
  const [wager, setWager] = useState(5);
  const [opponentOvr, setOpponentOvr] = useState(60);
  const [report, setReport] = useState<MatchReport | null>(null);
  const [playing, setPlaying] = useState(false);
  const game = useGame((s) => s.game);
  const toast = useGame((s) => s.toast);
  const problems = lineupProblems(game);

  const play = () => {
    if (problems.length > 0) { toast(problems[0] ?? 'Escalação inválida.', 'warning'); return; }
    if (mode === 'gems') {
      if (game.resources.gems < wager) { toast('Gemas insuficientes.', 'warning'); return; }
      useGame.getState().game.resources.gems -= wager;
    }
    setPlaying(true);
    const opp = generateOpponent(`online:${Date.now()}`, opponentOvr);
    const home = buildHomeTeam(game);
    const away = opponentToMatchTeam(opp);
    const rep = simulateMatch(home, away, Date.now(), { requiresWinner: true, arena: 'pitch' });
    setReport(rep);
    setPlaying(false);
    const won = rep.winner === 'home';
    if (mode === 'gems') {
      if (won) {
        useGame.getState().game.resources.gems += wager * 2;
        toast(`Vitória! +${wager * 2} gemas.`, 'success');
      } else {
        toast(`Derrota. -${wager} gemas.`, 'warning');
      }
    } else {
      toast(won ? 'Vitória!' : 'Derrota.', won ? 'success' : 'warning');
    }
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Online (simulado)</p>
          <h1>Desafios amistosos e valendo gemas</h1>
        </div>
      </header>
      <Tip topic="online" title="Sem multiplayer real">
        Este modo é assíncrono e simulado: não há servidor, contas ou jogadores reais. Os adversários são gerados localmente com a força que você escolher. Partidas valendo gemas usam gemas do seu saldo.
      </Tip>
      <div className="alert" role="alert">
        <AlertTriangle aria-hidden="true" size={18} />
        <p>Sem backend real, não há matchmaking, ranking ou partidas contra outros jogadores. Para jogar online de verdade seria necessário um servidor dedicado.</p>
      </div>
      <Tabs
        label="Modos online"
        value={mode}
        onChange={setMode}
        tabs={[
          { id: 'friendly', label: 'Amistoso', icon: Swords },
          { id: 'gems', label: 'Valendo gemas', icon: Gem },
        ]}
      />
      <div className="grid-2">
        <Panel title="Configurar desafio" eyebrow={mode === 'friendly' ? 'Sem aposta' : 'Aposta em gemas'} id="setup">
          <label className="field">
            <span>OVR do adversário</span>
            <input type="range" min={30} max={95} value={opponentOvr} onChange={(e) => setOpponentOvr(Number(e.target.value))} />
            <span className="muted small">OVR {opponentOvr}</span>
          </label>
          {mode === 'gems' ? (
            <label className="field">
              <span>Aposta (gemas)</span>
              <input type="number" min={1} max={Math.max(1, game.resources.gems)} value={wager} onChange={(e) => setWager(Math.max(1, Number(e.target.value)))} />
              <span className="muted small">Saldo: {fmt(game.resources.gems)} gemas. Vitória dobra a aposta.</span>
            </label>
          ) : null}
          <Button variant="primary" icon={Play} disabled={playing || problems.length > 0} onClick={play}>
            {playing ? 'Jogando…' : 'Iniciar desafio'}
          </Button>
          {problems.length > 0 ? <p className="muted small">{problems[0]}</p> : null}
        </Panel>
        <Panel title="Resultado" eyebrow="Último desafio" id="result">
          {report ? (
            <div className="stack">
              <p className="score-big">{report.score[0]} x {report.score[1]}</p>
              <p className="muted small">{report.winner === 'home' ? 'Vitória' : report.winner === 'away' ? 'Derrota' : 'Empate'}</p>
              <p className="muted small">Posse: {report.stats.home.possession}% x {report.stats.away.possession}% · Finalizações: {report.stats.home.shots} x {report.stats.away.shots}</p>
            </div>
          ) : (
            <EmptyState title="Nenhum desafio jogado" icon={Trophy}>
              Configure e inicie um desafio.
            </EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
