import { useEffect, useMemo, useRef, useState } from 'react';
import type { FrequencyRowDetail } from '../types/data';

type SortMode = 'count' | 'headword';

type FrequencyTableProps = {
  rows: FrequencyRowDetail[];
  totalTokens: number;
  uniqueLemmas: number;
  onViewOccurrences: (row: FrequencyRowDetail) => void;
};

export function FrequencyTable({
  rows,
  totalTokens,
  uniqueLemmas,
  onViewOccurrences,
}: FrequencyTableProps) {
  const [sortMode, setSortMode] = useState<SortMode>('count');
  const [openGlossLemmaId, setOpenGlossLemmaId] = useState<string | null>(null);
  const glossOverlayRef = useRef<HTMLDivElement | null>(null);

  const sortedRows = useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      if (sortMode === 'headword') {
        return a.headword.localeCompare(b.headword);
      }
      if (b.count !== a.count) return b.count - a.count;
      return a.headword.localeCompare(b.headword);
    });

    return copy;
  }, [rows, sortMode]);

  useEffect(() => {
    if (!openGlossLemmaId) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (glossOverlayRef.current && !glossOverlayRef.current.contains(target)) {
        setOpenGlossLemmaId(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenGlossLemmaId(null);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openGlossLemmaId]);

  if (!rows.length) {
    return (
      <section className="empty-results" aria-live="polite">
        <h2>No vocabulary rows found</h2>
        <p>Try expanding your chapter range or enabling function words.</p>
      </section>
    );
  }

  return (
    <section className="results-shell">
      <div className="results-summary">
        <div>
          <strong>{uniqueLemmas}</strong> unique words
        </div>
        <div>
          <strong>{totalTokens}</strong> total words
        </div>
        <label className="sort-control">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="count">Frequency</option>
            <option value="headword">Headword</option>
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Headword</th>
              <th>POS</th>
              <th>Gloss</th>
              <th>Count</th>
              <th>%</th>
              <th>Chapter Spread</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.lemmaId}>
                <td>{row.rank}</td>
                <td className="hebrew-text">{row.headword}</td>
                <td>{row.pos}</td>
                <td className="gloss-cell">
                  <div className="gloss-inline">
                    <span className="gloss-primary">{row.gloss || '—'}</span>
                    {row.glossBreakdown.length > 1 ? (
                      <div
                        className="gloss-overlay-wrap"
                        ref={openGlossLemmaId === row.lemmaId ? glossOverlayRef : null}
                      >
                        <button
                          type="button"
                          className="gloss-more-btn"
                          onClick={() =>
                            setOpenGlossLemmaId((current) => (current === row.lemmaId ? null : row.lemmaId))
                          }
                          title={row.glossBreakdown
                            .map((entry) => `${entry.gloss} (${entry.count})`)
                            .join('; ')}
                          aria-label={`Show all glosses for ${row.headword}`}
                          aria-expanded={openGlossLemmaId === row.lemmaId}
                        >
                          +{row.glossBreakdown.length - 1}
                        </button>
                        {openGlossLemmaId === row.lemmaId ? (
                          <div className="gloss-popover" role="list">
                            {row.glossBreakdown.map((entry) => (
                              <div key={entry.gloss} role="listitem">
                                {entry.gloss} ({entry.count})
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </td>
                <td>{row.count}</td>
                <td>{row.percent.toFixed(2)}</td>
                <td>{row.chapterSpread}</td>
                <td>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => onViewOccurrences(row)}
                    aria-label={`View occurrences for ${row.headword}`}
                  >
                    View verses
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
