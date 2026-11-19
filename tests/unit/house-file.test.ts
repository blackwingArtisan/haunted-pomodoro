import { describe, expect, it } from 'vitest';
import {
  HOUSE_FILE_FORMAT,
  HOUSE_FILE_VERSION,
  MAX_IMPORT_BYTES,
  decideImport,
  exportHouse,
  importSizeProblem,
} from '../../src/core/house-file';
import { houseScore } from '../../src/core/house';
import { createModel, reduceApp, type AppModel } from '../../src/core/model';
import { parseModel, serializeModel } from '../../src/core/snapshot';

const NOW = new Date(2026, 10, 18, 9, 30).getTime();

function modelWith(house: AppModel['house'], updatedAt = 1_000): AppModel {
  let m = createModel(updatedAt);
  m = reduceApp(m, { type: 'addTask', id: 't1', title: 'Catalogue the lanterns', estimate: 2 }, updatedAt).model;
  return { ...m, house, updatedAt, days: { '2026-11-10': { sessions: 2, focusMs: 3_000_000, distractions: 1 } } };
}

const refusal = (text: string, current: AppModel) => {
  const d = decideImport(text, current, NOW);
  if (d.ok) throw new Error('expected a refusal');
  return d;
};

describe('export', () => {
  // Req 11.1, 11.2
  it('wraps the existing snapshot in a versioned envelope with a dated file name', () => {
    const model = modelWith({ candlesLit: 2, roomsRestored: 3 });
    const file = exportHouse(model, NOW);
    expect(file.fileName).toBe('haunted-house-2026-11-18.json');
    const parsed = JSON.parse(file.text);
    expect(parsed.format).toBe(HOUSE_FILE_FORMAT);
    expect(parsed.formatVersion).toBe(HOUSE_FILE_VERSION);
    expect(parsed.exportedAt).toBe(NOW);
    expect(parsed.snapshot).toEqual(JSON.parse(serializeModel(model)));
  });

  // Req 11.3
  it('round-trips through the importer into an equal house', () => {
    const model = modelWith({ candlesLit: 1, roomsRestored: 2 });
    const d = decideImport(exportHouse(model, NOW).text, createModel(500), NOW);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.model.house).toEqual(model.house);
      expect(d.model.days).toEqual(model.days);
      expect(d.movedForward).toBe(true);
    }
  });
});

describe('import decision', () => {
  // Req 11.3, 11.4, 11.12
  it('merges a house that is further along and moves progress forward', () => {
    const current = modelWith({ candlesLit: 1, roomsRestored: 1 });
    const file = exportHouse(modelWith({ candlesLit: 3, roomsRestored: 4 }, 2_000), NOW).text;
    const d = decideImport(file, current, NOW);
    expect(d.ok && d.movedForward).toBe(true);
    if (d.ok) {
      expect(d.model.house).toEqual({ candlesLit: 3, roomsRestored: 4 });
      expect(d.model.timer).toBe(current.timer);
      expect(d.model.updatedAt).toBeGreaterThanOrEqual(NOW);
    }
  });

  // Req 11.4, 11.12
  it('never lowers progress when the file holds an older, smaller house', () => {
    const current = modelWith({ candlesLit: 2, roomsRestored: 5 }, 9_000);
    const older = modelWith({ candlesLit: 3, roomsRestored: 1 }, 100);
    const d = decideImport(exportHouse(older, NOW).text, current, NOW);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.movedForward).toBe(false);
      expect(d.model.house).toEqual(current.house);
      expect(houseScore(d.model.house)).toBeGreaterThanOrEqual(houseScore(current.house));
      expect(d.model.days['2026-11-10']?.sessions).toBe(2);
    }
  });

  // Req 11.4
  it('keeps the higher house even when the smaller file is newer', () => {
    const current = modelWith({ candlesLit: 0, roomsRestored: 6 }, 1_000);
    const newerButSmaller = modelWith({ candlesLit: 1, roomsRestored: 0 }, 50_000);
    const d = decideImport(exportHouse(newerButSmaller, NOW).text, current, NOW);
    expect(d.ok && d.model.house).toEqual(current.house);
  });

  // Req 11.5
  it('keeps the larger day counts from either copy', () => {
    const current = modelWith({ candlesLit: 0, roomsRestored: 0 });
    const other = { ...modelWith({ candlesLit: 0, roomsRestored: 0 }), days: { '2026-11-10': { sessions: 5, focusMs: 1, distractions: 0 }, '2026-11-11': { sessions: 1, focusMs: 1, distractions: 0 } } };
    const d = decideImport(exportHouse(other, NOW).text, current, NOW);
    expect(d.ok && d.model.days['2026-11-10']?.sessions).toBe(5);
    expect(d.ok && d.model.days['2026-11-11']?.sessions).toBe(1);
  });

  // Req 11.8
  it('refuses damaged JSON and changes nothing', () => {
    const d = refusal('{"format": "haunted-pomodoro-house", ', createModel(1));
    expect(d.reason).toBe('not-json');
    expect(d.message).toMatch(/unchanged/);
  });

  // Req 11.9
  it('refuses a file that is not a house file', () => {
    const current = createModel(1);
    expect(refusal('[1, 2, 3]', current).reason).toBe('foreign');
    expect(refusal('{"hello": "world"}', current).reason).toBe('foreign');
    expect(refusal('"a string"', current).reason).toBe('foreign');
    // A bare snapshot, as stored in localStorage, is not an export file either.
    expect(refusal(serializeModel(modelWith({ candlesLit: 3, roomsRestored: 9 })), current).reason).toBe('foreign');
  });

  // Req 11.10
  it('refuses a different format version', () => {
    const envelope = JSON.parse(exportHouse(modelWith({ candlesLit: 0, roomsRestored: 2 }), NOW).text);
    expect(refusal(JSON.stringify({ ...envelope, formatVersion: 2 }), createModel(1)).reason).toBe('wrong-version');
    expect(refusal(JSON.stringify({ ...envelope, formatVersion: undefined }), createModel(1)).reason).toBe('wrong-version');
  });

  // Req 11.11
  it('refuses an envelope whose snapshot is missing or hollow', () => {
    const base = { format: HOUSE_FILE_FORMAT, formatVersion: HOUSE_FILE_VERSION, exportedAt: NOW };
    const current = createModel(1);
    expect(refusal(JSON.stringify(base), current).reason).toBe('damaged');
    expect(refusal(JSON.stringify({ ...base, snapshot: { version: 1 } }), current).reason).toBe('damaged');
    expect(refusal(JSON.stringify({ ...base, snapshot: { version: 7, house: {}, days: {}, tasks: [] } }), current).reason).toBe('damaged');
  });

  // Req 11.7
  it('refuses a file over 1 MB without parsing it, and accepts one just under', () => {
    const current = createModel(1);
    const big = ' '.repeat(MAX_IMPORT_BYTES + 1);
    expect(refusal(big, current).reason).toBe('too-large');
    expect(importSizeProblem(MAX_IMPORT_BYTES + 1)?.ok).toBe(false);
    expect(importSizeProblem(MAX_IMPORT_BYTES)).toBeNull();
    // Multi-byte characters count as bytes, not characters.
    expect(refusal('é'.repeat(MAX_IMPORT_BYTES / 2 + 1), current).reason).toBe('too-large');
    const padded = exportHouse(modelWith({ candlesLit: 1, roomsRestored: 0 }), NOW).text + ' '.repeat(1_000);
    expect(decideImport(padded, current, NOW).ok).toBe(true);
  });

  // Req 11.3
  it('sanitizes hostile field values through the defensive parser', () => {
    const envelope = JSON.parse(exportHouse(modelWith({ candlesLit: 0, roomsRestored: 1 }), NOW).text);
    envelope.snapshot.house = { candlesLit: 99, roomsRestored: -4 };
    envelope.snapshot.tasks = [{ id: 1 }, { id: 'ok', title: 'Kept' }];
    const d = decideImport(JSON.stringify(envelope), createModel(1), NOW);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.model.house.candlesLit).toBeLessThanOrEqual(3);
      expect(d.model.house.roomsRestored).toBeGreaterThanOrEqual(0);
      expect(parseModel(JSON.parse(serializeModel(d.model)), NOW).house).toEqual(d.model.house);
    }
  });
});
