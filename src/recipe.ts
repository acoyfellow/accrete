import type { ToolCheck } from './types';

export type Recipe = {
  readonly name: string;
  readonly packages: Readonly<Record<string, string>>;
  readonly entry: string;
  readonly native: { readonly bin: string; readonly args: readonly string[] };
  readonly check: Omit<ToolCheck, 'stdout'>;
  readonly alias?: Readonly<Record<string, string>>;
  readonly embed?: Readonly<Record<string, string | readonly string[]>>;
  readonly nativeFiles?: Readonly<Record<string, string>>;
  readonly nativeFilter?: 'raw' | 'eslint-json';
};

export type BuildResult = {
  readonly code: string;
  readonly versions: Readonly<Record<string, string>>;
  readonly nativeStdout: string;
  readonly nativeExit: number;
  readonly nativeStderr: string;
  readonly builtStdout: string;
  readonly match: boolean;
  readonly buildSeconds: number;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isObject(value) && Object.values(value).every((entry) => typeof entry === 'string');

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isEmbedMap = (value: unknown): value is Record<string, string | string[]> =>
  isObject(value) && Object.values(value).every((entry) => typeof entry === 'string' || isStringArray(entry));

export const isRecipe = (value: unknown): value is Recipe =>
  isObject(value) &&
  typeof value.name === 'string' &&
  isStringRecord(value.packages) &&
  typeof value.entry === 'string' &&
  isObject(value.native) &&
  typeof value.native.bin === 'string' &&
  isStringArray(value.native.args) &&
  isObject(value.check) &&
  isStringArray(value.check.args) &&
  isStringRecord(value.check.files) &&
  (value.alias === undefined || isStringRecord(value.alias)) &&
  (value.embed === undefined || isEmbedMap(value.embed)) &&
  (value.nativeFiles === undefined || isStringRecord(value.nativeFiles));

export const isBuildResult = (value: unknown): value is BuildResult =>
  isObject(value) &&
  typeof value.code === 'string' &&
  isStringRecord(value.versions) &&
  typeof value.nativeStdout === 'string' &&
  typeof value.nativeExit === 'number' &&
  typeof value.nativeStderr === 'string' &&
  typeof value.builtStdout === 'string' &&
  typeof value.match === 'boolean' &&
  typeof value.buildSeconds === 'number';
