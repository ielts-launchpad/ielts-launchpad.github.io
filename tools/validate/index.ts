#!/usr/bin/env node
import { join } from 'node:path';
import { ContentError, findTestDirs, loadTest } from '../../src/engine/content/loader';
import { validateTest, type Problem } from '../../src/engine/content/validate';

/**
 * Content validation CLI (SPEC §3 rules 1–6). Validates every test (including
 * drafts) and exits non-zero with a readable report on any violation. Wired into
 * CI via `npm run validate`.
 */
function main(): number {
  const root = process.cwd();
  const contentDir = join(root, 'content');
  const publicDir = join(root, 'public');

  const dirs = findTestDirs(contentDir);
  const problems: Problem[] = [];

  for (const dir of dirs) {
    try {
      const test = loadTest(dir, publicDir);
      problems.push(...validateTest(test));
    } catch (error) {
      if (error instanceof ContentError) {
        problems.push({ file: error.file, rule: 1, message: error.message });
      } else {
        throw error;
      }
    }
  }

  if (problems.length === 0) {
    console.log(`validate: OK — ${dirs.length} test(s) checked, no problems.`);
    return 0;
  }

  console.error(`validate: ${problems.length} problem(s) found:`);
  for (const p of problems) {
    console.error(`  ✗ [rule ${p.rule}] ${p.file} — ${p.message}`);
  }
  return 1;
}

process.exit(main());
