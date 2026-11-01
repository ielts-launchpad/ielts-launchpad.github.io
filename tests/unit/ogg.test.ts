import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { oggOpusDurationSec } from '../../src/engine/audio/ogg';
import { sampleListening } from '../fixtures/sample-audio';

const SAMPLE = join(
  process.cwd(),
  'public',
  'audio',
  'academic',
  'sample-01',
  'part-1.opus',
);

describe('oggOpusDurationSec', () => {
  it('reads the committed sample duration matching its content metadata', () => {
    const duration = oggOpusDurationSec(readFileSync(SAMPLE));
    expect(duration).not.toBeNull();
    expect(Math.abs((duration as number) - sampleListening.part.durationSec)).toBeLessThanOrEqual(1);
  });

  it('returns null for a non-Ogg buffer', () => {
    expect(oggOpusDurationSec(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
    expect(oggOpusDurationSec(Buffer.from('not an ogg file at all'))).toBeNull();
  });

  it('returns null for an empty buffer', () => {
    expect(oggOpusDurationSec(new Uint8Array(0))).toBeNull();
  });
});
