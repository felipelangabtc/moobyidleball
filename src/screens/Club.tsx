import { useMemo, useState } from 'react';
import { Coins, Dumbbell, Gift, Hammer, Recycle, Wrench } from 'lucide-react';
import { useGame, selectors } from '../state/store';
import { useT } from '../i18n';
import { useNav } from '../ui/nav';
import { Bar, Button, EmptyState, Panel, Pill, RarityTag, Stat, Tabs, Tip } from '../ui/common';
import { Portrait } from '../ui/art';
import { CLUB_UPGRADES, ECONOMY, TRAINING } from '../domain/balance';
import { CLUB_UPGRADE_IDS, ITEM_SLOTS, TRAINING_FOCUS_IDS, type ClubUpgradeId, type Item, type ItemSlot, type TrainingFocus } from '../domain/types';
import { ATTR_LABEL, FOCUS_LABEL } from '../domain/labels';
import { clubLevelFor, clubXpFor, idleCoinsPerHour, inventoryCapacity, inventoryWarning, itemBonusAtLevel, itemName, recycleValue, slotLabel, stadiumPaybackHours, trainingCost, upgradeBenefitNext, upgradeCost, upgradeEffect } from '../domain/economy';
import { athleteTemplate } from '../domain/squad';
import { ITEM_TEMPLATES } from '../data/items';
import { RARITY_COLOR, fmt } from '../ui/theme';
import { computeIdle, formatDuration } from '../domain/idle';
import { useNow } from '../ui/hooks';
import { confirmAction } from '../ui/confirm';
import { templateById } from '../data/athletes';

export function Club() {
  const tab = useNav((s) => s.clubTab);
  const setTab = useNav((s) => s.setClubTab);
  const t = useT();
  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{t('club.title')}</p>
          <h1>{t('club.title')}</h1>
        </div>
      </header>
      <Tabs
        label="Seções do Club"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'treino', label: 'Treino', icon: Dumbbell },
          { id: 'equipamentos', label: 'Equipamentos', icon: Hammer },
          { id: 'melhorias', label: 'Upgrades', icon: Wrench },
          { id: 'clube', label: 'Club', icon: Coins },
        ]}
      />
      {tab === 'treino' ? <Training /> : null}
      {tab === 'equipamentos' ? <Equipment /> : null}
      {tab === 'melhorias' ? <Upgrades /> : null}
      {tab === 'clube' ? <ClubInfo /> : null}
    </div>
  );
}

function Training() {
  const game = useGame((s) => s.game);
  const train = useGame((s) => s.trainAthlete);
  const toast = useGame((s) => s.toast);
  const openAthlete = useNav((s) => s.openAthlete);
  const [focus, setFocus] = useState<Record<string, TrainingFocus>>({});
  const cost = (level: number) => trainingCost(level, game.upgrades.trainingCenter);

  const rows = useMemo(
    () => [...game.athletes].sort((a, b) => b.level - a.level),
    [game.athletes],
  );

  return (
    <div className="stack">
      <Tip topic="club" title="Treino e progressão">
        Cada sessão custa Coins e uma ficha de treino. Ela distribui pontos no foco escolhido e concede XP. O Centro de Treinamento reduz custos e aumenta o teto de nível.
      </Tip>
      <div className="grid-stats">
        <Stat label="Training tokens" value={game.resources.tokens} icon={Dumbbell} hint="1 por sessão" />
        <Stat label="Coins" value={fmt(game.resources.coins)} icon={Coins} />
        <Stat label="Centro de Treinamento" value={`Nível ${game.upgrades.trainingCenter}`} hint="Reduz custo e amplia o teto" />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Sem atletas para treinar" icon={Dumbbell}>Abra baús para contratar atletas.</EmptyState>
      ) : (
        <ul className="train-list">
          {rows.map((a) => {
            const template = athleteTemplate(a);
            if (!template) return null;
            const selectedFocus = focus[a.id] ?? (template.position === 'GK' ? 'keeper' : 'attack');
            const points = Object.values(a.trainingBonus).reduce<number>((sum, v) => sum + (v ?? 0), 0);
            const maxPoints = TRAINING.maxBonusPerAttribute * 20;
            return (
              <li key={a.id} className="train-row">
                <Portrait name={template.name} hue={template.hue} position={template.position} size={48} rarity={template.rarity} />
                <div className="grow">
                  <button type="button" className="link-btn strong" onClick={() => openAthlete(a.id)}>{template.name}</button>
                  <p className="muted small">Nível {a.level} · {'★'.repeat(a.stars)} · XP {Math.round(a.xp)} · pontos de treino {points}</p>
                  <Bar value={points} max={maxPoints} label={`Pontos de treino de ${template.name}`} />
                </div>
                <label className="sr-only" htmlFor={`focus-${a.id}`}>Foco de treino de {template.name}</label>
                <select
                  id={`focus-${a.id}`}
                  value={selectedFocus}
                  onChange={(e) => setFocus((f) => ({ ...f, [a.id]: e.target.value as TrainingFocus }))}
                >
                  {TRAINING_FOCUS_IDS.map((f) => (
                    <option key={f} value={f} disabled={f === 'keeper' && template.position !== 'GK'}>
                      {FOCUS_LABEL[f]}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={game.resources.tokens < 1 || game.resources.coins < cost(a.level)}
                  onClick={() => {
                    const res = train(a.id, selectedFocus);
                    if (!res.ok) toast(res.error ?? 'Treino indisponível.', 'warning');
                  }}
                >
                  Treinar · {fmt(cost(a.level))}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="muted small">Focos: {TRAINING_FOCUS_IDS.map((f) => `${FOCUS_LABEL[f]} (${TRAINING.focusAttributes[f].map((k) => ATTR_LABEL[k]).join(', ')})`).join(' · ')}.</p>
    </div>
  );
}

function Equipment() {
  const game = useGame((s) => s.game);
  const equip = useGame((s) => s.equip);
  const fuse = useGame((s) => s.fuseItems);
  const recycle = useGame((s) => s.recycleItem);
  const toast = useGame((s) => s.toast);
  const [slotFilter, setSlotFilter] = useState<ItemSlot | 'all'>('all');
  const [pick, setPick] = useState<Record<string, string>>({});
  const [fusionIds, setFusionIds] = useState<string[]>([]);
  const capacity = inventoryCapacity(game.upgrades.storage);
  const warning = inventoryWarning(game.items.length, capacity);

  const items = game.items
    .filter((i) => slotFilter === 'all' || i.slot === slotFilter)
    .sort((a, b) => a.slot.localeCompare(b.slot) || b.level - a.level);

  const equippedBy = (itemId: string): string | null => {
    for (const [aid, slots] of Object.entries(game.equipped)) {
      if (Object.values(slots).includes(itemId)) return aid;
    }
    return null;
  };

  const fusionGroups = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of game.items) {
      const key = `${item.templateId}|${item.level}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.values()].filter((g) => g.length >= ECONOMY.fusionCount && g[0] && g[0].level < ECONOMY.maxItemLevel);
  }, [game.items]);

  const toggleFusion = (id: string) => {
    setFusionIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= ECONOMY.fusionCount) return ids;
      return [...ids, id];
    });
  };

  return (
    <div className="stack">
      <Tip topic="equipment" title="Equipamentos e fusão">
        Cada atleta tem um item por slot. items sobem de nível com fusão: três iguais (mesmo modelo e nível) viram um de nível superior. items que não servem podem ser reciclados em Coins.
      </Tip>
      <div className="toolbar">
        <label className="field inline">
          <span>Slot</span>
          <select value={slotFilter} onChange={(e) => setSlotFilter(e.target.value as ItemSlot | 'all')}>
            <option value="all">Todos</option>
            {ITEM_SLOTS.map((s) => <option key={s} value={s}>{slotLabel(s)}</option>)}
          </select>
        </label>
        <div className="grow">
          <p className="small">Inventário: {game.items.length}/{capacity}</p>
          <Bar value={game.items.length} max={capacity} label="Ocupação do inventário" color={warning ? 'var(--gold)' : 'var(--accent)'} />
          {warning ? <p className="small alert-soft">{warning}</p> : null}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nenhum item neste filtro" icon={Hammer}>Abra baús para encontrar equipamentos.</EmptyState>
      ) : (
        <ul className="item-list">
          {items.map((item) => {
            const tpl = ITEM_TEMPLATES.find((t) => t.id === item.templateId);
            const owner = equippedBy(item.id);
            const ownerTpl = owner ? game.athletes.find((a) => a.id === owner) : undefined;
            const ownerName = ownerTpl ? athleteTemplate(ownerTpl)?.name ?? 'Atleta' : null;
            const candidates = game.athletes.filter((a) => item.slot !== 'gloves' || athleteTemplate(a)?.position === 'GK');
            const chosen = pick[item.id] ?? candidates[0]?.id ?? '';
            const selectedForFusion = fusionIds.includes(item.id);
            return (
              <li key={item.id} className="item-row" style={{ borderColor: RARITY_COLOR[item.rarity] }}>
                <span className="item-dot" style={{ background: RARITY_COLOR[item.rarity] }} aria-hidden="true" />
                <div className="grow">
                  <p className="strong">{itemName(item)} <span className="muted small">· {slotLabel(item.slot)} · nível {item.level}/{ECONOMY.maxItemLevel}</span></p>
                  <p className="small">{formatBonus(itemBonusAtLevel(item))}</p>
                  <p className="muted small">{tpl?.flavor ?? ''}</p>
                  <p className="small">
                    <RarityTag rarity={item.rarity} /> {ownerName ? <Pill>Equipado: {ownerName}</Pill> : <Pill>Livre</Pill>}
                  </p>
                </div>
                <div className="item-actions">
                  <label className="sr-only" htmlFor={`item-${item.id}`}>Atleta para equipar {itemName(item)}</label>
                  <select id={`item-${item.id}`} value={chosen} onChange={(e) => setPick((p) => ({ ...p, [item.id]: e.target.value }))} disabled={candidates.length === 0}>
                    {candidates.map((a) => (
                      <option key={a.id} value={a.id}>{athleteTemplate(a)?.name ?? 'Atleta'}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!chosen}
                    onClick={() => {
                      const res = equip(chosen, item.id);
                      if (!res.ok) toast(res.error ?? 'Não foi possível equipar.', 'warning');
                      else toast(`${itemName(item)} equipado.`, 'success');
                    }}
                  >
                    Equipar
                  </Button>
                  <Button size="sm" variant={selectedForFusion ? 'gold' : 'secondary'} disabled={item.level >= ECONOMY.maxItemLevel} onClick={() => toggleFusion(item.id)} aria-pressed={selectedForFusion}>
                    {selectedForFusion ? 'Selecionado para fusão' : 'Selecionar p/ fusão'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Recycle}
                    disabled={Boolean(owner)}
                    onClick={async () => {
                      const value = recycleValue(item);
                      const ok = await confirmAction({
                        title: 'Reciclar item?',
                        message: `${itemName(item)} será removido e você recebe ${fmt(value)} Coins. Esta ação não pode ser desfeita.`,
                        confirmLabel: 'Reciclar',
                        tone: 'danger',
                      });
                      if (!ok) return;
                      const res = recycle(item.id);
                      if (res.ok) toast(`Item reciclado: +${fmt(value)} Coins.`, 'success');
                    }}
                  >
                    Reciclar ({fmt(recycleValue(item))})
                  </Button>
                  {owner ? <p className="muted small">Desequipe antes de reciclar.</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Panel title="Fusão de items" eyebrow={`Escolha ${ECONOMY.fusionCount} iguais`} id="fusion">
        {fusionGroups.length === 0 ? (
          <p className="muted small">Você ainda não tem {ECONOMY.fusionCount} items idênticos (mesmo modelo e nível).</p>
        ) : (
          <ul className="list-plain small">
            {fusionGroups.map((g) => {
              const first = g[0];
              if (!first) return null;
              return (
                <li key={`${first.templateId}-${first.level}`}>
                  {itemName(first)} nível {first.level} · {g.length} disponíveis. Selecione 3 items desta lista abaixo.
                </li>
              );
            })}
          </ul>
        )}
        {fusionIds.length > 0 ? (
          <p className="small">Selecionados: {fusionIds.length}/{ECONOMY.fusionCount}</p>
        ) : null}
        <Button
          variant="gold"
          icon={Gift}
          disabled={fusionIds.length !== ECONOMY.fusionCount}
          onClick={async () => {
            const ok = await confirmAction({
              title: 'Fundir items?',
              message: `Os ${ECONOMY.fusionCount} items selecionados serão consumidos e um item de nível superior será criado.`,
              confirmLabel: 'Fundir',
            });
            if (!ok) return;
            const res = fuse(fusionIds);
            if (res.ok) {
              setFusionIds([]);
            } else {
              toast(res.error ?? 'Não foi possível fundir.', 'warning');
            }
          }}
        >
          Fundir selecionados
        </Button>
        {fusionIds.length > 0 ? <Button variant="ghost" onClick={() => setFusionIds([])}>Limpar seleção</Button> : null}
      </Panel>
    </div>
  );
}

function formatBonus(bonus: Partial<Record<string, number>>): string {
  return Object.entries(bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => `+${v} ${ATTR_LABEL[k as keyof typeof ATTR_LABEL]}`)
    .join(', ');
}

function Upgrades() {
  const game = useGame((s) => s.game);
  const buy = useGame((s) => s.upgradeClub);
  const toast = useGame((s) => s.toast);
  const level = clubLevelFor(game.resources.clubXp);
  const income = idleCoinsPerHour(level, game.upgrades.stadium);

  return (
    <div className="stack">
      <Tip topic="upgrades" title="Upgrades do Club">
        Upgrades são permanentes. O custo é em Coins, e cada nível exige um nível mínimo do Club, alcançado com XP das partidas e missões.
      </Tip>
      <div className="upgrade-grid">
        {CLUB_UPGRADE_IDS.map((id: ClubUpgradeId) => {
          const def = CLUB_UPGRADES[id];
          const current = game.upgrades[id];
          const cost = upgradeCost(id, current);
          const payback = id === 'stadium' ? stadiumPaybackHours(current, income) : null;
          const canBuy = Boolean(cost) && game.resources.coins >= (cost?.coins ?? Infinity) && level >= (cost?.requiredClubLevel ?? Infinity);
          return (
            <Panel key={id} title={def.name} eyebrow={`Nível ${current}/${def.maxLevel}`} id={`upg-${id}`} className="upgrade-card">
              <p className="muted small">{def.description}</p>
              <Bar value={current} max={def.maxLevel} label={`${def.name}: nível ${current} de ${def.maxLevel}`} />
              <dl className="kv small">
                <div><dt>Efeito atual</dt><dd>{current > 0 ? upgradeEffect(id, current) : 'Nenhum ainda'}</dd></div>
                <div><dt>Próximo nível</dt><dd>{upgradeBenefitNext(id, current)}</dd></div>
                {cost ? <div><dt>Custo</dt><dd>{fmt(cost.coins)} Coins · exige nível {cost.requiredClubLevel} do Club</dd></div> : null}
                {payback !== null ? <div><dt>Retorno estimado</dt><dd>{payback === null ? '—' : `${payback} h de Idle income`}</dd></div> : null}
              </dl>
              {cost ? (
                <Button
                  variant="primary"
                  icon={Wrench}
                  disabled={!canBuy}
                  onClick={() => {
                    const res = buy(id);
                    if (!res.ok) toast(res.error ?? 'Não foi possível melhorar.', 'warning');
                  }}
                >
                  Melhorar para nível {current + 1}
                </Button>
              ) : (
                <p className="alert-soft ok">Nível máximo</p>
              )}
              {cost && level < cost.requiredClubLevel ? <p className="muted small">Suba o Club para o nível {cost.requiredClubLevel}.</p> : null}
            </Panel>
          );
        })}
      </div>
      <p className="muted small">Idle income atual: {fmt(income)} Coins por hora. Estádio e Academia aumentam o acúmulo sem exigir espera artificial.</p>
    </div>
  );
}

function ClubInfo() {
  const game = useGame((s) => s.game);
  const rename = useGame((s) => s.renameClub);
  const collect = useGame((s) => s.collectIdle);
  const toast = useGame((s) => s.toast);
  const now = useNow(30_000);
  const [name, setName] = useState(game.clubName);
  const level = clubLevelFor(game.resources.clubXp);
  const nextXp = clubXpFor(level + 1);
  const currentXp = clubXpFor(level);
  const pending = computeIdle({
    lastCollectedAt: game.idle.lastCollectedAt,
    now,
    clubLevel: level,
    stadiumLevel: game.upgrades.stadium,
    youthLevel: game.upgrades.youthAcademy,
  });

  return (
    <div className="grid-2">
      <Panel title="Identidade" eyebrow="Club" id="club-identity">
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const res = rename(name);
            if (res.ok) toast('Nome do Club atualizado.', 'success');
            else toast(res.error ?? 'Nome inválido.', 'warning');
          }}
        >
          <label className="field">
            <span>Nome do Club (até 40 caracteres)</span>
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <Button type="submit" variant="primary">Salvar nome</Button>
        </form>
        <dl className="kv">
          <div><dt>Nível do Club</dt><dd>{level}</dd></div>
          <div><dt>Experiência de Club</dt><dd>{fmt(game.resources.clubXp)} XP</dd></div>
        </dl>
        <Bar value={game.resources.clubXp - currentXp} max={Math.max(1, nextXp - currentXp)} label="Progresso para o próximo nível do Club" />
        <p className="muted small">Próximo nível em {fmt(Math.max(0, nextXp - game.resources.clubXp))} XP.</p>
      </Panel>

      <Panel title="Idle income" eyebrow="Sem espera artificial" id="idle-detail">
        <dl className="kv">
          <div><dt>Taxa</dt><dd>{fmt(selectors.idleRate(game))} Coins por hora</dd></div>
          <div><dt>Teto de acúmulo</dt><dd>{selectors.idleCap(game)} horas</dd></div>
          <div><dt>Acumulado agora</dt><dd>{fmt(pending.coins)} Coins · {pending.elapsedMs > 0 ? formatDuration(pending.elapsedMs) : 'agora'}</dd></div>
          <div><dt>Total coletado</dt><dd>{fmt(game.idle.totalCollected)} Coins</dd></div>
        </dl>
        <Button
          variant="primary"
          icon={Gift}
          disabled={pending.coins <= 0}
          onClick={() => {
            const res = collect();
            if (res.ok && res.data) toast(`+${fmt(res.data.coins)} Coins coletadas`, 'success');
            else if (res.error) toast(res.error, 'warning');
          }}
        >
          Collect income
        </Button>
        <p className="muted small">A Idle income nunca avança fases, nunca declara vitórias e nunca concede atletas.</p>
      </Panel>

      <Panel title="Recursos e limites" eyebrow="Economia" id="economy">
        <ul className="list-plain small">
          <li>Coins: partidas, baús, missões, Achievements, idle e reciclagem.</li>
          <li>XP de Club: partidas, missões e coleta idle. Libera Upgrades.</li>
          <li>Training tokens: vitórias, empates, derrotas e missões.</li>
          <li>Fragments: baús (duplicatas), vitórias e missões. Evoluem estrelas.</li>
          <li>items: {game.items.length} de {inventoryCapacity(game.upgrades.storage)} espaços. Atletas: {game.athletes.length} de {ECONOMY.rosterCap}.</li>
        </ul>
      </Panel>

      <Panel title="Nível dos atletas" eyebrow="Teto" id="caps">
        <ul className="list-plain small">
          {game.athletes.slice(0, 6).map((a) => {
            const t = templateById(a.templateId);
            return (
              <li key={a.id} className="row">
                <RarityTag rarity={t?.rarity ?? 'common'} />
                <span className="grow">{t?.name ?? 'Atleta'}</span>
                <span className="small">Nível {a.level} · {'★'.repeat(a.stars)}</span>
              </li>
            );
          })}
        </ul>
        <p className="muted small">Teto de nível = 10 + 5 × (estrelas − 1) + 4 × nível do Centro de Treinamento (máx. 40). Raridade define o potencial inicial, não o teto.</p>
      </Panel>
    </div>
  );
}
