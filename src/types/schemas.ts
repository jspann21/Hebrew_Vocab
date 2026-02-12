import { z } from 'zod';

export const catalogBookSchema = z.object({
  id: z.string(),
  name: z.string(),
  hebrew: z.string().optional(),
  chapters: z.number().int().positive(),
  versesPerChapter: z.array(z.number().int().nonnegative()),
});

export const catalogSchema = z.object({
  generatedAt: z.string(),
  books: z.array(catalogBookSchema),
});

export const occurrenceRefSchema = z.object({
  verse: z.number().int().positive(),
  form: z.string(),
});

export const lemmaMetaSchema = z.object({
  lemmaId: z.string(),
  headword: z.string(),
  pos: z.string(),
  glosses: z.array(z.string()),
  variants: z.array(z.string()),
  isFunctionWord: z.boolean(),
});

export const chapterStatsSchema = z.object({
  chapter: z.number().int().positive(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  glossCounts: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())),
  occurrences: z.record(z.string(), z.array(occurrenceRefSchema)),
});

export const bookArtifactSchema = z.object({
  bookId: z.string(),
  lemmas: z.record(z.string(), lemmaMetaSchema),
  chapters: z.array(chapterStatsSchema),
  verses: z.record(z.string(), z.string()),
});
