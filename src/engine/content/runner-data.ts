/**
 * Build-time transform from a loaded test into the serialisable data the
 * client-side Reading runner consumes (SPEC §5). Runs in Node (Astro build),
 * never in the browser. Passage markdown is split into labelled paragraphs so
 * the runner can render selectable prose without a markdown dependency.
 */
import type { LoadedTest } from './loader';
import { READING_DURATION_SEC } from '../runner/timer';
import type { ReadingRunnerData, RunnerParagraph, RunnerPassage } from '../runner/types';

/** `[A] Some prose…` → `{ label: 'A', text: 'Some prose…' }`. */
export function parsePassageParagraphs(markdown: string): RunnerParagraph[] {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const match = /^\[([^\]]+)\]\s*([\s\S]*)$/.exec(block);
      if (match) {
        return { label: match[1], text: match[2].replace(/\s+/g, ' ').trim() };
      }
      return { label: null, text: block.replace(/\s+/g, ' ').trim() };
    });
}

/** Prepare every reading passage of a test for the runner island. */
export function buildReadingRunnerData(test: LoadedTest): ReadingRunnerData {
  const passages: RunnerPassage[] = test.reading
    .slice()
    .sort((a, b) => a.passage.passage - b.passage.passage)
    .map((loaded) => ({
      passage: loaded.passage.passage,
      title: loaded.passage.title,
      paragraphs: parsePassageParagraphs(loaded.markdownText),
      groups: loaded.passage.groups,
    }));

  return {
    testId: test.meta.id,
    testTitle: test.meta.title,
    kind: test.meta.kind,
    isDraft: test.isDraft,
    durationSec: READING_DURATION_SEC,
    passages,
  };
}
