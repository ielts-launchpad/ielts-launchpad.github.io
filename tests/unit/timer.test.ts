import { describe, expect, it } from 'vitest';
import {
  READING_DURATION_SEC,
  WARNING_THRESHOLDS_SEC,
  dueWarnings,
  formatClock,
  isExpired,
  remainingSec,
} from '../../src/engine/runner/timer';

describe('timer constants', () => {
  it('uses a 60-minute reading section', () => {
    expect(READING_DURATION_SEC).toBe(3600);
  });

  it('warns at 10 and 5 minutes', () => {
    expect(WARNING_THRESHOLDS_SEC).toEqual([600, 300]);
  });
});

describe('remainingSec', () => {
  it('counts down from the full duration', () => {
    expect(remainingSec(0, 3600, 0)).toBe(3600);
    expect(remainingSec(0, 3600, 60_000)).toBe(3540);
  });

  it('never goes below zero', () => {
    expect(remainingSec(0, 3600, 4_000_000)).toBe(0);
  });
});

describe('dueWarnings', () => {
  it('fires the 10-minute warning as it is crossed', () => {
    expect(dueWarnings(601, 600)).toEqual([600]);
  });

  it('fires the 5-minute warning as it is crossed', () => {
    expect(dueWarnings(301, 300)).toEqual([300]);
  });

  it('fires nothing when no threshold is crossed', () => {
    expect(dueWarnings(900, 800)).toEqual([]);
  });

  it('can fire both thresholds on a large jump', () => {
    expect(dueWarnings(700, 200)).toEqual([600, 300]);
  });

  it('does not re-fire a threshold already passed', () => {
    expect(dueWarnings(599, 598)).toEqual([]);
  });
});

describe('isExpired', () => {
  it('is true at or below zero', () => {
    expect(isExpired(0)).toBe(true);
    expect(isExpired(-1)).toBe(true);
  });

  it('is false while time remains', () => {
    expect(isExpired(1)).toBe(false);
  });
});

describe('formatClock', () => {
  it('formats minutes and seconds with padding', () => {
    expect(formatClock(3600)).toBe('60:00');
    expect(formatClock(599)).toBe('09:59');
    expect(formatClock(5)).toBe('00:05');
  });

  it('clamps negatives to zero', () => {
    expect(formatClock(-10)).toBe('00:00');
  });
});
