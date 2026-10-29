/**
 * AI configuration — all values are environment-driven with safe fallbacks so
 * the app never blocks on external credentials that are not yet provisioned.
 * Real values are injected at build time via `PUBLIC_*` env vars (see
 * `.env.example`). Implements SPEC §0, §1, §8.
 */

const env = import.meta.env;

/** Cloudflare Turnstile test site key (always passes) — used in dev and tests. */
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

export const ai = {
  /** Base URL of the Worker that proxies AI requests. Empty until configured. */
  workerUrl: env.PUBLIC_WORKER_URL ?? '',

  /** Turnstile site key for AI forms; defaults to the public test key. */
  turnstileSiteKey: env.PUBLIC_TURNSTILE_SITE_KEY ?? TURNSTILE_TEST_SITE_KEY,

  /**
   * Model identifiers. Verify current IDs before release; the Worker is the
   * source of truth for server-side evaluation (SPEC §8).
   */
  models: {
    writing: 'llama-3.3-70b-versatile',
    speaking: 'llama-3.3-70b-versatile',
    transcription: 'whisper-large-v3',
  },

  /** Daily per-user limits enforced by the Worker (SPEC §8). */
  limits: {
    writingPerDay: 3,
    speakingPerDay: 3,
  },
} as const;

export type AiConfig = typeof ai;

/** True when a Worker URL has been configured; UI can gate AI features on this. */
export const isAiConfigured = (): boolean => ai.workerUrl.length > 0;
