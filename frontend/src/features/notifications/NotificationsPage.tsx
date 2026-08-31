import { useEffect, useState } from "react";
import { Button, Card, PageHeader, StateView } from "../../components/ui";
import { notificationsApi } from "../../lib/api";
import type { NotificationItem } from "../../lib/types";

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    notificationsApi
      .list()
      .then(setItems)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function markAllRead() {
    await notificationsApi.markAllRead();
    load();
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="secondary" onClick={markAllRead}>
            Mark All Read
          </Button>
        }
      />

      {error && <StateView label={`Failed to load notifications: ${error}`} />}
      {!items && !error && <StateView label="Loading…" />}
      {items && items.length === 0 && <StateView label="No notifications yet." />}

      <div className="space-y-2">
        {items?.map((item) => (
          <Card key={item.id} className={item.is_read ? "opacity-60" : ""}>
            <div className="flex justify-between">
              <div>
                <div className="font-medium text-sm">{item.title}</div>
                <div className="text-sm text-slate-500">{item.message}</div>
              </div>
              {!item.is_read && <span className="h-2 w-2 rounded-full bg-red-500 mt-1" />}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
