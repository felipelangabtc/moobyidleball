import { useState } from 'react';
import { Download, RotateCcw, Save, Upload, Volume2 } from 'lucide-react';
import { useGame } from '../state/store';
import { useT } from '../i18n';
import { Button, Panel, Toggle, Tip } from '../ui/common';
import { MATCH } from '../domain/balance';
import { confirmAction } from '../ui/confirm';
import { SAVE_KEY } from '../state/persistence';
import { sfx } from '../audio/sound';

export function Settings() {
  const game = useGame((s) => s.game);
  const settings = game.settings;
  const t = useT();
  const update = useGame((s) => s.updateSettings);
  const toast = useGame((s) => s.toast);
  const setTutorial = useGame((s) => s.setTutorial);
  const exportText = useGame((s) => s.exportSaveText);
  const importText = useGame((s) => s.importSaveText);
  const resetGame = useGame((s) => s.resetGame);
  const [exported, setExported] = useState('');
  const [importValue, setImportValue] = useState('');
  const loadMessage = useGame((s) => s.loadMessage);
  const tutorialsDismissed = Object.keys(game.tutorials).length;

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Configurações</p>
          <h1>Ajustes</h1>
        </div>
      </header>
      <Tip topic="settings" title="Ajustes do jogo">
        Tudo é salvo automaticamente no seu navegador. Use a exportação para guardar uma cópia antes de trocar de aparelho.
      </Tip>

      <div className="grid-2">
        <Panel title={t('settings.language')} eyebrow="Language" id="language">
          <label className="field">
            <span>{t('settings.language')}</span>
            <select value={settings.language} onChange={(e) => update({ language: e.target.value as 'pt' | 'en' })}>
              <option value="pt">{t('settings.language.pt')}</option>
              <option value="en">{t('settings.language.en')}</option>
            </select>
          </label>
        </Panel>
        <Panel title="Áudio" eyebrow="Efeitos sonoros" id="audio">
          <Toggle id="sound" label="Efeitos sonoros" description="Apito, gols, defesas e aberturas de baús." checked={settings.sound} onChange={(v) => update({ sound: v })} />
          <label className="field">
            <span>Volume: {Math.round(settings.volume * 100)}%</span>
            <input type="range" min={0} max={100} value={Math.round(settings.volume * 100)} disabled={!settings.sound} onChange={(e) => update({ volume: Number(e.target.value) / 100 })} />
          </label>
          <Button icon={Volume2} disabled={!settings.sound} onClick={() => sfx.goal()}>Testar som</Button>
        </Panel>

        <Panel title="Movimento e leitura" eyebrow="Acessibilidade" id="motion">
          <label className="field">
            <span>Animações</span>
            <select value={settings.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.value as 'system' | 'on' | 'off' })}>
              <option value="system">Seguir o sistema</option>
              <option value="on">Reduzir movimento</option>
              <option value="off">Animações completas</option>
            </select>
          </label>
          <label className="field">
            <span>Velocidade padrão da partida</span>
            <select value={settings.defaultSpeed} onChange={(e) => update({ defaultSpeed: Number(e.target.value) as 1 | 2 | 4 })}>
              {MATCH.speeds.map((v) => <option key={v} value={v}>{v}×</option>)}
            </select>
          </label>
          <p className="muted small">Ao reduzir o movimento, flashes de gol e animações de abertura são desativados. A navegação nunca depende de animações.</p>
        </Panel>

        <Panel title="Automação" eyebrow="Modo idle" id="automation">
          <Toggle id="auto-lineup" label="Escalação automática" description="Preenche vagas vazias quando um atleta fica indisponível." checked={settings.autoLineup} onChange={(v) => update({ autoLineup: v })} />
          <Toggle id="auto-collect" label="Collect income ao abrir" description="Recolhe automaticamente a Idle income acumulada." checked={settings.autoCollect} onChange={(v) => update({ autoCollect: v })} />
          <Toggle id="auto-play" label="Jogar fases automaticamente" description="Após vitórias na Campaign, começa a próxima fase sozinho. Uma derrota desliga esta opção." checked={settings.autoPlay} onChange={(v) => update({ autoPlay: v })} />
        </Panel>

        <Panel title="Dicas" eyebrow="Tutoriais" id="tips">
          <p className="muted small">{tutorialsDismissed} dica(s) dispensada(s) ou lida(s).</p>
          <Button icon={RotateCcw} onClick={() => {
            setTutorial('home', null);
            for (const topic of ['campaign', 'match', 'squad', 'chests', 'club', 'challenge', 'missions', 'equipment', 'upgrades', 'encyclopedia', 'stats', 'settings', 'seasons']) setTutorial(topic, null);
            toast('Dicas restauradas.', 'success');
          }}>
            ReView all as dicas
          </Button>
        </Panel>

        <Panel title="Salvamento e cópia" eyebrow="Dados locais" id="save-data">
          {loadMessage ? <p className="alert-soft">{loadMessage}</p> : null}
          <div className="row wrap">
            <Button icon={Download} onClick={() => {
              const text = exportText();
              setExported(text);
              navigator.clipboard?.writeText(text).then(
                () => toast('Save copiado para a área de transferência.', 'success'),
                () => toast('Copie o texto manualmente abaixo.', 'info'),
              );
            }}>
              Exportar save
            </Button>
          </div>
          {exported ? (
            <label className="field">
              <span>Texto do save (guarde em local seguro)</span>
              <textarea readOnly rows={4} value={exported} onFocus={(e) => e.currentTarget.select()} />
            </label>
          ) : null}
          <label className="field">
            <span>Importar save</span>
            <textarea rows={4} value={importValue} onChange={(e) => setImportValue(e.target.value)} placeholder="Cole aqui um save exportado" />
          </label>
          <Button
            icon={Upload}
            disabled={!importValue.trim()}
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Substituir progresso?',
                message: 'O save atual será substituído pelo texto importado. Exporte o atual antes se quiser preservá-lo.',
                confirmLabel: 'Importar',
                tone: 'danger',
              });
              if (!ok) return;
              const res = importText(importValue);
              if (res.ok) {
                setImportValue('');
                toast('Save importado com sucesso.', 'success');
              } else toast(res.error ?? 'Save inválido.', 'error');
            }}
          >
            Importar
          </Button>
          <Button
            variant="danger"
            icon={Save}
            onClick={async () => {
              const ok = await confirmAction({
                title: 'Apagar todo o progresso?',
                message: `Isto remove o Club, o Squad, os baús e o histórico salvos neste navegador (${SAVE_KEY}). Não há como recuperar sem uma exportação.`,
                confirmLabel: 'Apagar tudo',
                tone: 'danger',
              });
              if (!ok) return;
              resetGame();
              toast('Progresso apagado. Um novo Club começou.', 'info');
            }}
          >
            Apagar progresso
          </Button>
        </Panel>

        <Panel title="Segurança e limites" eyebrow="Transparência" id="security">
          <ul className="list-plain small">
            <li>Modo exclusivamente local: não há conta, login, servidor, pagamentos nem multiplayer.</li>
            <li>O save tem checksum para detectar corrupção. Quem controla o navegador pode editar o save, por isso o sorteio e as recompensas não são garantidos contra fraude.</li>
            <li>Recompensas offline são limitadas por horas e nunca avançam fases.</li>
            <li>Consolações de derrota têm limite diário.</li>
            <li>Nenhum dado pessoal é coletado. Nenhuma requisição externa é feita.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
