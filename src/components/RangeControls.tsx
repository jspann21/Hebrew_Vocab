import { BookSelect } from './BookSelect';
import type { CatalogBook } from '../types/data';

type RangeControlsProps = {
  books: CatalogBook[];
  selectedBookId: string;
  startChapter: number;
  endChapter: number;
  includeFunctionWords: boolean;
  loading: boolean;
  hasResults: boolean;
  onBookChange: (bookId: string) => void;
  onStartChapterChange: (chapter: number) => void;
  onEndChapterChange: (chapter: number) => void;
  onIncludeFunctionWordsChange: (value: boolean) => void;
  onGenerate: () => void;
  onExportCsv: () => void;
  onExportAnki: () => void;
};

export function RangeControls({
  books,
  selectedBookId,
  startChapter,
  endChapter,
  includeFunctionWords,
  loading,
  hasResults,
  onBookChange,
  onStartChapterChange,
  onEndChapterChange,
  onIncludeFunctionWordsChange,
  onGenerate,
  onExportCsv,
  onExportAnki,
}: RangeControlsProps) {
  const selectedBook = books.find((book) => book.id === selectedBookId);
  const chapterCount = selectedBook?.chapters ?? 0;

  return (
    <section className="controls-shell" aria-label="Range controls">
      <div className="controls-grid">
        <label>
          <span>Book</span>
          <BookSelect
            books={books}
            selectedBookId={selectedBookId}
            onBookChange={onBookChange}
            disabled={loading}
          />
        </label>

        <label>
          <span>Start Chapter</span>
          <select
            value={startChapter}
            onChange={(event) => onStartChapterChange(Number(event.target.value))}
            disabled={loading}
          >
            {Array.from({ length: chapterCount }, (_, index) => index + 1).map((chapter) => (
              <option key={chapter} value={chapter}>
                {chapter}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>End Chapter</span>
          <select
            value={endChapter}
            onChange={(event) => onEndChapterChange(Number(event.target.value))}
            disabled={loading}
          >
            {Array.from({ length: chapterCount }, (_, index) => index + 1).map((chapter) => (
              <option key={chapter} value={chapter}>
                {chapter}
              </option>
            ))}
          </select>
        </label>

      </div>

      <div className="action-row">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={includeFunctionWords}
            onChange={(event) => onIncludeFunctionWordsChange(event.target.checked)}
            disabled={loading}
          />
          <span>Include function words</span>
        </label>
        <div className="spacer" />
        <button type="button" className="primary-btn" onClick={onGenerate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Vocabulary'}
        </button>
        <button type="button" className="secondary-btn" onClick={onExportCsv} disabled={!hasResults || loading}>
          Export CSV
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={onExportAnki}
          disabled={!hasResults || loading}
        >
          Export Anki TSV
        </button>
      </div>
    </section>
  );
}
