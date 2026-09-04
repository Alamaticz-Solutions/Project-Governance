import type { ReactNode } from 'react';
import { Badge, Button, FeedbackState, type PdsTone } from '@ui-kit';
import type { AppfwClientError } from '../lib/appfwClient';
import type { AsyncState } from '../app/providers';

// ---------------------------------------------------------------------------
// Error / empty / loading presentation. Everything routes through the design
// system's FeedbackState so a11y + tone stay consistent, and policy denials
// render as a distinct "denied" kind (fail closed — never show the action).
// ---------------------------------------------------------------------------

export function ClientErrorView({
  error,
  onRetry
}: {
  error: AppfwClientError;
  onRetry?: () => void;
}) {
  const denied = error.details.category === 'policy_denied' || error.details.category === 'auth';
  return (
    <FeedbackState
      kind={denied ? 'denied' : 'error'}
      title={denied ? 'This action is restricted' : 'Request failed'}
      detail={error.message}
      metadata={
        error.details.requestId ? { requestId: error.details.requestId } : undefined
      }
      action={
        !denied && onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export function AsyncSection<T>({
  state,
  children,
  emptyTitle = 'Nothing to show',
  emptyDetail,
  isEmpty
}: {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  emptyTitle?: string;
  emptyDetail?: ReactNode;
  isEmpty?: (data: T) => boolean;
}) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <FeedbackState kind="loading" title="Loading…" />;
  }
  if (state.status === 'error' && state.error) {
    return <ClientErrorView error={state.error} onRetry={state.reload} />;
  }
  const data = state.data as T;
  if (isEmpty?.(data)) {
    return <FeedbackState kind="empty" title={emptyTitle} detail={emptyDetail} />;
  }
  return <>{children(data)}</>;
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

const ENUM_TONE: Record<string, PdsTone> = {
  APPROVED: 'success',
  ACTIVE: 'success',
  COMPLETED: 'success',
  IN_PROGRESS: 'accent',
  IN_DELIVERY: 'accent',
  PENDING_APPROVAL: 'warning',
  CHANGES_REQUESTED: 'warning',
  NEEDS_INFO: 'warning',
  ON_HOLD: 'warning',
  DRAFT: 'neutral',
  LOCKED: 'neutral',
  SKIPPED: 'neutral',
  ARCHIVED: 'neutral',
  REJECTED: 'danger',
  CANCELLED: 'danger'
};

// Normalize any enum wire casing to SCREAMING_SNAKE: the GraphQL enums come
// back PascalCase on read/mutation (async-graphql's default rename — e.g.
// "InProgress"), while free-string status fields this product writes itself
// use snake_case ("in_progress") or SCREAMING_SNAKE audit action constants.
// One canonical form makes lookups and display consistent regardless of
// source — and it is also what `filter` arguments need: the generated
// `filter`/`sort` GraphQL args are untyped JSON, so enum comparisons bypass
// the schema's PascalCase rename entirely and compare the raw stored text,
// which is the model's original SCREAMING_SNAKE (confirmed live:
// `queryUsers(filter:{role:{_eq:"ADMIN"}})` matches, `_eq:"Admin"` does not).
// Exported as `toEnumFilterValue` for building filter clauses.
export function canonicalEnumKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}

/** Alias read at filter-building call sites — same conversion, named for intent. */
export const toEnumFilterValue = canonicalEnumKey;

export function humanizeEnum(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  return canonicalEnumKey(value)
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function EnumBadge({ value }: { value: unknown }) {
  if (typeof value !== 'string' || !value) return <span>—</span>;
  return <Badge tone={ENUM_TONE[canonicalEnumKey(value)] ?? 'neutral'}>{humanizeEnum(value)}</Badge>;
}

export function formatDate(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function asText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Small layout helpers (token-only styling)
// ---------------------------------------------------------------------------

export type DefinitionItem = { label: string; value: ReactNode };

export function DefinitionList({ items }: { items: readonly DefinitionItem[] }) {
  return (
    <dl className="def-list">
      {items.map((item) => (
        <div key={item.label} className="def-list__row">
          <dt>{item.label}</dt>
          <dd>{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="card-grid">{children}</div>;
}

export function InlineActions({ children }: { children: ReactNode }) {
  return <div className="inline-actions">{children}</div>;
}
