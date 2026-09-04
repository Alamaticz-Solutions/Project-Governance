import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import {
  AppShell,
  Badge,
  Button,
  ChartLegend,
  ChartShell,
  CommandPalette,
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
  type PdsDataGridColumn
} from '@ui-kit';
import { AppProviders } from './app/providers';
import { ErrorBoundary } from './app/ErrorBoundary';
import { AppRoot } from './app/App';
import { governanceUiContract } from './generated/appfw-ui-contract';
import './styles.css';

// ---------------------------------------------------------------------------
// The product SPA. Feature screens live under `src/features/**`; the shared
// client / routing / auth layer under `src/lib` + `src/app`. `ScaffoldReference`
// below is a reference screen for the product's own UI kit (src/ui/kit.tsx),
// reachable at `/scaffold`.
// ---------------------------------------------------------------------------

type StarterRow = Record<string, unknown> & {
  id: string;
  request: string;
  owner: string;
  state: string;
  due: string;
};

const starterRows: StarterRow[] = [
  { id: 'REF-1', request: 'Design system reference', owner: 'Platform', state: 'Ready', due: '—' },
  { id: 'REF-2', request: 'Token-only styling', owner: 'Platform', state: 'Ready', due: '—' },
  { id: 'REF-3', request: 'Accessible primitives', owner: 'Platform', state: 'Ready', due: '—' }
];

const starterColumns: PdsDataGridColumn<StarterRow>[] = [
  { key: 'request', header: 'Reference', width: '40%' },
  { key: 'owner', header: 'Owner', width: '20%' },
  {
    key: 'state',
    header: 'State',
    width: '20%',
    render: (row) => <Badge tone="success">{row.state}</Badge>
  },
  { key: 'due', header: 'Due', width: '20%', align: 'end' }
];

const referenceCommands: CommandPaletteItem[] = [
  { id: 'ref:contract', group: 'Reference', label: 'Generated UI contract', detail: 'src/generated/appfw-ui-contract.ts' },
  { id: 'ref:evidence', group: 'Reference', label: 'Scaffold check evidence', detail: 'target/appfw/frontend-scaffold-check.json' }
];

/** Product-owned UI kit reference. Not part of the product IA. */
export function ScaffoldReference() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(true);

  return (
    <AppShell
      brand={
        <div className="app-brand">
          <strong>Governance</strong>
          <span>Design system reference</span>
        </div>
      }
      navigation={
        <div className="app-nav" aria-label="Reference sections">
          <a href="#components">Components</a>
        </div>
      }
      topBar={
        <div className="app-topbar">
          <CommandPalette
            items={referenceCommands}
            triggerLabel="Search reference"
            searchPlaceholder="Search design-system reference"
          />
        </div>
      }
      footer={<div className="app-shell-footer">Generated scaffold reference</div>}
    >
      <PageHeader
        eyebrow="Reference"
        title="UI kit reference"
        subtitle={`${governanceUiContract.entities.length} entities in contract v${governanceUiContract.version}`}
        actions={<Badge tone="accent">{governanceUiContract.provider.dataSourceType}</Badge>}
      />
      <div className="app-kpi-grid" id="components">
        <KpiTile
          label="Design system"
          value="Self-owned"
          detail="src/ui/kit.tsx"
          tone="accent"
          trend={<MetricTrend value="Ready" label="in-repo" tone="positive" direction="up" />}
        />
        <KpiTile label="Tokens" value="--gov-*" detail="No raw hex" tone="success" />
        <KpiTile label="Routing" value="react-router" detail="src/app/App.tsx" tone="neutral" />
      </div>

      <div className="app-work-grid">
        <Surface title="Form primitives" density="compact">
          <ValidationSummary validation={{ example: ['Reference only.'] }} />
          <FormLayout
            columns="two"
            footer={
              <>
                <Button variant="quiet">Reset</Button>
                <Button variant="primary" onClick={() => setReviewOpen(true)}>
                  Open dialog
                </Button>
              </>
            }
          >
            <SelectField
              label="Example select"
              placeholder="Choose"
              options={[
                { value: 'a', label: 'Option A' },
                { value: 'b', label: 'Option B' }
              ]}
            />
            <TextField label="Example text" defaultValue="Reference" />
            <DateField label="Example date" defaultValue="2026-01-01" />
            <SwitchField
              id="ref-switch"
              label="Example switch"
              checked={approvalRequired}
              onCheckedChange={setApprovalRequired}
            />
          </FormLayout>
        </Surface>

        <Surface title="Grid primitives" density="compact">
          <DataGridToolbar
            ariaLabel="Reference grid controls"
            summary={<strong>{starterRows.length} rows</strong>}
          />
          <DataGridShell
            columns={starterColumns}
            rows={starterRows}
            rowKey="id"
            ariaLabel="Reference grid"
          />
          <DataGridPagination
            pageSize={25}
            pageIndex={1}
            startRow={1}
            endRow={starterRows.length}
            totalRows={starterRows.length}
          />
        </Surface>
      </div>

      <ChartShell title="Chart chrome" subtitle="Engine-neutral" footer={<ChartLegend items={[]} />}>
        <div className="app-chart-bars">
          <span className="app-chart-bar is-ready">
            <b>Reference</b>
          </span>
        </div>
      </ChartShell>

      <Dialog
        open={reviewOpen}
        title="Reference dialog"
        description="Shared overlay primitive."
        onClose={() => setReviewOpen(false)}
        closeLabel="Close dialog"
        footer={
          <Button variant="primary" onClick={() => setReviewOpen(false)}>
            Close
          </Button>
        }
      >
        <p>This screen is a UI kit reference, not part of the product navigation.</p>
      </Dialog>
    </AppShell>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProviders>
          <AppRoot scaffoldReference={<ScaffoldReference />} />
        </AppProviders>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
