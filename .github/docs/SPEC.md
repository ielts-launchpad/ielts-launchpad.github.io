# IELTS Launchpad — Product & Technical Specification (source of truth)

## 0. Product summary
Free, open-source IELTS **Academic** practice website (General Training later on the same engine).
- Exam-faithful computer-delivered test UI (own visual design).
- Listening & Reading: deterministic grading with strict IELTS rules + per-question explanations.
- Writing & Speaking: AI feedback via a Cloudflare Worker using free LLM tiers; band shown as a **range + "beta"**.
- Weakness analytics, band history, study planner.
- No accounts. All user data stays in the browser (IndexedDB). Export/import JSON.
- No ads, no analytics, no tracking, no third-party scripts except Cloudflare Turnstile on AI forms.
- Name: **IELTS Launchpad**. URL: https://ielts-launchpad.github.io
- Licences: code AGPL-3.0, content CC BY-SA 4.0, contributions via DCO.

### Disclaimer (footer on every page + About page, verbatim)
"IELTS is a registered trademark of the British Council, IDP: IELTS Australia and Cambridge University Press & Assessment. This site is not affiliated with, approved or endorsed by them."
AI disclaimer near every AI result: "AI estimate (beta), not an official IELTS score. For admissions, take the official test."

## 1. Tech stack (do not change without asking)
- Astro (static output) + React islands + TypeScript (strict) + Tailwind CSS
- Radix UI primitives (or shadcn/ui) for accessible controls; dnd-kit for drag-and-drop
- Zod for content schemas; Dexie for IndexedDB; Recharts for charts
- Vitest (unit) + Playwright (e2e) + @axe-core/playwright (a11y)
- Cloudflare Worker (TypeScript, Wrangler) in `/worker` with a SQLite-backed Durable Object for rate limits
- Node LTS, npm. GitHub Actions → GitHub Pages (`site: "https://ielts-launchpad.github.io"`, `base: "/"`)

## 2. Repository layout
```
content/academic/mocks/<mock-id>/...      # full mock tests
content/academic/practice/<skill>/<id>/... # practice sets (never reuse mock content)
content/tips.yaml                          # recommendations per question type / error type
content/official-links.yaml                # official resources page data
public/audio/academic/<test-id>/*.opus
src/config/brand.ts            # name, tagline, URLs, donation links, disclaimer text
src/config/ai.ts               # worker URL, model IDs, limits (env-driven)
src/engine/                    # exam-agnostic: schemas, question types, grading, timers
src/exams/ielts/               # IELTS specifics: sections, timings, band tables, rounding, rubric text
src/components/                # React components (runner, questions, results, dashboard, recorder, planner)
src/storage/                   # Dexie DB + repository interface (sync-ready)
src/ai/                        # client adapters: proxy (worker), groq (own key), gemini (own key)
src/i18n/en.ts                 # ALL UI strings
src/pages/                     # Astro pages
worker/                        # Cloudflare Worker
tools/                         # validate CLI, blind-solver, tts, review app, generation prompts
tests/unit, tests/e2e
```

## 3. Content format (YAML + Markdown)
Every test folder has `meta.yaml`:
```yaml
id: mock-01
exam: ielts
variant: academic          # academic | general
kind: mock                 # mock | practice
title: "Academic Mock Test 1"
status: draft              # draft | published (only published is built into production)
skills: [listening, reading, writing, speaking]
license: CC-BY-SA-4.0
version: 1
```

### Listening: `listening/part-<n>.yaml` (4 parts, 10 questions each, numbered 1–40)
```yaml
part: 1
audio: /audio/academic/mock-01/part-1.opus
durationSec: 380
transcript: part-1.transcript.md   # speaker-labelled lines with [mm:ss.s] timestamps
groups: [ ...QuestionGroup ]
```
### Reading: `reading/passage-<n>.md` + `reading/passage-<n>.yaml` (3 passages, 40 questions total)
Passage markdown uses paragraph labels `[A]`, `[B]`… when needed for matching questions.
```yaml
passage: 1
title: "..."
file: passage-1.md
groups: [ ...QuestionGroup ]
```
### QuestionGroup and Question
```yaml
- id: L1-G1
  instructions: "Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer."
  interaction: gap                  # single | multi | select | dragBank | gap
  qtype: form-completion            # IELTS type tag (list below), used for analytics
  template: |                       # optional, for note/table/form/summary/flow-chart completion
    Name: Sarah {{1}}
    Tour starts at: the {{2}}
  image: /images/mock-01/map.svg    # optional (diagram/map/plan labelling)
  options: { A: "...", B: "..." }   # for single | multi | select | dragBank
  allowReuse: false                 # select/dragBank: may an option be used more than once
  wordLimit: { words: 2, numberAllowed: true }   # gap only
  questions:
    - id: L1-Q2
      number: 2
      prompt: "Tour starts at: the ____"   # omit if fully covered by template
      answers: ["(main) entrance", "front gate"]   # gap: accepted strings; single/select/dragBank: ["B"]
      evidence:
        quote: "we'll meet at the main entrance"   # MUST appear verbatim in transcript/passage
        audioStart: 142.3                           # listening only (seconds)
        paragraph: C                                # reading only, optional
      explanation: "The guide corrects herself: not the car park but the main entrance."
      subskill: distractor-correction                # optional free tag
```
`multi` (Choose N) questions: one entry covering several numbers:
```yaml
    - id: R2-Q21-22
      numbers: [21, 22]
      n: 2
      answers: [B, D]
      explanation: { B: "...", D: "...", A: "Why A is wrong..." }
```
Allowed `qtype` values: multiple-choice, choose-n, true-false-not-given, yes-no-not-given,
matching-headings, matching-information, matching-features, matching-sentence-endings,
sentence-completion, summary-completion, note-completion, table-completion, flow-chart-completion,
form-completion, diagram-labelling, map-plan-labelling, short-answer.

### Writing: `writing/task-1.yaml`, `writing/task-2.yaml`
```yaml
task: 1
minutes: 20
minWords: 150
prompt: "The chart below shows..."
chart: { type: bar, title: "...", xLabel: "...", yLabel: "...", series: [...] }  # rendered as SVG by our component
modelAnswers:
  - band: 6
    text: "..."
    examinerNotes: "..."   # our own words
  - band: 7
  - band: 8
```
### Speaking: `speaking/speaking.yaml`
```yaml
part1: [{ topic: "Hometown", questions: ["...", "..."], audio: [...] }]
part2: { cueCard: "Describe a place...", bullets: ["...", "..."], prepSec: 60, speakSec: 120, audio: "..." }
part3: { questions: ["..."], audio: [...] }
modelAnswers: [{ part: 2, band: 7, text: "..." }]
```

### Content validation rules (build fails on any violation)
1. Zod schema valid; ids unique; `status` present.
2. Listening: exactly 4 parts, 40 questions, numbers 1–40 contiguous. Reading: 3 passages, 40 questions, 1–40 contiguous.
3. Every gap answer variant obeys its own `wordLimit` (after expanding optional words).
4. `multi`: `answers.length === n === numbers.length`; options unique; select/dragBank/single answers exist in `options`.
5. `evidence.quote` appears verbatim (case-insensitive, whitespace-normalised) in the passage/transcript.
6. Reading passages 650–1000 words; audio files exist; template placeholders match question numbers.
7. Auto-generated "perfect answer sheet" scores 40/40; every listed variant is accepted; every non-answer option is rejected.

## 4. Grading rules (Listening & Reading) — identical to real IELTS
- 1 mark per question, no negative marking, blank = 0.
- Case-insensitive. Trim, collapse internal whitespace, ignore a trailing full stop.
- Spelling is STRICT: only listed variants accepted (UK/US variants must be listed). **No fuzzy matching.**
- Optional words: `(the) river` expands to "river" and "the river".
- Numbers: a digit token equals its English word for integers 0–999 ("4" = "four", "twenty-one" = "21").
- Word limit: words = whitespace tokens; hyphenated token counts as one word; if `numberAllowed`, one numeric token is not counted as a word. Exceeding the limit = wrong even if it contains the answer.
- `multi` (Choose N): each correct letter = 1 mark, order irrelevant. UI prevents selecting more than N.
- `single` / `select` / `dragBank`: exact option letter match.

### Error classification (answer still marked wrong; used for feedback + analytics)
`blank` | `over-limit` (exceeds word limit) | `plural` (differs from an accepted answer only by trailing s/es) |
`spelling` (Damerau-Levenshtein ≤ 2 from an accepted answer, answer length ≥ 4) | `wrong`.

### Raw score → band (put in `src/exams/ielts/bands.ts`, comment "verify against ielts.org before release")
Listening: 39–40=9, 37–38=8.5, 35–36=8, 32–34=7.5, 30–31=7, 26–29=6.5, 23–25=6, 18–22=5.5, 16–17=5, 13–15=4.5, 10–12=4, 8–9=3.5, 6–7=3, 4–5=2.5, 2–3=2, 1=1, 0=0
Academic Reading: 39–40=9, 37–38=8.5, 35–36=8, 33–34=7.5, 30–32=7, 27–29=6.5, 23–26=6, 19–22=5.5, 15–18=5, 13–14=4.5, 10–12=4, 8–9=3.5, 6–7=3, 4–5=2.5, 2–3=2, 1=1, 0=0
General Reading (later): 40=9, 39=8.5, 37–38=8, 36=7.5, 34–35=7, 32–33=6.5, 30–31=6, 27–29=5.5, 23–26=5, 19–22=4.5, 15–18=4
Overall band rounding: mean of 4 skills; fractional part < .25 → down; .25–<.75 → .5; ≥ .75 → up to next whole.

## 5. Test modes
- **Exam mode** (always for mocks): Listening audio plays once, no seeking/pausing, parts advance automatically, 2-minute review time at the end, then auto-submit. Reading 60:00 countdown, auto-submit at 0. Answers hidden until submit.
- **Practice mode**: play/pause/seek/replay, optional timer, "Check answer" per question.
- Runner UI: split pane (passage | questions) on desktop, tabs on mobile; independent scroll; question navigator (1–40, answered/flagged state); flag for review; text highlighting + notes on passage; font size control; timer with warnings at 10 and 5 min.
- Answers autosave to IndexedDB every change; resume an in-progress attempt after refresh.

## 6. Results & analytics
- Results page: raw score, estimated band, per-section breakdown; every question shows user answer, correct answer(s), correct/incorrect, error class, evidence (quote highlighted in passage/transcript), explanation, and for listening a ▶ "Play answer location" button (seek to `audioStart - 3s`).
- "Something wrong with this question?" link (results page only) → prefilled GitHub issue URL with test id, question id, user answer.
- Dashboard: band history chart per skill + overall; accuracy by `qtype` across all attempts; error-class frequency; top 3 weaknesses with recommendations from `content/tips.yaml`; estimated current band (mean of latest result per skill; skills without data shown as "—").
- Export all data (JSON download) / import (validate with Zod, merge by id).

## 7. Planner (deterministic, no AI)
Inputs: exam date, target band, available hours/week. Uses latest bands + weakest qtypes.
Output: weekly plan until exam date: allocate hours proportionally to (target − current) per skill (min 1 session/skill/week), schedule a full mock every 2 weeks and in the final week, assign practice sets matching weak qtypes. Store in IndexedDB; tick sessions as done.

## 8. AI evaluation
### Worker API (base URL from `PUBLIC_WORKER_URL`)
All requests JSON unless noted; all require `turnstileToken`. CORS allowlist: https://ielts-launchpad.github.io, http://localhost:4321.
- `POST /v1/writing/evaluate` body `{ task: 1|2, prompt, chartSummary?, essay, turnstileToken }`
- `POST /v1/speaking/transcribe` multipart `{ audio (webm/opus ≤ 10 MB), turnstileToken }` → `{ text, words: [{ w, start, end }] }`
- `POST /v1/speaking/evaluate` body `{ part, questions, transcript, words, metrics, turnstileToken }`
- `GET /v1/health` → provider status
Response (writing): 
```json
{ "criteria": { "TA|TR": {"band": 6.5, "evidence": ["quote"], "feedback": "..."}, "CC": {...}, "LR": {...}, "GRA": {...} },
  "estimate": 6.5, "range": [6.0, 6.5], "errors": [{"quote": "...", "type": "grammar|vocabulary|cohesion|task", "fix": "..."}],
  "suggestions": ["..."], "provider": "groq", "model": "...", "remaining": { "writing": 2, "speaking": 3 } }
```
Speaking response: same shape with criteria FC, LR, GRA, P; `P.limited: true` when no audio-capable model was used.

### Worker rules
- Verify Turnstile server-side. Rate limit per (salted SHA-256 of IP + UTC date): 3 writing + 3 speaking evaluations/day (transcribe calls don't count separately). Return 429 with `{ code: "DAILY_LIMIT" }`.
- Reject essays > 1,200 words or < 20 words; audio > 10 MB.
- Store NOTHING (no content logging). Secrets: `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `TURNSTILE_SECRET`, `IP_SALT`.
- Providers are OpenAI-compatible: Groq `https://api.groq.com/openai/v1`, Cerebras `https://api.cerebras.ai/v1`. Model IDs in `worker/src/config.ts` (verify current IDs). Failover order: Groq → Cerebras. Whisper via Groq `/audio/transcriptions` with `response_format=verbose_json` and word timestamps.
- Scoring: code checks first (word count; under-length flag passed to the model), then 3 runs at temperature 0 with JSON-schema-constrained output; take the per-criterion median; validate with Zod; retry once on invalid JSON.
- Task band = mean of 4 criteria rounded down to nearest 0.5. Writing estimate for a full mock = (T1 + 2×T2)/3 rounded with the overall rule.
- `range` = [min, max] of the 3 runs' task bands, widened to at least 0.5 wide.
- Prompts: system prompt contains OUR OWN paraphrased rubric (never paste official band descriptor text), anchor examples loaded from `worker/src/anchors/*.json` (initially empty, add later), instruction to quote evidence for every score.
- Speaking metrics computed on the client and sent: words/min, mean pause > 0.5 s count, longest pause, filler count ("um", "uh", "er", "like", "you know"), type-token ratio, mean utterance length.

### Own-key mode (client-side, Settings page)
User may paste a Groq or Gemini API key (stored only in IndexedDB, never sent to our Worker). Then the browser calls the provider directly with the same prompts (shared prompt module in `src/ai/prompts.ts`, mirrored in worker). Gemini mode sends the audio for full Pronunciation scoring. Show warning: "Your key is stored only in this browser. Use a key with spending limits. Google requires users to be 18+." Fallback offered automatically when the Worker returns `DAILY_LIMIT` or is unavailable.

## 9. Pages
Home, Tests (list by skill/kind), Test runner (`/test/[id]/[skill]`), Results (`/results/[attemptId]`), Dashboard, Planner, Settings (own key, font size, export/import, delete all data), Official resources, How scoring works, About (disclaimer, AI-generated content notice, AI-generated audio notice), Privacy, Terms, Licences & credits, Support (Ko-fi + GitHub Sponsors), 404.
SEO: titles like "IELTS Launchpad — Free IELTS Academic Mock Tests with AI Feedback", meta descriptions, Open Graph, sitemap, robots.txt.

## 10. Non-functional
- WCAG 2.2 AA: keyboard-only operable, visible focus, labels, contrast, `prefers-reduced-motion`. axe must pass with zero serious/critical violations.
- Mobile-first; works on 360 px width.
- CSP via `<meta http-equiv="Content-Security-Policy">` allowing only self, Turnstile, the Worker URL, Groq/Gemini API hosts.
- No tracking, no cookies set by us.
- Production build excludes `status: draft` content; dev build shows it with a "DRAFT" badge.
