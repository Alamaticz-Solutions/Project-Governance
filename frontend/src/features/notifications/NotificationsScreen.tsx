import { useNavigate } from 'react-router';
import { useState } from 'react';
import { Button, Icon, InlineAlert, SwitchField } from '@ui-kit';
import { useAction, useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, formatDateTime } from '../../components/ui';

const notificationEntity = entityByType('Notification');

async function loadNotifications(
  client: AppfwClient,
  recipientId: string | undefined,
  unreadOnly: boolean
) {
  const clauses: unknown[] = [];
  if (recipientId) clauses.push({ recipient_id: { _eq: recipientId } });
  if (unreadOnly) clauses.push({ is_read: { _eq: false } });
  const result = await client.queryList(notificationEntity, {
    limit: 100,
    sort: { created_at: 'desc' },
    filter: clauses.length ? { _and: clauses } : undefined,
    selection: [
      'id',
      'notification_type',
      'title',
      'message',
      'action_url',
      'is_read',
      'created_at',
      'read_at',
      'project_id'
    ]
  });
  return result.rows;
}

function iconFor(row: AppfwRecord): string {
  const t = String(row.title ?? '').toLowerCase();
  if (t.includes('approved')) return 'check_circle';
  if (t.includes('rejected')) return 'cancel';
  if (t.includes('submitted')) return 'publish';
  return 'notifications';
}

/**
 * Full notification history. Presentation mirrors the Dev-branch portal
 * (card list, unread accent, mark-all-read); reads/writes go through the App
 * Framework client, recipient-scoped to the session user.
 */
export function NotificationsScreen() {
  const { auth } = useApp();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const state = useAsync(
    (client) => loadNotifications(client, auth.userId, unreadOnly),
    [auth.userId, unreadOnly]
  );

  const markRead = useAction((client, row: AppfwRecord) =>
    client.saveRecord(notificationEntity, 'update', {
      id: row.id,
      is_read: true,
      read_at: new Date().toISOString()
    })
  );

  async function markAllRead() {
    const rows = state.data ?? [];
    await Promise.all(rows.filter((r) => !r.is_read).map((r) => markRead.run(r)));
    state.reload();
  }

  function open(row: AppfwRecord) {
    if (!row.is_read) markRead.run(row).then(() => state.reload());
    if (row.action_url) navigate(String(row.action_url));
    else if (row.project_id) navigate(`/projects/${String(row.project_id)}`);
  }

  return (
    <div className="animate-fade-in" style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Notifications</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--gov-text-muted)' }}>
            {auth.userId
              ? 'Your workflow notifications'
              : 'All notifications — set a user in the session dialog to filter to yours'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <SwitchField
            id="notif-unread"
            label="Unread only"
            checked={unreadOnly}
            onCheckedChange={setUnreadOnly}
          />
          <Button variant="secondary" onClick={markAllRead} isLoading={markRead.pending}>
            <Icon name="done_all" size={18} /> Mark all read
          </Button>
        </div>
      </div>

      {markRead.error && (
        <InlineAlert tone="danger" title="Could not update" detail={markRead.error.message} />
      )}

      <AsyncSection
        state={state}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="No notifications"
        emptyDetail={unreadOnly ? 'Nothing unread.' : 'Nothing here yet.'}
      >
        {(rows) => (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((row) => (
              <button
                key={String(row.id)}
                type="button"
                onClick={() => open(row)}
                style={{
                  display: 'flex',
                  gap: 14,
                  textAlign: 'left',
                  padding: 16,
                  borderRadius: 'var(--gov-radius-md)',
                  border: '1px solid var(--gov-border)',
                  background: row.is_read ? 'var(--gov-bg-elevated)' : 'var(--gov-accent-soft)',
                  cursor: 'pointer'
                }}
              >
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: row.is_read ? 'var(--gov-bg-elevated-soft)' : 'rgba(79,70,229,0.15)',
                    color: row.is_read ? 'var(--gov-text-muted)' : 'var(--gov-accent)'
                  }}
                >
                  <Icon name={iconFor(row)} size={20} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'baseline'
                    }}
                  >
                    <strong style={{ fontSize: 14, color: 'var(--gov-text)' }}>
                      {String(row.title ?? '—')}
                    </strong>
                    {!row.is_read && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: 'var(--gov-accent)',
                          flexShrink: 0,
                          marginTop: 4
                        }}
                      />
                    )}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: 'var(--gov-text-muted)',
                      margin: '2px 0'
                    }}
                  >
                    {String(row.message ?? '')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--gov-text-muted)' }}>
                    {formatDateTime(row.created_at)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
