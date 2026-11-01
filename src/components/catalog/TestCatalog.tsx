import { useState } from 'react';
import {
  filterCatalogCards,
  type CatalogCard,
  type CatalogFilters,
} from '../../engine/content/catalog';
import { en } from '../../i18n/en';
import { format } from '../../i18n/format';

export interface TestCatalogProps {
  cards: CatalogCard[];
  includeDrafts: boolean;
}

export function TestCatalog({ cards, includeDrafts }: TestCatalogProps) {
  const [filters, setFilters] = useState<CatalogFilters>({ skill: 'all', kind: 'all' });
  const visible = filterCatalogCards(cards, filters);
  const controlClass = 'mt-2 w-full rounded-lg border border-slate-500 bg-white p-3 text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';

  return (
    <section className="mt-8" aria-label={en.catalog.listLabel} data-testid="test-catalog">
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <label htmlFor="catalog-skill" className="font-semibold">{en.catalog.skill}</label>
          <select
            id="catalog-skill"
            className={controlClass}
            value={filters.skill}
            onChange={(event) => {
              const skill = event.currentTarget.value;
              if (skill === 'all' || skill === 'reading' || skill === 'listening' || skill === 'writing' || skill === 'speaking') {
                setFilters((current) => ({ ...current, skill }));
              }
            }}
          >
            <option value="all">{en.catalog.allSkills}</option>
            {Object.entries(en.catalog.skills).map(([skill, label]) => (
              <option key={skill} value={skill}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="catalog-kind" className="font-semibold">{en.catalog.kind}</label>
          <select
            id="catalog-kind"
            className={controlClass}
            value={filters.kind}
            onChange={(event) => {
              const kind = event.currentTarget.value;
              if (kind === 'all' || kind === 'mock' || kind === 'practice') {
                setFilters((current) => ({ ...current, kind }));
              }
            }}
          >
            <option value="all">{en.catalog.allKinds}</option>
            {Object.entries(en.catalog.kinds).map(([kind, label]) => (
              <option key={kind} value={kind}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-4 text-slate-700" role="status" data-testid="catalog-count">
        {format(en.catalog.count, { n: visible.length })}
      </p>
      {visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-200 p-6" data-testid="catalog-empty">
          {!includeDrafts && cards.length === 0 ? en.catalog.emptyPublished : en.catalog.empty}
        </p>
      ) : (
        <ul className="mt-4 grid list-none gap-4 p-0" aria-label={en.catalog.listLabel}>
          {visible.map((card) => (
            <li key={card.id}>
              <article className="rounded-xl border border-slate-300 p-5" aria-labelledby={`catalog-title-${card.id}`} data-testid="catalog-card">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 id={`catalog-title-${card.id}`} className="text-xl font-bold">{card.title}</h2>
                  {includeDrafts && card.isDraft && (
                    <span className="rounded bg-amber-100 px-2 py-1 text-sm font-bold text-amber-950" data-testid="catalog-draft">
                      {en.common.draftBadge}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-slate-700">{en.catalog.kinds[card.kind]}</p>
                <ul className="mt-4 flex list-none flex-wrap gap-3 p-0">
                  {card.skills.filter(({ skill }) => filters.skill === 'all' || skill === filters.skill).map(({ skill, href }) => (
                    <li key={skill}>
                      {href ? (
                        <a className="inline-block rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900" href={href}>
                          {format(en.catalog.open, { skill: en.catalog.skills[skill] })}
                        </a>
                      ) : (
                        <p className="rounded-lg bg-slate-100 px-4 py-3 text-slate-700">
                          {format(en.catalog.comingSoon, { skill: en.catalog.skills[skill] })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}