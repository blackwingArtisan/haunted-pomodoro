/**
 * Exporting the house to a JSON file and importing one back. Pure: the caller passes the model, the
 * file text and the time. An import goes through the same defensive parser and merge as sync, so it
 * can only move progress forward: the house with the higher `houseScore` wins and no day count goes
 * down, so a lit candle or a restored room is never removed.
 */
import { dayKey } from './dates';
import { houseScore } from './house';
import type { AppModel } from './model';
import { mergeModels, parseModel, serializeModel } from './snapshot';

export const HOUSE_FILE_FORMAT = 'haunted-pomodoro-house';
export const HOUSE_FILE_VERSION = 1;
/** Files larger than this (1 MiB) are refused without being parsed. */
export const MAX_IMPORT_BYTES = 1_048_576;

export interface HouseFile {
  fileName: string;
  /** The JSON text to save. */
  text: string;
}

/** The export: a small envelope with a format version around the existing snapshot. */
export function exportHouse(model: AppModel, now: number): HouseFile {
  const envelope = {
    format: HOUSE_FILE_FORMAT,
    formatVersion: HOUSE_FILE_VERSION,
    exportedAt: now,
    snapshot: JSON.parse(serializeModel(model)) as unknown,
  };
  return { fileName: `haunted-house-${dayKey(now)}.json`, text: JSON.stringify(envelope, null, 2) };
}

export type ImportRefusalReason = 'too-large' | 'not-json' | 'foreign' | 'wrong-version' | 'damaged';

export type ImportDecision =
  | { ok: true; model: AppModel; movedForward: boolean; message: string }
  | { ok: false; reason: ImportRefusalReason; message: string };

const REFUSALS: Record<ImportRefusalReason, string> = {
  'too-large': 'That file is larger than 1 MB, so it was not opened. Your house is unchanged.',
  'not-json': 'That file is not valid JSON, so it was not imported. Your house is unchanged.',
  foreign: 'That file is not a Haunted Pomodoro house, so it was not imported. Your house is unchanged.',
  'wrong-version': 'That house file was made by a different version of the app, so it was not imported. Your house is unchanged.',
  damaged: 'That house file is damaged, so it was not imported. Your house is unchanged.',
};

function refuse(reason: ImportRefusalReason): ImportDecision {
  return { ok: false, reason, message: REFUSALS[reason] };
}

/** Lets the caller refuse a big file from its size alone, before reading it. */
export function importSizeProblem(bytes: number): ImportDecision | null {
  return bytes > MAX_IMPORT_BYTES ? refuse('too-large') : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Decides what an import does. It never throws and never returns a model with less progress than `current`. */
export function decideImport(text: string, current: AppModel, now: number): ImportDecision {
  const tooLarge = importSizeProblem(utf8Length(text));
  if (tooLarge) return tooLarge;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return refuse('not-json');
  }
  if (!isObject(raw) || raw.format !== HOUSE_FILE_FORMAT) return refuse('foreign');
  if (raw.formatVersion !== HOUSE_FILE_VERSION) return refuse('wrong-version');
  const snapshot = raw.snapshot;
  if (!isObject(snapshot) || snapshot.version !== 1 || !isObject(snapshot.house) || !isObject(snapshot.days) || !Array.isArray(snapshot.tasks)) {
    return refuse('damaged');
  }
  const imported = parseModel(snapshot, now);
  const merged = mergeModels(current, imported);
  const movedForward = houseScore(merged.house) > houseScore(current.house);
  const model: AppModel = { ...merged, updatedAt: Math.max(merged.updatedAt, now) };
  const message = movedForward
    ? 'House imported. Your candles and rooms moved forward.'
    : 'House imported. Your house was already as far along or further, so no candle or room was removed.';
  return { ok: true, model, movedForward, message };
}
