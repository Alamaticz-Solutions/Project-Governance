// Local-exploration auth only. Production auth is backend-governed: the runtime
// enforces policy from the bearer token + tenant header regardless of anything
// the SPA believes. This module just remembers a token the user pasted in and
// exposes the claims the UI uses to pre-gate actions (fail-closed).

export const AUTH_STORAGE_KEY = 'governance.frontend.authorization';
export const IDENTITY_STORAGE_KEY = 'governance.frontend.identity';

export type AuthSource = 'anonymous' | 'session';

export type GovernanceIdentity = {
  userId?: string;
  userName?: string;
  displayName?: string;
  roles: string[];
};

export type GovernanceAuthContext = GovernanceIdentity & {
  authorization?: string;
  source: AuthSource;
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

function normalizeRoles(roles: readonly string[] | null | undefined): string[] {
  return Array.from(
    new Set((roles ?? []).map((role) => role.trim().toLowerCase()).filter(Boolean))
  ).sort();
}

export function readSessionAuthContext(
  storage = browserSessionStorage()
): GovernanceAuthContext {
  const authorization = normalize(storage?.getItem(AUTH_STORAGE_KEY) ?? undefined);
  let identity: GovernanceIdentity = { roles: [] };
  try {
    const raw = storage?.getItem(IDENTITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GovernanceIdentity>;
      identity = {
        userId: normalize(parsed.userId),
        userName: normalize(parsed.userName),
        displayName: normalize(parsed.displayName),
        roles: normalizeRoles(parsed.roles)
      };
    }
  } catch {
    identity = { roles: [] };
  }
  return {
    ...identity,
    authorization,
    source: authorization ? 'session' : 'anonymous'
  };
}

export function writeSessionAuthorization(
  authorization: string | null,
  storage = browserSessionStorage()
): void {
  if (!storage) return;
  const value = normalize(authorization);
  if (value) storage.setItem(AUTH_STORAGE_KEY, value);
  else storage.removeItem(AUTH_STORAGE_KEY);
}

export function writeSessionIdentity(
  identity: GovernanceIdentity | null,
  storage = browserSessionStorage()
): void {
  if (!storage) return;
  if (identity) storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  else storage.removeItem(IDENTITY_STORAGE_KEY);
}

export function hasRole(auth: GovernanceIdentity, role: string): boolean {
  return auth.roles.includes(role.toLowerCase());
}

/**
 * Letters-only lowercase key for comparing a role across sources that use
 * different casing conventions for the same role: this app's own
 * snake_case session vocabulary (`project_manager`) vs the GraphQL `UserRole`
 * enum's PascalCase wire values (`ProjectManager`, from `assigned_role`
 * fields). Both normalize to `projectmanager`.
 */
export function roleKey(role: string | null | undefined): string {
  return (role ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Convert this app's snake_case role vocabulary (`project_manager`) to the
 * `UserRole` GraphQL enum's PascalCase wire value (`ProjectManager`), for
 * building filters against `assigned_role` fields.
 */
export function roleToEnumValue(role: string): string {
  return role
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

export function hasAnyRole(auth: GovernanceIdentity, roles: readonly string[]): boolean {
  return roles.some((role) => hasRole(auth, role));
}

/**
 * Governance workflow roles (UserRole enum, 14 values). Lowercase form matches
 * the backend Rego role literals (`has_role(input.user, "admin")`).
 */
export const GOVERNANCE_ROLES = [
  'admin',
  'project_manager',
  'bta',
  'epmo',
  'finance',
  'vendor_screening',
  'analysis_team',
  'eac',
  'cab',
  'security',
  'taf',
  'trc',
  'pic',
  'viewer'
] as const;
export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number];

export const ROLE_CAPTIONS: Record<GovernanceRole, string> = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  bta: 'Business Technology Analyst',
  epmo: 'EPMO',
  finance: 'Finance',
  vendor_screening: 'Vendor Screening',
  analysis_team: 'Analysis Team',
  eac: 'EAC',
  cab: 'Change Advisory Board',
  security: 'Security',
  taf: 'TAF',
  trc: 'TRC',
  pic: 'PIC',
  viewer: 'Viewer'
};
