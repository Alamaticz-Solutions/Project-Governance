import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '@ui-kit';
import { useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { ROLE_CAPTIONS, type GovernanceRole } from '../../lib/authContext';

/**
 * Top bar. Visual language mirrors the Dev-branch portal header (glass bar,
 * gradient wordmark, notification bell + dropdown, user menu). Notifications
 * are read through the App Framework client; sign-out clears the local
 * session; the "Local session" item opens the token dialog owned by AppShell.
 */

const notificationEntity = entityByType('Notification');

async function loadRecentNotifications(
  client: AppfwClient,
  recipientId: string | undefined
): Promise<AppfwRecord[]> {
  const result = await client.queryList(notificationEntity, {
    limit: 20,
    sort: { created_at: 'desc' },
    filter: recipientId ? { recipient_id: { _eq: recipientId } } : undefined,
    selection: [
      'id',
      'notification_type',
      'title',
      'message',
      'action_url',
      'is_read',
      'created_at',
      'project_id'
    ]
  });
  return result.rows;
}

const iconButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: '#64748B',
  cursor: 'pointer',
  transition: 'background 0.2s, color 0.2s'
};

function notificationIcon(row: AppfwRecord): string {
  const t = String(row.title ?? '').toLowerCase();
  if (t.includes('approved')) return 'check_circle';
  if (t.includes('rejected')) return 'cancel';
  if (t.includes('submitted')) return 'publish';
  return 'notifications';
}

export function Header({ onOpenSession }: { onOpenSession: () => void }) {
  const navigate = useNavigate();
  const { auth, setAuthorization, setIdentity } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const state = useAsync((client) => loadRecentNotifications(client, auth.userId), [auth.userId]);
  const rows = state.data ?? [];
  const unread = rows.filter((r) => !r.is_read).length;

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const name = auth.displayName || auth.userName || 'Signed out';
  const initials =
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '–';
  const roleCaption = auth.roles.length
    ? ROLE_CAPTIONS[auth.roles[0] as GovernanceRole] ?? auth.roles[0]
    : 'No role';

  function openNotification(row: AppfwRecord) {
    setShowNotifications(false);
    const title = String(row.title ?? '').toLowerCase();
    const projectId = row.project_id ? String(row.project_id) : undefined;
    if (
      projectId &&
      (title.includes('required') ||
        title.includes('review') ||
        String(row.notification_type ?? '') === 'ApprovalRequired')
    ) {
      navigate(`/team-inbox/${projectId}/workspace`);
    } else if (row.action_url) {
      navigate(String(row.action_url));
    } else if (projectId) {
      navigate(`/projects/${projectId}`);
    }
  }

  function signOut() {
    setAuthorization(null);
    setIdentity(null);
    navigate('/sign-in');
  }

  return (
    <header
      style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(255,255,255,0.80)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(79,70,229,0.10)',
        boxShadow: '0 1px 24px rgba(79,70,229,0.06), 0 1px 4px rgba(0,0,0,0.04)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h1
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            fontFamily: 'var(--gov-font-display)',
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}
        >
          Enterprise Governance Portal
        </h1>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#94A3B8'
          }}
        >
          AI-Powered Decision Engine
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Icon
            name="search"
            size={18}
            style={{ position: 'absolute', left: 12, color: '#94A3B8', pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="Search projects or members..."
            aria-label="Search"
            style={{
              paddingLeft: 36,
              paddingRight: 16,
              height: 38,
              width: 256,
              fontSize: 13,
              outline: 'none',
              borderRadius: 12,
              background: 'rgba(241,245,249,0.8)',
              border: '1.5px solid rgba(226,232,240,0.8)',
              color: '#334155'
            }}
          />
        </div>

        <div style={{ height: 28, width: 1, background: 'rgba(226,232,240,0.9)' }} />

        {/* Notifications */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            style={iconButtonStyle}
            title="Notifications"
            onClick={() => setShowNotifications((v) => !v)}
          >
            <Icon name="notifications" size={21} />
            {unread > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  borderRadius: 9999,
                  background: '#DC2626',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 700,
                  boxShadow: '0 0 0 2px white'
                }}
              >
                {unread > 10 ? '10+' : unread}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              className="animate-fade-in"
              style={{
                position: 'absolute',
                right: 0,
                marginTop: 12,
                width: 320,
                borderRadius: 12,
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                zIndex: 50,
                background: '#ffffff'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  background: 'rgba(248,250,252,0.8)'
                }}
              >
                <strong style={{ fontSize: 14, color: '#1e293b' }}>Notifications</strong>
              </div>
              <div className="custom-scrollbar" style={{ maxHeight: 384, overflowY: 'auto' }}>
                {rows.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
                    <Icon name="notifications_none" size={36} style={{ color: '#e2e8f0' }} />
                    <p style={{ margin: '8px 0 0', fontWeight: 500 }}>You&apos;re all caught up!</p>
                  </div>
                ) : (
                  rows.map((row) => (
                    <button
                      key={String(row.id)}
                      type="button"
                      onClick={() => openNotification(row)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        gap: 12,
                        padding: '12px 16px',
                        borderBottom: '1px solid #f8fafc',
                        cursor: 'pointer',
                        background: row.is_read ? 'transparent' : 'rgba(79,70,229,0.06)',
                        border: 'none'
                      }}
                    >
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: row.is_read ? '#f1f5f9' : 'rgba(79,70,229,0.12)',
                          color: row.is_read ? '#64748B' : '#4F46E5'
                        }}
                      >
                        <Icon name={notificationIcon(row)} size={18} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 14,
                            fontWeight: 700,
                            color: row.is_read ? '#334155' : '#0f172a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {String(row.title ?? '')}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: row.is_read ? '#64748B' : '#334155',
                            lineHeight: 1.4
                          }}
                        >
                          {String(row.message ?? '')}
                        </span>
                        <span style={{ display: 'block', marginTop: 6, fontSize: 10, fontWeight: 600, color: '#94A3B8' }}>
                          {row.created_at ? new Date(String(row.created_at)).toLocaleString() : ''}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div style={{ padding: 8, borderTop: '1px solid #f1f5f9', background: '#f8fafc', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/notifications');
                  }}
                  style={{
                    width: '100%',
                    padding: 4,
                    border: 'none',
                    background: 'transparent',
                    color: '#4F46E5',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        <button type="button" style={iconButtonStyle} title="Knowledge Base">
          <Icon name="help_outline" size={21} />
        </button>

        <div style={{ height: 28, width: 1, background: 'rgba(226,232,240,0.9)' }} />

        {/* User menu */}
        <div style={{ position: 'relative' }} ref={userRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 4,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <span style={{ position: 'relative', flexShrink: 0 }}>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  opacity: 0.6,
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  transform: 'scale(1.18)',
                  filter: 'blur(3px)'
                }}
              />
              <span
                style={{
                  position: 'relative',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'white',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
                }}
              >
                {initials}
              </span>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, color: '#1E293B' }}>{name}</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: '#94A3B8' }}>{roleCaption}</span>
            </span>
          </button>

          {showUserMenu && (
            <div
              className="animate-fade-in"
              style={{
                position: 'absolute',
                right: 0,
                marginTop: 12,
                width: 200,
                borderRadius: 12,
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                zIndex: 50,
                background: '#ffffff'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenSession();
                }}
                style={menuItemStyle}
              >
                <Icon name="vpn_key" size={18} style={{ color: '#64748B' }} />
                Local session
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  signOut();
                }}
                style={{ ...menuItemStyle, color: '#DC2626', borderTop: '1px solid #f1f5f9' }}
              >
                <Icon name="logout" size={18} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const menuItemStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 600,
  color: '#334155',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left'
};
