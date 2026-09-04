import { Link } from 'react-router';
import {
  Badge,
  Button,
  InlineAlert,
  PageHeader,
  SwitchField,
  Surface
} from '@appfw/pds-health-components';
import { useState } from 'react';
import { useAction, useApp, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwClient, AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, humanizeEnum, formatDateTime } from '../../components/ui';

const notificationEntity = entityByType('Notification');

async function loadNotifications(client: AppfwClient, recipientId: string | undefined, unreadOnly: boolean) {
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

export function NotificationsScreen() {
  const { auth } = useApp();
  const [unreadOnly, setUnreadOnly] = useState(true);
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

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={
          auth.userId
            ? 'Your workflow notifications'
            : 'Showing all notifications — set a user in the session dialog to filter to yours'
        }
        actions={
          <SwitchField
            id="notif-unread"
            label="Unread only"
            checked={unreadOnly}
            onCheckedChange={setUnreadOnly}
          />
        }
      />
      {markRead.error && (
        <InlineAlert tone="danger" title="Could not update" detail={markRead.error.message} />
      )}
      <Surface>
        <AsyncSection
          state={state}
          isEmpty={(rows) => rows.length === 0}
          emptyTitle="No notifications"
          emptyDetail={unreadOnly ? 'Nothing unread.' : 'Nothing here yet.'}
        >
          {(rows) => (
            <ul className="notification-list">
              {rows.map((row) => (
                <li key={String(row.id)} data-read={row.is_read ? 'true' : 'false'}>
                  <div>
                    <Badge tone={row.is_read ? 'neutral' : 'accent'}>
                      {humanizeEnum(row.notification_type)}
                    </Badge>{' '}
                    <strong>{String(row.title ?? '—')}</strong>
                    <p>{String(row.message ?? '')}</p>
                    <small>{formatDateTime(row.created_at)}</small>
                    {row.project_id ? (
                      <>
                        {' · '}
                        <Link to={`/projects/${String(row.project_id)}`}>view project</Link>
                      </>
                    ) : null}
                  </div>
                  {!row.is_read && (
                    <Button
                      size="sm"
                      variant="quiet"
                      isLoading={markRead.pending}
                      onClick={() => markRead.run(row).then(() => state.reload())}
                    >
                      Mark read
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </AsyncSection>
      </Surface>
    </>
  );
}
