import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader, SelectField, Surface } from '@appfw/pds-health-components';
import {
  EntityWorkspace,
  findEntityContract,
  type EntityWorkspaceState
} from '../../generated/appfw-entity-workspace';
import { governanceUiContract } from '../../generated/appfw-ui-contract';
import { SCHEMA } from '../../lib/entities';
import { useAsync } from '../../app/providers';

const options = governanceUiContract.entities
  .map((entity) => ({ value: entity.routeSegment, label: entity.caption.plural }))
  .sort((a, b) => a.label.localeCompare(b.label));

/**
 * Generic model-driven fallback: a read-only list for any generated entity,
 * built from the UI contract + the framework-owned `EntityWorkspace`. Bespoke
 * screens live under their own routes; this covers the long tail (audit
 * companions, workflow definitions, knowledge docs, …).
 */
export function EntityBrowserScreen() {
  const navigate = useNavigate();
  const { routeSegment } = useParams();
  const segment = routeSegment ?? options[0]?.value ?? '';
  const entity = useMemo(() => findEntityContract(SCHEMA, segment), [segment]);

  const state = useAsync(
    async (client) => {
      if (!entity) return { rows: [] as Record<string, unknown>[] };
      return client.queryList(entity, { limit: 50 });
    },
    [segment]
  );

  const workspaceState: EntityWorkspaceState =
    state.status === 'loading' || state.status === 'idle'
      ? 'loading'
      : state.status === 'error'
        ? state.error?.details.category === 'policy_denied' ||
          state.error?.details.category === 'auth'
          ? 'policy_denied'
          : 'error'
        : 'ready';

  return (
    <>
      <PageHeader
        title="All entities"
        subtitle="Generic model-driven browser over the generated UI contract"
      />
      <Surface>
        <SelectField
          label="Entity"
          aria-label="Choose entity"
          value={segment}
          onChange={(event) => navigate(`/entities/${event.target.value}`)}
          options={options}
        />
      </Surface>
      {entity ? (
        <EntityWorkspace
          entity={entity}
          rows={state.data?.rows ?? []}
          state={workspaceState}
          errorTitle={`Could not load ${entity.caption.plural.toLowerCase()}`}
          errorDetail={state.error?.message}
          onRetry={state.reload}
        />
      ) : (
        <p>Unknown entity “{segment}”.</p>
      )}
    </>
  );
}
