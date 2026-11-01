import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { oggOpusDurationSec } from '../../src/engine/audio/ogg';

const SAMPLE = join(
  process.cwd(),
  'public',
  'audio',
  'academic',
  'sample-01',
  'part-1.opus',
);

describe('oggOpusDurationSec', () => {
  it('reads the committed sample duration (~24s) from its granule position', () => {
    const duration = oggOpusDurationSec(readFileSync(SAMPLE));
    expect(duration).not.toBeNull();
    expect(Math.abs((duration as number) - 24)).toBeLessThanOrEqual(1);
  });

  it('returns null for a non-Ogg buffer', () => {
    expect(oggOpusDurationSec(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
    expect(oggOpusDurationSec(Buffer.from('not an ogg file at all'))).toBeNull();
  });

  it('returns null for an empty buffer', () => {
    expect(oggOpusDurationSec(new Uint8Array(0))).toBeNull();
  });
});
