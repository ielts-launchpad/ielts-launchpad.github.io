# Contributing to IELTS Launchpad

Thanks for your interest in improving IELTS Launchpad! This project is free and
open source. Code is licensed under **AGPL-3.0-or-later** and practice content
under **CC BY-SA 4.0**.

## Ground rules

- `docs/SPEC.md` (`.github/docs/SPEC.md`) is the single source of truth. Read it
  before starting. If something is ambiguous, open an issue to ask — do not
  invent requirements.
- Work one milestone / issue at a time. Keep pull requests small and focused.
- TypeScript is strict: no `any`, no `@ts-ignore`.
- All user-facing text lives in `src/i18n/en.ts`. Brand values live in
  `src/config/brand.ts`.
- Accessibility is mandatory (WCAG 2.2 AA). axe must report zero serious or
  critical violations.
- No analytics, trackers, ads, external fonts/CDNs, or third-party scripts
  (Cloudflare Turnstile is the only exception).
- Never commit secrets. Use `.env.example` and Wrangler secrets.
- Never copy official IELTS/Cambridge/British Council/IDP text, tests, or band
  descriptors. Paraphrase in our own words.

## Developer Certificate of Origin (DCO)

All contributions must be signed off under the
[Developer Certificate of Origin](https://developercertificate.org/). By signing
off, you certify that you wrote the patch or otherwise have the right to submit
it under the project's licences.

Add a `Signed-off-by` line to every commit:

```
Signed-off-by: Your Name <your.email@example.com>
```

The easiest way is to commit with the `-s` flag:

```bash
git commit -s -m "your message"
```

## Development workflow

```bash
npm install            # install dependencies
npm run dev            # start the dev server
npm run lint           # ESLint
npm run typecheck      # astro check (TypeScript)
npm test               # Vitest unit tests
npm run test:e2e       # Playwright + axe end-to-end tests
npm run validate       # content validation (stub until M1.3)
```

A change is only done when `npm run lint && npm run typecheck && npm test &&
npm run test:e2e` all pass.

## Reporting content problems

Use the "Something wrong with this question?" link on a results page (available
from M4 onward) or open an issue with the test id, question id, and details.
