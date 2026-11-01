import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { ContentError } from './loader';
import { tipsSchema, type PracticeTip } from '../analytics/tips';

export function loadTips(file: string): PracticeTip[] {
  try {
    const input: unknown = parse(readFileSync(file, 'utf8'));
    return tipsSchema.parse(input);
  } catch (error) {
    throw new ContentError(file, `Invalid practice tips: ${error instanceof Error ? error.message : String(error)}`);
  }
}