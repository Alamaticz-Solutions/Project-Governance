import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ForbiddenState } from '@appfw/pds-health-components';
import { useApp } from './providers';
import { hasAnyRole, ROLE_CAPTIONS, type GovernanceRole } from '../lib/authContext';

/**
 * Shell-level auth guard (ADR 0009 / ADR 0010: auth is default-on in the shell,
 * the UI fails closed). Unauthenticated → redirect to /sign-in preserving the
 * intended path. Authenticated but lacking a required role → an explicit denied
 * state (never a hidden route or a generic error).
 *
 * This is pre-gating for UX only; the backend Rego/policy layer is the
 * authority on every request regardless of what this component allows.
 */
export function RequireAuth({
  children,
  roles
}: {
  children: ReactNode;
  roles?: readonly GovernanceRole[];
}) {
  const { auth } = useApp();
  const location = useLocation();

  if (auth.source !== 'session') {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (roles && roles.length > 0 && !hasAnyRole(auth, roles)) {
    const need = roles.map((r) => ROLE_CAPTIONS[r] ?? r).join(', ');
    const have = auth.roles.length
      ? auth.roles.map((r) => ROLE_CAPTIONS[r as GovernanceRole] ?? r).join(', ')
      : 'none';
    return (
      <ForbiddenState
        title="You don't have access to this screen"
        detail={`Requires one of: ${need}. Your session roles: ${have}.`}
      />
    );
  }

  return <>{children}</>;
}
