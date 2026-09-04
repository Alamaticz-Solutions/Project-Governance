import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import {
  AppShell as PdsAppShell,
  Badge,
  Button,
  CommandPalette,
  Dialog,
  FormLayout,
  IdentitySummary,
  SelectField,
  TextArea,
  type CommandPaletteItem
} from '@ui-kit';
import { governanceUiContract } from '../generated/appfw-ui-contract';
import { useApp } from './providers';
import { GOVERNANCE_ROLES, ROLE_CAPTIONS } from '../lib/authContext';

type NavSection = { to: string; label: string };

const NAV: NavSection[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/team-inbox', label: 'Team inbox' },
  { to: '/intake', label: 'New intake' },
  { to: '/meeting-center', label: 'Meeting center' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/audit', label: 'Audit log' },
  { to: '/entities', label: 'All entities' }
];

export function AppShell() {
  const navigate = useNavigate();
  const { auth, tenant } = useApp();
  const [sessionOpen, setSessionOpen] = useState(false);

  const commands: CommandPaletteItem[] = useMemo(() => {
    const nav: CommandPaletteItem[] = NAV.map((item) => ({
      id: `nav:${item.to}`,
      group: 'Navigate',
      label: item.label,
      onSelect: () => navigate(item.to)
    }));
    const entities: CommandPaletteItem[] = governanceUiContract.entities.map((entity) => ({
      id: `entity:${entity.routeSegment}`,
      group: 'Entities',
      label: entity.caption.plural,
      detail: entity.typeName,
      onSelect: () => navigate(`/entities/${entity.routeSegment}`)
    }));
    return [...nav, ...entities];
  }, [navigate]);

  const identityName = auth.displayName || auth.userName || 'Not signed in';
  const roleSummary = auth.roles.length
    ? auth.roles.map((role) => ROLE_CAPTIONS[role as keyof typeof ROLE_CAPTIONS] ?? role).join(', ')
    : 'No roles — actions will fail closed';

  return (
    <>
      <PdsAppShell
        navigationLabel="Governance workspace"
        responsiveCollapse
        brand={
          <div className="app-brand">
            <strong>Governance</strong>
            <span>Portfolio &amp; gate workflow</span>
          </div>
        }
        navigation={
          <nav className="app-nav" aria-label="Workspace sections">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        }
        topBar={
          <div className="app-topbar">
            <CommandPalette
              items={commands}
              triggerLabel="Search workspace"
              searchPlaceholder="Jump to a screen or entity"
            />
            <Button variant="quiet" onClick={() => setSessionOpen(true)}>
              {identityName}
            </Button>
          </div>
        }
        footer={
          <div className="app-shell-footer">
            <span>Tenant {tenant.tenantId}</span>
            <span>{auth.roles.length} role(s)</span>
          </div>
        }
      >
        <Outlet />
      </PdsAppShell>

      <SessionDialog
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onSaved={() => {
          setSessionOpen(false);
          navigate('/dashboard');
        }}
        identityName={identityName}
        roleSummary={roleSummary}
      />
    </>
  );
}

function SessionDialog({
  open,
  onClose,
  onSaved,
  identityName,
  roleSummary
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  identityName: string;
  roleSummary: string;
}) {
  const { auth, setAuthorization, setIdentity } = useApp();
  const [token, setToken] = useState(auth.authorization ?? '');
  const [userName, setUserName] = useState(auth.userName ?? '');
  const [role, setRole] = useState<string>(auth.roles[0] ?? 'viewer');

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
          options={GOVERNANCE_ROLES.map((value) => ({
            value,
            label: ROLE_CAPTIONS[value]
          }))}
        />
      </FormLayout>
      <p style={{ marginTop: 'var(--gov-space-3)' }}>
        <Badge tone="neutral">Local only</Badge>
      </p>
    </Dialog>
  );
}
