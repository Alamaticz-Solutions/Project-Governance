import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  FormLayout,
  InlineAlert,
  PageHeader,
  SelectField,
  Surface,
  SwitchField,
  TextArea,
  TextField,
  ValidationSummary
} from '@appfw/pds-health-components';
import { useAction, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { PROJECT_PRIORITY, PROJECT_RISK } from '../shared/enums';

const projectEntity = entityByType('Project');
const userEntity = entityByType('User');

function newProjectNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GOV-${stamp}-${suffix}`;
}

type Draft = {
  project_number: string;
  project_name: string;
  business_unit: string;
  manager_id: string;
  department: string;
  sponsor_name: string;
  sponsor_email: string;
  requestor_name: string;
  request_type: string;
  problem_statement: string;
  business_value: string;
  desired_outcome: string;
  priority: string;
  risk_level: string;
  budget_estimated: string;
  has_phi_data: boolean;
  is_clinical: boolean;
  vendor_required: boolean;
};

function emptyDraft(): Draft {
  return {
    project_number: newProjectNumber(),
    project_name: '',
    business_unit: '',
    manager_id: '',
    department: '',
    sponsor_name: '',
    sponsor_email: '',
    requestor_name: '',
    request_type: '',
    problem_statement: '',
    business_value: '',
    desired_outcome: '',
    priority: 'Medium',
    risk_level: 'Medium',
    budget_estimated: '',
    has_phi_data: false,
    is_clinical: false,
    vendor_required: false
  };
}

export function IntakeScreen() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const create = useAction((client, input: AppfwRecord) =>
    client.saveRecord(projectEntity, 'create', input)
  );

  // Project.manager_id is a required FK; offer the seeded users as candidates.
  const managers = useAsync(
    (client) =>
      client.queryList(userEntity, {
        limit: 100,
        sort: [{ full_name: 'asc' }],
        selection: ['id', 'full_name', 'email', 'role']
      }),
    []
  );
  useEffect(() => {
    if (managers.status === 'ready' && !draft.manager_id) {
      const first = managers.data?.rows[0];
      if (first && typeof first.id === 'string') set('manager_id', first.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managers.status]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const errors: string[] = [];
    if (!draft.project_number.trim()) errors.push('Project number is required.');
    if (!draft.project_name.trim()) errors.push('Project name is required.');
    if (!draft.business_unit.trim()) errors.push('Business unit is required.');
    if (!draft.manager_id) errors.push('A manager is required.');
    if (!draft.problem_statement.trim()) errors.push('Problem statement is required.');
    if (!draft.priority) errors.push('Priority is required.');
    setClientErrors(errors);
    if (errors.length) return;

    const input: AppfwRecord = {
      project_number: draft.project_number.trim(),
      project_name: draft.project_name.trim(),
      business_unit: draft.business_unit.trim(),
      manager_id: draft.manager_id,
      department: draft.department.trim() || null,
      sponsor_name: draft.sponsor_name.trim() || null,
      sponsor_email: draft.sponsor_email.trim() || null,
      requestor_name: draft.requestor_name.trim() || null,
      request_type: draft.request_type.trim() || null,
      problem_statement: draft.problem_statement.trim(),
      business_value: draft.business_value.trim() || null,
      desired_outcome: draft.desired_outcome.trim() || null,
      priority: draft.priority,
      risk_level: draft.risk_level || null,
      budget_estimated: draft.budget_estimated ? Number(draft.budget_estimated) : null,
      has_phi_data: draft.has_phi_data,
      is_clinical: draft.is_clinical,
      vendor_required: draft.vendor_required,
      status: 'Draft',
      created_at: new Date().toISOString()
    };
    const created = await create.run(input);
    if (created && typeof created.id === 'string') {
      navigate(`/projects/${created.id}`);
    }
  };

  const managerOptions = (managers.data?.rows ?? []).map((row) => ({
    value: String(row.id),
    label: `${String(row.full_name ?? row.email ?? row.id)} (${String(row.role ?? '')})`
  }));

  return (
    <>
      <PageHeader
        title="New intake"
        subtitle="Capture a governance request. It starts in Draft; the workflow engine advances it through the gate DAG."
      />
      <Surface>
        {clientErrors.length > 0 && (
          <ValidationSummary
            title="Fix these before submitting"
            items={clientErrors.map((message, index) => ({
              id: `err-${index}`,
              messages: [message]
            }))}
          />
        )}
        {create.error && (
          <InlineAlert
            tone={create.error.details.category === 'policy_denied' ? 'warning' : 'danger'}
            title={
              create.error.details.category === 'policy_denied'
                ? 'You do not have permission to create a project'
                : 'Create failed'
            }
            detail={create.error.message}
          />
        )}
        <FormLayout
          columns="two"
          footer={
            <>
              <Button variant="quiet" onClick={() => setDraft(emptyDraft())}>
                Reset
              </Button>
              <Button variant="primary" isLoading={create.pending} onClick={submit}>
                Create project
              </Button>
            </>
          }
        >
          <TextField
            label="Project number"
            required
            value={draft.project_number}
            onChange={(event) => set('project_number', event.target.value)}
            hint="Pre-filled; edit if your org has a numbering convention."
          />
          <TextField
            label="Project name"
            required
            value={draft.project_name}
            onChange={(event) => set('project_name', event.target.value)}
          />
          <TextField
            label="Request type"
            value={draft.request_type}
            onChange={(event) => set('request_type', event.target.value)}
          />
          <TextField
            label="Business unit"
            required
            value={draft.business_unit}
            onChange={(event) => set('business_unit', event.target.value)}
          />
          <TextField
            label="Department"
            value={draft.department}
            onChange={(event) => set('department', event.target.value)}
          />
          <SelectField
            label="Manager"
            required
            value={draft.manager_id}
            onChange={(event) => set('manager_id', event.target.value)}
            options={managerOptions}
            placeholder={managers.status === 'loading' ? 'Loading users…' : 'Select a manager'}
          />
          <TextField
            label="Sponsor name"
            value={draft.sponsor_name}
            onChange={(event) => set('sponsor_name', event.target.value)}
          />
          <TextField
            label="Sponsor email"
            type="email"
            value={draft.sponsor_email}
            onChange={(event) => set('sponsor_email', event.target.value)}
          />
          <TextField
            label="Requestor name"
            value={draft.requestor_name}
            onChange={(event) => set('requestor_name', event.target.value)}
          />
          <TextField
            label="Estimated budget (USD)"
            type="number"
            value={draft.budget_estimated}
            onChange={(event) => set('budget_estimated', event.target.value)}
          />
          <SelectField
            label="Priority"
            required
            value={draft.priority}
            onChange={(event) => set('priority', event.target.value)}
            options={PROJECT_PRIORITY}
          />
          <SelectField
            label="Risk level"
            value={draft.risk_level}
            onChange={(event) => set('risk_level', event.target.value)}
            options={PROJECT_RISK}
          />
          <TextArea
            label="Problem statement"
            required
            rows={3}
            value={draft.problem_statement}
            onChange={(event) => set('problem_statement', event.target.value)}
          />
          <TextArea
            label="Business value"
            rows={3}
            value={draft.business_value}
            onChange={(event) => set('business_value', event.target.value)}
          />
          <TextArea
            label="Desired outcome"
            rows={3}
            value={draft.desired_outcome}
            onChange={(event) => set('desired_outcome', event.target.value)}
          />
          <SwitchField
            id="intake-phi"
            label="Contains PHI data"
            checked={draft.has_phi_data}
            onCheckedChange={(checked) => set('has_phi_data', checked)}
          />
          <SwitchField
            id="intake-clinical"
            label="Clinical initiative"
            checked={draft.is_clinical}
            onCheckedChange={(checked) => set('is_clinical', checked)}
          />
          <SwitchField
            id="intake-vendor"
            label="Vendor required"
            checked={draft.vendor_required}
            onCheckedChange={(checked) => set('vendor_required', checked)}
          />
        </FormLayout>
      </Surface>
    </>
  );
}
