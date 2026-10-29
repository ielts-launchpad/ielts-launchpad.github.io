# AGENTS.md — guidance for AI coding agents

This file orients automated agents working in this repository. Humans should read
`CONTRIBUTING.md`; the rules below mirror it in agent-friendly form.

## Source of truth

- `.github/docs/SPEC.md` is the single source of truth. Read it before any task.
  If something is ambiguous or conflicts, stop and ask — do not invent
  requirements.
- `docs/PLAN.md` is the implementation plan (milestones M0–M8, one PR per issue).
  Work only on the milestone you are given; do not refactor unrelated code.

## Hard rules

- TypeScript strict. No `any`, no `@ts-ignore`.
- All UI text goes in `src/i18n/en.ts`. Brand values come only from
  `src/config/brand.ts`.
- Accessibility is mandatory: semantic HTML, labels, keyboard support, focus
  management, ARIA only when needed. axe must pass with zero serious/critical
  violations.
- Never add analytics, trackers, ads, external fonts/CDNs, or third-party scripts
  (Cloudflare Turnstile is the only exception).
- Never commit secrets. Use `.env.example` and Wrangler secrets.
- Never copy official IELTS/Cambridge/British Council/IDP text, tests, or band
  descriptors. Paraphrase in our own words.
- Keep functions in `src/engine` and `src/exams` small, pure, and testable.

## Definition of done (every change)

Run and fix failures before declaring a task complete:

```bash
npm run lint && npm run typecheck && npm test && npm run test:e2e
```

Every feature ships with tests: Vitest for logic, Playwright (+ axe) for UI.

## Commits

- Sign off every commit (DCO): `git commit -s`.
- Small, focused commits and pull requests.
