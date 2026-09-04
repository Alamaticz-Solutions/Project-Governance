import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  FormLayout,
  InlineAlert,
  PageHeader,
  SelectField,
  Surface,
  TextArea,
  TextField
} from '@ui-kit';
import { useApp } from '../../app/providers';
import { GOVERNANCE_ROLES, ROLE_CAPTIONS } from '../../lib/authContext';

/**
 * Local-exploration sign-in. Production identity is Okta/JWT via the backend
 * (ADR 0010); this screen just records a bearer token + the claims the UI uses
 * to pre-gate actions into sessionStorage. It is the public landing route —
 * every other route is behind <RequireAuth>.
 */
export function SignInScreen() {
  const { auth, setAuthorization, setIdentity } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [token, setToken] = useState(auth.authorization ?? '');
  const [userName, setUserName] = useState(auth.userName ?? '');
  const [role, setRole] = useState<string>(auth.roles[0] ?? 'viewer');
  const [touched, setTouched] = useState(false);

  if (auth.source === 'session') {
    return <Navigate to={from} replace />;
  }

  const submit = () => {
    setTouched(true);
    if (!token.trim() || !userName.trim()) return;
    setAuthorization(token.trim());
    setIdentity({
      userName: userName.trim(),
      displayName: userName.trim(),
      roles: [role]
    });
    navigate(from, { replace: true });
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--gov-space-6)' }}>
      <PageHeader
        eyebrow="Governance"
        title="Sign in"
        subtitle="Local session for the governance workspace. The backend enforces policy from the token itself."
      />
      <Surface>
        {touched && (!token.trim() || !userName.trim()) && (
          <InlineAlert
            tone="warning"
            title="Token and user name are required"
            detail="Both are needed before the workspace will load."
          />
        )}
        <FormLayout
          columns="one"
          footer={
            <Button variant="primary" onClick={submit}>
              Enter workspace
            </Button>
          }
        >
          <TextArea
            label="Bearer token"
            required
            rows={3}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            hint="Stored in sessionStorage only; never sent anywhere except the governance API."
          />
          <TextField
            label="User name (email)"
            required
            type="email"
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
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
      </Surface>
    </div>
  );
}
