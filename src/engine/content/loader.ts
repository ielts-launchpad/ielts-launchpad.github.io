import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import {
  listeningPartSchema,
  metaSchema,
  readingPassageSchema,
  speakingSchema,
  writingTaskSchema,
  type ListeningPart,
  type Meta,
  type ReadingPassage,
  type Speaking,
  type WritingTask,
} from './schema';

/**
 * Build-time content loader (SPEC §3, §10). Parses YAML + Markdown into typed
 * objects, resolves transcript/passage/audio/image paths, and filters
 * `status: draft` content out of production builds. This runs in Node (Astro
 * build step / validator CLI), never in the browser.
 */

export interface LoaderOptions {
  /** Absolute path to the content root (e.g. `<root>/content`). */
  contentDir: string;
  /** Absolute path to the public dir (e.g. `<root>/public`) for audio lookup. */
  publicDir: string;
  /** Include `status: draft` tests. False in production builds. */
  includeDrafts: boolean;
}

export interface LoadedListeningPart {
  part: ListeningPart;
  /** Resolved transcript markdown text. */
  transcriptText: string;
  /** Filesystem path the audio should exist at. */
  audioFsPath: string;
}

export interface LoadedReadingPassage {
  passage: ReadingPassage;
  /** Resolved passage markdown text. */
  markdownText: string;
}

export interface LoadedTest {
  meta: Meta;
  /** Absolute path to the test folder. */
  dir: string;
  isDraft: boolean;
  listening: LoadedListeningPart[];
  reading: LoadedReadingPassage[];
  writing: WritingTask[];
  speaking: Speaking | null;
}

/** A content error with the offending file for a readable report. */
export class ContentError extends Error {
  constructor(
    public readonly file: string,
    message: string,
  ) {
    super(`${file}: ${message}`);
    this.name = 'ContentError';
  }
}

function parseFile<S extends z.ZodTypeAny>(schema: S, file: string): z.infer<S> {
  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ContentError(file, `invalid YAML (${(error as Error).message})`);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new ContentError(file, `schema validation failed:\n${details}`);
  }
  return result.data;
}

function readMarkdown(file: string): string {
  if (!existsSync(file)) {
    throw new ContentError(file, 'referenced markdown file does not exist');
  }
  return readFileSync(file, 'utf8');
}

function listYamlFiles(dir: string, prefix: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.yaml'))
    .sort()
    .map((name) => join(dir, name));
}

/** Map a public `/audio/...` URL to its filesystem path under `publicDir`. */
export function resolvePublicPath(publicDir: string, url: string): string {
  const clean = url.replace(/^\//, '');
  return join(publicDir, clean);
}

/** Recursively find every directory containing a `meta.yaml`. */
export function findTestDirs(contentDir: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir);
    if (entries.includes('meta.yaml')) {
      found.push(dir);
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
    }
  };
  walk(contentDir);
  return found.sort();
}

/** Load and validate a single test folder into typed objects. */
export function loadTest(testDir: string, publicDir: string): LoadedTest {
  const meta = parseFile(metaSchema, join(testDir, 'meta.yaml'));

  const listeningDir = join(testDir, 'listening');
  const listening: LoadedListeningPart[] = listYamlFiles(listeningDir, 'part-').map((file) => {
    const part = parseFile(listeningPartSchema, file);
    return {
      part,
      transcriptText: readMarkdown(join(listeningDir, part.transcript)),
      audioFsPath: resolvePublicPath(publicDir, part.audio),
    };
  });

  const readingDir = join(testDir, 'reading');
  const reading: LoadedReadingPassage[] = listYamlFiles(readingDir, 'passage-').map((file) => {
    const passage = parseFile(readingPassageSchema, file);
    return {
      passage,
      markdownText: readMarkdown(join(readingDir, passage.file)),
    };
  });

  const writingDir = join(testDir, 'writing');
  const writing: WritingTask[] = listYamlFiles(writingDir, 'task-').map((file) =>
    parseFile(writingTaskSchema, file),
  );

  const speakingFile = join(testDir, 'speaking', 'speaking.yaml');
  const speaking: Speaking | null = existsSync(speakingFile)
    ? parseFile(speakingSchema, speakingFile)
    : null;

  return {
    meta,
    dir: testDir,
    isDraft: meta.status === 'draft',
    listening,
    reading,
    writing,
    speaking,
  };
}

/** Load every test, excluding drafts unless `includeDrafts` is set. */
export function loadAllTests(options: LoaderOptions): LoadedTest[] {
  return findTestDirs(options.contentDir)
    .map((dir) => loadTest(dir, options.publicDir))
    .filter((test) => options.includeDrafts || !test.isDraft);
}
