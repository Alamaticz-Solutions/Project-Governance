import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Badge,
  Button,
  DataGridPagination,
  DataGridShell,
  DataGridToolbar,
  PageHeader,
  SearchBar,
  SelectField,
  Surface,
  type PdsDataGridColumn
} from '@ui-kit';
import { useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, EnumBadge, formatDate, toEnumFilterValue } from '../../components/ui';
import { PROJECT_STATUS } from '../shared/enums';

const PAGE_SIZE = 25;
const projectEntity = entityByType('Project');

type Row = AppfwRecord & { id: string };

export function ProjectListScreen() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const filter = useMemo(() => {
    const clauses: unknown[] = [];
    // filter args are untyped JSON and compare the raw stored text, which is
    // the model's SCREAMING_SNAKE casing — not the PascalCase the SelectField
    // options use for mutation-input/display consistency. See toEnumFilterValue.
    if (status) clauses.push({ status: { _eq: toEnumFilterValue(status) } });
    if (search.trim()) {
      clauses.push({
        _or: [
          { project_name: { _ilike: `%${search.trim()}%` } },
          { project_number: { _ilike: `%${search.trim()}%` } }
        ]
      });
    }
    return clauses.length ? { _and: clauses } : undefined;
  }, [status, search]);

  const state = useAsync(
    (client) =>
      client.queryList(projectEntity, {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        filter,
        sort: { created_at: 'desc' },
        selection: [
          'id',
          'project_number',
          'project_name',
          'business_unit',
          'priority',
          'risk_level',
          'status',
          'current_stage',
          'submitted_at'
        ]
      }),
    [page, filter]
  );

  const columns: PdsDataGridColumn<Row>[] = [
    {
      key: 'project_number',
      header: 'Number',
      width: '12%',
      render: (row) => (
        <Link to={`/projects/${String(row.id)}`}>{String(row.project_number ?? '—')}</Link>
      )
    },
    { key: 'project_name', header: 'Project', width: '28%' },
    { key: 'business_unit', header: 'Business unit', width: '16%' },
    {
      key: 'priority',
      header: 'Priority',
      width: '10%',
      render: (row) => <EnumBadge value={row.priority} />
    },
    {
      key: 'status',
      header: 'Status',
      width: '12%',
      render: (row) => <EnumBadge value={row.status} />
    },
    { key: 'current_stage', header: 'Stage', width: '12%' },
    {
      key: 'submitted_at',
      header: 'Submitted',
      width: '10%',
      align: 'end',
      render: (row) => formatDate(row.submitted_at)
    }
  ];

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Portfolio intake and gate progression"
        actions={
          <Button variant="primary" onClick={() => navigate('/intake')}>
            New intake
          </Button>
        }
      />
      <Surface>
        <DataGridToolbar
          ariaLabel="Project filters"
          search={
            <SearchBar
              items={[]}
              placeholder="Search name or number"
              value={search}
              onValueChange={(value) => {
                setPage(0);
                setSearch(value);
              }}
            />
          }
          filters={
            <SelectField
              label="Status"
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setPage(0);
                setStatus(event.target.value);
              }}
              options={[{ value: '', label: 'All statuses' }, ...PROJECT_STATUS]}
            />
          }
          summary={
            state.status === 'ready' ? (
              <Badge tone="neutral">{state.data?.page.queryCount ?? 0} total</Badge>
            ) : null
          }
        />
        <AsyncSection
          state={state}
          isEmpty={(data) => data.rows.length === 0}
          emptyTitle="No projects match"
          emptyDetail="Adjust the filters or start a new intake."
        >
          {(data) => (
            <>
              <DataGridShell
                ariaLabel="Projects"
                columns={columns}
                rows={data.rows as Row[]}
                rowKey="id"
                onRowSelect={(row) => navigate(`/projects/${String(row.id)}`)}
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
