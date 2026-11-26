import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));

const worker = (await import('../../src/index')).default;

const TOKEN = 'test-fixture';

const authHeader = (value: string) => ({ authorization: ['Bearer', value].join(' ') });

const fakeEnv = (token = TOKEN) =>
  ({
    ACCRETE_TOKEN: token,
    REGISTRY: {
      idFromName: () => 'global',
      get: () => ({ list: async () => [] }),
    },
    WORKSPACE: {
      idFromName: (name: string) => name,
      get: () => ({ runTask: async () => ({ ok: true, logs: [], files: {}, reads: [], queuedMs: 0 }) }),
    },
    TOOLS: { put: async () => undefined, get: async () => null },
  }) as never;

const call = (path: string, init: RequestInit = {}, token = TOKEN, host = 'accrete.customer0.dev') =>
  worker.fetch(new Request(`https://${host}${path}`, init), fakeEnv(token));

describe('HTTP API: auth and request validation', () => {
  it('rejects missing, wrong, or unconfigured bearer tokens with 401', async () => {
    expect((await call('/tools')).status).toBe(401);
    expect((await call('/tools', { headers: authHeader('wrong') })).status).toBe(401);
    expect((await call('/tools', { headers: authHeader('') }, '')).status).toBe(401);
  });

  it('accepts the matching bearer token', async () => {
    const response = await call('/tools', { headers: authHeader(TOKEN) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('returns 400 bad json for invalid JSON bodies instead of 500', async () => {
    const response = await call('/task', {
      method: 'POST',
      headers: { ...authHeader(TOKEN), 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'bad json' });
  });

  it('validates task workspace, seed values, and step fields', async () => {
    const post = (body: unknown) =>
      call('/task', {
        method: 'POST',
        headers: { ...authHeader(TOKEN), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    expect((await post({ workspace: '', seed: {}, steps: [] })).status).toBe(400);
    expect((await post({ workspace: 'w1', seed: { 'a.txt': 123 }, steps: [] })).status).toBe(400);
    expect((await post({ workspace: 'w1', seed: {}, steps: [{ op: 'tool' }] })).status).toBe(400);
    expect((await post({ workspace: 'w1', seed: {}, steps: [{ op: 'read' }] })).status).toBe(400);
    expect((await post({ workspace: 'w1', seed: { 'a.txt': 'hi' }, steps: [{ op: 'read', path: 'a.txt' }] })).status).toBe(200);
  });

  it('keeps /api/status public and blocks /api/reset off localhost', async () => {
    const status = await call('/api/status');
    expect(status.status).toBe(200);
    const reset = await call('/api/reset', { method: 'POST' });
    expect(reset.status).toBe(403);
  });
});
