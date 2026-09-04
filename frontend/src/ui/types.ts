/**
 * Shared primitive types for the product's own UI kit (src/ui/kit.tsx).
 *
 * This kit replaces the vendor `@appfw/pds-health-components` design system.
 * It is written from scratch for this product -- no vendor markup, class
 * names, or CSS were copied -- so the product carries no dependency on
 * client-owned component code and can be reused for other clients.
 */
import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning';
export type Size = 'sm' | 'md' | 'lg';
export type Density = 'compact' | 'comfortable';

export type Option = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type DataGridColumn<Row extends Record<string, unknown>> = {
  key: keyof Row & string;
  header: string;
  width?: string | number;
  align?: 'start' | 'center' | 'end';
  render?: (row: Row) => ReactNode;
};

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
