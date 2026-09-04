import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Badge,
  DataGridPagination,
  DataGridShell,
  DataGridToolbar,
  PageHeader,
  SearchBar,
  Surface,
  type PdsDataGridColumn
} from '@appfw/pds-health-components';
import { useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, humanizeEnum, formatDateTime } from '../../components/ui';

const PAGE_SIZE = 50;
const auditEntity = entityByType('AuditEvent');

type Row = AppfwRecord & { id: string };

export function AuditScreen() {
  const [page, setPage] = useState(0);
  const [entityType, setEntityType] = useState('');

  const filter = useMemo(
    () => (entityType.trim() ? { entity_type: { _ilike: `%${entityType.trim()}%` } } : undefined),
    [entityType]
  );

  const state = useAsync(
    (client) =>
      client.queryList(auditEntity, {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        filter,
        sort: { performed_at: 'desc' },
        selection: ['id', 'entity_type', 'entity_id', 'action', 'performed_at', 'project_id']
      }),
    [page, filter]
  );

  const columns: PdsDataGridColumn<Row>[] = [
    {
      key: 'performed_at',
      header: 'When',
      width: '20%',
      render: (row) => formatDateTime(row.performed_at)
    },
    {
      key: 'action',
      header: 'Action',
      width: '22%',
      render: (row) => <Badge tone="neutral">{humanizeEnum(row.action)}</Badge>
    },
    { key: 'entity_type', header: 'Entity', width: '18%' },
    { key: 'entity_id', header: 'Entity id', width: '24%' },
    {
      key: 'project_id',
      header: 'Project',
      width: '16%',
      render: (row) =>
        row.project_id ? (
          <Link to={`/projects/${String(row.project_id)}`}>open</Link>
        ) : (
          <span>—</span>
        )
    }
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Append-only AuditEvent stream (workflow, gate, and project actions)"
      />
      <Surface>
        <DataGridToolbar
          ariaLabel="Audit filters"
          search={
            <SearchBar
              items={[]}
              placeholder="Filter by entity type"
              value={entityType}
              onValueChange={(value) => {
                setPage(0);
                setEntityType(value);
              }}
            />
          }
          summary={state.status === 'ready' ? `${state.data?.page.queryCount ?? 0} events` : null}
        />
        <AsyncSection
          state={state}
          isEmpty={(data) => data.rows.length === 0}
          emptyTitle="No audit events"
        >
          {(data) => (
            <>
              <DataGridShell
                ariaLabel="Audit events"
                columns={columns}
                rows={data.rows as Row[]}
                rowKey="id"
              />
              <DataGridPagination
                pageSize={PAGE_SIZE}
                pageIndex={page + 1}
                startRow={data.rows.length ? page * PAGE_SIZE + 1 : 0}
                endRow={page * PAGE_SIZE + data.rows.length}
                totalRows={data.page.queryCount}
                pageCount={data.page.pageCount || undefined}
                onPreviousPage={() => setPage((p) => Math.max(0, p - 1))}
                onNextPage={() => setPage((p) => p + 1)}
                onFirstPage={() => setPage(0)}
              />
            </>
          )}
        </AsyncSection>
      </Surface>
    </>
  );
}
