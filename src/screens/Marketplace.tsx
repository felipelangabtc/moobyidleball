import { useState, useMemo } from 'react';
import { Coins, Package, ShoppingBag, Store } from 'lucide-react';
import { useGame } from '../state/store';
import { Button, EmptyState, Panel, Pill, Tabs, Tip } from '../ui/common';
import { Portrait } from '../ui/art';
import { templateById, ATHLETE_TEMPLATES } from '../data/athletes';
import { ITEM_TEMPLATES } from '../data/items';
import { RARITY_COLOR, fmt } from '../ui/theme';
import { createRng, hashString } from '../domain/rng';
import { itemBonusAtLevel, itemName } from '../domain/economy';
import { RARITY_NAME_PT } from '../domain/labels';
import { clubLevelFor } from '../domain/economy';

type Tab = 'sell' | 'buy' | 'listings';

export function Marketplace() {
  const [tab, setTab] = useState<Tab>('sell');
  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Mercado</p>
          <h1>Mercado de transferências (simulado)</h1>
        </div>
      </header>
      <Tip topic="marketplace" title="Mercado simulado">
        Este mercado é assíncrono e simulado: não há multiplayer real. Você lista atletas e itens para venda e "compradores" (simulados, baseados no nível do seu clube) os adquirem com o tempo. Você também pode comprar ofertas de "vendedores" simulados.
      </Tip>
      <Tabs
        label="Seções do mercado"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'sell', label: 'Vender', icon: ShoppingBag },
          { id: 'buy', label: 'Comprar', icon: Store },
          { id: 'listings', label: 'Meus anúncios', icon: Package },
        ]}
      />
      {tab === 'sell' ? <SellTab /> : null}
      {tab === 'buy' ? <BuyTab /> : null}
      {tab === 'listings' ? <ListingsTab /> : null}
    </div>
  );
}

function SellTab() {
  const game = useGame((s) => s.game);
  const listAthlete = useGame((s) => s.listAthlete);
  const listItem = useGame((s) => s.listItem);
  const toast = useGame((s) => s.toast);
  const [price, setPrice] = useState<Record<string, number>>({});

  const sellableAthletes = game.athletes.filter((a) => !game.lineup.slots.includes(a.id));
  const sellableItems = game.items.filter((i) => !Object.values(game.equipped).some((s) => Object.values(s).includes(i.id)));

  return (
    <div className="stack">
      <Panel title="Vender atletas" eyebrow="Fora da escalação" id="sell-athletes">
        {sellableAthletes.length === 0 ? (
          <EmptyState title="Nenhum atleta disponível para venda" icon={Store}>
            Tire um atleta da escalação para anunciá-lo.
          </EmptyState>
        ) : (
          <ul className="roster-grid">
            {sellableAthletes.map((a) => {
              const t = templateById(a.templateId);
              if (!t) return null;
              return (
                <li key={a.id} className="roster-card">
                  <Portrait name={t.name} hue={t.hue} position={t.position} size={44} rarity={t.rarity} />
                  <div className="grow">
                    <p className="strong">{t.name}</p>
                    <p className="muted small">OVR { /* placeholder */ } · {'★'.repeat(a.stars)}</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={price[a.id] ?? 100}
                    onChange={(e) => setPrice((p) => ({ ...p, [a.id]: Number(e.target.value) }))}
                    style={{ width: '90px' }}
                  />
                  <Button size="sm" variant="primary" icon={ShoppingBag} onClick={() => {
                    const res = listAthlete(a.id, price[a.id] ?? 100);
                    if (res.ok) toast('Atleta anunciado no mercado.', 'success');
                    else toast(res.error ?? 'Não foi possível anunciar.', 'warning');
                  }}>
                    Anunciar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Vender itens" eyebrow="Não equipados" id="sell-items">
        {sellableItems.length === 0 ? (
          <EmptyState title="Nenhum item disponível para venda" icon={Package}>
            Desequipe um item para anunciá-lo.
          </EmptyState>
        ) : (
          <ul className="item-list">
            {sellableItems.map((item) => (
              <li key={item.id} className="item-row">
                <span className="item-dot" style={{ background: RARITY_COLOR[item.rarity] }} aria-hidden="true" />
                <div className="grow">
                  <p className="strong">{itemName(item)} · nível {item.level}</p>
                  <p className="small">{formatBonus(itemBonusAtLevel(item))}</p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={price[item.id] ?? 50}
                  onChange={(e) => setPrice((p) => ({ ...p, [item.id]: Number(e.target.value) }))}
                  style={{ width: '90px' }}
                />
                <Button size="sm" variant="primary" icon={ShoppingBag} onClick={() => {
                  const res = listItem(item.id, price[item.id] ?? 50);
                  if (res.ok) toast('Item anunciado no mercado.', 'success');
                  else toast(res.error ?? 'Não foi possível anunciar.', 'warning');
                }}>
                  Anunciar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function formatBonus(bonus: Partial<Record<string, number>>): string {
  return Object.entries(bonus)
    .filter(([, v]) => v)
    .map(([k, v]) => `+${v} ${k}`)
    .join(', ');
}

function BuyTab() {
  const game = useGame((s) => s.game);
  const buyMarket = useGame((s) => s.buyMarketOffering);
  const toast = useGame((s) => s.toast);
  const level = clubLevelFor(game.resources.clubXp);
  const offerings = useMemo(() => generateOfferings(game.nextId, level), [game.nextId, level]);

  return (
    <div className="stack">
      <Panel title="Ofertas do mercado" eyebrow="Vendedores simulados" id="buy-offers">
        <p className="muted small">Ofertas geradas localmente com base no nível do seu clube. Não há vendedores reais.</p>
        <ul className="roster-grid">
          {offerings.map((o) => (
            <li key={o.id} className="roster-card">
              {o.kind === 'athlete' ? (
                <Portrait name={o.name} hue={o.hue} position={o.position as any} size={44} rarity={o.rarity} />
              ) : (
                <span className="item-dot" style={{ background: RARITY_COLOR[o.rarity] }} aria-hidden="true" />
              )}
              <div className="grow">
                <p className="strong">{o.name}</p>
                <p className="muted small">{o.kind === 'athlete' ? `${o.position} · ${RARITY_NAME_PT[o.rarity]}` : `${o.slot} · ${RARITY_NAME_PT[o.rarity]}`}</p>
              </div>
              <Pill>{fmt(o.price)} Coins</Pill>
              <Button size="sm" variant="primary" disabled={game.resources.coins < o.price} onClick={() => {
                const res = buyMarket(o);
                if (res.ok) toast('Compra realizada.', 'success');
                else toast(res.error ?? 'Não foi possível comprar.', 'warning');
              }}>
                Comprar
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

interface Offering {
  id: string;
  kind: 'athlete' | 'item';
  name: string;
  position?: string;
  slot?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legend' | 'mythic';
  hue: number;
  price: number;
}

function generateOfferings(seed: number, level: number): Offering[] {
  const rng = createRng(hashString(`market:${seed}:${level}`));
  const out: Offering[] = [];
  for (let i = 0; i < 8; i++) {
    if (rng.chance(0.5)) {
      const t = rng.pick(ATHLETE_TEMPLATES);
      out.push({
        id: `mk-a-${seed}-${i}`,
        kind: 'athlete',
        name: t.name,
        position: t.position,
        rarity: t.rarity,
        hue: t.hue,
        price: 100 + level * 20 + rng.int(0, 200),
      });
    } else {
      const t = rng.pick(ITEM_TEMPLATES);
      out.push({
        id: `mk-i-${seed}-${i}`,
        kind: 'item',
        name: t.name,
        slot: t.slot,
        rarity: t.rarity,
        hue: 0,
        price: 40 + level * 10 + rng.int(0, 120),
      });
    }
  }
  return out;
}

function ListingsTab() {
  const game = useGame((s) => s.game);
  const collect = useGame((s) => s.collectMarketEarnings);
  const cancel = useGame((s) => s.cancelListing);
  const toast = useGame((s) => s.toast);
  const listings = game.marketplace.listings;

  return (
    <div className="stack">
      <Panel title="Ganhos do mercado" eyebrow="Simulado" id="earnings">
        <p className="big-number">{fmt(game.marketplace.earnings)} Coins acumulados</p>
        <Button variant="primary" icon={Coins} disabled={game.marketplace.earnings <= 0} onClick={() => {
          const res = collect();
          if (res.ok) toast(`+${fmt(game.marketplace.earnings)} Coins coletados.`, 'success');
        }}>
          Coletar ganhos
        </Button>
        <p className="muted small">Compradores simulados adquirem seus anúncios com o tempo. Colete os ganhos aqui.</p>
      </Panel>

      <Panel title="Meus anúncios" eyebrow={`${listings.filter((l) => !l.soldAt).length} ativos`} id="listings">
        {listings.length === 0 ? (
          <EmptyState title="Nenhum anúncio" icon={Package}>
            Anuncie atletas ou itens na aba Vender.
          </EmptyState>
        ) : (
          <ul className="list-plain">
            {listings.map((l) => {
              const name = l.kind === 'athlete' ? (templateById(l.refId)?.name ?? 'Atleta') : (ITEM_TEMPLATES.find((t) => t.id === l.refId)?.name ?? 'Item');
              return (
                <li key={l.id} className="item-row">
                  <div className="grow">
                    <p className="strong">{name}</p>
                    <p className="muted small">{l.kind === 'athlete' ? 'Atleta' : 'Item'} · {fmt(l.price)} Coins</p>
                    {l.soldAt ? <Pill color="var(--ok)">Vendido · +{fmt(l.price)} Coins</Pill> : <Pill>Aguardando comprador</Pill>}
                  </div>
                  {!l.soldAt ? (
                    <Button size="sm" variant="ghost" onClick={() => {
                      const res = cancel(l.id);
                      if (res.ok) toast('Anúncio cancelado.', 'info');
                    }}>
                      Cancelar
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
