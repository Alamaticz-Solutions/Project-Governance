import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  Dialog,
  FormLayout,
  IdentitySummary,
  SelectField,
  TextArea
} from '@ui-kit';
import { useApp, useAsync } from './providers';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { entityByType } from '../lib/entities';
import type { AppfwClient } from '../lib/appfwClient';
import { GOVERNANCE_ROLES, ROLE_CAPTIONS } from '../lib/authContext';

const approvalEntity = entityByType('ProjectApproval');

async function countPendingReviews(client: AppfwClient, roles: readonly string[]): Promise<number> {
  // `filter` args are untyped JSON and compare the raw stored SCREAMING_SNAKE
  // text, not the enum wire value (confirmed live).
  const enumRoles = roles.map((r) => r.toUpperCase());
  const roleFilter = enumRoles.length ? { assigned_role: { _in: enumRoles } } : undefined;
  try {
    const result = await client.queryList(approvalEntity, {
      limit: 100,
      filter: roleFilter
        ? { _and: [{ status: { _eq: 'PENDING' } }, roleFilter] }
        : { status: { _eq: 'PENDING' } },
      selection: ['id']
    });
    return result.page.queryCount || result.rows.length;
  } catch {
    return 0;
  }
}

/**
 * Application chrome: a fixed navigation rail, a sticky top bar, and a
 * scrolling content region — the Dev-branch portal layout, re-expressed with
 * product-owned components. The local-session dialog (paste a bearer token
 * for local exploration) is retained from this branch's auth model.
 */
export function AppShell() {
  const navigate = useNavigate();
  const { auth } = useApp();
  const [sessionOpen, setSessionOpen] = useState(false);

  const pending = useAsync((client) => countPendingReviews(client, auth.roles), [auth.roles]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100%',
          overflow: 'hidden',
          background: 'var(--gov-bg)',
          color: 'var(--gov-text)',
          fontFamily: 'var(--gov-font)'
        }}
      >
        <Sidebar pendingReviewCount={pending.data ?? 0} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Header onOpenSession={() => setSessionOpen(true)} />
          <main className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', width: '100%' }}>
            <Outlet />
          </main>
        </div>
      </div>

      <SessionDialog
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onSaved={() => {
          setSessionOpen(false);
          navigate('/dashboard');
        }}
      />
    </>
  );
}

function SessionDialog({
  open,
  onClose,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { auth, setAuthorization, setIdentity } = useApp();
  const [token, setToken] = useState(auth.authorization ?? '');
  const [userName, setUserName] = useState(auth.userName ?? '');
  const [role, setRole] = useState<string>(auth.roles[0] ?? 'viewer');

  const identityName = auth.displayName || auth.userName || 'Not signed in';
  const roleSummary = auth.roles.length
    ? auth.roles.map((r) => ROLE_CAPTIONS[r as keyof typeof ROLE_CAPTIONS] ?? r).join(', ')
    : 'No roles — actions will fail closed';

  return (
    <Dialog
      open={open}
      title="Local session"
      description="Paste a bearer token for local exploration. The backend still enforces policy from the token itself — this only sets the headers the SPA sends."
      onClose={onClose}
      closeLabel="Close session dialog"
      footer={
        <>
          <Button
            variant="quiet"
            onClick={() => {
              setAuthorization(null);
              setIdentity(null);
              onSaved();
            }}
          >
            Clear
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setAuthorization(token.trim() || null);
              setIdentity(
                userName.trim()
                  ? { userName: userName.trim(), displayName: userName.trim(), roles: [role] }
                  : null
              );
              onSaved();
            }}
          >
            Save session
          </Button>
        </>
      }
    >
      <IdentitySummary name={identityName} description={roleSummary} />
      <FormLayout columns="one">
        <TextArea
          label="Bearer token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          rows={3}
          hint="Stored in sessionStorage only."
        />
        <TextArea
          label="User name (email)"
          value={userName}
          onChange={(event) => setUserName(event.target.value)}
          rows={1}
          hint="Used to resolve the current user for inbox / notification filters."
        />
        <SelectField
          label="Primary role (UI pre-gating only)"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          options={GOVERNANCE_ROLES.map((value) => ({ value, label: ROLE_CAPTIONS[value] }))}
        />
      </FormLayout>
      <p style={{ marginTop: 'var(--gov-space-3)' }}>
        <Badge tone="neutral">Local only</Badge>
      </p>
    </Dialog>
  );
}
