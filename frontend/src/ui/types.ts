/**
 * Shared primitive types (tones, sizes, density, option and data-grid column
 * shapes) plus the `cx` class-name helper for the product UI kit
 * (src/ui/kit.tsx).
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
