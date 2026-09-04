// App Framework GraphQL client for the governance schema.
//
// The generated backend mounts one async-graphql endpoint per schema at
// `/<schema>` (see backend/src/routes/governance.rs). In dev the Vite proxy
// forwards `/governance` to the running backend; set VITE_BACKEND_URL to target
// one directly. Every request carries the session bearer + `x-tenant-id`, a
// generated `x-request-id`, a matching `x-correlation-id`, and `x-timezone`
// (docs/frontend/product-frontend.md §Typed API Pattern; ADR 0009 correlation-id
// propagation). The runtime is the authority on policy regardless of what the
// SPA sends.

import type {
  AppfwUiEntityContract,
  AppfwUiOperationContract
} from '../generated/appfw-ui-contract';
import type { GovernanceAuthContext } from './authContext';
import type { GovernanceTenantContext } from './tenantContext';

// Canonical shapes from docs/frontend/product-frontend.md §Typed API Pattern.
// `AppfwErrorCategory` extends the documented 5-value set with `not_found` and
// `network` (additive; both map to explicit UI states).
export type AppfwErrorCategory =
  | 'validation'
  | 'policy_denied'
  | 'auth'
  | 'not_found'
  | 'provider'
  | 'network'
  | 'unknown';

export type AppfwRequestContext = {
  schemaName: string;
  operationName: string;
  requestId?: string;
  correlationId?: string;
};

export type AppfwResult<TData> = {
  data: TData;
  requestId: string;
  correlationId: string;
  responseMs: number;
};

export type AppfwRecord = Record<string, unknown>;

export type AppfwClientContext = {
  baseUrl?: string;
  auth?: GovernanceAuthContext;
  tenant?: GovernanceTenantContext;
  fetchImpl?: typeof fetch;
};

export type AppfwPage = {
  skip: number;
  limit: number;
  pageCount: number;
  pageIndex: number;
  queryCount: number;
  nextCursor: string | null;
  previousCursor: string | null;
};

export type AppfwListResult = {
  rows: AppfwRecord[];
  page: AppfwPage;
  selection: readonly string[];
  requestId: string;
};

export type AppfwListVariables = {
  skip?: number;
  limit?: number;
  after?: string | null;
  filter?: unknown;
  sort?: unknown;
  selection?: readonly string[];
};

export type AppfwOperationError = {
  message: string;
  category: AppfwErrorCategory;
  requestId?: string;
  correlationId?: string;
  httpStatus?: number;
  responseMs?: number;
  validation?: Record<string, string[]>;
};

export class AppfwClientError extends Error {
  readonly details: AppfwOperationError;
  constructor(details: AppfwOperationError) {
    super(details.message);
    this.name = 'AppfwClientError';
    this.details = details;
  }
}

type GraphqlPayload<T> = {
  data?: T;
  errors?: {
    message?: string;
    extensions?: { code?: string; category?: string; validation?: Record<string, string[]> };
  }[];
};

const GRAPHQL_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;

export function createAppfwClient(context: AppfwClientContext = {}) {
  const fetchImpl = context.fetchImpl ?? globalThis.fetch;
  const endpoint = context.baseUrl
    ? `${context.baseUrl.replace(/\/$/, '')}/governance`
    : '/governance';

  async function graphql<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<AppfwResult<T>> {
    const requestId = newRequestId();
    const correlationId = requestId;
    const startedAt =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: headers(context, requestId, correlationId),
        body: JSON.stringify({ query, variables })
      });
    } catch (error: unknown) {
      throw new AppfwClientError({
        message: error instanceof Error ? error.message : 'Network request failed',
        category: 'network',
        requestId,
        correlationId,
        responseMs: elapsed(startedAt)
      });
    }
    const responseMs = elapsed(startedAt);
    const responseRequestId = response.headers.get('x-request-id') ?? requestId;
    const responseCorrelationId =
      response.headers.get('x-correlation-id') ?? correlationId;
    const payload = (await response.json().catch(() => ({}))) as GraphqlPayload<T>;

    if (!response.ok || payload.errors?.length) {
      throw new AppfwClientError({
        message: messageOf(payload, response.statusText),
        category: categoryOf(response.status, payload),
        requestId: responseRequestId,
        correlationId: responseCorrelationId,
        httpStatus: response.status,
        responseMs,
        validation: payload.errors?.find((e) => e.extensions?.validation)?.extensions?.validation
      });
    }
    return {
      data: (payload.data ?? {}) as T,
      requestId: responseRequestId,
      correlationId: responseCorrelationId,
      responseMs
    };
  }

  async function queryList(
    entity: AppfwUiEntityContract,
    variables: AppfwListVariables = {}
  ): Promise<AppfwListResult> {
    const operation = requireOperation(
      entity,
      (op) => op.kind === 'query' && op.returnsShape === 'connection',
      'query connection'
    );
    const selection = selectionFor(entity, operation, 'list', variables.selection);
    const limit = variables.limit ?? 25;
    const query = `query ${operation.graphqlName}($filter: JSON, $sort: JSON, $skip: Int, $limit: Int, $after: String) {
  ${operation.graphqlName}(filter: $filter, sort: $sort, skip: $skip, limit: $limit, after: $after) {
    skip
    limit
    page_count
    page_index
    query_count
    next_cursor
    previous_cursor
    items {
      ${selection.join('\n      ')}
    }
  }
}`;
    const { data, requestId } = await graphql<Record<string, ConnectionShape | undefined>>(query, {
      filter: variables.filter ?? undefined,
      sort: variables.sort ?? undefined,
      skip: variables.skip,
      limit,
      after: variables.after ?? undefined
    });
    const connection = data[operation.graphqlName] ?? {};
    return {
      rows: Array.isArray(connection.items) ? (connection.items as AppfwRecord[]) : [],
      selection,
      requestId,
      page: {
        skip: numberOr(connection.skip, variables.skip ?? 0),
        limit: numberOr(connection.limit, limit),
        pageCount: numberOr(connection.page_count, 0),
        pageIndex: numberOr(connection.page_index, 0),
        queryCount: numberOr(connection.query_count, 0),
        nextCursor: stringOrNull(connection.next_cursor),
        previousCursor: stringOrNull(connection.previous_cursor)
      }
    };
  }

  async function findRecord(
    entity: AppfwUiEntityContract,
    id: string,
    selectionOverride?: readonly string[]
  ): Promise<AppfwRecord | null> {
    const operation = requireOperation(
      entity,
      (op) => op.kind === 'query' && op.returnsShape === 'record' && op.name.startsWith('find_'),
      'find record'
    );
    const selection = selectionFor(entity, operation, 'detail', selectionOverride);
    const query = `query ${operation.graphqlName}($id: String!) {
  ${operation.graphqlName}(id: $id) {
    ${selection.join('\n    ')}
  }
}`;
    const { data } = await graphql<Record<string, AppfwRecord | null>>(query, { id });
    return data[operation.graphqlName] ?? null;
  }

  async function saveRecord(
    entity: AppfwUiEntityContract,
    mode: 'create' | 'update',
    input: AppfwRecord,
    selectionOverride?: readonly string[]
  ): Promise<AppfwRecord | null> {
    const operation = requireOperation(
      entity,
      (op) =>
        op.kind === 'mutation' &&
        op.returnsShape === 'record' &&
        op.name.startsWith(`${mode}_`),
      `${mode} record`
    );
    const selection = selectionFor(entity, operation, 'detail', selectionOverride);
    const query = `mutation ${operation.graphqlName}($input: Input${entity.typeName}!) {
  ${operation.graphqlName}(input: $input) {
    ${selection.join('\n    ')}
  }
}`;
    const { data } = await graphql<Record<string, AppfwRecord | null>>(query, { input });
    return data[operation.graphqlName] ?? null;
  }

  /**
   * Invoke a generated custom-method mutation that returns the JSON scalar
   * (cancel / submitDecision / decide / saveStage / start / submit / skip /
   * processTranscript). `args` maps GraphQL arg name -> value; string values are
   * declared `String!`, everything else `JSON`.
   */
  async function invoke<T = unknown>(
    field: string,
    args: Record<string, unknown>
  ): Promise<T> {
    const names = Object.keys(args).filter((name) => GRAPHQL_NAME.test(name));
    const decls = names
      .map((name) => `$${name}: ${typeof args[name] === 'string' ? 'String!' : 'JSON'}`)
      .join(', ');
    const pass = names.map((name) => `${name}: $${name}`).join(', ');
    const query = `mutation ${field}(${decls}) {\n  ${field}(${pass})\n}`;
    const { data } = await graphql<Record<string, T>>(
      query,
      Object.fromEntries(names.map((name) => [name, args[name]]))
    );
    return data[field];
  }

  return { graphql, queryList, findRecord, saveRecord, invoke, endpoint };
}

export type AppfwClient = ReturnType<typeof createAppfwClient>;

type ConnectionShape = {
  skip?: unknown;
  limit?: unknown;
  page_count?: unknown;
  page_index?: unknown;
  query_count?: unknown;
  next_cursor?: unknown;
  previous_cursor?: unknown;
  items?: unknown;
};

function headers(
  context: AppfwClientContext,
  requestId: string,
  correlationId: string
): Record<string, string> {
  const result: Record<string, string> = {
    'content-type': 'application/json',
    'x-request-id': requestId,
    'x-correlation-id': correlationId,
    'x-timezone': browserTimezone()
  };
  const authorization = context.auth?.authorization;
  const tenantId = context.tenant?.tenantId;
  if (authorization) {
    result.authorization = authorization.startsWith('Bearer ')
      ? authorization
      : `Bearer ${authorization}`;
  }
  if (tenantId) result['x-tenant-id'] = tenantId;
  return result;
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function elapsed(startedAt: number): number {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return Math.round(now - startedAt);
}

function newRequestId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `governance-ui-${random}`;
}

function messageOf<T>(payload: GraphqlPayload<T>, fallback: string): string {
  const messages = payload.errors?.map((e) => e.message).filter(Boolean) ?? [];
  return messages.length ? messages.join('; ') : fallback || 'App Framework request failed';
}

function categoryOf<T>(httpStatus: number, payload: GraphqlPayload<T>): AppfwErrorCategory {
  const raw = String(
    payload.errors?.find((e) => e.extensions?.category || e.extensions?.code)?.extensions?.category ??
      payload.errors?.find((e) => e.extensions?.code)?.extensions?.code ??
      ''
  ).toLowerCase();
  if (httpStatus === 401 || raw.includes('unauth')) return 'auth';
  if (httpStatus === 403 || raw.includes('forbidden') || raw.includes('denied') || raw.includes('policy'))
    return 'policy_denied';
  if (httpStatus === 404 || raw.includes('not_found') || raw.includes('notfound')) return 'not_found';
  if (raw.includes('validation') || raw.includes('invalid')) return 'validation';
  if (raw.includes('provider') || httpStatus >= 500) return 'provider';
  return 'unknown';
}

function requireOperation(
  entity: AppfwUiEntityContract,
  predicate: (op: AppfwUiOperationContract) => boolean,
  label: string
): AppfwUiOperationContract {
  const operation = entity.operations.find(predicate);
  if (!operation) {
    throw new AppfwClientError({
      message: `No generated ${label} operation exists for ${entity.schemaName}.${entity.typeName}.`,
      category: 'unknown'
    });
  }
  if (operation.disabledReason) {
    throw new AppfwClientError({ message: operation.disabledReason, category: 'policy_denied' });
  }
  return operation;
}

function selectionFor(
  entity: AppfwUiEntityContract,
  operation: AppfwUiOperationContract,
  surface: 'list' | 'detail',
  override?: readonly string[]
): string[] {
  const candidate =
    override?.length
      ? override
      : operation.selectionPreset.length
        ? operation.selectionPreset
        : surface === 'list'
          ? entity.scaffold.list.fields
          : entity.scaffold.detail.fields;
  const scalarFields = new Set(
    entity.fields.filter((field) => field.kind !== 'relationship').map((field) => field.name)
  );
  const picked = candidate.filter((name) => scalarFields.has(name) && GRAPHQL_NAME.test(name));
  const unique = Array.from(new Set(picked));
  if (unique.length) return unique;
  return [entity.primaryKey, entity.captionField].filter(
    (name) => name && GRAPHQL_NAME.test(name)
  );
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
