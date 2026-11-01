import type { LoadedTest } from './loader';
import type { Meta, Skill } from './schema';

export type CatalogKind = Meta['kind'];
export interface CatalogSkill {
  skill: Skill;
  href: string | null;
}
export interface CatalogCard {
  id: string;
  title: string;
  kind: CatalogKind;
  isDraft: boolean;
  skills: CatalogSkill[];
}
export interface CatalogFilters {
  skill: Skill | 'all';
  kind: CatalogKind | 'all';
}

/** Mirror the runner routes' build-time policy, including the explicit fixture flag. */
export function catalogIncludesDrafts(dev: boolean, fixtureFlag: string | undefined): boolean {
  return dev || fixtureFlag === 'true';
}

/** Only implemented runners with loaded content can have a navigation target. */
export function catalogRunnerHref(test: LoadedTest, skill: Skill): string | null {
  if (skill === 'reading' && test.reading.length > 0) {
    return `/test/${encodeURIComponent(test.meta.id)}/reading`;
  }
  if (skill === 'listening' && test.listening.length > 0) {
    return `/test/${encodeURIComponent(test.meta.id)}/listening`;
  }
  return null;
}

/** Explicit allowlist: no answers, transcripts, passage text or filesystem paths. */
export function buildCatalogCards(tests: readonly LoadedTest[], includeDrafts: boolean): CatalogCard[] {
  return tests
    .filter((test) => includeDrafts || test.meta.status !== 'draft')
    .map((test) => ({
      id: test.meta.id,
      title: test.meta.title,
      kind: test.meta.kind,
      isDraft: test.meta.status === 'draft',
      skills: test.meta.skills.map((skill) => ({ skill, href: catalogRunnerHref(test, skill) })),
    }));
}

/** AND filters preserve loader order and do not mutate cards or their skills. */
export function filterCatalogCards(cards: readonly CatalogCard[], filters: CatalogFilters): CatalogCard[] {
  return cards.filter((card) =>
    (filters.kind === 'all' || card.kind === filters.kind) &&
    (filters.skill === 'all' || card.skills.some(({ skill }) => skill === filters.skill)),
  );
}