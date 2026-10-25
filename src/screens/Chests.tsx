import { useEffect, useMemo, useState } from 'react';
import { Gift, Info, Package, ShoppingBag, Sparkles } from 'lucide-react';
import { useGame, type ChestOpenSummary } from '../state/store';
import { useNav } from '../ui/nav';
import { useT } from '../i18n';
import { Bar, Button, Modal, Panel, Pill, RarityTag, Tip } from '../ui/common';
import { ChestArt, Portrait } from '../ui/art';
import { CHESTS, ECONOMY, FRAGMENTS_FROM_DUPLICATE, PITY } from '../domain/balance';
import { chestOdds, effectiveWeights, validateChestTables } from '../domain/chests';
import { ATHLETE_TEMPLATES } from '../data/athletes';
import { ITEM_TEMPLATES } from '../data/items';
import { CHEST_NAME_PT, RARITY_NAME_PT } from '../domain/labels';
import { CHEST_KINDS, RARITIES, type ChestKind, type Rarity } from '../domain/types';
import { RARITY_COLOR, dateLabel, clock, fmt } from '../ui/theme';
import { confirmAction } from '../ui/confirm';
import { sfx } from '../audio/sound';
import { clubLevelFor, inventoryCapacity } from '../domain/economy';
import { useReducedMotion } from '../ui/hooks';

export function Chests() {
  const t = useT();
  const game = useGame((s) => s.game);
  const buy = useGame((s) => s.buyChest);
  const openStock = useGame((s) => s.openStockChest);
  const toast = useGame((s) => s.toast);
  const go = useNav((s) => s.go);
  const [summary, setSummary] = useState<ChestOpenSummary | null>(null);
  const [preview, setPreview] = useState<ChestKind | null>(null);
  const [busy, setBusy] = useState(false);
  const batchUnlocked = clubLevelFor(game.resources.clubXp) >= 3;
  const validation = useMemo(() => validateChestTables(), []);
  const capacity = inventoryCapacity(game.upgrades.storage);

  const run = async (kind: ChestKind, count: number, source: 'shop' | 'stock') => {
    const price = CHESTS[kind].price * count;
    if (source === 'shop' && game.resources.coins < price) {
      toast(`Faltam ${fmt(price - game.resources.coins)} Coins.`, 'warning');
      return;
    }
    if (kind === 'ouro' || count > 3) {
      const ok = await confirmAction({
        title: `Abrir ${count} ${CHEST_NAME_PT[kind]}?`,
        message: source === 'shop'
          ? `Custo: ${fmt(price)} Coins. As probabilidades estão na ficha do baú. Atletas repetidos viram Fragments.`
          : 'Os baús guardados serão consumidos.',
        confirmLabel: 'Abrir',
      });
      if (!ok) return;
    }
    setBusy(true);
    const res = source === 'shop' ? buy(kind, count) : openStock(kind, count);
    setBusy(false);
    if (!res.ok || !res.data) {
      toast(res.error ?? 'Não foi possível abrir o baú.', 'warning');
      return;
    }
    sfx.chestOpen();
    setSummary(res.data);
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{t('chests.title')}</p>
          <h1>{t('chests.title')}</h1>
        </div>
        <Pill>{fmt(game.resources.coins)} Coins</Pill>
      </header>

      <Tip topic="chests" title="Como funcionam os baús">
        Cada baú faz alguns sorteios. Cada sorteio é um atleta (60%) ou um item (40%), com raridade pela tabela do baú. As probabilidades são públicas, e a proteção (pity) garante uma raridade alta após sequências longas.
      </Tip>

      <div className="chest-grid">
        {CHEST_KINDS.map((kind) => {
          const config = CHESTS[kind];
          const stock = game.chestStock[kind];
          const odds = chestOdds(kind, game.pity);
          return (
            <Panel key={kind} title={config.name} eyebrow={`${config.rolls} sorteios`} id={`chest-${kind}`} className="chest-card" actions={<ChestArt kind={kind} size={44} />}>
              <p className="muted small">
                Preço: <strong>{fmt(config.price)} Coins</strong> · Guardados: {stock}
              </p>
              <p className="small">
                Coins: {fmt(config.coinsRange[0])}–{fmt(config.coinsRange[1])} · Fragments: {config.fragmentsRange[0]}–{config.fragmentsRange[1]}
              </p>
              <ul className="odds" aria-label={`Chances por sorteio em ${config.name}`}>
                {odds.map(({ rarity, percent }) => (
                  <li key={rarity}>
                    <span style={{ color: RARITY_COLOR[rarity] }}>{RARITY_NAME_PT[rarity]}</span>
                    <Bar value={percent} max={100} color={RARITY_COLOR[rarity]} label={`${RARITY_NAME_PT[rarity]} ${percent}%`} />
                    <span className="small">{percent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span>
                  </li>
                ))}
              </ul>
              <div className="row wrap">
                <Button variant="primary" icon={ShoppingBag} disabled={busy || game.resources.coins < config.price} onClick={() => run(kind, 1, 'shop')}>
                  Comprar 1
                </Button>
                <Button disabled={busy || !batchUnlocked || game.resources.coins < config.price * 10} onClick={() => run(kind, 10, 'shop')}>
                  Comprar 10
                </Button>
                <Button icon={Package} disabled={busy || stock < 1} onClick={() => run(kind, 1, 'stock')}>
                  Abrir guardado ({stock})
                </Button>
                <Button variant="ghost" icon={Info} onClick={() => setPreview(kind)}>Ver conteúdo possível</Button>
              </div>
              {!batchUnlocked ? <p className="muted small">Aberturas em lote são liberadas no nível 3 do Club.</p> : null}
            </Panel>
          );
        })}
      </div>

      <div className="grid-2">
        <Panel title="Proteção (pity)" eyebrow="Sequências sem raridade alta" id="pity">
          <p className="small">Épico ou superior: após {PITY.epicAfter} sorteios sem ele, o próximo sorteio é garantido épico ou superior.</p>
          <Bar value={game.pity.sinceEpic} max={PITY.epicAfter} label="Contador de épico" />
          <p className="muted small">{game.pity.sinceEpic}/{PITY.epicAfter} sorteios desde o último épico ou superior.</p>
          <p className="small">Lendário ou superior: após {PITY.legendAfter} sorteios sem ele, o próximo é garantido lendário ou mítico.</p>
          <Bar value={game.pity.sinceLegend} max={PITY.legendAfter} label="Contador de lendário" color="var(--gold)" />
          <p className="muted small">{game.pity.sinceLegend}/{PITY.legendAfter} sorteios desde o último lendário ou superior.</p>
        </Panel>

        <Panel title="Duplicatas e limites" eyebrow="Conversão" id="duplicates">
          <p className="small">Atletas repetidos viram Fragments, conforme a raridade:</p>
          <ul className="list-plain small">
            {RARITIES.map((r) => (
              <li key={r}><RarityTag rarity={r} /> {FRAGMENTS_FROM_DUPLICATE[r]} Fragments</li>
            ))}
          </ul>
          <p className="muted small">
            Fragments evoluem estrelas. items excedentes com inventário cheio viram Coins. Com o Squad cheio ({ECONOMY.rosterCap} atletas), novos atletas viram Fragments.
          </p>
          <p className="muted small">Inventário: {game.items.length}/{capacity} items.</p>
          <Button variant="ghost" icon={Gift} onClick={() => go('club')}>Ver equipamentos</Button>
        </Panel>

        <Panel title="Transparência" eyebrow="Dados do baú" id="validation">
          {validation.length === 0 ? (
            <p className="alert-soft ok">Tabelas validadas: as probabilidades de cada baú somam 100% e há conteúdo para cada raridade.</p>
          ) : (
            <ul className="problems">{validation.map((v) => <li key={v}>{v}</li>)}</ul>
          )}
          <p className="muted small">
            Modo local: o sorteio roda no seu navegador, como demonstração. Não há servidor para validar aberturas, e nada é vendido com dinheiro real.
          </p>
        </Panel>

        <Panel title="Histórico de aberturas" eyebrow="Últimas 30" id="openings">
          {game.openings.length === 0 ? (
            <p className="muted small">Nenhum baú aberto ainda.</p>
          ) : (
            <ul className="list-plain openings">
              {game.openings.slice(0, 12).map((o) => (
                <li key={o.id}>
                  <strong>{o.count}× {CHEST_NAME_PT[o.kind]}</strong> · {dateLabel(o.at)} {clock(o.at)}
                  <p className="muted small">
                    +{fmt(o.coins)} Coins · +{fmt(o.fragments)} Fragments
                    {o.highlights.length ? ` · ${o.highlights.slice(0, 3).join(', ')}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <PreviewModal kind={preview} onClose={() => setPreview(null)} />
      <OpenModal summary={summary} onClose={() => setSummary(null)} />
    </div>
  );
}

function PreviewModal({ kind, onClose }: { kind: ChestKind | null; onClose: () => void }) {
  const game = useGame((s) => s.game);
  const owned = new Set(game.athletes.map((a) => a.templateId));
  const seen = new Set(game.encyclopedia.athletes);
  const weights = kind ? effectiveWeights(kind, game.pity).weights : null;
  return (
    <Modal open={Boolean(kind)} onClose={onClose} title={kind ? `Conteúdo possível: ${CHEST_NAME_PT[kind]}` : 'Conteúdo'} wide>
      {kind && weights ? (
        <div className="stack">
          <p className="small">Raridades possíveis neste momento (já considerando o pity):</p>
          <ul className="odds">
            {RARITIES.map((r) => (
              <li key={r}>
                <RarityTag rarity={r} />
                <Bar value={weights[r]} max={100} color={RARITY_COLOR[r]} label={`${RARITY_NAME_PT[r]} ${weights[r]}%`} />
                <span className="small">{weights[r].toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span>
              </li>
            ))}
          </ul>
          {RARITIES.map((r) => {
            const list = ATHLETE_TEMPLATES.filter((t) => t.rarity === r);
            return (
              <section key={r} aria-label={`Atletas ${RARITY_NAME_PT[r]}`}>
                <h3 className="section-title" style={{ color: RARITY_COLOR[r] }}>Atletas {RARITY_NAME_PT[r]} ({list.length})</h3>
                <ul className="preview-grid">
                  {list.map((t) => {
                    const known = owned.has(t.id) || seen.has(t.id);
                    return (
                      <li key={t.id} className="preview-item">
                        <Portrait name={t.name} hue={t.hue} position={t.position} size={40} locked={!known} rarity={t.rarity} />
                        <span className="small">{known ? t.name : 'Atleta desconhecido'}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <section aria-label="items possíveis">
            <h3 className="section-title">items possíveis ({ITEM_TEMPLATES.length})</h3>
            <ul className="list-plain small">
              {ITEM_TEMPLATES.map((t) => (
                <li key={t.id}><RarityTag rarity={t.rarity} /> {t.name}</li>
              ))}
            </ul>
          </section>
          <p className="muted small">Silhuetas representam conteúdo ainda não visto. Atletas repetidos viram Fragments.</p>
        </div>
      ) : null}
    </Modal>
  );
}

function OpenModal({ summary, onClose }: { summary: ChestOpenSummary | null; onClose: () => void }) {
  const setting = useGame((s) => s.game.settings.reduceMotion);
  const reduced = useReducedMotion(setting);
  const [shown, setShown] = useState(0);
  const total = summary?.rolls.length ?? 0;
  const close = () => {
    setShown(0);
    onClose();
  };

  return (
    <Modal
      open={Boolean(summary)}
      onClose={close}
      title={summary ? `Abertura: ${CHEST_NAME_PT[summary.kind]}` : 'Abertura'}
      wide
      footer={
        summary ? (
          <>
            {shown < total ? <Button variant="ghost" onClick={() => setShown(total)}>Revelar tudo</Button> : null}
            <Button variant="primary" onClick={() => (shown < total ? setShown((s) => Math.min(total, s + 1)) : close())}>
              {shown < total ? 'Revelar próximo' : 'Fechar'}
            </Button>
          </>
        ) : null
      }
    >
      {summary ? (
        <div className="opening">
          <p className="small">
            {summary.count > 1 ? `${summary.count} baús abertos. ` : ''}
            Coins: +{fmt(summary.coins)} · Gems: +{fmt(summary.gems)} · Fragments: +{fmt(summary.fragments)}
          </p>
          {summary.warnings.length > 0 ? (
            <ul className="problems small">{summary.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          ) : null}
          <ol className="reveal-list" aria-live="polite">
            {summary.rolls.slice(0, shown).map((roll, i) => (
              <RevealRow key={`${roll.templateId}-${i}`} index={i} roll={roll} reduced={reduced} />
            ))}
          </ol>
          {shown < total ? (
            <p className="muted small">{total - shown} sorteio(s) restante(s).</p>
          ) : (
            <p className="alert-soft ok"><Sparkles aria-hidden="true" size={14} /> Abertura completa.</p>
          )}
          <p className="muted small">Pity antes: {summary.pityBefore.sinceEpic}/{PITY.epicAfter} · depois: {summary.pityAfter.sinceEpic}/{PITY.epicAfter}</p>
        </div>
      ) : null}
    </Modal>
  );
}

function RevealRow({ roll, index, reduced }: { roll: ChestOpenSummary['rolls'][number]; index: number; reduced: boolean }) {
  const rarity: Rarity = roll.rarity;
  useEffect(() => {
    sfx.reveal(rarity);
  }, [rarity]);
  const template = roll.kind === 'athlete' ? ATHLETE_TEMPLATES.find((t) => t.id === roll.templateId) : undefined;
  return (
    <li
      className={`reveal ${reduced ? '' : 'reveal-anim'}`}
      style={{ borderColor: RARITY_COLOR[rarity], animationDelay: reduced ? '0ms' : `${index * 40}ms` }}
    >
      {template ? (
        <Portrait name={template.name} hue={template.hue} position={template.position} size={44} rarity={template.rarity} />
      ) : (
        <span className="item-dot" style={{ background: RARITY_COLOR[rarity] }} aria-hidden="true" />
      )}
      <div className="grow">
        <p className="strong">{roll.name}</p>
        <p className="small muted">
          {roll.kind === 'athlete'
            ? roll.duplicate ? `Repetido: +${roll.duplicateFragments} Fragments` : roll.athlete ? 'Novo atleta no Squad' : `Convertido: +${roll.duplicateFragments} Fragments`
            : roll.item ? 'Item guardado no inventário' : 'Item reciclado'}
          {roll.pityForced ? ' · pity' : ''}
        </p>
      </div>
      <RarityTag rarity={rarity} />
    </li>
  );
}
