/**
 * Product-owned UI kit.
 *
 * Replaces the vendored `@appfw/pds-health-components` design system with a
 * small set of components built from scratch for this product, so the app
 * carries no client-owned frontend code and can be reused/pitched
 * standalone. Prop shapes intentionally mirror the subset of the vendor
 * library the app actually used (so call sites didn't need rewriting), but
 * every implementation and CSS class below is original.
 */
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react';
import { createPortal } from 'react-dom';
import { cx, type DataGridColumn, type Density, type Option, type Size, type Tone } from './types';

export type { Tone as PdsTone, DataGridColumn as PdsDataGridColumn, Option as PdsOption };
export { cx as composeClassNames };

/* ----------------------------------------------------------------------- */
/* Primitives                                                              */
/* ----------------------------------------------------------------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: Size;
  isLoading?: boolean;
  isDenied?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', isLoading, isDenied, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading || isDenied}
      className={cx('gov-btn', `gov-btn--${variant}`, `gov-btn--${size}`, className)}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? <span className="gov-btn__spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };
export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span {...props} className={cx('gov-badge', `gov-badge--${tone}`, className)}>
      {children}
    </span>
  );
}

export type SegmentedControlOption<Value extends string = string> = {
  value: Value;
  label: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};
export type SegmentedControlProps<Value extends string = string> = HTMLAttributes<HTMLDivElement> & {
  ariaLabel: string;
  value: Value;
  options: readonly SegmentedControlOption<Value>[];
  onValueChange: (value: Value) => void;
  size?: Size;
  disabled?: boolean;
};
export function SegmentedControl<Value extends string = string>({
  ariaLabel,
  value,
  options,
  onValueChange,
  size = 'md',
  disabled,
  className,
  ...props
}: SegmentedControlProps<Value>) {
  return (
    <div {...props} role="tablist" aria-label={ariaLabel} className={cx('gov-segmented', `gov-segmented--${size}`, className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          aria-label={option.ariaLabel}
          disabled={disabled || option.disabled}
          className={cx('gov-segmented__item', option.value === value && 'is-selected')}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Form fields                                                             */
/* ----------------------------------------------------------------------- */

function FieldChrome({
  id,
  label,
  hint,
  error,
  required,
  children,
  className
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('gov-field', Boolean(error) && 'gov-field--invalid', className)}>
      <label htmlFor={id} className="gov-field__label">
        {label}
        {required ? <span className="gov-field__required" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="gov-field__hint">{hint}</p> : null}
      {error ? (
        <p className="gov-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  variant?: 'filled' | 'outlined';
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};
export function TextField({ id, label, hint, error, variant, leadingIcon, trailingIcon, className, required, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldChrome id={fieldId} label={label} hint={hint} error={error} required={required}>
      <div className="gov-input-shell">
        {leadingIcon ? <span className="gov-input-shell__icon">{leadingIcon}</span> : null}
        <input
          {...props}
          id={fieldId}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          className={cx('gov-input', className)}
        />
        {trailingIcon ? <span className="gov-input-shell__icon">{trailingIcon}</span> : null}
      </div>
    </FieldChrome>
  );
}

export type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  variant?: 'filled' | 'outlined';
};
export function DateField(props: DateFieldProps) {
  return <TextField {...props} type="date" />;
}

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
};
export function TextArea({ id, label, hint, error, className, required, ...props }: TextAreaProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldChrome id={fieldId} label={label} hint={hint} error={error} required={required}>
      <textarea
        {...props}
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={cx('gov-input', 'gov-textarea', className)}
      />
    </FieldChrome>
  );
}

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  options: readonly Option[];
  placeholder?: string;
  variant?: 'filled' | 'outlined';
};
export function SelectField({ id, label, hint, error, options, placeholder, className, required, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldChrome id={fieldId} label={label} hint={hint} error={error} required={required}>
      <select
        {...props}
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        className={cx('gov-input', 'gov-select', className)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldChrome>
  );
}

export type SwitchFieldProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  detail?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};
export function SwitchField({ id, label, checked, onCheckedChange, detail, error, disabled, className }: SwitchFieldProps) {
  return (
    <div className={cx('gov-switch-field', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cx('gov-switch', checked && 'is-checked')}
        onClick={() => onCheckedChange(!checked)}
      >
        <span className="gov-switch__thumb" />
      </button>
      <label htmlFor={id} className="gov-switch-field__label">
        {label}
        {detail ? <span className="gov-switch-field__detail">{detail}</span> : null}
      </label>
      {error ? (
        <p className="gov-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Layout / surfaces                                                       */
/* ----------------------------------------------------------------------- */

export type SurfaceProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  as?: 'section' | 'article' | 'div';
  variant?: 'elevated' | 'filled' | 'outlined';
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  density?: Density;
  children: ReactNode;
};
export function Surface({ as: Component = 'section', variant = 'elevated', title, subtitle, actions, className, children, ...props }: SurfaceProps) {
  return (
    <Component {...props} className={cx('gov-surface', `gov-surface--${variant}`, className)}>
      {title || actions ? (
        <header className="gov-surface__header">
          <div>
            {title ? <h3 className="gov-surface__title">{title}</h3> : null}
            {subtitle ? <p className="gov-surface__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="gov-surface__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </Component>
  );
}

export type FormLayoutProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 'one' | 'two' | 'auto';
  footer?: ReactNode;
  children: ReactNode;
};
export function FormLayout({ columns = 'one', footer, className, children, ...props }: FormLayoutProps) {
  return (
    <div {...props} className={cx('gov-form-layout', `gov-form-layout--${columns}`, className)}>
      <div className="gov-form-layout__fields">{children}</div>
      {footer ? <div className="gov-form-layout__footer">{footer}</div> : null}
    </div>
  );
}

export type ValidationSummaryItem = { id: string; label?: ReactNode; messages: readonly ReactNode[] };
export type ValidationSummaryProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode;
  items?: readonly ValidationSummaryItem[];
  validation?: Record<string, readonly ReactNode[]>;
};
export function ValidationSummary({ title = 'Fix the following', items, validation, className, ...props }: ValidationSummaryProps) {
  const resolved: readonly ValidationSummaryItem[] =
    items ?? Object.entries(validation ?? {}).map(([id, messages]) => ({ id, messages }));
  if (resolved.length === 0) return null;
  return (
    <div {...props} className={cx('gov-validation-summary', className)} role="alert">
      <p className="gov-validation-summary__title">{title}</p>
      <ul>
        {resolved.map((item) => (
          <li key={item.id}>
            {item.label ? <strong>{item.label}: </strong> : null}
            {item.messages.map((message, index) => (
              <span key={index}>{message} </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type InlineAlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  tone?: Tone;
  title: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
};
export function InlineAlert({ tone = 'neutral', title, detail, action, className, children, ...props }: InlineAlertProps) {
  return (
    <div {...props} className={cx('gov-alert', `gov-alert--${tone}`, className)} role="status">
      <div>
        <p className="gov-alert__title">{title}</p>
        {detail ? <p className="gov-alert__detail">{detail}</p> : null}
        {children}
      </div>
      {action ? <div className="gov-alert__action">{action}</div> : null}
    </div>
  );
}

export type FeedbackStateKind = 'loading' | 'empty' | 'error' | 'denied' | 'success' | 'info';
export type FeedbackStateProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  kind?: FeedbackStateKind;
  title: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  metadata?: { requestId?: ReactNode; correlationId?: ReactNode; responseMs?: number | null; details?: readonly { label: ReactNode; value: ReactNode }[] };
};
export function FeedbackState({ kind = 'info', title, detail, action, metadata, className, children, ...props }: FeedbackStateProps) {
  return (
    <div {...props} className={cx('gov-feedback', `gov-feedback--${kind}`, className)}>
      <p className="gov-feedback__title">{title}</p>
      {detail ? <p className="gov-feedback__detail">{detail}</p> : null}
      {children}
      {metadata ? (
        <dl className="gov-feedback__meta">
          {metadata.requestId ? (
            <>
              <dt>Request</dt>
              <dd>{metadata.requestId}</dd>
            </>
          ) : null}
          {metadata.correlationId ? (
            <>
              <dt>Correlation</dt>
              <dd>{metadata.correlationId}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {action ? <div className="gov-feedback__action">{action}</div> : null}
    </div>
  );
}

export type ForbiddenStateProps = Omit<FeedbackStateProps, 'kind'>;
export function ForbiddenState(props: ForbiddenStateProps) {
  return <FeedbackState {...props} kind="denied" />;
}

export type MetricTrendProps = HTMLAttributes<HTMLSpanElement> & {
  value: ReactNode;
  label?: ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';
  direction?: 'up' | 'down' | 'flat';
};
export function MetricTrend({ value, label, tone = 'neutral', direction, className, ...props }: MetricTrendProps) {
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : direction === 'flat' ? '▬' : null;
  return (
    <span {...props} className={cx('gov-metric-trend', `gov-metric-trend--${tone}`, className)}>
      {arrow ? <span aria-hidden="true">{arrow} </span> : null}
      {value}
      {label ? <span className="gov-metric-trend__label"> {label}</span> : null}
    </span>
  );
}

export type KpiTileProps = HTMLAttributes<HTMLElement> & {
  as?: 'article' | 'section' | 'div';
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  trend?: ReactNode;
  tone?: Tone;
};
export function KpiTile({ as: Component = 'article', label, value, detail, icon, trend, tone = 'neutral', className, ...props }: KpiTileProps) {
  return (
    <Component {...props} className={cx('gov-kpi', `gov-kpi--${tone}`, className)}>
      {icon ? <span className="gov-kpi__icon">{icon}</span> : null}
      <p className="gov-kpi__label">{label}</p>
      <p className="gov-kpi__value">{value}</p>
      {detail ? <p className="gov-kpi__detail">{detail}</p> : null}
      {trend ? <div className="gov-kpi__trend">{trend}</div> : null}
    </Component>
  );
}

export type ChartShellProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};
export function ChartShell({ title, subtitle, actions, footer, className, children, ...props }: ChartShellProps) {
  return (
    <section {...props} className={cx('gov-chart-shell', className)}>
      <header className="gov-chart-shell__header">
        <div>
          <h3 className="gov-surface__title">{title}</h3>
          {subtitle ? <p className="gov-surface__subtitle">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      <div className="gov-chart-shell__body">{children}</div>
      {footer ? <footer className="gov-chart-shell__footer">{footer}</footer> : null}
    </section>
  );
}

export type ChartLegendItem = { id: string; label: ReactNode; tone?: Tone; value?: ReactNode };
export type ChartLegendProps = HTMLAttributes<HTMLUListElement> & { items: readonly ChartLegendItem[] };
export function ChartLegend({ items, className, ...props }: ChartLegendProps) {
  return (
    <ul {...props} className={cx('gov-chart-legend', className)}>
      {items.map((item) => (
        <li key={item.id} className="gov-chart-legend__item">
          <span className={cx('gov-chart-legend__swatch', `gov-chart-legend__swatch--${item.tone ?? 'neutral'}`)} aria-hidden="true" />
          <span>{item.label}</span>
          {item.value !== undefined ? <strong>{item.value}</strong> : null}
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------------- */
/* App shell / navigation                                                  */
/* ----------------------------------------------------------------------- */

export type AppShellProps = HTMLAttributes<HTMLDivElement> & {
  brand: ReactNode;
  navigation: ReactNode;
  topBar?: ReactNode;
  footer?: ReactNode;
  navigationLabel?: string;
  responsiveCollapse?: boolean;
  children: ReactNode;
};
export function AppShell({ brand, navigation, topBar, footer, navigationLabel = 'Primary', responsiveCollapse: _responsiveCollapse, children, className, ...props }: AppShellProps) {
  return (
    <div {...props} className={cx('gov-app-shell', className)}>
      <aside className="gov-app-shell__sidebar">
        <div className="gov-app-shell__brand">{brand}</div>
        <nav aria-label={navigationLabel} className="gov-app-shell__nav">
          {navigation}
        </nav>
        {footer ? <div className="gov-app-shell__footer">{footer}</div> : null}
      </aside>
      <div className="gov-app-shell__content">
        {topBar ? <div className="gov-app-shell__topbar">{topBar}</div> : null}
        <main className="gov-app-shell__main">{children}</main>
      </div>
    </div>
  );
}

export type PageHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
};
export function PageHeader({ title, subtitle, eyebrow, actions, className, ...props }: PageHeaderProps) {
  return (
    <div {...props} className={cx('gov-page-header', className)}>
      <div>
        {eyebrow ? <p className="gov-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="gov-page-header__title">{title}</h1>
        {subtitle ? <p className="gov-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="gov-page-header__actions">{actions}</div> : null}
    </div>
  );
}

export type CommandPaletteItem = {
  id: string;
  group: string;
  label: string;
  detail?: ReactNode;
  href?: string;
  icon?: ReactNode;
  disabled?: boolean;
  keywords?: readonly string[];
  onSelect?: () => void;
};
export type CommandPaletteProps = HTMLAttributes<HTMLDivElement> & {
  items: readonly CommandPaletteItem[];
  triggerLabel?: ReactNode;
  searchLabel?: string;
  searchPlaceholder?: string;
  emptyMessage?: ReactNode;
};
export function CommandPalette({ items, triggerLabel = 'Search', searchLabel = 'Search', searchPlaceholder = 'Search…', emptyMessage = 'No results', className, ...props }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.keywords?.some((k) => k.toLowerCase().includes(q)));
  }, [items, query]);

  return (
    <div {...props} className={cx('gov-command-palette', className)}>
      <button type="button" className="gov-command-palette__trigger" onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
      {open ? (
        <div className="gov-command-palette__panel" role="dialog" aria-label={searchLabel}>
          <input
            autoFocus
            className="gov-input"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
          />
          <ul className="gov-command-palette__list">
            {filtered.length === 0 ? (
              <li className="gov-command-palette__empty">{emptyMessage}</li>
            ) : (
              filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      item.onSelect?.();
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span>{item.label}</span>
                    {item.detail ? <span className="gov-command-palette__detail">{item.detail}</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
          <button type="button" className="gov-command-palette__close" onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

export type TabItem = { id: string; label: string; content: ReactNode; disabled?: boolean };
export type TabsProps = { items: readonly TabItem[]; selectedId: string; onChange: (id: string) => void; ariaLabel: string };
export function Tabs({ items, selectedId, onChange, ariaLabel }: TabsProps) {
  const active = items.find((item) => item.id === selectedId) ?? items[0];
  return (
    <div className="gov-tabs">
      <div role="tablist" aria-label={ariaLabel} className="gov-tabs__list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active?.id}
            disabled={item.disabled}
            className={cx('gov-tabs__tab', item.id === active?.id && 'is-selected')}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="gov-tabs__panel" role="tabpanel">
        {active?.content}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Overlays                                                                */
/* ----------------------------------------------------------------------- */

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

export type DialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  role?: 'dialog' | 'alertdialog';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};
export function Dialog({ open, title, description, children, footer, onClose, closeLabel = 'Close', role = 'dialog', size = 'md', className }: DialogProps) {
  useBodyScrollLock(open);
  if (!open) return <></>;
  return createPortal(
    <div className="gov-overlay" onMouseDown={onClose}>
      <div
        role={role}
        aria-modal="true"
        aria-label={title}
        className={cx('gov-dialog', `gov-dialog--${size}`, className)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="gov-dialog__header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="gov-dialog__close" aria-label={closeLabel} onClick={onClose}>
            ×
          </button>
        </header>
        <div className="gov-dialog__body">{children}</div>
        {footer ? <footer className="gov-dialog__footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}

export type DrawerProps = HTMLAttributes<HTMLElement> & {
  open: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
};
export function Drawer({ open, title, description, children, footer, onClose, closeLabel = 'Close', side = 'right', size = 'md', className, ...props }: DrawerProps) {
  useBodyScrollLock(open);
  if (!open) return null;
  return createPortal(
    <div className="gov-overlay" onMouseDown={onClose}>
      <aside
        {...props}
        aria-label={title}
        className={cx('gov-drawer', `gov-drawer--${side}`, `gov-drawer--${size}`, className)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="gov-dialog__header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="gov-dialog__close" aria-label={closeLabel} onClick={onClose}>
            ×
          </button>
        </header>
        <div className="gov-dialog__body">{children}</div>
        {footer ? <footer className="gov-dialog__footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body
  );
}

/* ----------------------------------------------------------------------- */
/* Process / navigation aids                                               */
/* ----------------------------------------------------------------------- */

export type ProcessStepStatus = 'complete' | 'current' | 'upcoming' | 'warning' | 'blocked';
export type ProcessStepItem = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  status?: ProcessStepStatus;
  optional?: boolean;
  disabled?: boolean;
};
export type ProcessStepperProps = Omit<HTMLAttributes<HTMLOListElement>, 'onSelect'> & {
  ariaLabel: string;
  steps: readonly ProcessStepItem[];
  currentStepId?: string;
  orientation?: 'horizontal' | 'vertical';
  onStepSelect?: (step: ProcessStepItem, index: number) => void;
};
export function ProcessStepper({ ariaLabel, steps, orientation = 'horizontal', onStepSelect, className, ...props }: ProcessStepperProps) {
  return (
    <ol {...props} aria-label={ariaLabel} className={cx('gov-stepper', `gov-stepper--${orientation}`, className)}>
      {steps.map((step, index) => (
        <li key={step.id} className={cx('gov-stepper__step', `gov-stepper__step--${step.status ?? 'upcoming'}`)}>
          <button
            type="button"
            disabled={step.disabled || !onStepSelect}
            className="gov-stepper__button"
            onClick={() => onStepSelect?.(step, index)}
          >
            <span className="gov-stepper__marker" aria-hidden="true" />
            <span>
              <span className="gov-stepper__label">{step.label}</span>
              {step.description ? <span className="gov-stepper__description">{step.description}</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export type SearchBarItem = { id: string; label: string; detail?: ReactNode; onSelect?: () => void; keywords?: readonly string[] };
export type SearchBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  items: readonly SearchBarItem[];
  label?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
};
export function SearchBar({ items, label = 'Search', placeholder = 'Search…', value, onValueChange, className, ...props }: SearchBarProps) {
  const [internal, setInternal] = useState('');
  const query = value ?? internal;
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.keywords?.some((k) => k.toLowerCase().includes(q))).slice(0, 8);
  }, [items, query]);

  return (
    <div {...props} className={cx('gov-search-bar', className)}>
      <input
        aria-label={label}
        className="gov-input"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setInternal(event.target.value);
          onValueChange?.(event.target.value);
        }}
      />
      {open && results.length > 0 ? (
        <ul className="gov-search-bar__results">
          {results.map((item) => (
            <li key={item.id}>
              <button type="button" onMouseDown={item.onSelect}>
                <span>{item.label}</span>
                {item.detail ? <span className="gov-search-bar__detail">{item.detail}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export type IdentitySummaryProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  description?: ReactNode;
  metadata?: ReactNode;
  avatar?: ReactNode;
  trailing?: ReactNode;
  density?: Density;
};
export function IdentitySummary({ name, description, metadata, avatar, trailing, className, ...props }: IdentitySummaryProps) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div {...props} className={cx('gov-identity', className)}>
      <span className="gov-identity__avatar" aria-hidden="true">
        {avatar ?? initials}
      </span>
      <span className="gov-identity__body">
        <span className="gov-identity__name">{name}</span>
        {description ? <span className="gov-identity__description">{description}</span> : null}
        {metadata ? <span className="gov-identity__meta">{metadata}</span> : null}
      </span>
      {trailing ? <span className="gov-identity__trailing">{trailing}</span> : null}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Data grid                                                               */
/* ----------------------------------------------------------------------- */

export type DataGridToolbarProps = {
  ariaLabel: string;
  search?: ReactNode;
  filters?: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  className?: string;
};
export function DataGridToolbar({ ariaLabel, search, filters, summary, actions, className }: DataGridToolbarProps) {
  return (
    <div aria-label={ariaLabel} className={cx('gov-data-toolbar', className)}>
      <div className="gov-data-toolbar__start">
        {search}
        {filters}
      </div>
      <div className="gov-data-toolbar__end">
        {summary}
        {actions}
      </div>
    </div>
  );
}

export type DataGridShellProps<Row extends Record<string, unknown>> = {
  columns: readonly DataGridColumn<Row>[];
  rows: readonly Row[];
  rowKey: keyof Row & string;
  ariaLabel: string;
  className?: string;
  isLoading?: boolean;
  selectedRowKey?: string | null;
  emptyTitle?: string;
  emptyDetail?: ReactNode;
  onRowSelect?: (row: Row) => void;
};
export function DataGridShell<Row extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  ariaLabel,
  className,
  isLoading,
  selectedRowKey,
  emptyTitle = 'No records',
  emptyDetail,
  onRowSelect
}: DataGridShellProps<Row>) {
  return (
    <div className={cx('gov-data-grid', className)}>
      <table aria-label={ariaLabel} className="gov-data-grid__table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={{ width: column.width, textAlign: column.align ?? 'left' }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="gov-data-grid__empty">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="gov-data-grid__empty">
                <p>{emptyTitle}</p>
                {emptyDetail ? <p>{emptyDetail}</p> : null}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = String(row[rowKey]);
              return (
                <tr
                  key={key}
                  className={cx(onRowSelect && 'is-clickable', key === selectedRowKey && 'is-selected')}
                  onClick={() => onRowSelect?.(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} style={{ textAlign: column.align ?? 'left' }}>
                      {column.render ? column.render(row) : String(row[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export type DataGridPaginationProps = {
  pageSize: number;
  pageIndex: number;
  startRow: number;
  endRow: number;
  totalRows?: number | null;
  pageCount?: number | null;
  className?: string;
  ariaLabel?: string;
  onFirstPage?: () => void;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  onLastPage?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
};
export function DataGridPagination({
  startRow,
  endRow,
  totalRows,
  className,
  ariaLabel = 'Pagination',
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  canPrevious = true,
  canNext = true
}: DataGridPaginationProps) {
  return (
    <div aria-label={ariaLabel} className={cx('gov-pagination', className)}>
      <span>
        {startRow}–{endRow}
        {totalRows != null ? ` of ${totalRows}` : ''}
      </span>
      <div className="gov-pagination__controls">
        {onFirstPage ? (
          <button type="button" disabled={!canPrevious} onClick={onFirstPage}>
            First
          </button>
        ) : null}
        <button type="button" disabled={!canPrevious} onClick={onPreviousPage}>
          Previous
        </button>
        <button type="button" disabled={!canNext} onClick={onNextPage}>
          Next
        </button>
        {onLastPage ? (
          <button type="button" disabled={!canNext} onClick={onLastPage}>
            Last
          </button>
        ) : null}
      </div>
    </div>
  );
}
