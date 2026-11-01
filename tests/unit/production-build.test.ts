import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('unflagged production build contains no sample-01 or mock-fixture route', () => {
  const output = mkdtempSync(join(tmpdir(), 'ielts-production-'));
  const env = { ...process.env };
  delete env.INCLUDE_DRAFTS;
  // Vitest injects Vite's DEV/PROD flags into process.env; the child must use
  // Astro's own production flags, not inherit the parent test runner's mode.
  delete env.DEV;
  delete env.PROD;
  delete env.MODE;
  env.NODE_ENV = 'production';
  try {
    const build = spawnSync(process.execPath, [
      join(process.cwd(), 'node_modules/astro/astro.js'), 'build', '--outDir', output,
    ], { env, encoding: 'utf8', timeout: 120_000 });
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
    expect(existsSync(join(output, 'index.html'))).toBe(true);
    expect(existsSync(join(output, 'test/sample-01'))).toBe(false);
    expect(existsSync(join(output, 'test/mock-fixture'))).toBe(false);
    expect(existsSync(join(output, 'test/mock-listening-fixture'))).toBe(false);
    expect(existsSync(join(output, 'results/index.html'))).toBe(true);
    expect(existsSync(join(output, 'practice/sample-01'))).toBe(false);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}, 150_000);