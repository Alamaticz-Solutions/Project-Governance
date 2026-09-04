import {
  governanceUiContract,
  type AppfwUiEntityContract
} from '../generated/appfw-ui-contract';

export const SCHEMA = governanceUiContract.schemaName;

export function entityByType(typeName: string): AppfwUiEntityContract {
  const entity = governanceUiContract.entities.find((e) => e.typeName === typeName);
  if (!entity) {
    throw new Error(`Entity "${typeName}" is not in the generated governance contract`);
  }
  return entity;
}

export function entityByRoute(routeSegment: string): AppfwUiEntityContract | undefined {
  return governanceUiContract.entities.find((e) => e.routeSegment === routeSegment);
}

export const CONTRACT_VERSION = governanceUiContract.version;
export const CONTRACT_ENTITY_COUNT = governanceUiContract.entities.length;
