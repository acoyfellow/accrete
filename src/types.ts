export type Placement = 'isolate' | 'built-tool' | 'container';

export type ToolKind = 'esm' | 'cli' | 'wasi' | 'container-only';

export type ToolRecord = {
  readonly name: string;
  readonly version: string;
  readonly hash: string;
  readonly kind: ToolKind;
  readonly check: ToolCheck;
  readonly registeredAt: string;
};

export type ToolCheck = {
  readonly args: readonly string[];
  readonly files: Readonly<Record<string, string>>;
  readonly stdout: string;
};

export type ToolInput = {
  readonly args: readonly string[];
  readonly files: Readonly<Record<string, string>>;
};

export type ToolOutput = {
  readonly stdout: string;
  readonly files: Readonly<Record<string, string>>;
};

export type CallLog = {
  readonly op: string;
  readonly placement: Placement;
  readonly tool?: string;
  readonly hash?: string;
  readonly ms: number;
  readonly containerSeconds: number;
  readonly ok: boolean;
  readonly error?: string;
  readonly build?: import('./tools').BuildReceipt;
};

export type Step =
  | { readonly op: 'read'; readonly path: string }
  | { readonly op: 'write'; readonly path: string; readonly content: string }
  | { readonly op: 'edit'; readonly path: string; readonly find: string; readonly replace: string }
  | { readonly op: 'tool'; readonly name: string; readonly args: readonly string[]; readonly inputs: readonly string[]; readonly stdoutTo?: string };

export type Env = {
  readonly LOADER: WorkerLoader;
  readonly TOOLS: R2Bucket;
  readonly WORKSPACE: DurableObjectNamespace<import('./workspace').Workspace>;
  readonly REGISTRY: DurableObjectNamespace<import('./registry').Registry>;
  readonly BUILDER: DurableObjectNamespace<import('./builder').Builder>;
  readonly ACCRETE_TOKEN: string;
  readonly ASSETS: Fetcher;
};
