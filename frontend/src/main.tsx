import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AppShell,
  Badge,
  Button,
  ChartLegend,
  ChartShell,
  CommandPalette,
  DataGridDensityControl,
  DataGridPagination,
  DataGridShell,
  DataGridToolbar,
  DateField,
  Dialog,
  FormLayout,
  KpiTile,
  MetricTrend,
  PageHeader,
  SelectField,
  Surface,
  SwitchField,
  TextField,
  ValidationSummary,
  type CommandPaletteItem,
  type PdsDataGridColumn,
  type PdsDensity
} from '@appfw/pds-health-components';
import {
  EntityWorkspace,
  findEntityContract,
  type EntityWorkspaceRow,
  type EntityWorkspaceState
} from './generated/appfw-entity-workspace';
import { governanceUiContract } from './generated/appfw-ui-contract';
import './styles.css';

// Product-owned view adapter over the generated UI contract. The generated
// `governanceUiContract` is the source of truth; this shapes the few fields the
// starter shell renders. Bespoke feature screens land under `src/features/**`.
const appUiContract = {
  schema: governanceUiContract.schemaName,
  schemaLabel: 'Governance',
  displayName: 'Governance',
  provider: governanceUiContract.provider.dataSourceType,
  modelStatus: `${governanceUiContract.entities.length} entities · contract v${governanceUiContract.version}`
};

type StarterRow = Record<string, unknown> & {
  id: string;
  request: string;
  owner: string;
  state: string;
  due: string;
};

const starterRows: StarterRow[] = [
  { id: 'REQ-101', request: 'Model review', owner: 'Platform team', state: 'Ready', due: 'Jun 18' },
  { id: 'REQ-102', request: 'Policy mapping', owner: 'Security team', state: 'Needs review', due: 'Jun 20' },
  { id: 'REQ-103', request: 'Release evidence', owner: 'Product team', state: 'Draft', due: 'Jun 24' }
];

const starterColumns: PdsDataGridColumn<StarterRow>[] = [
  { key: 'request', header: 'Request', width: '32%' },
  { key: 'owner', header: 'Owner', width: '26%' },
  { key: 'state', header: 'State', width: '22%', render: (row) => <Badge tone={row.state === 'Ready' ? 'success' : row.state === 'Needs review' ? 'warning' : 'neutral'}>{row.state}</Badge> },
  { key: 'due', header: 'Due', width: '20%', align: 'end' }
];

const requestTypeOptions = [
  { value: 'intake', label: 'Intake review' },
  { value: 'model', label: 'Model decision' },
  { value: 'release', label: 'Release evidence' }
];

const starterValidation = {
  requestType: ['Select a generated type before submit.']
};

const starterLegend = [
  { id: 'ready', label: 'Ready', tone: 'success' as const, value: '72%' },
  { id: 'review', label: 'Needs review', tone: 'warning' as const, value: '18%' },
  { id: 'draft', label: 'Draft', tone: 'neutral' as const, value: '10%' }
];

// -----------------------------------------------------------------------------
// M11a — generic contract-driven renderer.
//
// Nothing below is entity-specific: every list is derived from
// `governanceUiContract` + the framework-owned `EntityWorkspace` presentational
// component, giving a read-only CRUD surface for all 24 generated entities
// before any `src/features/**` screen exists (file 05 §5.4). The live query is
// best-effort — with no backend reachable it simply lands in the `error` state.
// -----------------------------------------------------------------------------

const SCHEMA = governanceUiContract.schemaName;

const GRAPHQL_URL =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_GOVERNANCE_GRAPHQL_URL) ?? '/governance/graphql';

const entityOptions = governanceUiContract.entities
  .map((e) => ({ value: e.routeSegment, label: e.caption.plural }))
  .sort((a, b) => a.label.localeCompare(b.label));

// Local-exploration auth only; production auth is backend-governed. Bearer token
// and tenant id come from session storage so no credential is in the bundle.
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  try {
    const bearer = window.sessionStorage.getItem('appfw.bearer');
    const tenant = window.sessionStorage.getItem('appfw.tenantId');
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    if (tenant) headers['x-tenant-id'] = tenant;
  } catch {
    /* storage unavailable — send an unauthenticated probe, UI fails closed */
  }
  return headers;
}

// Simplest list operation the contract exposes: a zero-arg `list`-shaped query
// if present, else the connection query capped at one page.
function listPlanFor(entity: ReturnType<typeof findEntityContract>) {
  if (!entity) return undefined;
  const op =
    entity.operations.find((o) => o.kind === 'query' && o.returnsShape === 'list') ??
    entity.operations.find((o) => o.kind === 'query' && o.returnsShape === 'connection');
  if (!op) return undefined;
  const fields = entity.scaffold.list.fields.length
    ? entity.scaffold.list.fields
    : op.selectionPreset;
  const selection = fields.join('\n      ');
  const isConnection = op.returnsShape === 'connection';
  const inner = isConnection
    ? `${op.graphqlName}(limit: 100) {\n    items {\n      ${selection}\n    }\n  }`
    : `${op.graphqlName} {\n    ${selection}\n  }`;
  return { graphqlName: op.graphqlName, isConnection, query: `query ${op.graphqlName}List {\n  ${inner}\n}` };
}

type FetchState = { state: EntityWorkspaceState; rows: EntityWorkspaceRow[]; errorDetail?: string };

function useEntityRows(segment: string): FetchState & { retry: () => void } {
  const entity = useMemo(() => findEntityContract(SCHEMA, segment), [segment]);
  const plan = useMemo(() => listPlanFor(entity), [entity]);
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<FetchState>({ state: 'loading', rows: [] });
  const retry = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!entity || !plan) {
      setResult({ state: 'error', rows: [], errorDetail: `No list operation is exposed for "${segment}".` });
      return;
    }
    let cancelled = false;
    setResult({ state: 'loading', rows: [] });
    fetch(GRAPHQL_URL, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ query: plan.query }) })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return { denied: true as const };
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: unknown) => {
        if (cancelled) return;
        if (payload && typeof payload === 'object' && 'denied' in payload) {
          setResult({ state: 'policy_denied', rows: [] });
          return;
        }
        const body = payload as { data?: Record<string, unknown>; errors?: { message: string }[] };
        if (body.errors?.length) {
          const denied = body.errors.some((e) => /forbidden|unauthor|denied|policy/i.test(e.message));
          setResult({
            state: denied ? 'policy_denied' : 'error',
            rows: [],
            errorDetail: body.errors.map((e) => e.message).join('; ')
          });
          return;
        }
        const raw = body.data?.[plan.graphqlName];
        const rows = (
          plan.isConnection ? ((raw as { items?: unknown[] } | undefined)?.items ?? []) : (raw ?? [])
        ) as EntityWorkspaceRow[];
        setResult({ state: rows.length ? 'ready' : 'empty', rows });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult({
          state: 'error',
          rows: [],
          errorDetail: err instanceof Error ? err.message : 'Request failed to complete.'
        });
      });
    return () => {
      cancelled = true;
    };
  }, [entity, plan, segment, tick]);

  return { ...result, retry };
}

function GenericEntityBrowser() {
  const [segment, setSegment] = useState<string>(entityOptions[0]?.value ?? '');
  const entity = useMemo(() => findEntityContract(SCHEMA, segment), [segment]);
  const { state, rows, errorDetail, retry } = useEntityRows(segment);

  return (
    <Surface
      id="entities"
      title="Generated entities"
      subtitle="Read-only generic renderer — every entity from the UI contract"
      density="compact"
    >
      <FormLayout columns="one">
        <SelectField
          label="Entity"
          value={segment}
          onChange={(event) => setSegment(event.target.value)}
          options={entityOptions}
        />
      </FormLayout>
      {entity ? (
        <EntityWorkspace
          entity={entity}
          rows={rows}
          state={state}
          errorTitle={`Could not load ${entity.caption.plural.toLowerCase()}`}
          errorDetail={errorDetail}
          onRetry={retry}
          actions={<Badge tone="neutral">read-only</Badge>}
        />
      ) : (
        <p>No generated entities are available in this contract.</p>
      )}
    </Surface>
  );
}

const workspaceCommands: CommandPaletteItem[] = [
  { id: 'workspace:entities', group: 'Workspace', label: 'Browse generated entities', detail: 'Generic renderer', href: '#entities' },
  { id: 'workspace:model', group: 'Workspace', label: 'Review model', detail: appUiContract.schema, href: '#model' },
  { id: 'workspace:contract', group: 'Workspace', label: 'Open generated contract', detail: 'src/generated/appfw-ui-contract.ts', href: '#contract' },
  { id: 'workspace:evidence', group: 'Release', label: 'Review frontend evidence', detail: 'target/appfw/frontend-scaffold-check.json', href: '#evidence' },
  { id: 'workspace:components', group: 'Design system', label: 'Review starter components', detail: 'Forms, grid, overlays, and analytics', href: '#components' }
];

function App() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [density, setDensity] = useState<PdsDensity>('compact');
  const [approvalRequired, setApprovalRequired] = useState(true);

  return (
    <AppShell
      brand={(
        <div className="app-brand">
          <strong>{appUiContract.displayName}</strong>
          <span>{appUiContract.schemaLabel} workspace</span>
        </div>
      )}
      navigation={(
        <div className="app-nav" aria-label="Workspace sections">
          <a href="#entities">Entities</a>
          <a href="#model">Model</a>
          <a href="#contract">Contract</a>
          <a href="#evidence">Evidence</a>
          <a href="#components">Components</a>
        </div>
      )}
      topBar={(
        <div className="app-topbar">
          <CommandPalette
            items={workspaceCommands}
            triggerLabel="Search workspace"
            searchPlaceholder="Search workspace commands"
          />
        </div>
      )}
      footer={(
        <div className="app-shell-footer">
          <span>Generated scaffold</span>
          <strong>{appUiContract.provider}</strong>
        </div>
      )}
    >
      <PageHeader
        eyebrow={appUiContract.schemaLabel}
        title={appUiContract.displayName}
        subtitle="legacy-modernization product workspace"
        actions={<Badge tone="accent">{appUiContract.provider}</Badge>}
      />

      <GenericEntityBrowser />

      <div className="app-status-grid" aria-label="Workspace status">
        <Surface id="model" title="Model" subtitle="Application data model" density="compact">
          <p>{appUiContract.schema}</p>
          <Badge>{appUiContract.modelStatus}</Badge>
        </Surface>
        <Surface id="contract" title="Contract" subtitle="Generated UI boundary" density="compact">
          <p>src/generated/appfw-ui-contract.ts</p>
          <Badge tone="success">Ready</Badge>
        </Surface>
        <Surface id="evidence" title="Evidence" subtitle="Frontend scaffold check" density="compact">
          <p>target/appfw/frontend-scaffold-check.json</p>
          <Badge>Local</Badge>
        </Surface>
      </div>
      <div className="app-kpi-grid" id="components" aria-label="Starter component examples">
        <KpiTile
          label="Design system"
          value="PDS"
          detail="Framework-owned source"
          tone="accent"
          trend={<MetricTrend value="Ready" label="starter" tone="positive" direction="up" />}
        />
        <KpiTile
          label="Generated contract"
          value={appUiContract.schemaLabel}
          detail="Replace after model generation"
          tone="success"
          trend={<MetricTrend value="v1" label="UI boundary" tone="accent" direction="flat" />}
        />
        <KpiTile
          label="Release evidence"
          value="Local"
          detail="Retain scaffold check output"
          tone="neutral"
          trend={<MetricTrend value="4" label="starter examples" tone="neutral" direction="flat" />}
        />
      </div>

      <div className="app-work-grid">
        <Surface title="Generated form starter" subtitle="Token-backed field states and validation" density="compact">
          <ValidationSummary validation={starterValidation} />
          <FormLayout
            columns="two"
            footer={(
              <>
                <Button variant="quiet">Reset</Button>
                <Button variant="primary" onClick={() => setReviewOpen(true)}>Review draft</Button>
              </>
            )}
          >
            <SelectField
              label="Request type"
              required
              error="Select a generated type before submit."
              placeholder="Select a type"
              options={requestTypeOptions}
            />
            <TextField label="Owner" defaultValue="Product team" hint="Use product-owned copy and generated field hints." />
            <DateField label="Due date" defaultValue="2026-06-24" hint="Native date controls preserve keyboard and mobile behavior." />
            <SwitchField
              id="approval-required"
              label="Require approval"
              checked={approvalRequired}
              onCheckedChange={setApprovalRequired}
              detail="Use explicit state for governed workflow choices."
            />
          </FormLayout>
        </Surface>

        <Surface title="Work queue starter" subtitle="Compact grid with user-selectable density" density="compact">
          <DataGridToolbar
            ariaLabel="Starter queue controls"
            search={<input className="app-search" type="search" aria-label="Search starter queue" placeholder="Search queue" />}
            summary={(
              <>
                <strong>{starterRows.length} rows</strong>
                <span>{density} density</span>
              </>
            )}
            actions={<DataGridDensityControl value={density} onChange={setDensity} label="Density" />}
            density={density}
          />
          <DataGridShell
            columns={starterColumns}
            rows={starterRows}
            rowKey="id"
            ariaLabel="Starter work queue"
            density={density}
          />
          <DataGridPagination pageSize={25} pageIndex={1} startRow={1} endRow={starterRows.length} totalRows={starterRows.length} responseMs={32} />
        </Surface>
      </div>

      <ChartShell
        title="Readiness starter"
        subtitle="Chart-engine-neutral analytics chrome"
        footer={<ChartLegend items={starterLegend} />}
      >
        <div className="app-chart-bars" aria-label="Starter readiness distribution">
          <span className="app-chart-bar is-ready"><b>Ready</b></span>
          <span className="app-chart-bar is-review"><b>Needs review</b></span>
          <span className="app-chart-bar is-draft"><b>Draft</b></span>
        </div>
      </ChartShell>

      <Dialog
        open={reviewOpen}
        title="Review starter draft"
        description="Use shared overlays for confirmation, review, and supporting workflow panels."
        onClose={() => setReviewOpen(false)}
        closeLabel="Close review dialog"
        footer={<Button variant="primary" onClick={() => setReviewOpen(false)}>Close</Button>}
      >
        <p>This placeholder is product-owned. Replace it with workflow-specific review content once the model and generated UI contract are ready.</p>
      </Dialog>
    </AppShell>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
