import type {
  BookArtifact,
  FrequencyQuery,
  FrequencyResult,
  FrequencyRowDetail,
  OccurrenceRef,
} from '../../types/data';

type Aggregate = {
  lemmaId: string;
  count: number;
  glossCounts: Record<string, number>;
  chapterSet: Set<number>;
  occurrencesByChapter: Record<number, OccurrenceRef[]>;
};

export function runFrequencyQuery(book: BookArtifact, query: FrequencyQuery): FrequencyResult {
  const start = Math.max(1, Math.min(query.startChapter, query.endChapter));
  const end = Math.min(
    Math.max(query.startChapter, query.endChapter),
    Math.max(...book.chapters.map((chapter) => chapter.chapter)),
  );

  const selectedChapters = book.chapters.filter((chapter) => chapter.chapter >= start && chapter.chapter <= end);

  const aggregates = new Map<string, Aggregate>();
  let totalTokens = 0;

  for (const chapter of selectedChapters) {
    for (const [lemmaId, count] of Object.entries(chapter.counts)) {
      const lemma = book.lemmas[lemmaId];
      if (!lemma) {
        continue;
      }

      if (!query.includeFunctionWords && lemma.isFunctionWord) {
        continue;
      }

      totalTokens += count;

      if (!aggregates.has(lemmaId)) {
        aggregates.set(lemmaId, {
          lemmaId,
          count: 0,
          glossCounts: {},
          chapterSet: new Set<number>(),
          occurrencesByChapter: {},
        });
      }

      const aggregate = aggregates.get(lemmaId);
      if (!aggregate) {
        continue;
      }

      aggregate.count += count;
      aggregate.chapterSet.add(chapter.chapter);

      const chapterGlossCounts = chapter.glossCounts[lemmaId] ?? {};
      for (const [gloss, glossCount] of Object.entries(chapterGlossCounts)) {
        aggregate.glossCounts[gloss] = (aggregate.glossCounts[gloss] ?? 0) + glossCount;
      }

      const occurrences = chapter.occurrences[lemmaId] ?? [];
      if (!aggregate.occurrencesByChapter[chapter.chapter]) {
        aggregate.occurrencesByChapter[chapter.chapter] = [];
      }
      aggregate.occurrencesByChapter[chapter.chapter].push(...occurrences);
    }
  }

  const rows: FrequencyRowDetail[] = Array.from(aggregates.values())
    .map((aggregate) => {
      const lemma = book.lemmas[aggregate.lemmaId];
      const glossBreakdown = Object.entries(aggregate.glossCounts)
        .map(([gloss, count]) => ({ gloss, count }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.gloss.localeCompare(b.gloss);
        });

      if (!glossBreakdown.length && lemma.glosses[0]) {
        glossBreakdown.push({ gloss: lemma.glosses[0], count: aggregate.count });
      }

      const gloss = glossBreakdown[0]?.gloss ?? lemma.glosses[0] ?? '';
      const glossCount = glossBreakdown[0]?.count ?? 0;

      Object.values(aggregate.occurrencesByChapter).forEach((chapterOccurrences) => {
        chapterOccurrences.sort((a, b) => a.verse - b.verse);
      });

      return {
        rank: 0,
        lemmaId: aggregate.lemmaId,
        headword: lemma.headword,
        pos: lemma.pos,
        gloss,
        glossCount,
        glossBreakdown,
        glosses: glossBreakdown.map((entry) => entry.gloss),
        count: aggregate.count,
        percent: totalTokens ? Number(((aggregate.count / totalTokens) * 100).toFixed(2)) : 0,
        chapterSpread: aggregate.chapterSet.size,
        variants: lemma.variants,
        occurrencesByChapter: aggregate.occurrencesByChapter,
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.headword.localeCompare(b.headword);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

  return {
    totalTokens,
    uniqueLemmas: rows.length,
    rows,
  };
}
