import { useState } from 'react';
import { ArrowUpCircle, Dumbbell, Trash2, Zap } from 'lucide-react';
import { useGame, selectors } from '../state/store';
import { useConfirm } from '../ui/confirm';
import { Bar, Button, Modal, Pill, RarityTag, SectionTitle } from '../ui/common';
import { Portrait } from '../ui/art';
import { ABILITIES, type AbilityDef } from '../data/abilities';
import { ATTRIBUTE_KEYS, type AttributeKey, type Item, type ItemSlot, type Position, type TrainingFocus } from '../domain/types';
import { ATTR_LABEL, FOCUS_LABEL } from '../domain/labels';
import { POSITION_LABEL, POSITION_SHORT, relevantAttributes, POSITION_WEIGHTS } from '../domain/football';
import { effectiveAttributes, levelCap, positionRating, starUpCost, strengthsAndWeaknesses, xpForNextLevel, canStarUp } from '../domain/athletes';
import { athleteTemplate, equippedItemsFor } from '../domain/squad';
import { itemBonusAtLevel, itemName, slotLabel, trainingCost, focusLabel } from '../domain/economy';
import { TRAINING } from '../domain/balance';
import { POSITION_COLOR, fmt } from '../ui/theme';
import { useNav } from '../ui/nav';
import { ITEM_TEMPLATES } from '../data/items';

const SLOT_ORDER: ItemSlot[] = ['boots', 'gloves', 'armband', 'kit'];
const FOCUS_OPTIONS: TrainingFocus[] = ['attack', 'defense', 'physical', 'technique', 'keeper', 'leadership'];

export function AthleteModal({ athleteId, onClose }: { athleteId: string | null; onClose: () => void }) {
  const game = useGame((s) => s.game);
  const athlete = athleteId ? game.athletes.find((a) => a.id === athleteId) : undefined;
  const template = athlete ? athleteTemplate(athlete) : undefined;
  return (
    <Modal open={Boolean(athlete && template)} onClose={onClose} title={template ? template.name : 'Atleta'} wide>
      {athlete && template ? <Details athleteId={athlete.id} /> : null}
    </Modal>
  );
}

function Details({ athleteId }: { athleteId: string }) {
  const game = useGame((s) => s.game);
  const train = useGame((s) => s.trainAthlete);
  const evolve = useGame((s) => s.evolveAthlete);
  const release = useGame((s) => s.releaseAthlete);
  const equip = useGame((s) => s.equip);
  const unequip = useGame((s) => s.unequip);
  const toast = useGame((s) => s.toast);
  const confirm = useConfirm((s) => s.ask);
  const [focus, setFocus] = useState<TrainingFocus>('attack');

  const athlete = game.athletes.find((a) => a.id === athleteId);
  if (!athlete) return null;
  const template = athleteTemplate(athlete);
  if (!template) return null;
  const items = equippedItemsFor(athlete.id, { items: game.items, equipped: game.equipped });
  const attrs = effectiveAttributes(athlete, items);
  const ovr = selectors.athleteOvr(game, athlete);
  const cap = levelCap(athlete.stars, game.upgrades.trainingCenter);
  const { strong, weak } = strengthsAndWeaknesses(attrs, template.position);
  const relevant = relevantAttributes(template.position);
  const ability: AbilityDef | undefined = template.ability ? ABILITIES[template.ability] : undefined;
  const cost = trainingCost(athlete.level, game.upgrades.trainingCenter);
  const nextStarCost = starUpCost(athlete.stars);
  const isGoalkeeper = template.position === 'GK';
  const inLineup = game.lineup.slots.includes(athlete.id);
  const xpNeed = xpForNextLevel(athlete.level);
  const canEvolve = canStarUp(athlete, game.upgrades.trainingCenter);

  const ownedItemsFor = (slot: ItemSlot): Item[] => {
    return game.items.filter((i) => i.slot === slot && (slot !== 'gloves' || isGoalkeeper));
  };

  return (
    <div className="athlete-sheet">
      <header className="athlete-head">
        <Portrait name={template.name} hue={template.hue} position={template.position} size={96} rarity={template.rarity} />
        <div className="grow">
          <p className="eyebrow">{template.nationality} · {POSITION_LABEL[template.position]}</p>
          <h2>{template.name}</h2>
          <div className="row wrap">
            <RarityTag rarity={template.rarity} />
            <Pill>{'★'.repeat(athlete.stars)}{'☆'.repeat(5 - athlete.stars)}</Pill>
            <Pill>Nível {athlete.level}/{cap}</Pill>
            {inLineup ? <Pill color="var(--ok)">Titular</Pill> : null}
            {athlete.status === 'injured' ? <Pill color="var(--danger)">Lesionado · {athlete.injuryMatches} partida(s)</Pill> : null}
          </div>
          <p className="muted small">{template.bio}</p>
          <div className="traits" aria-label="Traços">
            {template.traits.map((t) => <Pill key={t}>{t}</Pill>)}
          </div>
        </div>
        <div className="athlete-ovr" aria-label={`OVR ${ovr}`}>
          <span className="stat-label">OVR</span>
          <strong style={{ color: POSITION_COLOR[template.position] }}>{ovr}</strong>
          <span className="muted small">{POSITION_SHORT[template.position]}</span>
        </div>
      </header>

      <div className="athlete-grid">
        <section className="athlete-col" aria-labelledby="ath-attrs">
          <SectionTitle>Atributos</SectionTitle>
          <p className="muted small" id="ath-attrs">Valores já incluem nível, estrelas, treino e equipamentos. Teto 99.</p>
          <ul className="attr-list">
            {ATTRIBUTE_KEYS.map((key) => {
              const value = attrs[key];
              const isKey = relevant.includes(key);
              const weight = POSITION_WEIGHTS[template.position][key];
              return (
                <li key={key} className={isKey ? 'is-key' : ''}>
                  <span className="attr-name">
                    {ATTR_LABEL[key]}
                    {weight ? <span className="muted small"> · peso {weight}</span> : null}
                  </span>
                  <Bar value={value} max={99} label={`${ATTR_LABEL[key]} ${value}`} color={attrColor(value)} />
                  <span className="attr-value">{value}</span>
                </li>
              );
            })}
          </ul>
          <p className="small"><strong>Fortes:</strong> {strong.length ? strong.map((k) => ATTR_LABEL[k]).join(', ') : 'nenhum destaque claro'}</p>
          <p className="small"><strong>Fracos:</strong> {weak.length ? weak.map((k) => ATTR_LABEL[k]).join(', ') : 'nenhum ponto fraco crítico'}</p>
          <p className="small muted">Notas por posição: {[template.position, ...template.secondary].map((p) => `${POSITION_SHORT[p as Position]} ${Math.round(positionRating(attrs, p as Position))}`).join(' · ')}</p>
        </section>

        <section className="athlete-col" aria-labelledby="ath-ability">
          <SectionTitle icon={Zap}>Habilidade especial</SectionTitle>
          {ability ? (
            <div className="ability" id="ath-ability">
              <p className="strong">{ability.name}</p>
              <p className="small">{ability.description}</p>
              <dl className="kv small">
                <div><dt>Gatilho</dt><dd>{triggerLabel(ability.trigger)}</dd></div>
                <div><dt>Recarga</dt><dd>{ability.cooldownMinutes} min</dd></div>
                <div><dt>Limite</dt><dd>{ability.maxUsesPerMatch} por partida</dd></div>
                <div><dt>Chance ao gatilho</dt><dd>{Math.round(ability.activationChance * 100)}%</dd></div>
              </dl>
            </div>
          ) : <p className="muted">Sem habilidade especial.</p>}

          <SectionTitle>Estatísticas</SectionTitle>
          <dl className="kv">
            <div><dt>Partidas</dt><dd>{athlete.matches}</dd></div>
            <div><dt>Gols · assistências</dt><dd>{athlete.goals} · {athlete.assists}</dd></div>
            <div><dt>Defesas</dt><dd>{athlete.saves}</dd></div>
            <div><dt>Melhor nota</dt><dd>{athlete.bestRating ? athlete.bestRating.toFixed(1) : '—'}</dd></div>
          </dl>

          <SectionTitle>Condição</SectionTitle>
          <div className="condition">
            <span>Energia {Math.round(athlete.energy)}%</span>
            <Bar value={athlete.energy} color="var(--ok)" label="Energia" />
            <span>Moral {Math.round(athlete.morale)}%</span>
            <Bar value={athlete.morale} color="var(--gold)" label="Moral" />
            <span>Experiência para o próximo nível: {athlete.level >= cap ? 'nível máximo atual' : `${Math.round(athlete.xp)}/${xpNeed}`}</span>
            <Bar value={athlete.level >= cap ? 1 : athlete.xp} max={athlete.level >= cap ? 1 : xpNeed} label="Experiência" />
          </div>
        </section>

        <section className="athlete-col" aria-labelledby="ath-actions">
          <SectionTitle icon={Dumbbell}>Treino</SectionTitle>
          <p className="muted small" id="ath-actions">
            Cada sessão custa {fmt(cost)} Coins e 1 ficha, dá de 1 a 3 pontos na família escolhida e até {TRAINING.maxBonusPerAttribute} pontos por atributo. Também concede XP.
          </p>
          <div className="row wrap">
            <label className="field inline">
              <span>Foco</span>
              <select value={focus} onChange={(e) => setFocus(e.target.value as TrainingFocus)}>
                {FOCUS_OPTIONS.map((f) => (
                  <option key={f} value={f} disabled={f === 'keeper' && !isGoalkeeper}>
                    {FOCUS_LABEL[f]} ({TRAINING.focusAttributes[f].map((k) => ATTR_LABEL[k]).join(', ')})
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="primary"
              icon={Dumbbell}
              onClick={() => {
                const res = train(athlete.id, focus);
                if (!res.ok) toast(res.error ?? 'Treino indisponível.', 'warning');
                else {
                  const total = Object.values(res.data?.points ?? {}).reduce<number>((sum, v) => sum + (v ?? 0), 0);
                  toast(`Treino concluído (${focusLabel(focus)}): +${total} pontos`, 'success');
                }
              }}
            >
              Treinar ({fmt(cost)} · 1 ficha)
            </Button>
          </div>
          <p className="muted small">Fichas disponíveis: {game.resources.tokens} · Coins: {fmt(game.resources.coins)}</p>

          <SectionTitle icon={ArrowUpCircle}>Evolução</SectionTitle>
          {nextStarCost === null ? (
            <p className="muted small">Este atleta já atingiu 5 estrelas.</p>
          ) : (
            <>
              <p className="muted small">
                Próxima estrela: {nextStarCost} Fragments. Requer o nível máximo atual ({cap}). Você tem {fmt(game.resources.fragments)} Fragments.
              </p>
              <Button
                disabled={!canEvolve || game.resources.fragments < nextStarCost}
                onClick={() => {
                  const res = evolve(athlete.id);
                  if (!res.ok) toast(res.error ?? 'Não foi possível evoluir.', 'warning');
                  else toast(`${template.name} agora tem ${res.data} estrelas!`, 'success');
                }}
              >
                Evoluir para {athlete.stars + 1}★
              </Button>
            </>
          )}

          <SectionTitle>Equipamentos</SectionTitle>
          <ul className="equip-list">
            {SLOT_ORDER.map((slot) => {
              const equippedId = game.equipped[athlete.id]?.[slot];
              const current = equippedId ? game.items.find((i) => i.id === equippedId) : undefined;
              const options = ownedItemsFor(slot);
              return (
                <li key={slot} className="equip-row">
                  <div className="grow">
                    <p className="small strong">{slotLabel(slot)}{slot === 'gloves' && !isGoalkeeper ? ' (só goleiros)' : ''}</p>
                    {current ? (
                      <p className="small">
                        {itemName(current)} · nível {current.level} · {formatBonus(itemBonusAtLevel(current))}
                      </p>
                    ) : <p className="muted small">Vazio</p>}
                  </div>
                  <label className="sr-only" htmlFor={`equip-${athlete.id}-${slot}`}>Escolher item para {slotLabel(slot)}</label>
                  <select
                    id={`equip-${athlete.id}-${slot}`}
                    value={current?.id ?? ''}
                    disabled={slot === 'gloves' && !isGoalkeeper}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        unequip(athlete.id, slot);
                        return;
                      }
                      const item = game.items.find((i) => i.id === id);
                      if (!item) return;
                      const res = equip(athlete.id, item.id);
                      if (!res.ok) toast(res.error ?? 'Não foi possível equipar.', 'warning');
                    }}
                  >
                    <option value="">Nenhum</option>
                    {options.map((item) => {
                      const tpl = ITEM_TEMPLATES.find((t) => t.id === item.templateId);
                      return (
                        <option key={item.id} value={item.id}>
                          {tpl?.name ?? 'Item'} · nível {item.level} {item.id === equippedId ? '(equipado)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </li>
              );
            })}
          </ul>
          <p className="muted small">Cada item só pode estar equipado em um atleta. Trocar um item move o bônus.</p>

          <div className="danger-zone">
            <Button
              variant="danger"
              icon={Trash2}
              disabled={inLineup}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Dispensar atleta?',
                  message: `${template.name} será removido do Squad. Você recebe Fragments pela carta, mas não recupera o atleta. Esta ação não pode ser desfeita.`,
                  confirmLabel: 'Dispensar',
                  tone: 'danger',
                });
                if (!ok) return;
                const res = release(athlete.id);
                if (res.ok) {
                  toast(`${template.name} foi dispensado. +${res.data} Fragments.`, 'info');
                  useNav.getState().openAthlete(null);
                } else toast(res.error ?? 'Não foi possível dispensar.', 'warning');
              }}
            >
              Dispensar atleta
            </Button>
            {inLineup ? <p className="muted small">Tire o atleta da escalação para dispensá-lo.</p> : null}
          </div>
        </section>
      </div>
      <p className="muted small">Energia e moral afetam o rendimento durante a partida. items e treino entram direto no cálculo.</p>
    </div>
  );
}

function attrColor(value: number): string {
  if (value >= 80) return 'var(--ok)';
  if (value >= 65) return 'var(--accent)';
  if (value >= 50) return 'var(--gold)';
  return 'var(--danger)';
}

function triggerLabel(trigger: AbilityDef['trigger']): string {
  switch (trigger) {
    case 'shot':
      return 'Ao finalizar';
    case 'defend':
      return 'Ao defender';
    case 'save':
      return 'Nas defesas do goleiro';
    case 'pass':
      return 'Na construção';
    case 'corner':
      return 'Em escanteios e cruzamentos';
    case 'counter':
      return 'No contra-ataque';
  }
}

function formatBonus(bonus: Partial<Record<AttributeKey, number>>): string {
  return Object.entries(bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => `+${v} ${ATTR_LABEL[k as AttributeKey]}`)
    .join(', ');
}
