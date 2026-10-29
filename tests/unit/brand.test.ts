import { describe, expect, it } from 'vitest';
import { brand } from '../../src/config/brand';

describe('brand config', () => {
  it('exposes the brand name', () => {
    expect(brand.name).toBe('IELTS Launchpad');
  });

  // The trademark disclaimer must match SPEC §0 verbatim.
  it('has the §0 disclaimer verbatim', () => {
    expect(brand.disclaimer).toBe(
      'IELTS is a registered trademark of the British Council, IDP: IELTS Australia and Cambridge University Press & Assessment. This site is not affiliated with, approved or endorsed by them.',
    );
  });

  it('has the §0 AI disclaimer verbatim', () => {
    expect(brand.aiDisclaimer).toBe(
      'AI estimate (beta), not an official IELTS score. For admissions, take the official test.',
    );
  });
});
