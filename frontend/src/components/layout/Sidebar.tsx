import type { CSSProperties, ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Icon } from '@ui-kit';
import { useApp } from '../../app/providers';
import { ROLE_CAPTIONS, type GovernanceRole } from '../../lib/authContext';

/**
 * Primary navigation rail. Visual language (dark gradient canvas, ambient
 * glow, gradient brand lockup, pill nav items) mirrors the Dev-branch
 * governance portal; the identity footer and the "Pending Reviews" badge are
 * wired to the live session / inbox rather than placeholder values.
 */

type NavItem = { label: string; icon: string; route: string; badge?: number };

const NAV_WORKSPACE: NavItem[] = [
  { label: 'Overview Dashboard', icon: 'dashboard', route: '/dashboard' },
  { label: 'New Request', icon: 'add_circle', route: '/intake' },
  { label: 'My Requests', icon: 'list_alt', route: '/projects' }
];

const activeItemStyle: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(79,70,229,0.25) 0%, rgba(124,58,237,0.15) 100%)',
  color: 'white',
  border: '1px solid rgba(79,70,229,0.3)',
  boxShadow: '0 2px 12px rgba(79,70,229,0.15)'
};
const idleItemStyle: CSSProperties = {
  color: 'rgba(148,163,184,0.8)',
  border: '1px solid transparent'
};

function NavRow({ item }: { item: NavItem }) {
  return (
    <li>
      <NavLink
        to={item.route}
        end={item.route === '/dashboard'}
        style={({ isActive }) => ({
          margin: '0 12px',
          padding: '10px 12px',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          position: 'relative',
          transition: 'all 0.2s',
          ...(isActive ? activeItemStyle : idleItemStyle)
        })}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  borderRadius: 9999,
                  background: 'linear-gradient(180deg, #818CF8, #A78BFA)'
                }}
              />
            )}
            <Icon name={item.icon} size={19} style={{ color: isActive ? '#818CF8' : undefined }} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge ? (
              <span
                style={{
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  minWidth: 20,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  boxShadow: '0 2px 8px rgba(79,70,229,0.4)'
                }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            ) : null}
          </>
        )}
      </NavLink>
    </li>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        padding: '0 20px 8px',
        display: 'block',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'rgba(148,163,184,0.5)'
      }}
    >
      {children}
    </span>
  );
}

export function Sidebar({ pendingReviewCount }: { pendingReviewCount?: number }) {
  const { auth } = useApp();

  const name = auth.displayName || auth.userName || 'Not signed in';
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

  const navGovernance: NavItem[] = [
    {
      label: 'Pending Reviews',
      icon: 'pending_actions',
      route: '/team-inbox',
      badge: pendingReviewCount || undefined
    },
    { label: 'Meeting Center', icon: 'groups', route: '/meeting-center' },
    { label: 'Analytics', icon: 'insights', route: '/analytics' }
  ];

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: 256,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0D0F1A 0%, #111827 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 256,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 30% 0%, rgba(79,70,229,0.18) 0%, transparent 70%)',
          zIndex: 0
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 192,
          height: 192,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at 100% 100%, rgba(124,58,237,0.12) 0%, transparent 70%)',
          zIndex: 0
        }}
      />

      {/* Brand lockup */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '20px',
          minHeight: 72,
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}
      >
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 12,
              filter: 'blur(8px)',
              opacity: 0.7,
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              transform: 'scale(1.15)'
            }}
          />
          <div
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
            }}
          >
            <Icon name="account_tree" size={20} style={{ color: 'white' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'white',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--gov-font-display)',
              letterSpacing: '0.01em'
            }}
          >
            Governance Portal
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              background: 'linear-gradient(90deg, #818CF8, #A78BFA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Enterprise AI
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div
        className="custom-scrollbar"
        style={{ flex: 1, overflowY: 'auto', padding: '16px 0', position: 'relative', zIndex: 10 }}
      >
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Workspace</SectionLabel>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
            {NAV_WORKSPACE.map((item) => (
              <NavRow key={item.route} item={item} />
            ))}
          </ul>
        </div>
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Governance Engine</SectionLabel>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
            {navGovernance.map((item) => (
              <NavRow key={item.route} item={item} />
            ))}
          </ul>
        </div>
      </div>

      {/* Identity footer */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: 16,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 10,
            borderRadius: 12,
            border: '1px solid transparent'
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                filter: 'blur(4px)',
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                transform: 'scale(1.2)',
                opacity: 0.6
              }}
            />
            <div
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
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)'
              }}
            >
              {initials}
            </div>
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <span
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {name}
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'rgba(148,163,184,0.7)' }}>
              {roleCaption}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
