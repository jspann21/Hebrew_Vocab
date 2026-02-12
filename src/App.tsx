import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FrequencyTable } from './components/FrequencyTable';
import { OccurrencePanel } from './components/OccurrencePanel';
import { RangeControls } from './components/RangeControls';
import { downloadText, toAnkiTsv, toCsv } from './features/exports/exporters';
import { runFrequencyQuery } from './features/frequency/query';
import { loadBookArtifact, loadCatalog } from './lib/dataClient';
import { parseUrlState, writeUrlState } from './lib/urlState';
import type { CatalogBook, FrequencyResult, FrequencyRowDetail } from './types/data';

const EMPTY_BOOKS: CatalogBook[] = [];

function clampChapter(value: number, max: number): number {
  return Math.min(Math.max(value, 1), Math.max(max, 1));
}

function buildRangeLabel(book: CatalogBook, startChapter: number, endChapter: number): string {
  return `${book.name} ${startChapter}-${endChapter}`;
}

export default function App() {
  const initialUrlState = useMemo(() => parseUrlState(window.location.search), []);

  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: loadCatalog,
  });

  const [selectedBookId, setSelectedBookId] = useState(initialUrlState.bookId ?? '');
  const [startChapter, setStartChapter] = useState(initialUrlState.from ?? 1);
  const [endChapter, setEndChapter] = useState(initialUrlState.to ?? 1);
  const [includeFunctionWords, setIncludeFunctionWords] = useState(
    initialUrlState.includeFunctionWords ?? false,
  );
  const [result, setResult] = useState<FrequencyResult | null>(null);
  const [resultSource, setResultSource] = useState<{
    book: CatalogBook;
    start: number;
    end: number;
  } | null>(null);
  const [activeRow, setActiveRow] = useState<FrequencyRowDetail | null>(null);

  const books = catalogQuery.data?.books ?? EMPTY_BOOKS;
  const selectedBook = books.find((book) => book.id === selectedBookId) ?? null;

  useEffect(() => {
    if (!books.length) {
      return;
    }

    const fallbackBook = books[0];
    const requestedBook = books.find((book) => book.id === initialUrlState.bookId);
    const effectiveBook = requestedBook ?? fallbackBook;

    if (!selectedBookId || !requestedBook) {
      setSelectedBookId(effectiveBook.id);
    }

    const safeStart = clampChapter(initialUrlState.from ?? 1, effectiveBook.chapters);
    const safeEnd = clampChapter(initialUrlState.to ?? safeStart, effectiveBook.chapters);

    setStartChapter(Math.min(safeStart, safeEnd));
    setEndChapter(Math.max(safeStart, safeEnd));
  }, [books, initialUrlState.bookId, initialUrlState.from, initialUrlState.to, selectedBookId]);

  useEffect(() => {
    if (!selectedBook) {
      return;
    }

    setStartChapter((current) => clampChapter(current, selectedBook.chapters));
    setEndChapter((current) => clampChapter(current, selectedBook.chapters));
  }, [selectedBook]);

  const bookQuery = useQuery({
    queryKey: ['book-artifact', selectedBookId],
    queryFn: () => loadBookArtifact(selectedBookId),
    enabled: Boolean(selectedBookId),
  });

  const isGenerating = bookQuery.isFetching || catalogQuery.isFetching;

  const generateFrequency = () => {
    if (!selectedBook || !bookQuery.data) {
      return;
    }

    const normalizedStart = Math.min(startChapter, endChapter);
    const normalizedEnd = Math.max(startChapter, endChapter);

    const frequency = runFrequencyQuery(bookQuery.data, {
      bookId: selectedBook.id,
      startChapter: normalizedStart,
      endChapter: normalizedEnd,
      includeFunctionWords,
    });

    setResult(frequency);
    setResultSource({
      book: selectedBook,
      start: normalizedStart,
      end: normalizedEnd,
    });
    setActiveRow(null);

    writeUrlState({
      bookId: selectedBook.id,
      from: normalizedStart,
      to: normalizedEnd,
      includeFunctionWords,
    });
  };

  useEffect(() => {
    if (!selectedBook || !bookQuery.data || result) {
      return;
    }

    generateFrequency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBook, bookQuery.data]);

  const onExportCsv = () => {
    if (!result || !selectedBook) {
      return;
    }

    const csv = toCsv(result.rows);
    const filename = `${selectedBook.id}-${startChapter}-${endChapter}-frequency.csv`;
    downloadText(filename, csv, 'text/csv;charset=utf-8');
  };

  const onExportAnki = () => {
    if (!result || !selectedBook) {
      return;
    }

    const anki = toAnkiTsv(result.rows, selectedBook.id, selectedBook.name, startChapter, endChapter);
    const filename = `${selectedBook.id}-${startChapter}-${endChapter}-anki.tsv`;
    downloadText(filename, anki, 'text/tab-separated-values;charset=utf-8');
  };

  if (catalogQuery.isPending) {
    return <main className="app-shell">Loading vocabulary catalog...</main>;
  }

  if (catalogQuery.error) {
    return (
      <main className="app-shell error-state">
        Failed to load catalog: {(catalogQuery.error as Error).message}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="kicker">Hebrew Old Testament Study Tool</p>
        <h1>Hebrew Vocabulary by Chapter</h1>
        <p>
          Choose a chapter range to generate vocabulary ranked by frequency within that range, with instant access to verse context.
        </p>
      </header>

      <RangeControls
        books={books}
        selectedBookId={selectedBookId}
        startChapter={startChapter}
        endChapter={endChapter}
        includeFunctionWords={includeFunctionWords}
        loading={isGenerating}
        hasResults={Boolean(result?.rows.length)}
        onBookChange={(bookId) => {
          setSelectedBookId(bookId);
          // We keep the result visible but it might be from a different book now.
          // If we want to clear it: setResult(null); setResultSource(null);
          // But the user asked for the banner to be consistent with the vocab.
          // So we should probably NOT clear the result, just let it be 'stale' until regenerated.
          setActiveRow(null);
        }}
        onStartChapterChange={(chapter) => {
          setStartChapter(chapter);
          if (chapter > endChapter) setEndChapter(chapter);
        }}
        onEndChapterChange={(chapter) => {
          setEndChapter(chapter);
          if (chapter < startChapter) setStartChapter(chapter);
        }}
        onIncludeFunctionWordsChange={(value) => setIncludeFunctionWords(value)}
        onGenerate={generateFrequency}
        onExportCsv={onExportCsv}
        onExportAnki={onExportAnki}
      />

      {bookQuery.error ? (
        <section className="error-state">Failed to load selected book data.</section>
      ) : null}

      {resultSource && result ? (
        <section className="range-banner">
          <strong>Range:</strong> {buildRangeLabel(resultSource.book, resultSource.start, resultSource.end)}
        </section>
      ) : null}

      {result ? (
        <FrequencyTable
          rows={result.rows}
          totalTokens={result.totalTokens}
          uniqueLemmas={result.uniqueLemmas}
          onViewOccurrences={setActiveRow}
        />
      ) : null}

      <OccurrencePanel
        isOpen={Boolean(activeRow)}
        row={activeRow}
        book={bookQuery.data ?? null}
        onClose={() => setActiveRow(null)}
      />
    </main>
  );
}
