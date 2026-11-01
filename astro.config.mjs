import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://ielts-launchpad.github.io',
  base: '/',
  output: 'static',
  integrations: [react()],
  // Baseline CSP (SPEC §10). Tightened in M8.5. Astro computes hashes for its
  // own inline island-hydration scripts so client:only components work without
  // `'unsafe-inline'` in script-src. Allows self + Turnstile + the AI provider
  // hosts the Worker / own-key mode talk to.
  experimental: {
    csp: {
      directives: [
        "default-src 'self'",
        'frame-src https://challenges.cloudflare.com',
        "connect-src 'self' https://api.groq.com https://api.cerebras.ai https://generativelanguage.googleapis.com",
        "img-src 'self' data:",
        "font-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://challenges.cloudflare.com'],
      },
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
