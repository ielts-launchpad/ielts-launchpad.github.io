#!/usr/bin/env node
// @ts-check
/**
 * create-issues.mjs — create GitHub labels, milestones, and issues from docs/PLAN.md.
 *
 * Reads the machine-readable `<!-- meta: ... -->` comments in docs/PLAN.md and drives the
 * GitHub CLI (`gh`). Idempotent: it skips any label / milestone / issue that already exists
 * (matched by name or exact title), so re-running never creates duplicates.
 *
 * Usage:
 *   node tools/github/create-issues.mjs --dry-run   # print planned actions, create nothing
 *   node tools/github/create-issues.mjs             # perform the changes
 *
 * Execution order (per approved plan):
 *   1. labels: code, manual, content, later
 *   2. milestones: M0..M8
 *   3. issues (dependency order from PLAN.md) with label + milestone + body (+ assignee)
 *   4. second pass: backfill "Depends on #N" into issue bodies
 *   5. one tracking issue per milestone with a task list of its child issues
 *
 * Requirements: `gh` installed and authenticated (`gh auth status`).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = resolve(__dirname, '../../docs/PLAN.md');

const LABELS = [
  { name: 'code', color: '1f6feb', description: 'Implementable by Copilot/coding agent' },
  { name: 'manual', color: 'd4a72c', description: 'Maintainer task: accounts, keys, deploy' },
  { name: 'content', color: '8250df', description: 'Maintainer task: authoring test content' },
  { name: 'later', color: '6e7781', description: 'Deferred until explicitly scheduled' },
];

const MILESTONES = [
  { title: 'M0', description: 'Bootstrap: scaffold, tooling, CI/CD, layout, legal' },
  { title: 'M1', description: 'Content schema & validator' },
  { title: 'M2', description: 'Grading engine' },
  { title: 'M3', description: 'Reading runner' },
  { title: 'M4', description: 'Listening runner & Results' },
  { title: 'M5', description: 'Dashboard & data' },
  { title: 'M6', description: 'Worker & Writing/Speaking' },
  { title: 'M7', description: 'Content tools' },
  { title: 'M8', description: 'Planner, static pages & release' },
];

const ISSUE_TITLE_PREFIX = 'IELTS:'; // namespacing so idempotent title matching is unambiguous

// ---------------------------------------------------------------------------
// gh helpers
// ---------------------------------------------------------------------------

/** Run `gh` and return stdout (trimmed). Throws on non-zero exit. */
function gh(args, { input } = {}) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

/** Run a read-only `gh` query; always executes (safe in dry-run). */
function ghQuery(args) {
  try {
    return gh(args);
  } catch (err) {
    const msg = err?.stderr?.toString?.() || err?.message || String(err);
    throw new Error(`gh ${args.join(' ')} failed: ${msg}`);
  }
}

/** Run a mutating `gh` command, or just log it when --dry-run. */
function ghMutate(label, args, { input } = {}) {
  if (DRY_RUN) {
    console.log(`  [dry-run] ${label}`);
    return '';
  }
  const out = gh(args, { input });
  console.log(`  [done] ${label}`);
  return out;
}

function getRepo() {
  const nameWithOwner = ghQuery(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
  const [owner, name] = nameWithOwner.split('/');
  return { owner, name, nameWithOwner };
}

// ---------------------------------------------------------------------------
// PLAN.md parsing
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ParsedIssue
 * @property {string} id
 * @property {string} title
 * @property {string} label
 * @property {string} milestone
 * @property {string[]} depends
 * @property {string} assignee
 * @property {string} body
 */

/** @returns {ParsedIssue[]} */
function parsePlan() {
  const md = readFileSync(PLAN_PATH, 'utf8');
  const lines = md.split(/\r?\n/);
  /** @type {ParsedIssue[]} */
  const issues = [];

  // Find each "### <ID> <Title>" heading followed (soon) by a meta comment.
  for (let i = 0; i < lines.length; i++) {
    const headingMatch = /^###\s+([A-Z0-9.]+)\s+(.*\S)\s*$/.exec(lines[i]);
    if (!headingMatch) continue;

    // Collect the section until the next "### " or "## " or EOF.
    let j = i + 1;
    const sectionLines = [];
    for (; j < lines.length; j++) {
      if (/^##\s/.test(lines[j]) || /^###\s/.test(lines[j])) break;
      sectionLines.push(lines[j]);
    }

    const section = sectionLines.join('\n');
    const meta = /<!--\s*meta:\s*(.*?)\s*-->/s.exec(section);
    if (!meta) {
      i = j - 1;
      continue; // not an issue section
    }

    const metaFields = Object.fromEntries(
      meta[1]
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const idx = p.indexOf('=');
          return [p.slice(0, idx).trim(), p.slice(idx + 1).trim()];
        }),
    );

    const titleFromMeta = headingMatch[2];
    const body = section
      .replace(/<!--\s*meta:.*?-->/s, '')
      .trim();

    issues.push({
      id: metaFields.id || headingMatch[1],
      title: titleFromMeta,
      label: metaFields.label || '',
      milestone: metaFields.milestone || '',
      depends: (metaFields.depends || '')
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      assignee: metaFields.assignee || '',
      body,
    });

    i = j - 1;
  }

  return issues;
}

/** Build the full GitHub issue title for an issue id/title. */
function issueTitle(issue) {
  return `${ISSUE_TITLE_PREFIX} ${issue.id} ${issue.title}`;
}

/** Build the issue body (base content + resolved dependency block). */
function buildBody(issue, idToNumber) {
  const parts = [issue.body];
  if (issue.depends.length) {
    const refs = issue.depends.map((depId) => {
      const num = idToNumber.get(depId);
      return num ? `#${num} (${depId})` : depId;
    });
    parts.push('---', `**Depends on:** ${refs.join(', ')}`);
  } else {
    parts.push('---', '**Depends on:** none');
  }
  parts.push(`\n<sub>Generated from \`docs/PLAN.md\` · id \`${issue.id}\`</sub>`);
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Idempotent ensure-* operations
// ---------------------------------------------------------------------------

function ensureLabels() {
  console.log('\n== Labels ==');
  const existing = new Set(
    JSON.parse(ghQuery(['label', 'list', '--json', 'name']) || '[]').map((l) => l.name),
  );
  for (const label of LABELS) {
    if (existing.has(label.name)) {
      console.log(`  [skip] label "${label.name}" exists`);
      continue;
    }
    ghMutate(`create label "${label.name}"`, [
      'label', 'create', label.name,
      '--color', label.color,
      '--description', label.description,
    ]);
  }
}

function ensureMilestones(repo) {
  console.log('\n== Milestones ==');
  const existing = JSON.parse(
    ghQuery(['api', `repos/${repo.nameWithOwner}/milestones`, '--paginate', '-q', '.']) || '[]',
  );
  const existingTitles = new Set(existing.map((m) => m.title));
  /** @type {Map<string, number>} */
  const titleToNumber = new Map(existing.map((m) => [m.title, m.number]));

  for (const ms of MILESTONES) {
    if (existingTitles.has(ms.title)) {
      console.log(`  [skip] milestone "${ms.title}" exists (#${titleToNumber.get(ms.title)})`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] create milestone "${ms.title}"`);
      continue;
    }
    const created = JSON.parse(
      gh([
        'api', '--method', 'POST', `repos/${repo.nameWithOwner}/milestones`,
        '-f', `title=${ms.title}`,
        '-f', `description=${ms.description}`,
      ]),
    );
    titleToNumber.set(ms.title, created.number);
    console.log(`  [done] create milestone "${ms.title}" (#${created.number})`);
  }
  return titleToNumber;
}

/** Fetch all existing issues (open+closed) as a title→number map. */
function fetchExistingIssues() {
  const list = JSON.parse(
    ghQuery(['issue', 'list', '--state', 'all', '--limit', '1000', '--json', 'number,title']) || '[]',
  );
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const it of list) map.set(it.title, it.number);
  return map;
}

function ensureIssues(issues, titleToNumber) {
  console.log('\n== Issues (create pass) ==');
  const existingByTitle = fetchExistingIssues();
  /** @type {Map<string, number>} */
  const idToNumber = new Map();

  for (const issue of issues) {
    const title = issueTitle(issue);
    const existing = existingByTitle.get(title);
    if (existing) {
      idToNumber.set(issue.id, existing);
      console.log(`  [skip] issue "${title}" exists (#${existing})`);
      continue;
    }

    const args = ['issue', 'create', '--title', title, '--body', issue.body];
    if (issue.label) args.push('--label', issue.label);
    if (issue.milestone && titleToNumber.has(issue.milestone)) {
      args.push('--milestone', issue.milestone);
    }
    if (issue.assignee) args.push('--assignee', issue.assignee);

    if (DRY_RUN) {
      const bits = [
        `label=${issue.label || '-'}`,
        `milestone=${issue.milestone || '-'}`,
        `assignee=${issue.assignee || '-'}`,
        `depends=[${issue.depends.join(',') || '-'}]`,
      ];
      console.log(`  [dry-run] create issue "${title}"  (${bits.join(' ')})`);
      idToNumber.set(issue.id, /* placeholder */ 0);
      continue;
    }

    const url = gh(args);
    const num = Number(url.split('/').pop());
    idToNumber.set(issue.id, num);
    console.log(`  [done] create issue "${title}" (#${num})`);
  }

  return idToNumber;
}

function backfillDependencies(issues, idToNumber) {
  console.log('\n== Issues (dependency backfill pass) ==');
  for (const issue of issues) {
    const num = idToNumber.get(issue.id);
    const body = buildBody(issue, idToNumber);
    if (DRY_RUN) {
      const refs = issue.depends.length
        ? issue.depends.map((d) => `${d}→#${idToNumber.get(d) ?? '?'}`).join(', ')
        : 'none';
      console.log(`  [dry-run] set body for "${issue.id}" (depends on: ${refs})`);
      continue;
    }
    if (!num) {
      console.log(`  [warn] no issue number for ${issue.id}; skipping backfill`);
      continue;
    }
    ghMutate(`update body for #${num} (${issue.id})`, [
      'issue', 'edit', String(num), '--body', body,
    ]);
  }
}

function ensureTrackingIssues(issues, titleToNumber, idToNumber) {
  console.log('\n== Milestone tracking issues ==');
  const existingByTitle = fetchExistingIssues();

  for (const ms of MILESTONES) {
    const children = issues.filter((it) => it.milestone === ms.title);
    if (!children.length) continue;

    const title = `${ISSUE_TITLE_PREFIX} ${ms.title} tracking — ${ms.description}`;
    const taskList = children
      .map((c) => {
        const num = idToNumber.get(c.id);
        const ref = num ? `#${num}` : `${c.id}`;
        return `- [ ] ${ref} ${c.id} ${c.title} \`${c.label}\``;
      })
      .join('\n');
    const body = `Tracking issue for milestone **${ms.title}** (${ms.description}).\n\n${taskList}\n\n<sub>Generated from \`docs/PLAN.md\`</sub>`;

    const existing = existingByTitle.get(title);
    if (existing) {
      ghMutate(`update tracking issue "${ms.title}" (#${existing})`, [
        'issue', 'edit', String(existing), '--body', body,
      ]);
      continue;
    }

    const args = ['issue', 'create', '--title', title, '--body', body];
    if (titleToNumber.has(ms.title)) args.push('--milestone', ms.title);

    if (DRY_RUN) {
      console.log(`  [dry-run] create tracking issue "${title}" with ${children.length} items`);
      continue;
    }
    const url = gh(args);
    console.log(`  [done] create tracking issue "${title}" (#${url.split('/').pop()})`);
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  console.log(`create-issues.mjs ${DRY_RUN ? '(DRY RUN — no changes will be made)' : '(LIVE)'}`);

  // Preflight: gh auth + repo.
  try {
    ghQuery(['auth', 'status']);
  } catch {
    console.error('ERROR: `gh` is not authenticated. Run `gh auth login` first.');
    process.exit(1);
  }
  const repo = getRepo();
  console.log(`Target repository: ${repo.nameWithOwner}`);

  const issues = parsePlan();
  console.log(`Parsed ${issues.length} issues from docs/PLAN.md`);

  ensureLabels();
  const titleToNumber = ensureMilestones(repo);
  const idToNumber = ensureIssues(issues, titleToNumber);
  backfillDependencies(issues, idToNumber);
  ensureTrackingIssues(issues, titleToNumber, idToNumber);

  console.log(`\nDone.${DRY_RUN ? ' (dry run — nothing was created)' : ''}`);
}

main();
