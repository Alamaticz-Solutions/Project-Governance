import { describe, expect, it } from 'vitest';
import { AppfwClientError, createAppfwClient } from './appfwClient';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }
  });
}

describe('createAppfwClient error categorization', () => {
  it('sends x-request-id, x-correlation-id and x-timezone', async () => {
    let seen: Headers | undefined;
    const client = createAppfwClient({
      fetchImpl: async (_url, init) => {
        seen = new Headers(init?.headers);
        return jsonResponse({ data: { ok: true } });
      }
    });
    await client.invoke('ping', { id: 'x' });
    expect(seen?.get('x-request-id')).toBeTruthy();
    expect(seen?.get('x-correlation-id')).toBe(seen?.get('x-request-id'));
    expect(seen?.get('x-timezone')).toBeTruthy();
  });

  it('classifies HTTP 403 as policy_denied', async () => {
    const client = createAppfwClient({
      fetchImpl: async () => jsonResponse({ errors: [{ message: 'forbidden' }] }, { status: 403 })
    });
    await expect(client.invoke('cancel', { projectId: 'p', reason: 'r' })).rejects.toSatisfy(
      (err: unknown) => err instanceof AppfwClientError && err.details.category === 'policy_denied'
    );
  });

  it('classifies a validation extension as validation', async () => {
    const client = createAppfwClient({
      fetchImpl: async () =>
        jsonResponse({
          errors: [{ message: 'bad', extensions: { category: 'validation', validation: { name: ['required'] } } }]
        })
    });
    await expect(client.invoke('createThing', { id: 'x' })).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof AppfwClientError &&
        err.details.category === 'validation' &&
        err.details.validation?.name?.[0] === 'required'
    );
  });

  it('classifies a thrown fetch as network', async () => {
    const client = createAppfwClient({
      fetchImpl: async () => {
        throw new Error('offline');
      }
    });
    await expect(client.invoke('ping', { id: 'x' })).rejects.toSatisfy(
      (err: unknown) => err instanceof AppfwClientError && err.details.category === 'network'
    );
  });
});
