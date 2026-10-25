import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import {
  BarChart3,
  BookOpen,
  Gift,
  Home as HomeIcon,
  Map as MapIcon,
  Settings as SettingsIcon,
  Store,
  Target,
  Users,
  Wrench,
  Medal,
  X,
  Coins,
  ClipboardList,
  Gem,
} from 'lucide-react';
import { useGame } from './state/store';
import { I18nProvider, useT } from './i18n';
import { useNav, type Screen } from './ui/nav';
import { configureAudio } from './audio/sound';
import { useReducedMotion } from './ui/hooks';
import { useConfirm } from './ui/confirm';
import { Button, Modal } from './ui/common';
import { fmt } from './ui/theme';
import { formatDuration, type IdleSummary } from './domain/idle';
import { clubLevelFor } from './domain/economy';
import { Home } from './screens/Home';
import { Campaign } from './screens/Campaign';
import { MatchPrep } from './screens/MatchPrep';
import { MatchView } from './screens/MatchView';
import { Squad } from './screens/Squad';
import { Chests } from './screens/Chests';
import { Club } from './screens/Club';
import { Marketplace } from './screens/Marketplace';
import { Missions } from './screens/Missions';
import { Encyclopedia } from './screens/Encyclopedia';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { AthleteModal } from './screens/AthleteModal';
import { clock } from './ui/theme';

const PRIMARY_NAV: Array<{ id: Screen; icon: typeof HomeIcon }> = [
  { id: 'home', icon: HomeIcon },
  { id: 'campaign', icon: MapIcon },
  { id: 'squad', icon: Users },
  { id: 'chests', icon: Gift },
  { id: 'club', icon: Wrench },
];

const SECONDARY_NAV: Array<{ id: Screen; icon: typeof HomeIcon }> = [
  { id: 'marketplace', icon: Store },
  { id: 'missions', icon: ClipboardList },
  { id: 'encyclopedia', icon: BookOpen },
  { id: 'stats', icon: BarChart3 },
  { id: 'settings', icon: SettingsIcon },
];

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro na interface:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal" role="alert">
          <h1>Algo deu errado nesta tela.</h1>
          <p>Seu progresso continua salvo. Tente voltar ao início.</p>
          <p className="muted small">{this.state.error.message}</p>
          <Button variant="primary" onClick={() => {
            useNav.getState().go('home');
            this.setState({ error: null });
          }}>
            Voltar ao início
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function useAutosave() {
  useEffect(() => {
    let timer: number | null = null;
    const unsubscribe = useGame.subscribe((state, prev) => {
      if (state.game === prev.game || !state.ready) return;
      useGame.getState().setSaveStatus('saving');
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        useGame.getState().persist(Date.now());
      }, 400);
    });
    const flush = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      useGame.getState().persist(Date.now());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer) window.clearTimeout(timer);
    };
  }, []);
}

function ScreenSwitch({ screen }: { screen: Screen }) {
  switch (screen) {
    case 'home':
      return <Home />;
    case 'campaign':
      return <Campaign />;
    case 'prep':
      return <MatchPrep />;
    case 'match':
      return <MatchView />;
    case 'squad':
      return <Squad />;
    case 'chests':
      return <Chests />;
    case 'club':
      return <Club />;
    case 'marketplace':
      return <Marketplace />;
    case 'missions':
      return <Missions />;
    case 'encyclopedia':
      return <Encyclopedia />;
    case 'stats':
      return <Stats />;
    case 'settings':
      return <Settings />;
  }
}

function SaveIndicator() {
  const status = useGame((s) => s.saveStatus);
  const savedAt = useGame((s) => s.savedAt);
  const error = useGame((s) => s.saveError);
  let text = 'Progresso salvo automaticamente';
  if (status === 'saving') text = 'Salvando…';
  if (status === 'saved' && savedAt) text = `Salvo às ${clock(savedAt)}`;
  if (status === 'error') text = error ?? 'Falha ao salvar';
  return (
    <p className={`save-indicator ${status === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">
      {text}
    </p>
  );
}

function Navigation({ screen }: { screen: Screen }) {
  const go = useNav((s) => s.go);
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <>
      <nav className="sidebar" aria-label="Navegação principal">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">IB</span>
          <div>
            <p className="brand-name">Idle Ball</p>
            <p className="brand-sub">Temporada infinita</p>
          </div>
        </div>
        <ul className="nav-list">
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.id} id={item.id} icon={item.icon} active={screen === item.id || (item.id === 'campaign' && (screen === 'prep' || screen === 'match'))} onSelect={go} />
          ))}
        </ul>
        <p className="nav-group-title">Mais</p>
        <ul className="nav-list">
          {SECONDARY_NAV.map((item) => (
            <NavItem key={item.id} id={item.id} icon={item.icon} active={screen === item.id} onSelect={go} />
          ))}
        </ul>
        <div className="sidebar-foot">
          <SaveIndicator />
        </div>
      </nav>

      <nav className="bottom-nav" aria-label="Navegação principal (celular)">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = screen === item.id || (item.id === 'campaign' && (screen === 'prep' || screen === 'match'));
          return (
            <button key={item.id} type="button" className={`bottom-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => { go(item.id); setMoreOpen(false); }}>
              <Icon aria-hidden="true" size={20} />
              <span>{t(`nav.${item.id}`)}</span>
            </button>
          );
        })}
        <button type="button" className={`bottom-item ${moreOpen ? 'is-active' : ''}`} aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
          <Medal aria-hidden="true" size={20} />
          <span>Mais</span>
        </button>
        {moreOpen ? (
          <div className="bottom-more" role="menu">
            {SECONDARY_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" role="menuitem" className="bottom-more-item" onClick={() => { go(item.id); setMoreOpen(false); }}>
                  <Icon aria-hidden="true" size={18} />
                  {t(`nav.${item.id}`)}
                </button>
              );
            })}
          </div>
        ) : null}
      </nav>
    </>
  );
}

function NavItem({ id, icon: Icon, active, onSelect }: { id: Screen; icon: typeof HomeIcon; active: boolean; onSelect: (s: Screen) => void }) {
  const t = useT();
  return (
    <li>
      <button type="button" className={`nav-item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => onSelect(id)}>
        <Icon aria-hidden="true" size={18} />
        <span>{t(`nav.${id}`)}</span>
      </button>
    </li>
  );
}

function TopBar() {
  const coins = useGame((s) => s.game.resources.coins);
  const gems = useGame((s) => s.game.resources.gems);
  const tokens = useGame((s) => s.game.resources.tokens);
  const club = useGame((s) => s.game.clubName);
  const level = useGame((s) => clubLevelFor(s.game.resources.clubXp));
  return (
    <header className="topbar">
      <div>
        <p className="club-name">{club}</p>
        <p className="muted small">Nível do clube {level}</p>
      </div>
      <div className="topbar-res" aria-label="Recursos">
        <span className="res" title="Moedas"><Coins aria-hidden="true" size={16} /> {fmt(coins)}</span>
        <span className="res" title="Gemas"><Gem aria-hidden="true" size={16} /> {fmt(gems)}</span>
        <span className="res" title="Fichas de treino"><Target aria-hidden="true" size={16} /> {tokens}</span>
      </div>
    </header>
  );
}

function IdleReturnModal() {
  const game = useGame((s) => s.game);
  const idleSummary = useGame((s) => s.idleSummary);
  const collectIdle = useGame((s) => s.collectIdle);
  const toast = useGame((s) => s.toast);
  const [summary, setSummary] = useState<IdleSummary | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    setChecked(true);
    const s = idleSummary();
    if (s.coins <= 0) return;
    if (game.settings.autoCollect) {
      const res = collectIdle();
      if (res.ok && res.data) toast(`Receita idle coletada: +${fmt(res.data.coins)} moedas`, 'success');
      return;
    }
    if (s.elapsedMs >= 5 * 60_000) setSummary(s);
  }, [checked, collectIdle, game.settings.autoCollect, idleSummary, toast]);

  return (
    <Modal
      open={Boolean(summary)}
      onClose={() => setSummary(null)}
      title="Resumo de retorno"
      footer={
        <>
          <Button variant="ghost" onClick={() => setSummary(null)}>Depois</Button>
          <Button
            variant="primary"
            onClick={() => {
              const res = collectIdle();
              if (res.ok && res.data) toast(`+${fmt(res.data.coins)} moedas coletadas`, 'success');
              setSummary(null);
            }}
          >
            Coletar receita
          </Button>
        </>
      }
    >
      {summary ? (
        <div className="stack">
          <p>
            Você ficou ausente por <strong>{formatDuration(summary.elapsedMs)}</strong>. A receita considerou no máximo{' '}
            <strong>{summary.cappedHours.toLocaleString('pt-BR')} h</strong>
            {summary.cappedByLimit ? ' (limite atual da Academia Juvenil)' : ''}.
          </p>
          <ul className="list-plain">
            <li><Coins aria-hidden="true" size={16} /> {fmt(summary.coins)} moedas</li>
            <li><Medal aria-hidden="true" size={16} /> {fmt(summary.clubXp)} XP de clube</li>
            <li><Target aria-hidden="true" size={16} /> {summary.tokens} fichas de treino</li>
          </ul>
          <p className="muted small">A receita offline nunca avança fases nem concede atletas: ela só acelera seus recursos.</p>
        </div>
      ) : null}
    </Modal>
  );
}

function ConfirmHost() {
  const request = useConfirm((s) => s.request);
  const close = useConfirm((s) => s.close);
  return (
    <Modal
      open={Boolean(request)}
      onClose={() => close(false)}
      title={request?.title ?? ''}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>Cancelar</Button>
          <Button variant={request?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
            {request?.confirmLabel ?? 'Confirmar'}
          </Button>
        </>
      }
    >
      <p>{request?.message}</p>
    </Modal>
  );
}

function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
          <span>{t.message}</span>
          <button type="button" className="icon-btn" aria-label="Fechar aviso" onClick={() => dismiss(t.id)}>
            <X aria-hidden="true" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function LoadBanner() {
  const message = useGame((s) => s.loadMessage);
  const dismiss = useGame((s) => s.dismissLoadMessage);
  if (!message) return null;
  return (
    <div className="banner" role="status">
      <span>{message}</span>
      <Button size="sm" variant="ghost" onClick={dismiss}>Entendi</Button>
    </div>
  );
}

function AthleteLayer() {
  const athleteId = useNav((s) => s.athleteId);
  const open = useNav((s) => s.openAthlete);
  return <AthleteModal athleteId={athleteId} onClose={() => open(null)} />;
}

export default function App() {
  const initialize = useGame((s) => s.initialize);
  const ready = useGame((s) => s.ready);
  const screen = useNav((s) => s.screen);
  const settings = useGame((s) => s.game.settings);
  const reduced = useReducedMotion(settings.reduceMotion);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useAutosave();

  useEffect(() => {
    configureAudio({ enabled: settings.sound, volume: settings.volume });
  }, [settings.sound, settings.volume]);

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
  }, [reduced]);

  if (!ready) {
    return (
      <div className="boot" role="status" aria-live="polite">
        <div className="boot-ball" aria-hidden="true" />
        <p>Carregando seu clube…</p>
      </div>
    );
  }

  return (
    <I18nProvider initial={settings.language}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
        <a className="skip-link" href="#main">Pular para o conteúdo</a>
      <div className="app">
        <Navigation screen={screen} />
        <div className="content">
          <TopBar />
          <LoadBanner />
          <main id="main" tabIndex={-1} className="main">
            <ErrorBoundary key={screen}>
              <ScreenSwitch screen={screen} />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <Toasts />
      <IdleReturnModal />
      <ConfirmHost />
      <AthleteLayer />
    </MotionConfig>
    </I18nProvider>
  );
}
