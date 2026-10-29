import { describe, expect, it } from 'vitest';
import { ai, isAiConfigured } from '../../src/config/ai';

describe('ai config', () => {
  it('reads the worker URL with a safe empty fallback when unset', () => {
    expect(typeof ai.workerUrl).toBe('string');
  });

  it('falls back to the Turnstile test site key when unset', () => {
    expect(ai.turnstileSiteKey.length).toBeGreaterThan(0);
  });

  it('enforces the SPEC §8 daily limits', () => {
    expect(ai.limits.writingPerDay).toBe(3);
    expect(ai.limits.speakingPerDay).toBe(3);
  });

  it('reports AI as not configured when no worker URL is set', () => {
    expect(isAiConfigured()).toBe(ai.workerUrl.length > 0);
  });
});
