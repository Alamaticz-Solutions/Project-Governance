// Single-tenant deployment. The backend generator hardcodes the PDS tenant id
// (`180000`); this module only lets local exploration override the `x-tenant-id`
// header for testing. Nothing here is a security boundary.

export const TENANT_STORAGE_KEY = 'governance.frontend.tenantId';

/** Matches `pds_tenant_id` baked into the generated backend. */
export const DEFAULT_TENANT_ID = '180000';

export type TenantSource = 'default' | 'session';

export type GovernanceTenantContext = {
  tenantId: string;
  source: TenantSource;
};

function browserSessionStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function normalize(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readSessionTenantContext(
  storage = browserSessionStorage()
): GovernanceTenantContext {
  const stored = normalize(storage?.getItem(TENANT_STORAGE_KEY) ?? undefined);
  return stored
    ? { tenantId: stored, source: 'session' }
    : { tenantId: DEFAULT_TENANT_ID, source: 'default' };
}

export function writeSessionTenantId(
  tenantId: string | null,
  storage = browserSessionStorage()
): void {
  if (!storage) return;
  const value = normalize(tenantId);
  if (value && value !== DEFAULT_TENANT_ID) storage.setItem(TENANT_STORAGE_KEY, value);
  else storage.removeItem(TENANT_STORAGE_KEY);
}
