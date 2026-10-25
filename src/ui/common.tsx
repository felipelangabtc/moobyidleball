import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X, Lightbulb } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGame } from '../state/store';
import { RARITY_COLOR } from './theme';
import { RARITY_NAME_PT } from '../domain/labels';
import type { Rarity } from '../domain/types';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  block,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${block ? 'btn-block' : ''} ${className}`}
      {...rest}
    >
      {Icon ? <Icon aria-hidden="true" size={size === 'sm' ? 14 : 18} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Panel({
  title,
  eyebrow,
  actions,
  children,
  className = '',
  id,
}: {
  title?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`panel ${className}`} aria-labelledby={id ? `${id}-title` : undefined}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2 id={id ? `${id}-title` : undefined}>{title}</h2> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}

export function Bar({ value, max = 100, color = 'var(--accent)', label, showValue = false }: { value: number; max?: number; color?: string; label?: string; showValue?: boolean }) {
  const pctValue = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <div className="bar-fill" style={{ width: `${pctValue}%`, background: color }} />
      {showValue ? <span className="bar-value">{Math.round(value)}</span> : null}
    </div>
  );
}

export function RarityTag({ rarity }: { rarity: Rarity }) {
  return (
    <span className="tag" style={{ borderColor: RARITY_COLOR[rarity], color: RARITY_COLOR[rarity] }}>
      {RARITY_NAME_PT[rarity]}
    </span>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: string }) {
  return (
    <div className="stat" style={tone ? { ['--tone' as string]: tone } : undefined}>
      {Icon ? <Icon aria-hidden="true" size={18} className="stat-icon" /> : null}
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint ? <p className="stat-hint">{hint}</p> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="empty" role="status">
      {Icon ? <Icon aria-hidden="true" size={32} /> : null}
      <p className="empty-title">{title}</p>
      {children ? <div className="empty-body">{children}</div> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; id: string }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span>
        <span className="toggle-label">{label}</span>
        {description ? <span className="toggle-desc">{description}</span> : null}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: TabDef<T>[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`tab ${selected ? 'is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {Icon ? <Icon aria-hidden="true" size={16} /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="modal-body">
          <header className="modal-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
              <X aria-hidden="true" size={18} />
            </button>
          </header>
          <div className="modal-content">{children}</div>
          {footer ? <footer className="modal-foot">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Dica contextual: aparece uma vez por tópico, com opção de dispensar ou rever depois. */
export function Tip({ topic, title, children }: { topic: string; title: string; children: ReactNode }) {
  const status = useGame((s) => s.game.tutorials[topic]);
  const setTutorial = useGame((s) => s.setTutorial);
  if (status) return null;
  return (
    <aside className="tip" aria-label={`Dica: ${title}`}>
      <Lightbulb aria-hidden="true" size={20} className="tip-icon" />
      <div className="tip-body">
        <p className="tip-title">{title}</p>
        <div className="tip-text">{children}</div>
        <div className="tip-actions">
          <Button size="sm" variant="primary" onClick={() => setTutorial(topic, 'seen')}>
            Entendi
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTutorial(topic, 'dismissed')}>
            Não mostrar mais
          </Button>
        </div>
      </div>
    </aside>
  );
}

export function SectionTitle({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <h3 className="section-title">
      {Icon ? <Icon aria-hidden="true" size={18} /> : null}
      {children}
    </h3>
  );
}

export function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return <span className="pill" style={color ? { borderColor: color, color } : undefined}>{children}</span>;
}
