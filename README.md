# IELTS Launchpad

Free, open-source IELTS **Academic** practice: exam-faithful Listening and
Reading with deterministic, explained grading, AI feedback for Writing and
Speaking, and weakness analytics. **No accounts, no ads, no tracking.** Not
affiliated with IELTS.

> Live site: https://ielts-launchpad.github.io

## Features

- Exam-faithful computer-delivered test UI (our own visual design).
- Listening & Reading: strict IELTS grading rules with per-question
  explanations.
- Writing & Speaking: AI feedback via a Cloudflare Worker (band shown as a range
  - "beta").
- Weakness analytics, band history, and a deterministic study planner.
- All data stays in your browser (IndexedDB). Export/import as JSON.
- No third-party scripts except Cloudflare Turnstile on AI forms.

## Tech stack

Astro (static) + React islands + TypeScript (strict) + Tailwind CSS. Zod, Dexie,
Recharts. Vitest + Playwright + axe. A Cloudflare Worker (in `worker/`) proxies
AI requests. Deployed to GitHub Pages.

## Getting started

Requires the Node version in [`.nvmrc`](.nvmrc) and npm.

```bash
npm install
cp .env.example .env   # fill in values when available (optional for local dev)
npm run dev            # http://localhost:4321
```

## Scripts

| Script              | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server                 |
| `npm run build`     | Production build (`dist/`)           |
| `npm run preview`   | Preview the production build         |
| `npm run lint`      | ESLint                               |
| `npm run typecheck` | `astro check` (TypeScript)           |
| `npm test`          | Vitest unit tests                    |
| `npm run test:e2e`  | Playwright + axe end-to-end tests    |
| `npm run validate`  | Content validation (stub until M1.3) |

## Project layout

See [`.github/docs/SPEC.md`](.github/docs/SPEC.md) §2 for the full repository
layout. The implementation plan lives in [`docs/PLAN.md`](docs/PLAN.md).

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md). All
contributions are made under the Developer Certificate of Origin — sign off your
commits with `git commit -s`.

## Licences

- Code: **AGPL-3.0-or-later** — see [`LICENSE`](LICENSE).
- Practice content (`content/`): **CC BY-SA 4.0** — see
  [`LICENSE-CONTENT`](LICENSE-CONTENT).

## Disclaimer

IELTS is a registered trademark of the British Council, IDP: IELTS Australia and
Cambridge University Press & Assessment. This site is not affiliated with,
approved or endorsed by them.
