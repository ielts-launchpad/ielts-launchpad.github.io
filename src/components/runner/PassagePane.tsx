import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { HighlightRecord } from '@/lib/storage/db';
import type { RunnerPassage } from '@/engine/runner/types';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';

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
  onUpdateNote: (id: string, note: string) => void;
}

/** Character offset of (node, offset) within a paragraph text container. */
function offsetWithin(container: HTMLElement, node: Node, nodeOffset: number): number {
  const prefix = document.createRange();
  prefix.selectNodeContents(container);
  prefix.setEnd(node, nodeOffset);
  return prefix.toString().length;
}

function paragraphFor(node: Node): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLElement>('[data-paragraph]') ?? null;
}

/** Reading passage pane with text highlighting and notes (SPEC §5). */
export function PassagePane({
  passages,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
  onUpdateNote,
}: PassagePaneProps): React.JSX.Element {
  const [hint, setHint] = useState('');
  const highlightButton = useRef<HTMLButtonElement>(null);

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
    const startPara = paragraphFor(range.startContainer);
    const endPara = paragraphFor(range.endContainer);
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
          ref={highlightButton}
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
                )}
              </span>
            </p>
          ))}
        </article>
      ))}
      {highlights.length > 0 && (
        <section aria-label={t.highlightsHeading} className="mt-4">
          <h3 className="font-semibold text-slate-900">{t.highlightsHeading}</h3>
          <ul className="space-y-3">
            {highlights.map((highlight) => (
              <HighlightNote
                key={highlight.id}
                highlight={highlight}
                onUpdateNote={onUpdateNote}
                onRemove={() => {
                  onRemoveHighlight(highlight.id);
                  highlightButton.current?.focus();
                }}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function HighlightNote({ highlight, onUpdateNote, onRemove }: {
  highlight: HighlightRecord;
  onUpdateNote: (id: string, note: string) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(highlight.note);
  const id = useId();
  const editor = useRef<HTMLTextAreaElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (editing) editor.current?.focus();
  }, [editing]);

  const closeEditor = (): void => {
    setEditing(false);
    action.current?.focus();
  };

  return (
    <li className="rounded border border-slate-300 p-3 text-slate-900" data-testid="highlight-note">
      <p>{format(t.highlightLabel, { quote: highlight.quote })}</p>
      {highlight.note && <p className="mt-2 whitespace-pre-wrap break-words" data-testid="note-text">{highlight.note}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button ref={action} type="button" className="rounded border border-slate-400 px-2 py-1" onClick={() => {
          setNote(highlight.note);
          setEditing(true);
        }}>{highlight.note ? t.editNote : t.addNote}</button>
        {highlight.note && <button type="button" className="rounded border border-slate-400 px-2 py-1" onClick={() => {
          onUpdateNote(highlight.id, '');
          setNote('');
          closeEditor();
        }}>{t.deleteNote}</button>}
        <button type="button" className="rounded border border-slate-400 px-2 py-1" onClick={onRemove}>{t.removeHighlight}</button>
      </div>
      {editing && (
        <form className="mt-3" onSubmit={(event) => {
          event.preventDefault();
          onUpdateNote(highlight.id, note);
          closeEditor();
        }} onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeEditor();
          }
        }}>
          <label htmlFor={id} className="block">{t.noteLabel}</label>
          <textarea ref={editor} id={id} value={note} onChange={(event) => setNote(event.target.value)} className="w-full rounded border border-slate-400 p-2" />
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-white">{t.saveNote}</button>
            <button type="button" className="rounded border border-slate-400 px-3 py-1" onClick={closeEditor}>{t.cancelNote}</button>
          </div>
        </form>
      )}
    </li>
  );
}

function renderParagraph(
  text: string,
  highlights: HighlightRecord[],
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
        <mark
          key={`h${h.id}`}
          className="rounded bg-yellow-200 text-slate-900"
          data-testid={`highlight-${h.id}`}
        >
          {text.slice(start, end)}
        </mark>,
      );
    }
    cursor = Math.max(cursor, end);
  });
  if (cursor < text.length) nodes.push(<span key="tend">{text.slice(cursor)}</span>);
  return nodes;
}
