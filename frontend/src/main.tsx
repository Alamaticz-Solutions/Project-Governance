import React, { useState } from 'react';
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
import { governanceUiContract } from './generated/appfw-ui-contract';
import './styles.css';

// Product-owned view adapter over the generated UI contract. The generated
// `governanceUiContract` is the source of truth; this shapes the few fields the
// starter shell renders. Replace with real feature screens under `src/features/**`.
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

const workspaceCommands: CommandPaletteItem[] = [
  {
    id: 'workspace:model',
    group: 'Workspace',
    label: 'Review model',
    detail: appUiContract.schema,
    href: '#model'
  },
  {
    id: 'workspace:contract',
    group: 'Workspace',
    label: 'Open generated contract',
    detail: 'src/generated/appfw-ui-contract.ts',
    href: '#contract'
  },
  {
    id: 'workspace:evidence',
    group: 'Release',
    label: 'Review frontend evidence',
    detail: 'target/appfw/frontend-scaffold-check.json',
    href: '#evidence'
  },
  {
    id: 'workspace:components',
    group: 'Design system',
    label: 'Review starter components',
    detail: 'Forms, grid, overlays, and analytics',
    href: '#components'
  }
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
