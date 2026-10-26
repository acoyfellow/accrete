import { DurableObject } from 'cloudflare:workers';
import { runTool } from './tools';
import type { CallLog, Env, Step } from './types';

export type TaskResult = {
  readonly ok: boolean;
  readonly logs: readonly CallLog[];
  readonly files: Readonly<Record<string, string>>;
  readonly reads: readonly string[];
};

const failure = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

export class Workspace extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, content TEXT NOT NULL)');
  }

  readFile(path: string): string {
    const row = this.ctx.storage.sql.exec<{ content: string }>('SELECT content FROM files WHERE path = ?', path).toArray()[0];
    if (row === undefined) throw new Error(`no such file: ${path}`);
    return row.content;
  }

  writeFile(path: string, content: string): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO files (path, content) VALUES (?, ?)', path, content);
  }

  listFiles(): Record<string, string> {
    const rows = this.ctx.storage.sql.exec<{ path: string; content: string }>('SELECT path, content FROM files ORDER BY path').toArray();
    return Object.fromEntries(rows.map((row) => [row.path, row.content]));
  }

  async runTask(seed: Readonly<Record<string, string>>, steps: readonly Step[]): Promise<TaskResult> {
    this.ctx.storage.sql.exec('DELETE FROM files');
    for (const [path, content] of Object.entries(seed)) this.writeFile(path, content);
    const logs: CallLog[] = [];
    const reads: string[] = [];
    for (const step of steps) {
      const started = Date.now();
      try {
        const log = await this.runStep(step, reads);
        logs.push({ ...log, ms: Date.now() - started, ok: true });
      } catch (cause) {
        logs.push({ op: step.op, placement: 'isolate', ms: Date.now() - started, containerSeconds: 0, ok: false, error: failure(cause) });
        return { ok: false, logs, files: this.listFiles(), reads };
      }
    }
    return { ok: true, logs, files: this.listFiles(), reads };
  }

  private async runStep(step: Step, reads: string[]): Promise<Omit<CallLog, 'ms' | 'ok'>> {
    switch (step.op) {
      case 'read':
        reads.push(this.readFile(step.path));
        return { op: 'read', placement: 'isolate', containerSeconds: 0 };
      case 'write':
        this.writeFile(step.path, step.content);
        return { op: 'write', placement: 'isolate', containerSeconds: 0 };
      case 'edit': {
        const current = this.readFile(step.path);
        if (!current.includes(step.find)) throw new Error(`edit target not found in ${step.path}`);
        this.writeFile(step.path, current.replace(step.find, step.replace));
        return { op: 'edit', placement: 'isolate', containerSeconds: 0 };
      }
      case 'tool': {
        const files = Object.fromEntries(step.inputs.map((path) => [path, this.readFile(path)]));
        const { output, record } = await runTool(this.env, step.name, { args: step.args, files });
        for (const [path, content] of Object.entries(output.files)) this.writeFile(path, content);
        if (step.stdoutTo !== undefined) this.writeFile(step.stdoutTo, output.stdout);
        return { op: 'tool', placement: 'built-tool', tool: `${record.name}@${record.version}`, hash: record.hash, containerSeconds: 0 };
      }
    }
  }
}
