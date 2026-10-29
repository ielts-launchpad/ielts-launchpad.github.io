import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadAllTests } from '../../src/engine/content/loader';

const contentDir = fileURLToPath(new URL('../fixtures/content', import.meta.url));
const publicDir = fileURLToPath(new URL('../fixtures/public', import.meta.url));

describe('loadAllTests', () => {
  it('excludes drafts in production mode', () => {
    const tests = loadAllTests({ contentDir, publicDir, includeDrafts: false });
    const ids = tests.map((t) => t.meta.id);
    expect(ids).toContain('published-sample');
    expect(ids).not.toContain('draft-sample');
  });

  it('includes drafts when requested', () => {
    const tests = loadAllTests({ contentDir, publicDir, includeDrafts: true });
    const ids = tests.map((t) => t.meta.id);
    expect(ids).toContain('published-sample');
    expect(ids).toContain('draft-sample');
  });

  it('flags draft tests via isDraft', () => {
    const tests = loadAllTests({ contentDir, publicDir, includeDrafts: true });
    const draft = tests.find((t) => t.meta.id === 'draft-sample');
    expect(draft?.isDraft).toBe(true);
  });
});
