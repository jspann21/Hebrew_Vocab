import { useEffect, useMemo } from 'react';
import { highlightForms } from '../features/occurrences/highlight';
import type { BookArtifact, FrequencyRowDetail } from '../types/data';

type OccurrencePanelProps = {
  isOpen: boolean;
  row: FrequencyRowDetail | null;
  book: BookArtifact | null;
  onClose: () => void;
};

type VerseEntry = {
  verse: number;
  forms: string[];
};

export function OccurrencePanel({ isOpen, row, book, onClose }: OccurrencePanelProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const grouped = useMemo(() => {
    if (!row) return [] as Array<{ chapter: number; verses: VerseEntry[] }>;

    return Object.entries(row.occurrencesByChapter)
      .map(([chapterKey, occurrences]) => {
        const chapter = Number(chapterKey);
        const verseMap = new Map<number, string[]>();

        occurrences.forEach((occurrence) => {
          const forms = verseMap.get(occurrence.verse) ?? [];
          forms.push(occurrence.form);
          verseMap.set(occurrence.verse, forms);
        });

        const verses = Array.from(verseMap.entries())
          .map(([verse, forms]) => ({ verse, forms }))
          .sort((a, b) => a.verse - b.verse);

        return { chapter, verses };
      })
      .sort((a, b) => a.chapter - b.chapter);
  }, [row]);

  if (!row || !book) {
    return null;
  }

  return (
    <aside className={`occurrence-panel ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
      <header>
        <div>
          <h2 className="hebrew-text">{row.headword}</h2>
          <p>
            {row.pos} · {row.count} occurrences
          </p>
        </div>
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          aria-label="Close occurrences panel"
        >
          ×
        </button>
      </header>

      <div className="occurrence-content">
        {grouped.map((chapterGroup) => (
          <section key={chapterGroup.chapter} className="chapter-group">
            <h3>Chapter {chapterGroup.chapter}</h3>
            {chapterGroup.verses.map((entry) => {
              const verseKey = `${chapterGroup.chapter}:${entry.verse}`;
              const verseText = book.verses[verseKey] ?? '';
              const highlighted = highlightForms(verseText, entry.forms);

              return (
                <article key={verseKey} className="verse-entry">
                  <span className="verse-number">{entry.verse}</span>
                  <p
                    className="hebrew-text verse-text"
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                  />
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
}
