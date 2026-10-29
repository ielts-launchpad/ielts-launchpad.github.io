/**
 * Brand constants — the single source of brand values for the whole app.
 * UI components must read brand strings from here (never hard-code them).
 * Implements SPEC §0.
 */
export const brand = {
  name: 'IELTS Launchpad',
  tagline: 'Free, open-source IELTS Academic practice with AI feedback',
  url: 'https://ielts-launchpad.github.io',
  repoUrl: 'https://github.com/ielts-launchpad/ielts-launchpad.github.io',

  /** Donation / support links shown in the footer and on the Support page. */
  donate: {
    koFi: 'https://ko-fi.com/ieltslaunchpad',
    githubSponsors: 'https://github.com/sponsors/ielts-launchpad',
  },

  /** Licence identifiers (SPDX). Full texts live in LICENSE / LICENSE-CONTENT. */
  licences: {
    code: 'AGPL-3.0-or-later',
    content: 'CC-BY-SA-4.0',
  },

  /**
   * Trademark disclaimer — shown in the footer of every page and on the About
   * page. Must match SPEC §0 verbatim.
   */
  disclaimer:
    'IELTS is a registered trademark of the British Council, IDP: IELTS Australia and Cambridge University Press & Assessment. This site is not affiliated with, approved or endorsed by them.',

  /** Shown near every AI result. Must match SPEC §0 verbatim. */
  aiDisclaimer:
    'AI estimate (beta), not an official IELTS score. For admissions, take the official test.',
} as const;

export type Brand = typeof brand;
