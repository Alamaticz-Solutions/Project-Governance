import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Badge, Button, FormLayout, Icon, InlineAlert, SelectField, TextArea, TextField } from '@ui-kit';
import { useApp } from '../../app/providers';
import { GOVERNANCE_ROLES, ROLE_CAPTIONS } from '../../lib/authContext';

/**
 * Local-exploration sign-in. Production identity is Okta/JWT via the backend
 * (ADR 0010); this screen records a bearer token + the claims the UI uses to
 * pre-gate actions into sessionStorage. It is the public landing route — every
 * other route is behind <RequireAuth>.
 *
 * The split-panel presentation mirrors the Dev-branch portal login. The form
 * itself keeps this branch's token-based session model (there is no
 * email/password backend on this branch).
 */

const FEATURES = [
  { icon: 'account_tree', label: 'End-to-end governance workflow engine' },
  { icon: 'fact_check', label: 'Gate-based committee reviews (A → CAB)' },
  { icon: 'security', label: 'HIPAA & ISO 27001 compliance tracking' },
  { icon: 'smart_toy', label: 'GenAI-powered document extraction' },
  { icon: 'dashboard', label: 'Real-time executive dashboards' }
];

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

  const invalid = !token.trim() || !userName.trim();
  const submit = () => {
    setTouched(true);
    if (invalid) return;
    setAuthorization(token.trim());
    setIdentity({ userName: userName.trim(), displayName: userName.trim(), roles: [role] });
    navigate(from, { replace: true });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left brand panel */}
      <div
        className="gov-signin-brand"
        style={{
          flex: 1,
          flexDirection: 'column',
          padding: 48,
          color: 'white',
          background: 'linear-gradient(135deg, #312E81 0%, #4F46E5 55%, #7C3AED 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 80 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)'
            }}
          >
            <Icon name="hub" size={28} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: 'white' }}>
              Governance Portal
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Enterprise decision engine</p>
          </div>
        </div>

        <div style={{ maxWidth: 480 }}>
          <h2 style={{ fontWeight: 800, fontSize: 36, margin: '0 0 20px', lineHeight: 1.2, color: 'white' }}>
            One platform for every project — from idea to go-live
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: '0 0 40px' }}>
            Replacing 10–15 fragmented forms with a single intelligent governance workflow engine.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FEATURES.map((f) => (
              <div
                key={f.icon}
                style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  <Icon name={f.icon} size={20} style={{ color: 'white' }} />
                </div>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div
        style={{
          width: 480,
          maxWidth: '100%',
          flexShrink: 0,
          background: '#f7f8fc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 400,
            background: 'white',
            borderRadius: 16,
            padding: 40,
            boxShadow: '0 8px 40px rgba(9,30,66,0.12)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#172B4D' }}>Welcome back</h2>
            <p style={{ margin: 0, fontSize: 14, color: '#6B778C' }}>Start a local governance session</p>
          </div>

          {touched && invalid && (
            <InlineAlert
              tone="warning"
              title="Token and user name are required"
              detail="Both are needed before the workspace will load."
            />
          )}

          <FormLayout
            columns="one"
            footer={
              <Button variant="primary" onClick={submit} style={{ width: '100%' }}>
                <Icon name="login" size={18} /> Enter workspace
              </Button>
            }
          >
            <TextArea
              label="Bearer token"
              required
              rows={3}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              hint="Stored in sessionStorage only; sent only to the governance API."
            />
            <TextField
              label="User name (email)"
              required
              type="email"
              autoComplete="email"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              hint="Resolves the current user for inbox / notification filters."
            />
            <SelectField
              label="Primary role (UI pre-gating only)"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              options={GOVERNANCE_ROLES.map((value) => ({ value, label: ROLE_CAPTIONS[value] }))}
            />
          </FormLayout>
          <p style={{ marginTop: 12, textAlign: 'center' }}>
            <Badge tone="neutral">Local only — backend enforces policy from the token</Badge>
          </p>
        </div>
      </div>
    </div>
  );
}
