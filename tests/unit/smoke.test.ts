import { describe, expect, it } from 'vitest';

// Trivial smoke test (SPEC §1 / M0.1): proves the unit runner is wired up.
describe('smoke', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
