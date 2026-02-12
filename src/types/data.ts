export type CatalogBook = {
  id: string;
  name: string;
  hebrew?: string;
  chapters: number;
  versesPerChapter: number[];
};

export type Catalog = {
  generatedAt: string;
  books: CatalogBook[];
};

export type LemmaMeta = {
  lemmaId: string;
  headword: string;
  pos: string;
  glosses: string[];
  variants: string[];
  isFunctionWord: boolean;
};

export type OccurrenceRef = {
  verse: number;
  form: string;
};

export type ChapterStats = {
  chapter: number;
  counts: Record<string, number>;
  glossCounts: Record<string, Record<string, number>>;
  occurrences: Record<string, OccurrenceRef[]>;
};

export type BookArtifact = {
  bookId: string;
  lemmas: Record<string, LemmaMeta>;
  chapters: ChapterStats[];
  verses: Record<string, string>;
};

export type FrequencyQuery = {
  bookId: string;
  startChapter: number;
  endChapter: number;
  includeFunctionWords: boolean;
};

export type FrequencyRow = {
  rank: number;
  lemmaId: string;
  headword: string;
  pos: string;
  gloss: string;
  glossCount: number;
  count: number;
  percent: number;
  chapterSpread: number;
};

export type FrequencyRowDetail = FrequencyRow & {
  glossBreakdown: Array<{ gloss: string; count: number }>;
  glosses: string[];
  variants: string[];
  occurrencesByChapter: Record<number, OccurrenceRef[]>;
};

export type FrequencyResult = {
  totalTokens: number;
  uniqueLemmas: number;
  rows: FrequencyRowDetail[];
};
