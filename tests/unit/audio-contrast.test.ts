import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'src/components/runner/AudioPlayer.css'), 'utf8');
function color(name: string): string {
  const value = new RegExp(`--audio-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1];
  if (!value) throw new Error(`Missing player color: ${name}`);
  return value;
}
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first: string, second: string): number {
  const values = [luminance(color(first)), luminance(color(second))];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe('shared audio control contrast', () => {
  it.each([['played', 'unplayed'], ['played', 'surface'], ['border', 'surface'],
    ['border', 'unplayed'], ['thumb', 'played'], ['focus', 'surface']] as const)(
    '%s vs %s meets WCAG 1.4.11 (including the light track boundary)', (first, second) => {
      expect(contrast(first, second)).toBeGreaterThanOrEqual(3);
    },
  );

  it('styles native Chromium/Firefox tracks, progress, thumbs, and visible focus', () => {
    for (const selector of ['::-webkit-slider-runnable-track', '::-webkit-slider-thumb',
      '::-moz-range-track', '::-moz-range-progress', '::-moz-range-thumb', ':focus-visible']) {
      expect(css).toContain(selector);
    }
    expect(css).toContain('outline: 3px solid var(--audio-focus)');
    expect(css).toContain('border: 1px solid var(--audio-border)');
  });
});