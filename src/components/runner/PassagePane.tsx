import { useMemo, useState } from 'react';
import type { HighlightRecord } from '@/lib/storage/db';
import type { RunnerPassage } from '@/engine/runner/types';
import { en } from '@/i18n/en';

const t = en.runner.passage;

interface PassagePaneProps {
  passages: RunnerPassage[];
  highlights: HighlightRecord[];
  onAddHighlight: (
    passage: number,
    paragraphIndex: number,
    start: number,
    end: number,
    quote: string,
  ) => void;
  onRemoveHighlight: (id: string) => void;
}

/** Character offset of (node, offset) within a paragraph text container. */
function offsetWithin(container: HTMLElement, node: Node, nodeOffset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + nodeOffset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total;
}

/** Reading passage pane with text highlighting and notes (SPEC §5). */
export function PassagePane({
  passages,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
}: PassagePaneProps): React.JSX.Element {
  const [hint, setHint] = useState('');

  const byParagraph = useMemo(() => {
    const map = new Map<string, HighlightRecord[]>();
    for (const h of highlights) {
      const key = `${h.passage}:${h.paragraphIndex}`;
      const list = map.get(key) ?? [];
      list.push(h);
      map.set(key, list);
    }
    return map;
  }, [highlights]);

  const handleHighlight = (): void => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setHint(t.selectPrompt);
      return;
    }
    const range = selection.getRangeAt(0);
    const startPara = (range.startContainer.parentElement ?? null)?.closest<HTMLElement>(
      '[data-paragraph]',
    );
    const endPara = (range.endContainer.parentElement ?? null)?.closest<HTMLElement>(
      '[data-paragraph]',
    );
    if (!startPara || startPara !== endPara) {
      setHint(t.selectPrompt);
      return;
    }
    const start = offsetWithin(startPara, range.startContainer, range.startOffset);
    const end = offsetWithin(startPara, range.endContainer, range.endOffset);
    const quote = range.toString();
    if (end <= start || quote.trim() === '') {
      setHint(t.selectPrompt);
      return;
    }
    onAddHighlight(
      Number(startPara.dataset.passage),
      Number(startPara.dataset.paragraph),
      start,
      end,
      quote,
    );
    setHint('');
    selection.removeAllRanges();
  };

  return (
    <div data-testid="passage-pane">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleHighlight}
          className="rounded bg-yellow-200 px-3 py-1 text-sm text-yellow-900"
          data-testid="highlight-button"
        >
          {t.highlight}
        </button>
        <span role="status" aria-live="polite" className="text-xs text-slate-600">
          {hint}
        </span>
      </div>

      {passages.map((passage) => (
        <article key={passage.passage} className="mb-6">
          <h3 className="mb-2 text-lg font-semibold text-slate-900">{passage.title}</h3>
          {passage.paragraphs.map((paragraph, index) => (
            <p key={index} className="mb-3 leading-7 text-slate-800">
              {paragraph.label && <span className="mr-2 font-semibold">{paragraph.label}</span>}
              <span
                data-paragraph={index}
                data-passage={passage.passage}
                data-testid={`paragraph-${passage.passage}-${index}`}
              >
                {renderParagraph(
                  paragraph.text,
                  byParagraph.get(`${passage.passage}:${index}`) ?? [],
                  onRemoveHighlight,
                )}
              </span>
            </p>
          ))}
        </article>
      ))}
    </div>
  );
}

function renderParagraph(
  text: string,
  highlights: HighlightRecord[],
  onRemoveHighlight: (id: string) => void,
): React.ReactNode {
  if (highlights.length === 0) return text;
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((h, i) => {
    const start = Math.max(cursor, h.start);
    const end = Math.min(text.length, h.end);
    if (start > cursor) nodes.push(<span key={`t${i}`}>{text.slice(cursor, start)}</span>);
    if (end > start) {
      nodes.push(
        <button
          key={`h${h.id}`}
          type="button"
          onClick={() => onRemoveHighlight(h.id)}
          aria-label={en.runner.passage.removeHighlight}
          className="rounded bg-yellow-200 text-yellow-900"
          data-testid={`highlight-${h.id}`}
        >
          {text.slice(start, end)}
        </button>,
      );
    }
    cursor = Math.max(cursor, end);
  });
  if (cursor < text.length) nodes.push(<span key="tend">{text.slice(cursor)}</span>);
  return nodes;
}
