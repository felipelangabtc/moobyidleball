import { useMemo, useState } from 'react';
import { Search, Shuffle, Star, UserMinus, UserPlus, Users, Shirt } from 'lucide-react';
import { useGame, selectors } from '../state/store';
import { useNav } from '../ui/nav';
import { Bar, Button, EmptyState, Panel, Pill, Tabs, Tip, Toggle } from '../ui/common';
import { Portrait } from '../ui/art';
import { POSITION_LABEL, POSITION_SHORT, FORMATIONS, TACTICS } from '../domain/football';
import { FORMATION_IDS, POSITIONS, TACTIC_IDS, type FormationId, type Position, type TacticId } from '../domain/types';
import { POSITION_COLOR } from '../ui/theme';
import { athleteTemplate, athleteSlotOvr, shortName } from '../domain/squad';
import { lineupProblems, squadContext } from '../state/matchFlow';
import { levelCap } from '../domain/athletes';
import { templateById } from '../data/athletes';
import { ECONOMY } from '../domain/balance';

export function Squad() {
  const tab = useNav((s) => s.squadTab);
  const setTab = useNav((s) => s.setSquadTab);
  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Squad</p>
          <h1>Squad</h1>
        </div>
      </header>
      <Tabs
        label="Seções do Squad"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'escalacao', label: 'Lineup', icon: Users },
          { id: 'elenco', label: 'Roster', icon: Shirt },
        ]}
      />
      {tab === 'escalacao' ? <Lineup /> : <Roster />}
    </div>
  );
}

function Lineup() {
  const game = useGame((s) => s.game);
  const setLineupSlot = useGame((s) => s.setLineupSlot);
  const setFormation = useGame((s) => s.setFormation);
  const setTactic = useGame((s) => s.setTactic);
  const setCaptain = useGame((s) => s.setCaptain);
  const autoLineup = useGame((s) => s.autoLineup);
  const updateSettings = useGame((s) => s.updateSettings);
  const toast = useGame((s) => s.toast);
  const openAthlete = useNav((s) => s.openAthlete);
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const formation = FORMATIONS[game.lineup.formation as FormationId];
  const problems = lineupProblems(game);
  const ctx = squadContext(game);
  const selectedPosition: Position | null = slotIndex !== null ? (formation.slots[slotIndex]?.position ?? null) : null;

  const candidates = useMemo(() => {
    if (slotIndex === null || !selectedPosition) return [];
    const context = squadContext(game);
    const used = new Set(game.lineup.slots.filter((s): s is string => Boolean(s)));
    const q = search.trim().toLowerCase();
    return game.athletes
      .filter((a) => !q || (athleteTemplate(a)?.name ?? '').toLowerCase().includes(q))
      .map((a) => ({
        athlete: a,
        rating: athleteSlotOvr(a, selectedPosition, context),
        current: game.lineup.slots[slotIndex] === a.id,
        used: used.has(a.id) && game.lineup.slots[slotIndex] !== a.id,
      }))
      .sort((a, b) => b.rating - a.rating);
  }, [game, slotIndex, selectedPosition, search]);

  return (
    <div className="stack">
      <Tip topic="squad" title="Escalação e táticas">
        Cada posição mostra a nota do atleta naquele lugar. Atletas fora da posição principal perdem rendimento, mas continuam úteis. Capitão com boa liderança melhora o moral do time.
      </Tip>

      <div className="grid-2">
        <Panel title="Formação e tática" eyebrow="Decisões" id="formation-panel">
          <div className="form-grid">
            <label className="field">
              <span>Formação</span>
              <select value={game.lineup.formation} onChange={(e) => setFormation(e.target.value as FormationId)}>
                {FORMATION_IDS.map((f) => <option key={f} value={f}>{FORMATIONS[f as FormationId].label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Tática</span>
              <select value={game.lineup.tactic} onChange={(e) => setTactic(e.target.value as TacticId)}>
                {TACTIC_IDS.map((t) => <option key={t} value={t}>{TACTICS[t as TacticId].label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Capitão</span>
              <select value={game.lineup.captainId ?? ''} onChange={(e) => setCaptain(e.target.value || null)}>
                <option value="">Sem capitão</option>
                {game.lineup.slots.filter((s): s is string => Boolean(s)).map((id) => (
                  <option key={id} value={id}>{selectors.athleteName(game, id)}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">{formation.description}</p>
          <p className="muted small">{TACTICS[game.lineup.tactic as TacticId].description}</p>
          <div className="row wrap">
            <Button icon={Shuffle} onClick={() => {
              autoLineup();
              toast('Escalação automática aplicada.', 'success');
            }}>Escalação automática</Button>
          </div>
          <Toggle
            id="auto-lineup"
            label="Manter escalação automática"
            description="Quando um atleta se lesionar ou sair do Squad, o jogo preenche a vaga sozinho."
            checked={game.settings.autoLineup}
            onChange={(v) => updateSettings({ autoLineup: v })}
          />
        </Panel>

        <Panel title="Diagnóstico" eyebrow="Pronto para jogar?" id="lineup-check">
          {problems.length === 0 ? (
            <p className="alert-soft ok">Escalação completa e pronta para a próxima partida.</p>
          ) : (
            <ul className="problems">
              {problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          <p className="muted small">Atletas no Squad: {game.athletes.length}/{ECONOMY.rosterCap}. Lesionados não podem ser escalados.</p>
        </Panel>
      </div>

      <Panel title="Campo" eyebrow={formation.label} id="formation-field">
        <div className="lineup-grid" role="list" aria-label="Posições da escalação">
          {formation.slots.map((slot, index) => {
            const id = game.lineup.slots[index] ?? null;
            const athlete = id ? game.athletes.find((a) => a.id === id) : undefined;
            const template = athlete ? templateById(athlete.templateId) : undefined;
            const rating = athlete ? athleteSlotOvr(athlete, slot.position, ctx) : 0;
            const selected = slotIndex === index;
            return (
              <div key={index} role="listitem" className={`slot-card ${selected ? 'is-selected' : ''} ${athlete?.status === 'injured' ? 'is-injured' : ''}`} style={{ ['--pos' as string]: POSITION_COLOR[slot.position] }}>
                <p className="slot-pos">{POSITION_SHORT[slot.position]}</p>
                {athlete && template ? (
                  <>
                    <Portrait name={template.name} hue={template.hue} position={template.position} number={index + 1} size={44} rarity={template.rarity} />
                    <p className="slot-name">{shortName(template.name)}</p>
                    <p className="slot-ovr">OVR {rating.toLocaleString('pt-BR')}</p>
                    {athlete.status === 'injured' ? <Pill color="var(--danger)">Lesionado</Pill> : null}
                  </>
                ) : (
                  <p className="slot-empty">Vaga vazia</p>
                )}
                <div className="row">
                  <Button size="sm" variant={selected ? 'primary' : 'secondary'} icon={UserPlus} onClick={() => setSlotIndex(selected ? null : index)} aria-pressed={selected}>
                    {selected ? 'Fechar' : athlete ? 'Trocar' : 'Escalar'}
                  </Button>
                  {athlete ? (
                    <Button size="sm" variant="ghost" icon={UserMinus} aria-label={`Remover ${template?.name ?? 'atleta'} da escalação`} onClick={() => setLineupSlot(index, null)} />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {slotIndex !== null && selectedPosition ? (
        <Panel title={`Escolher ${POSITION_LABEL[selectedPosition].toLowerCase()}`} eyebrow={`Vaga ${slotIndex + 1}`} id="candidates" actions={<Button size="sm" variant="ghost" onClick={() => setSlotIndex(null)}>Fechar</Button>}>
          <label className="search">
            <Search aria-hidden="true" size={16} />
            <span className="sr-only">Buscar atleta</span>
            <input type="search" placeholder="Buscar por nome" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          {candidates.length === 0 ? (
            <EmptyState title="Nenhum atleta encontrado" icon={Users}>Treine ou abra baús para ampliar o Squad.</EmptyState>
          ) : (
            <ul className="candidate-list">
              {candidates.map((c) => {
                const template = athleteTemplate(c.athlete);
                if (!template) return null;
                return (
                  <li key={c.athlete.id} className="candidate">
                    <Portrait name={template.name} hue={template.hue} position={template.position} size={44} rarity={template.rarity} />
                    <div className="grow">
                      <button type="button" className="link-btn strong" onClick={() => openAthlete(c.athlete.id)}>{template.name}</button>
                      <p className="muted small">
                        {POSITION_SHORT[template.position]} · nota {c.rating.toLocaleString('pt-BR')} nesta vaga · nível {c.athlete.level}
                        {c.athlete.status === 'injured' ? ' · lesionado' : ''}
                      </p>
                      <Bar value={c.athlete.energy} label={`Energia de ${template.name}`} color="var(--ok)" />
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={c.athlete.status === 'injured' || c.current}
                      onClick={() => {
                        const res = setLineupSlot(slotIndex, c.athlete.id);
                        if (!res.ok) toast(res.error ?? 'Não foi possível escalar.', 'warning');
                        else setSlotIndex(null);
                      }}
                    >
                      {c.current ? 'Escalado' : c.used ? 'Trocar com titular' : 'Escalar'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function Roster() {
  const game = useGame((s) => s.game);
  const openAthlete = useNav((s) => s.openAthlete);
  const [position, setPosition] = useState<Position | 'all'>('all');
  const [sort, setSort] = useState<'ovr' | 'level' | 'stars' | 'energy'>('ovr');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return game.athletes
      .map((a) => ({ athlete: a, template: athleteTemplate(a), ovr: selectors.athleteOvr(game, a) }))
      .filter((r) => r.template)
      .filter((r) => position === 'all' || r.template?.position === position)
      .filter((r) => !q || (r.template?.name ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'ovr') return b.ovr - a.ovr;
        if (sort === 'level') return b.athlete.level - a.athlete.level;
        if (sort === 'stars') return b.athlete.stars - a.athlete.stars;
        return b.athlete.energy - a.athlete.energy;
      });
  }, [game, position, sort, search]);

  return (
    <div className="stack">
      <div className="toolbar">
        <label className="search">
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">Buscar no Squad</span>
          <input type="search" placeholder="Buscar atleta" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="field inline">
          <span>Posição</span>
          <select value={position} onChange={(e) => setPosition(e.target.value as Position | 'all')}>
            <option value="all">Todas</option>
            {POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="field inline">
          <span>Ordenar</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="ovr">OVR</option>
            <option value="level">Nível</option>
            <option value="stars">Estrelas</option>
            <option value="energy">Energia</option>
          </select>
        </label>
        <p className="muted small">{rows.length} de {game.athletes.length} atletas · limite {ECONOMY.rosterCap}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nenhum atleta com este filtro" icon={Users}>Ajuste a busca ou abra baús para contratar novos atletas.</EmptyState>
      ) : (
        <ul className="roster-grid">
          {rows.map(({ athlete, template, ovr }) => {
            if (!template) return null;
            return (
              <li key={athlete.id}>
                <button type="button" className="roster-card" onClick={() => openAthlete(athlete.id)} aria-label={`Ver ficha de ${template.name}, OVR ${ovr}`}>
                  <Portrait name={template.name} hue={template.hue} position={template.position} size={56} rarity={template.rarity} />
                  <div className="grow">
                    <p className="roster-name">{template.name}</p>
                    <p className="muted small">
                      <span style={{ color: POSITION_COLOR[template.position] }}>{POSITION_SHORT[template.position]}</span> · nível {athlete.level}/{levelCap(athlete.stars, game.upgrades.trainingCenter)} · {'★'.repeat(athlete.stars)}
                    </p>
                    <Bar value={athlete.energy} label="Energia" color="var(--ok)" />
                    {athlete.status === 'injured' ? <Pill color="var(--danger)">Lesionado · {athlete.injuryMatches} partida(s)</Pill> : null}
                  </div>
                  <span className="roster-ovr">{ovr.toLocaleString('pt-BR')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Panel title="Como ler a nota" eyebrow="OVR" id="ovr-help">
        <p className="muted small">
          A nota (OVR) é a média dos atributos que mais importam para a posição, ponderada por peso. Atletas fora da posição principal perdem alguns pontos, conforme a versatilidade. Atributos acima de 70 são fortes; abaixo de 60 são fracos. Cada atributo tem teto de 99.
        </p>
        <p className="muted small"><Star aria-hidden="true" size={12} /> Estrelas aumentam o potencial de crescimento e o teto de nível.</p>
        <p className="muted small"><Users aria-hidden="true" size={12} /> Formações disponíveis: {FORMATION_IDS.map((f) => FORMATIONS[f as FormationId].label).join(', ')}.</p>
      </Panel>
    </div>
  );
}
