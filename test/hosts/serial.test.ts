import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));

vi.mock('../../src/tools', () => ({
  runTool: async (_env: unknown, _name: string, input: { files: Record<string, string> }) => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { output: { stdout: Object.keys(input.files).join(','), files: {} }, record: { name: 'slow', version: '1', hash: 'h' }, placement: 'built-tool', containerSeconds: 0 };
  },
}));

const { Workspace } = await import('../../src/workspace');
const { Builder } = await import('../../src/builder');

const memorySql = () => {
  const files = new Map<string, string>();
  const rows = (list: unknown[]) => ({ toArray: () => list, rowsWritten: 0 });
  return {
    exec: (query: string, ...args: string[]) => {
      if (query.startsWith('DELETE')) files.clear();
      if (query.startsWith('INSERT')) files.set(args[0], args[1]);
      if (query.includes('WHERE path')) return rows(files.has(args[0]) ? [{ content: files.get(args[0]) }] : []);
      if (query.startsWith('SELECT')) return rows([...files].sort().map(([path, content]) => ({ path, content })));
      return rows([]);
    },
  };
};

const taskFor = (who: string) =>
  [
    { [`${who}.txt`]: who },
    [
      { op: 'tool' as const, name: 'slow', args: [], inputs: [`${who}.txt`], stdoutTo: 'out.txt' },
      { op: 'read' as const, path: `${who}.txt` },
    ],
  ] as const;

describe('Workspace: one task at a time', () => {
  it('two tasks on one workspace both finish with their own files', async () => {
    const workspace = new Workspace({ storage: { sql: memorySql() } } as never, {} as never);
    const [alice, bob] = await Promise.all([workspace.runTask(...taskFor('alice')), workspace.runTask(...taskFor('bob'))]);
    expect(alice.ok).toBe(true);
    expect(bob.ok).toBe(true);
    expect(Object.keys(alice.files)).toEqual(['alice.txt', 'out.txt']);
    expect(Object.keys(bob.files)).toEqual(['bob.txt', 'out.txt']);
    expect(bob.queuedMs).toBeGreaterThan(0);
  });

  it('a failed task does not block the next one', async () => {
    const workspace = new Workspace({ storage: { sql: memorySql() } } as never, {} as never);
    const failing = workspace.runTask({}, [{ op: 'read', path: 'missing.txt' }]);
    const next = workspace.runTask(...taskFor('carol'));
    expect((await failing).ok).toBe(false);
    expect((await next).ok).toBe(true);
  });
});

describe('Builder: shutdown waits for builds in flight', () => {
  it('a short build finishing does not kill a longer one', async () => {
    let active = 0;
    let killedMidBuild = 0;
    const container = {
      running: false,
      images: {},
      start() {
        this.running = true;
      },
      async destroy() {
        if (active > 0) killedMidBuild += 1;
        this.running = false;
      },
      async setInactivityTimeout() {},
      getTcpPort: () => ({
        fetch: async (request: Request) => {
          active += 1;
          await new Promise((resolve) => setTimeout(resolve, Number(new URL(request.url).searchParams.get('ms'))));
          active -= 1;
          return new Response('{"ok":true}');
        },
      }),
    };
    const builder = new Builder({ container } as never, {} as never);
    const build = (ms: number) => builder.fetch(new Request(`http://builder/build?ms=${ms}`)).then((response) => response.text()).finally(() => builder.shutdown());
    await Promise.all([build(10), build(80)]);
    expect(killedMidBuild).toBe(0);
    expect(container.running).toBe(false);
  });
});
