import { useState } from 'react';
import { BookOpen, Map, Shield as ShieldIcon, Shirt } from 'lucide-react';
import { useGame } from '../state/store';
import { useT } from '../i18n';
import { Panel, Pill, RarityTag, Tabs, Tip } from '../ui/common';
import { Portrait } from '../ui/art';
import { ATHLETE_TEMPLATES } from '../data/athletes';
import { ITEM_TEMPLATES } from '../data/items';
import { BIOMES } from '../data/biomes';
import { POSITION_SHORT } from '../domain/football';
import { RARITY_NAME_PT } from '../domain/labels';
import { RARITY_COLOR } from '../ui/theme';
import { CAMPAIGN } from '../domain/balance';

type EncTab = 'adversarios' | 'atletas' | 'items' | 'temporadas';

export function Encyclopedia() {
  const t = useT();
  const [tab, setTab] = useState<EncTab>('adversarios');
  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{t('encyc.title')}</p>
          <h1>{t('encyc.title')}</h1>
        </div>
      </header>
      <Tabs
        label="Seções da enciclopédia"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'adversarios', label: 'Adversários', icon: ShieldIcon },
          { id: 'atletas', label: 'Atletas', icon: Shirt },
          { id: 'items', label: 'items', icon: BookOpen },
          { id: 'temporadas', label: 'Temporadas', icon: Map },
        ]}
      />
      {tab === 'adversarios' ? <Opponents /> : null}
      {tab === 'atletas' ? <Athletes /> : null}
      {tab === 'items' ? <Items /> : null}
      {tab === 'temporadas' ? <Seasons /> : null}
    </div>
  );
}

function Opponents() {
  const game = useGame((s) => s.game);
  const seen = game.encyclopedia.opponents;
  return (
    <div className="stack">
      <Tip topic="encyclopedia" title="Livro de adversários">
        Cada Club enfrentado entra aqui. Os ainda não enfrentados aparecem como silhueta. Os nomes são fictícios.
      </Tip>
      {seen.length === 0 ? (
        <p className="muted">Você ainda não enfrentou nenhum Club.</p>
      ) : (
        <ul className="opponent-list">
          {seen.map((name) => (
            <li key={name} className="opponent-chip">
              <ShieldIcon aria-hidden="true" size={18} />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{seen.length} Clubs registrados. Cada fase traz um novo adversário gerado de forma determinística.</p>
    </div>
  );
}

function Athletes() {
  const game = useGame((s) => s.game);
  const known = new Set(game.encyclopedia.athletes);
  const ownedNow = new Set(game.athletes.map((a) => a.templateId));
  return (
    <div className="stack">
      <p className="muted small">{known.size + [...ownedNow].filter((id) => !known.has(id)).length} de {ATHLETE_TEMPLATES.length} atletas vistos.</p>
      <ul className="preview-grid big">
        {ATHLETE_TEMPLATES.map((t) => {
          const isKnown = known.has(t.id) || ownedNow.has(t.id);
          return (
            <li key={t.id} className="preview-item">
              <Portrait name={t.name} hue={t.hue} position={t.position} size={56} locked={!isKnown} rarity={t.rarity} />
              <span className="strong small">{isKnown ? t.name : '???'}</span>
              <span className="muted small">{isKnown ? `${POSITION_SHORT[t.position]} · ${t.nationality}` : 'Não descoberto'}</span>
              <RarityTag rarity={t.rarity} />
              {isKnown ? <p className="muted small">{t.bio}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Items() {
  const game = useGame((s) => s.game);
  const known = new Set(game.encyclopedia.items);
  return (
    <div className="stack">
      <p className="muted small">{known.size} de {ITEM_TEMPLATES.length} equipamentos vistos.</p>
      <ul className="item-catalog">
        {ITEM_TEMPLATES.map((t) => {
          const isKnown = known.has(t.id);
          return (
            <li key={t.id} className="catalog-item" style={{ borderColor: RARITY_COLOR[t.rarity] }}>
              <div className="grow">
                <p className="strong">{isKnown ? t.name : 'Equipamento desconhecido'}</p>
                <p className="muted small">{isKnown ? t.flavor : 'Obtenha este item em baús ou partidas.'}</p>
                {isKnown ? <p className="small">{Object.entries(t.bonus).map(([k, v]) => `+${v} ${k}`).join(', ')}</p> : null}
              </div>
              <Pill color={RARITY_COLOR[t.rarity]}>{RARITY_NAME_PT[t.rarity]}</Pill>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Seasons() {
  const game = useGame((s) => s.game);
  return (
    <div className="stack">
      <Tip topic="seasons" title="Temporadas e biomas">
        Cada bioma é uma temporada com {CAMPAIGN.phasesPerBiome} fases. Ao vencer o chefe, o próximo bioma abre, com visual e adversários próprios.
      </Tip>
      <div className="season-grid">
        {BIOMES.map((b, index) => {
          const firstPhase = index * CAMPAIGN.phasesPerBiome + 1;
          const unlocked = game.campaign.highestCleared + 1 >= firstPhase;
          return (
            <Panel key={b.id} title={b.name} eyebrow={`Temporada ${index + 1}`} id={`biome-${b.id}`} className={unlocked ? '' : 'is-locked'}>
              <p className="muted small">{b.subtitle}</p>
              <p className="small">Estádio: {b.stadium} · Baú típico: {b.chest}</p>
              <div className="biome-swatch" style={{ background: `linear-gradient(90deg, ${b.grass[0]}, ${b.grass[1]})` }} aria-hidden="true" />
              {unlocked ? <Pill>Desbloqueada</Pill> : <Pill>Bloqueada · fase {firstPhase}</Pill>}
            </Panel>
          );
        })}
      </div>
      <p className="muted small">Após o último bioma, a Campaign continua em ciclo com adversários mais fortes (teto de OVR em 95).</p>
    </div>
  );
}
