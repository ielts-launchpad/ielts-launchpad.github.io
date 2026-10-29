# IELTS Launchpad — Implementation Plan

> **Source of truth:** [SPEC.md](../.github/docs/SPEC.md). Each issue is sized for one PR.
>
> **Global Definition of Done (every issue):** `npm run lint && npm run typecheck && npm test && npm run test:e2e` all green; TypeScript strict (no `any`, no `@ts-ignore`); all UI text in `src/i18n/en.ts`; brand values only from `src/config/brand.ts`; no analytics/trackers/third-party scripts except Turnstile.

**Labels:** `code` (Copilot) · `manual` (maintainer: accounts/keys/deploy) · `content` (maintainer: authoring) · `later` (deferred)

**Confirmed cross-cutting dependencies:**

1. M2 grading complete before M3 practice "Check answer" (§5) and all M4 Results logic (§6).
2. M2.4 perfect-answer-sheet check extends the M1.3 validator (depends on M1.3 + M2.2).
3. M0.2 establishes the axe e2e harness; every UI issue adds page-specific axe checks (§10).

> Machine-readable metadata for each issue lives in an HTML comment of the form
> `<!-- meta: id=…; label=…; milestone=…; depends=…; assignee=… -->`.
> `tools/github/create-issues.mjs` parses these to create labels, milestones, and issues.

## Milestone / issue index (id — label — depends)

- **M0 Bootstrap:** M0.1 scaffold (code, —) · M0.2 test-infra (code, M0.1) · M0.3 config+i18n (code, M0.1) · M0.4 layout+stubs (code, M0.3) · M0.5 legal/docs (code, M0.1) · M0.6 CI (code, M0.2)
- **M1 Content schema & validator:** M1.1 zod (code, M0.1) · M1.2 loader (code, M1.1) · M1.3 validate (code, M1.1) · M1.4 sample-01 (code, M1.1+M1.2+M1.3)
- **M2 Grading engine:** M2.1 normalise (code, M1.1) · M2.2 grade+errors (code, M2.1) · M2.3 bands (code, M0.1) · M2.4 perfect-sheet (code, M1.3+M2.2)
- **M3 Reading runner:** M3.1 dexie (code, M1.1) · M3.2 interactions (code, M1.2+M2.2) · M3.3 dragBank (code, M3.2) · M3.4 templates/images (code, M3.2) · M3.5 shell (code, M3.2) · M3.6 highlight/notes (code, M3.5) · M3.7 timer/modes/autosave (code, M3.1+M3.5) · M3.8 reading integ (code, M3.2–M3.7)
- **M4 Listening & Results:** M4.1 audio (code, M3.8) · M4.2 listening integ (code, M4.1+M3.8) · M4.3 results (code, M2.2+M3.8) · M4.4 results extras (code, M4.3+M4.1)
- **M5 Dashboard & data:** M5.1 tests-list (code, M1.2) · M5.2 dashboard (code, M3.1+M2.3) · M5.3 weaknesses (code, M5.2) · M5.4 settings (code, M3.1)
- **M6 Worker & AI:** M6.1 worker-scaffold (code, M0.1) · M6.2 turnstile+limits (code, M6.1) · M6.3 prompts/anchors (code, M6.1) · M6.4 writing-eval (code, M6.2+M6.3) · M6.5 speaking-eval (code, M6.2+M6.3) · M6.6 writing-page (code, M6.4) · M6.7 speaking-page (code, M6.5) · M6.8 own-key (code, M5.4+M6.3) · M6.9 worker-readme (code, M6.1) · M6.M deploy (manual, M6.1–M6.9)
- **M7 Content tools:** M7.1 gen-prompts (code, M1.1) · M7.2 blind-solver (code, M2.2) · M7.3 tts (code, M0.1) · M7.4 review-app (code, M1.2) · M7.5 workflow-doc (code, M7.1–M7.4) · M7.C1 mock-01 (content) · M7.C2 mock-02 (content) · M7.C3 practice (content)
- **M8 Planner, pages & release:** M8.1 planner (code, M5.2) · M8.2 official+scoring (code, M0.4) · M8.3 static-pages (code, M0.4) · M8.4 seo (code, M0.4) · M8.5 csp-audit (code, M0.4) · M8.6 health-workflow (code, M6.1) · M8.7 release-checklist (code, M8.1–M8.6) · M8.M pre-release-verification (manual, M8.1–M8.7 + M7.C1–C3)
- **Post-M8 trackers:** GT General Training (later) · ANCHORS real AI anchors (content)

---

## M0 — Bootstrap

### M0.1 Scaffold Astro + React + TS + Tailwind
<!-- meta: id=M0.1; label=code; milestone=M0; depends=; assignee= -->
**Implements:** SPEC §1, §2.

**Acceptance criteria:**

- Astro static-output project with React islands, TypeScript `strict: true`, Tailwind configured.
- `package.json` scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, `validate` (validate may be a no-op stub until M1.3).
- ESLint + Prettier configured; lint fails on `any`/unused.
- `.nvmrc` pins current Node LTS; `astro.config` sets `site: "https://ielts-launchpad.github.io"`, `base: "/"`.

**Tests:** Unit — one trivial Vitest test passes. CI — `lint`, `typecheck`, `build` succeed.

### M0.2 Test & a11y harness
<!-- meta: id=M0.2; label=code; milestone=M0; depends=M0.1; assignee= -->
**Implements:** SPEC §1, §10.

**Acceptance criteria:**

- Vitest configured for unit tests; Playwright configured for e2e; `@axe-core/playwright` wired as a reusable helper (`expectNoA11yViolations(page)`).
- Example e2e visits home page; example axe check asserts zero serious/critical violations.

**Tests:** e2e — sample spec passes headless in CI. axe — helper returns zero serious/critical on the stub home page.

### M0.3 Config & i18n scaffolding
<!-- meta: id=M0.3; label=code; milestone=M0; depends=M0.1; assignee= -->
**Implements:** SPEC §0, §1, §2.

**Acceptance criteria:**

- `src/config/brand.ts` (name, tagline, URLs, donation links, disclaimer verbatim text from §0).
- `src/config/ai.ts` (worker URL, model IDs, limits — all env-driven with placeholders).
- `src/i18n/en.ts` exports typed string catalog; `.env.example` lists `PUBLIC_WORKER_URL`, `PUBLIC_TURNSTILE_SITE_KEY`.

**Tests:** Unit — disclaimer string matches §0 verbatim; `ai.ts` reads env with safe fallbacks.

### M0.4 Base layout & stub pages
<!-- meta: id=M0.4; label=code; milestone=M0; depends=M0.3; assignee= -->
**Implements:** SPEC §9, §0, §10.

**Acceptance criteria:**

- Layout with semantic landmarks, skip link, header, footer containing the §0 disclaimer + donation links + licence notice.
- Stub pages for all §9 routes (Home, Tests, Dashboard, Planner, Settings, Official resources, How scoring works, About, Privacy, Terms, Licences & credits, Support) + 404.
- Baseline CSP `<meta>` present (self + Turnstile + Worker + Groq/Gemini hosts).

**Tests:** e2e — each route returns 200 and renders footer disclaimer. axe — zero serious/critical on layout + 404.

### M0.5 Legal & repo docs
<!-- meta: id=M0.5; label=code; milestone=M0; depends=M0.1; assignee= -->
**Implements:** SPEC §0.

**Acceptance criteria:** `LICENSE` (AGPL-3.0), `LICENSE-CONTENT` (CC BY-SA 4.0), `CONTRIBUTING.md` (DCO sign-off), `NOTICE`, updated `README.md`, `AGENTS.md`.

**Tests:** CI — markdown-lint passes; links resolve.

### M0.6 CI/CD pipelines
<!-- meta: id=M0.6; label=code; milestone=M0; depends=M0.2; assignee= -->
**Implements:** SPEC §1, §10, §0.

**Acceptance criteria:**

- `ci.yml` runs lint → typecheck → unit → e2e → `validate` on PRs.
- `deploy.yml` builds and publishes to GitHub Pages; production build excludes `status: draft` content (hook ready even if validate is stub).

**Tests:** CI — pipeline green on the scaffold; deploy dry-run succeeds on main.

---

## M1 — Content schema & validator

### M1.1 Zod content schemas
<!-- meta: id=M1.1; label=code; milestone=M1; depends=M0.1; assignee= -->
**Implements:** SPEC §3.

**Acceptance criteria:**

- Schemas for `meta.yaml`, `QuestionGroup`, `Question`, per-skill files, and the `multi` (`numbers`/`n`) and `gap` (`wordLimit`) variants.
- Shared `qtype` enum exactly matches the §3 allowed list; `interaction` enum = single|multi|select|dragBank|gap.

**Tests:** Unit — valid fixtures parse; malformed fixtures (missing `status`, bad `qtype`, duplicate ids) rejected with clear errors.

### M1.2 Content loader
<!-- meta: id=M1.2; label=code; milestone=M1; depends=M1.1; assignee= -->
**Implements:** SPEC §3, §10.

**Acceptance criteria:**

- Loads YAML + Markdown into typed objects; excludes `status: draft` in production builds; shows a "DRAFT" badge in dev.
- Resolves transcript/passage/image/audio paths.

**Tests:** Unit — prod mode filters drafts; dev mode includes them flagged.

### M1.3 Validator CLI
<!-- meta: id=M1.3; label=code; milestone=M1; depends=M1.1; assignee= -->
**Implements:** SPEC §3 rules 1–6.

**Acceptance criteria:**

- `npm run validate` enforces §3 rules 1–6: schema/ids/status; Listening 4 parts/40 Q/1–40 contiguous; Reading 3 passages/40 Q; gap word-limit compliance; `multi` cardinality + option existence; `evidence.quote` verbatim (case-insensitive, whitespace-normalised); passage 650–1000 words; audio exists; template placeholders match question numbers.
- Non-zero exit + readable report on any violation; wired into `ci.yml`.

**Tests:** Unit — one passing fixture set + one failing fixture per rule (1–6). CI — validate step fails on a seeded bad fixture.

### M1.4 Draft sample test `sample-01`
<!-- meta: id=M1.4; label=code; milestone=M1; depends=M1.1,M1.2,M1.3; assignee= -->
**Implements:** SPEC §3.

**Acceptance criteria:**

- `content/academic/practice/sample-01` uses every interaction type and ≥ 8 qtypes; `status: draft`.
- Committed short generated silent/tone `.opus` audio for any listening group.
- `npm run validate` passes for the sample.

**Tests:** Integration — validator passes on sample; loader returns it only in dev.

---

## M2 — Grading engine

### M2.1 Normalisation primitives
<!-- meta: id=M2.1; label=code; milestone=M2; depends=M1.1; assignee= -->
**Implements:** SPEC §4.

**Acceptance criteria:** Pure functions for trim/collapse-whitespace/case-fold/trailing-full-stop removal; optional-words expansion (`(the) river` → both forms); number↔word equivalence for integers 0–999; word counting (hyphen = one word; one numeric token free when `numberAllowed`).

**Tests:** Unit — exhaustive tables for each rule incl. edge cases (0, 999, hyphenated, numeric-with-limit).

### M2.2 Grading & error classification
<!-- meta: id=M2.2; label=code; milestone=M2; depends=M2.1; assignee= -->
**Implements:** SPEC §4.

**Acceptance criteria:**

- `gradeQuestion`/`gradeTest`: 1 mark/Q, no negative marking, blank = 0; strict spelling (listed variants only, no fuzzy acceptance); `multi` per-letter marking order-independent; exact option match for single/select/dragBank.
- Error class per wrong answer: `blank` | `over-limit` | `plural` | `spelling` (Damerau-Levenshtein ≤ 2, len ≥ 4) | `wrong`.

**Tests:** Unit — accept/reject matrices per interaction; each error class triggered by targeted fixtures; over-limit-containing-answer marked wrong.

### M2.3 Band tables & rounding
<!-- meta: id=M2.3; label=code; milestone=M2; depends=M0.1; assignee= -->
**Implements:** SPEC §4.

**Acceptance criteria:** `src/exams/ielts/bands.ts` with Listening, Academic Reading, and General Reading tables + overall-band rounding (mean of 4; <.25 down, .25–<.75 → .5, ≥.75 up); carries the "verify against ielts.org before release" comment.

**Tests:** Unit — every raw-score boundary maps to the specified band for all three tables; rounding edge cases (.24/.25/.74/.75).

### M2.4 Perfect-answer-sheet check
<!-- meta: id=M2.4; label=code; milestone=M2; depends=M1.3,M2.2; assignee= -->
**Implements:** SPEC §3 rule 7.

**Acceptance criteria:** Validator extended so a generated "perfect" sheet scores 40/40; every listed variant accepted; every non-answer option rejected. Fails build on violation.

**Tests:** Unit — sample-01 yields 40/40; a fixture with an unreachable variant fails; a fixture where a distractor is wrongly accepted fails.

---

## M3 — Reading runner

### M3.1 Dexie storage schema & repository
<!-- meta: id=M3.1; label=code; milestone=M3; depends=M1.1; assignee= -->
**Implements:** SPEC §5, §6.

**Acceptance criteria:** Dexie DB with tables for attempts, per-question answers, results, and settings; repository interface (sync-ready) with typed CRUD; autosave-friendly upsert.

**Tests:** Unit (fake-indexeddb) — create/resume attempt, upsert answers, read results; schema migration no-op test.

### M3.2 Core interaction components
<!-- meta: id=M3.2; label=code; milestone=M3; depends=M1.2,M2.2; assignee= -->
**Implements:** SPEC §3, §4, §5, §10.

**Acceptance criteria:** `single`, `multi` (Choose-N — UI prevents selecting > N), `select`, `gap` components; labelled controls; practice-mode "Check answer" uses M2 grading; every option is reachable/selectable by mouse, keyboard, and touch.

**Tests:** Component/unit — selection state, N-limit enforcement, gap word-limit live hint. axe — zero serious/critical per component. e2e — keyboard-only selects every option.

### M3.3 dragBank component
<!-- meta: id=M3.3; label=code; milestone=M3; depends=M3.2; assignee= -->
**Implements:** SPEC §3, §5, §10.

**Acceptance criteria:** dnd-kit drag bank with keyboard and touch operation; `allowReuse` honoured; clear focus/drop affordances; every bank option placeable into every target.

**Tests:** e2e — keyboard DnD places each option; touch DnD (emulated) works; reuse/no-reuse enforced. axe — zero serious/critical.

### M3.4 Templates & image questions
<!-- meta: id=M3.4; label=code; milestone=M3; depends=M3.2; assignee= -->
**Implements:** SPEC §3.

**Acceptance criteria:** Renders note/table/form/summary/flow-chart `template` with `{{n}}` gap mapping; diagram/map/plan `image` labelling; placeholder↔question-number integrity matches validator.

**Tests:** Unit — template token→question mapping; e2e — labelling interaction records answers. axe — image questions have accessible labels/alt.

### M3.5 Runner shell & navigator
<!-- meta: id=M3.5; label=code; milestone=M3; depends=M3.2; assignee= -->
**Implements:** SPEC §5, §10.

**Acceptance criteria:** Split pane (passage | questions) on desktop, tabs on mobile (works at 360px) with independent scroll; question navigator 1–40 showing answered/flagged state; flag-for-review toggle; font-size control.

**Tests:** e2e — desktop split + mobile tabs; navigator reflects answered/flagged; font-size persists. axe — zero serious/critical; focus visible.

### M3.6 Passage highlighting & notes
<!-- meta: id=M3.6; label=code; milestone=M3; depends=M3.5; assignee= -->
**Implements:** SPEC §5.

**Acceptance criteria:** User can highlight passage text and attach notes; persisted to storage; keyboard-accessible.

**Tests:** e2e — create/remove highlight + note, persists across reload. axe — controls labelled.

### M3.7 Timer, modes, autosave/resume
<!-- meta: id=M3.7; label=code; milestone=M3; depends=M3.1,M3.5; assignee= -->
**Implements:** SPEC §5.

**Acceptance criteria:** Reading 60:00 countdown with warnings at 10 and 5 min, auto-submit at 0 (exam mode); practice mode optional timer + per-question check; answers autosave every change; in-progress attempt resumes after refresh.

**Tests:** Unit — timer/warnings/auto-submit logic (fake timers). e2e — refresh mid-attempt resumes answers; auto-submit fires at 0.

### M3.8 Reading runner integration + e2e
<!-- meta: id=M3.8; label=code; milestone=M3; depends=M3.2,M3.3,M3.4,M3.5,M3.6,M3.7; assignee= -->
**Implements:** SPEC §3–§6.

**Acceptance criteria:** End-to-end Reading attempt on sample-01 across all interaction types → submit → stored result; answers hidden until submit in exam mode.

**Tests:** e2e — full attempt per interaction type; exam-mode hides answers. axe — runner route zero serious/critical.

---

## M4 — Listening runner & Results

### M4.1 Audio player (exam + practice)
<!-- meta: id=M4.1; label=code; milestone=M4; depends=M3.8; assignee= -->
**Implements:** SPEC §5.

**Acceptance criteria:** Exam mode plays once, no seek/pause, auto-advances parts, 2-minute review window then auto-submit; practice mode allows play/pause/seek/replay.

**Tests:** Unit — mode state machine (no-seek/auto-advance/review/submit). e2e — exam play-once + auto-advance; practice seek/replay. axe — player controls labelled.

### M4.2 Listening runner integration
<!-- meta: id=M4.2; label=code; milestone=M4; depends=M4.1,M3.8; assignee= -->
**Implements:** SPEC §3, §5.

**Acceptance criteria:** 4 parts × 10 questions reuse M3 interaction components; numbering 1–40; autosave/resume.

**Tests:** e2e — full listening attempt on sample-01 exam + practice. axe — zero serious/critical.

### M4.3 Results page
<!-- meta: id=M4.3; label=code; milestone=M4; depends=M2.2,M3.8; assignee= -->
**Implements:** SPEC §6, §4.

**Acceptance criteria:** Shows raw score, estimated band, per-section breakdown; per question: user answer, correct answer(s), correct/incorrect, error class, evidence quote highlighted in passage/transcript, explanation.

**Tests:** Unit — results view-model from a graded attempt. e2e — every field renders for a sample attempt. axe — zero serious/critical.

### M4.4 Results extras: replay & issue link
<!-- meta: id=M4.4; label=code; milestone=M4; depends=M4.3,M4.1; assignee= -->
**Implements:** SPEC §6.

**Acceptance criteria:** Listening "▶ Play answer location" seeks to `audioStart − 3s`; "Something wrong with this question?" link builds a prefilled GitHub issue URL (test id, question id, user answer) — results page only.

**Tests:** Unit — issue-URL builder encodes params. e2e — replay button seeks correctly; issue link opens with prefilled query.

---

## M5 — Dashboard & data

### M5.1 Tests list page
<!-- meta: id=M5.1; label=code; milestone=M5; depends=M1.2; assignee= -->
**Implements:** SPEC §9, §3.

**Acceptance criteria:** Lists tests by skill/kind; DRAFT badge in dev; production hides drafts; links into the runner.

**Tests:** e2e — list renders; dev shows DRAFT, prod hides it. axe — zero serious/critical.

### M5.2 Dashboard analytics
<!-- meta: id=M5.2; label=code; milestone=M5; depends=M3.1,M2.3; assignee= -->
**Implements:** SPEC §6.

**Acceptance criteria:** Band history chart per skill + overall; accuracy by `qtype` across attempts; error-class frequency; estimated current band (mean of latest result per skill; missing skills show "—"). Recharts; keyboard/screen-reader accessible summaries.

**Tests:** Unit — aggregation functions (latest-per-skill, qtype accuracy, error freq). e2e — charts render with seeded attempts. axe — chart alternatives present.

### M5.3 Weaknesses & tips
<!-- meta: id=M5.3; label=code; milestone=M5; depends=M5.2; assignee= -->
**Implements:** SPEC §6.

**Acceptance criteria:** Top-3 weaknesses derived from analytics with recommendations loaded from `content/tips.yaml` (Zod-validated).

**Tests:** Unit — weakness ranking + tip lookup; missing-tip fallback. e2e — recommendations render.

### M5.4 Settings page
<!-- meta: id=M5.4; label=code; milestone=M5; depends=M3.1; assignee= -->
**Implements:** SPEC §6, §9.

**Acceptance criteria:** Font-size control; export all data (JSON download); import (Zod-validate, merge by id); delete all data (confirm). No cookies set.

**Tests:** Unit — export/import round-trip + merge-by-id + invalid-import rejection. e2e — delete-all clears DB. axe — form labelled.

---

## M6 — Worker & Writing/Speaking

### M6.1 Worker scaffold
<!-- meta: id=M6.1; label=code; milestone=M6; depends=M0.1; assignee= -->
**Implements:** SPEC §8.

**Acceptance criteria:** Wrangler TS worker in `/worker`; routes stubbed; CORS allowlist (prod site + `localhost:4321`); `GET /v1/health` returns provider status; `worker/src/config.ts` with placeholder model IDs + env secrets names.

**Tests:** Unit (Miniflare/vitest-workers) — health route; CORS allow/deny; unknown route 404.

### M6.2 Turnstile & rate limiting
<!-- meta: id=M6.2; label=code; milestone=M6; depends=M6.1; assignee= -->
**Implements:** SPEC §8.

**Acceptance criteria:** Server-side Turnstile verify (test keys in dev/tests); Durable Object (SQLite) rate limit keyed on salted SHA-256(IP + UTC date): 3 writing + 3 speaking/day; transcribe doesn't count separately; 429 `{ code: "DAILY_LIMIT" }`; stores nothing.

**Tests:** Unit — limit decrement/reset at UTC rollover; 4th call 429; invalid Turnstile rejected; no content persisted.

### M6.3 Shared prompts & anchors loader
<!-- meta: id=M6.3; label=code; milestone=M6; depends=M6.1; assignee= -->
**Implements:** SPEC §8.

**Acceptance criteria:** `src/ai/prompts.ts` (mirrored in worker) with OUR paraphrased rubric (no official descriptor text); evidence-quoting instruction; anchors loader reads `worker/src/anchors/*.json` and works with an empty directory.

**Tests:** Unit — empty-anchors load returns []; prompt builder injects criteria + anchors; no copyrighted text present (string guard).

### M6.4 Writing evaluate endpoint
<!-- meta: id=M6.4; label=code; milestone=M6; depends=M6.2,M6.3; assignee= -->
**Implements:** SPEC §8.

**Acceptance criteria:** `POST /v1/writing/evaluate`: reject >1200 or <20 words; under-length flag to model; 3 runs @ temp 0 JSON-schema-constrained; per-criterion median; Zod-validate, retry once on invalid JSON; task band = mean of 4 criteria rounded down to 0.5; `range` = [min,max] of 3 task bands widened to ≥0.5; Groq→Cerebras failover; returns §8 writing shape incl. `remaining`.

**Tests:** Unit (mocked providers) — median math; band/range math; word-count rejections; failover on Groq error; retry-once path; response matches Zod schema.

### M6.5 Speaking transcribe & evaluate
<!-- meta: id=M6.5; label=code; milestone=M6; depends=M6.2,M6.3; assignee= -->
**Implements:** SPEC §8.

**Acceptance criteria:** `POST /v1/speaking/transcribe` (multipart ≤10MB; Groq Whisper `verbose_json` word timestamps) → `{text, words}`; `POST /v1/speaking/evaluate` returns criteria FC/LR/GRA/P with `P.limited:true` when no audio-capable model; same median/range rules.

**Tests:** Unit (mocked) — >10MB rejected; word timestamps mapped; `P.limited` set correctly; schema valid.

### M6.6 Writing page
<!-- meta: id=M6.6; label=code; milestone=M6; depends=M6.4; assignee= -->
**Implements:** SPEC §8, §9, §0.

**Acceptance criteria:** Task 1/2 form; renders Task-1 `chart` as SVG component; Turnstile widget; calls worker; renders criteria/estimate/range/errors/suggestions; AI disclaimer shown near result; band shown as range + "beta".

**Tests:** e2e (mocked worker) — submit → results render; under-length flagged; disclaimer present. axe — form + results zero serious/critical.

### M6.7 Speaking page
<!-- meta: id=M6.7; label=code; milestone=M6; depends=M6.5; assignee= -->
**Implements:** SPEC §8, §9, §0.

**Acceptance criteria:** Recorder (MediaRecorder webm/opus, feature-detected); client metrics (wpm, pause>0.5s count, longest pause, filler count, type-token ratio, mean utterance length); transcribe→evaluate flow; disclaimer; range + "beta".

**Tests:** Unit — metrics computations on fixture transcripts. e2e (mocked) — record→transcribe→evaluate renders. axe — controls labelled.

### M6.8 Own-key mode
<!-- meta: id=M6.8; label=code; milestone=M6; depends=M5.4,M6.3; assignee= -->
**Implements:** SPEC §8, §9.

**Acceptance criteria:** Settings lets user paste Groq/Gemini key (IndexedDB only, never sent to our Worker); browser calls provider directly with shared prompts; Gemini sends audio for full Pronunciation; warning text (key stored locally, use spending limits, Google 18+); auto-fallback when Worker returns `DAILY_LIMIT` or is unavailable.

**Tests:** Unit — adapter selection; key never included in Worker requests; fallback trigger logic. e2e (mocked) — own-key path renders results; warning shown.

### M6.9 Worker README & client config
<!-- meta: id=M6.9; label=code; milestone=M6; depends=M6.1; assignee= -->
**Implements:** SPEC §8.

**Acceptance criteria:** `worker/README.md` deploy steps (secrets, Wrangler, model-ID verification); finalize `src/config/ai.ts` wiring.

**Tests:** CI — markdown-lint; `ai.ts` type-checks with env placeholders.

### M6.M Cloudflare/provider setup & deploy
<!-- meta: id=M6.M; label=manual; milestone=M6; depends=M6.1,M6.2,M6.3,M6.4,M6.5,M6.6,M6.7,M6.8,M6.9; assignee=HabibApez -->
**Implements:** SPEC §8, §11 defaults.

**Acceptance criteria:** Create Cloudflare account + Turnstile site; obtain Groq/Cerebras keys; verify current model IDs; set Wrangler secrets (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, `TURNSTILE_SECRET`, `IP_SALT`); deploy worker; set repo vars `PUBLIC_WORKER_URL`, `PUBLIC_TURNSTILE_SITE_KEY`.

**Tests:** Manual — `GET /v1/health` returns provider status from deployed worker.

---

## M7 — Content tools

### M7.1 Generation prompt templates
<!-- meta: id=M7.1; label=code; milestone=M7; depends=M1.1; assignee= -->
**Implements:** SPEC §2 (`tools/`), §3.

**Acceptance criteria:** `tools/` prompt templates producing content that conforms to the schema; never copy official IELTS text.

**Tests:** Unit — generated-sample fixture passes `npm run validate`.

### M7.2 Blind-solver CLI
<!-- meta: id=M7.2; label=code; milestone=M7; depends=M2.2; assignee= -->
**Implements:** SPEC §2.

**Acceptance criteria:** CLI attempts a test using only visible prompts (no answers) and reports ambiguous/guessable questions to flag weak items.

**Tests:** Unit — solver flags a deliberately ambiguous fixture; clean sample yields no false flags.

### M7.3 Azure TTS script
<!-- meta: id=M7.3; label=code; milestone=M7; depends=M0.1; assignee= -->
**Implements:** SPEC §2.

**Acceptance criteria:** Script generates `.opus` audio with word timestamps aligned to transcript `[mm:ss.s]`; outputs to `public/audio/...`; no secrets committed.

**Tests:** Unit — timestamp parser/formatter; dry-run without network.

### M7.4 Local-only review app
<!-- meta: id=M7.4; label=code; milestone=M7; depends=M1.2; assignee= -->
**Implements:** SPEC §2.

**Acceptance criteria:** `npm run review` serves a local app to preview/QA draft content (incl. drafts); never built into production.

**Tests:** e2e (local) — review app loads sample-01; excluded from prod build.

### M7.5 Content workflow doc
<!-- meta: id=M7.5; label=code; milestone=M7; depends=M7.1,M7.2,M7.3,M7.4; assignee= -->
**Implements:** SPEC §2.

**Acceptance criteria:** `docs/CONTENT-WORKFLOW.md` documents generate→validate→blind-solve→TTS→review→publish.

**Tests:** CI — markdown-lint; referenced scripts exist.

### M7.C1 Author mock-01
<!-- meta: id=M7.C1; label=content; milestone=M7; depends=M7.5; assignee=HabibApez -->
**Implements:** SPEC §3.

**Acceptance criteria:** Author `mock-01` (full Listening/Reading/Writing/Speaking). `npm run validate` + perfect-answer-sheet pass; blind-solver clean.

**Tests:** CI — validator + perfect-sheet green on the new content.

### M7.C2 Author mock-02
<!-- meta: id=M7.C2; label=content; milestone=M7; depends=M7.5; assignee=HabibApez -->
**Implements:** SPEC §3.

**Acceptance criteria:** Author `mock-02`. `npm run validate` + perfect-answer-sheet pass; blind-solver clean.

**Tests:** CI — validator + perfect-sheet green on the new content.

### M7.C3 Author practice sets
<!-- meta: id=M7.C3; label=content; milestone=M7; depends=M7.5; assignee=HabibApez -->
**Implements:** SPEC §3.

**Acceptance criteria:** Author practice sets per skill (never reuse mock content). `npm run validate` + perfect-answer-sheet pass; blind-solver clean.

**Tests:** CI — validator + perfect-sheet green on the new content.

---

## M8 — Planner, static pages & release

### M8.1 Planner
<!-- meta: id=M8.1; label=code; milestone=M8; depends=M5.2; assignee= -->
**Implements:** SPEC §7.

**Acceptance criteria:** Deterministic weekly plan from exam date, target band, hours/week + latest bands + weakest qtypes; hours allocated proportionally to (target − current) per skill (min 1 session/skill/week); full mock every 2 weeks and in final week; practice sets matched to weak qtypes; stored in IndexedDB; sessions tickable. No AI.

**Tests:** Unit — allocation math, min-session rule, mock scheduling, qtype matching (deterministic). e2e — generate plan, tick a session, persists. axe — zero serious/critical.

### M8.2 Official resources & scoring pages
<!-- meta: id=M8.2; label=code; milestone=M8; depends=M0.4; assignee= -->
**Implements:** SPEC §9.

**Acceptance criteria:** Official resources page from `content/official-links.yaml`; "How scoring works" page explaining §4 rules in our own words.

**Tests:** e2e — pages render; links valid. axe — zero serious/critical.

### M8.3 Static content pages
<!-- meta: id=M8.3; label=code; milestone=M8; depends=M0.4; assignee= -->
**Implements:** SPEC §0, §9.

**Acceptance criteria:** About (disclaimer + AI-generated content & audio notices), Privacy, Terms, Licences & credits, Support (Ko-fi + GitHub Sponsors).

**Tests:** e2e — each renders required notices. axe — zero serious/critical.

### M8.4 SEO
<!-- meta: id=M8.4; label=code; milestone=M8; depends=M0.4; assignee= -->
**Implements:** SPEC §9.

**Acceptance criteria:** Page titles/meta descriptions per §9, Open Graph, `sitemap.xml`, `robots.txt`.

**Tests:** Unit/e2e — meta tags present; sitemap lists public routes; robots valid.

### M8.5 CSP finalize & security audit
<!-- meta: id=M8.5; label=code; milestone=M8; depends=M0.4; assignee= -->
**Implements:** SPEC §10.

**Acceptance criteria:** CSP `<meta>` restricted to self + Turnstile + Worker + Groq/Gemini hosts; no inline-script violations; no cookies/trackers; OWASP review of worker inputs.

**Tests:** e2e — no CSP violations in console across pages; security assertions on worker input validation.

### M8.6 Weekly health workflow
<!-- meta: id=M8.6; label=code; milestone=M8; depends=M6.1; assignee= -->
**Implements:** SPEC §8, §11.

**Acceptance criteria:** `health.yml` scheduled workflow pings `GET /v1/health` and reports provider status.

**Tests:** CI — workflow lints/parses; dry-run against mocked endpoint.

### M8.7 Release checklist & full audit
<!-- meta: id=M8.7; label=code; milestone=M8; depends=M8.1,M8.2,M8.3,M8.4,M8.5,M8.6; assignee= -->
**Implements:** SPEC §4, §10, §11.

**Acceptance criteria:** `docs/RELEASE-CHECKLIST.md` including the manual item "Verify band tables against ielts.org" (assigned maintainer), full a11y/axe audit, draft-exclusion verification, CSP check.

**Tests:** CI — checklist present; full axe sweep green; prod build excludes drafts.

### M8.M Pre-release verification
<!-- meta: id=M8.M; label=manual; milestone=M8; depends=M8.1,M8.2,M8.3,M8.4,M8.5,M8.6,M8.7,M7.C1,M7.C2,M7.C3; assignee=HabibApez -->
**Implements:** SPEC §4, §8, §9, §10, §11.

**Acceptance criteria (manual checklist — all must be ticked before tagging a release):**

- [ ] Verify band tables in `src/exams/ielts/bands.ts` against ielts.org
- [ ] Verify all links in `content/official-links.yaml` (incl. British Council pages)
- [ ] Confirm Groq/Cerebras terms allow a shared proxy, users 16+, EEA/UK use; confirm Azure TTS output terms
- [ ] Confirm the current Groq/Cerebras/Gemini model IDs and browser (CORS) access for own-key mode
- [ ] Take every published mock end-to-end in exam mode (desktop + mobile)
- [ ] Test AI Writing/Speaking evaluation on the deployed Worker, including the daily-limit fallback

**Tests:** Manual — every checklist item verified and ticked; blocks release tag until complete.

---

## Post-M8 trackers

### GT General Training
<!-- meta: id=GT; label=later; milestone=; depends=; assignee= -->
**Implements:** SPEC §0, §11 defaults.

**Acceptance criteria:** GT pages/content/UI. Engine, schema (`variant: general`), and GT Reading band table already shipped (M1/M2); no GT surface until this issue is scheduled.

**Tests:** Deferred — defined when scheduled.

### ANCHORS Real AI anchors
<!-- meta: id=ANCHORS; label=content; milestone=; depends=M6.3; assignee=HabibApez -->
**Implements:** SPEC §8.

**Acceptance criteria:** Add curated example answers to `worker/src/anchors/`; loader already tolerates empty dir (M6.3).

**Tests:** Unit — anchors load and are injected into prompts.
