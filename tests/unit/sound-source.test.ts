import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('sound sources', () => {
  // Req 6.1
  it('ships no audio files: every sound is synthesized with the Web Audio API', () => {
    const audio = ['public', 'src'].flatMap((dir) => filesUnder(join(root, dir))).filter((f) => /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i.test(f));
    expect(audio.map((f) => relative(root, f))).toEqual([]);
    const engine = readFileSync(join(root, 'src/audio/sound.ts'), 'utf8');
    expect(engine).toMatch(/createOscillator|createBufferSource/);
    expect(engine).not.toMatch(/fetch\(|new Audio\(|decodeAudioData/);
  });
});
