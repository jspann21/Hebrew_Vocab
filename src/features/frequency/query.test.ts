import { describe, expect, it } from 'vitest';
import { runFrequencyQuery } from './query';
import type { BookArtifact } from '../../types/data';

const fixture: BookArtifact = {
  bookId: 'genesis',
  lemmas: {
    'noun::דבר': {
      lemmaId: 'noun::דבר',
      headword: 'דָבָר',
      pos: 'noun',
      glosses: ['word'],
      variants: ['דָבָר'],
      isFunctionWord: false,
    },
    'conjunction::כי': {
      lemmaId: 'conjunction::כי',
      headword: 'כִּי',
      pos: 'conjunction',
      glosses: ['for', 'that'],
      variants: ['כִּי'],
      isFunctionWord: true,
    },
    'noun::כי': {
      lemmaId: 'noun::כי',
      headword: 'כִּי',
      pos: 'noun',
      glosses: ['khi'],
      variants: ['כִּי'],
      isFunctionWord: false,
    },
  },
  chapters: [
    {
      chapter: 1,
      counts: {
        'noun::דבר': 3,
        'conjunction::כי': 2,
        'noun::כי': 1,
      },
      glossCounts: {
        'noun::דבר': { word: 2, thing: 1 },
        'conjunction::כי': { for: 1, that: 1 },
        'noun::כי': { khi: 1 },
      },
      occurrences: {
        'noun::דבר': [
          { verse: 1, form: 'דָבָר' },
          { verse: 1, form: 'דְבָרִים' },
          { verse: 2, form: 'דָבָר' },
        ],
        'conjunction::כי': [{ verse: 1, form: 'כִּי' }, { verse: 2, form: 'כִּי' }],
        'noun::כי': [{ verse: 2, form: 'כִּי' }],
      },
    },
    {
      chapter: 2,
      counts: {
        'noun::דבר': 2,
        'conjunction::כי': 1,
      },
      glossCounts: {
        'noun::דבר': { word: 1, thing: 1 },
        'conjunction::כי': { for: 1 },
      },
      occurrences: {
        'noun::דבר': [
          { verse: 3, form: 'דָבָר' },
          { verse: 4, form: 'דָבָר' },
        ],
        'conjunction::כי': [{ verse: 1, form: 'כִּי' }],
      },
    },
  ],
  verses: {
    '1:1': 'כִּי דָבָר',
    '1:2': 'דָבָר כִּי',
    '2:1': 'כִּי',
    '2:3': 'דָבָר',
    '2:4': 'דָבָר',
  },
};

describe('runFrequencyQuery', () => {
  it('sorts by in-range token frequency and excludes function-word POS rows by default', () => {
    const result = runFrequencyQuery(fixture, {
      bookId: 'genesis',
      startChapter: 1,
      endChapter: 2,
      includeFunctionWords: false,
    });

    expect(result.totalTokens).toBe(6);
    expect(result.uniqueLemmas).toBe(2);
    expect(result.rows[0].lemmaId).toBe('noun::דבר');
    expect(result.rows[0].percent).toBe(83.33);
    expect(result.rows[0].gloss).toBe('word');
    expect(result.rows[0].glossCount).toBe(3);
    expect(result.rows[0].glossBreakdown).toEqual([
      { gloss: 'word', count: 3 },
      { gloss: 'thing', count: 2 },
    ]);
    expect(result.rows.map((row) => row.lemmaId)).toEqual(['noun::דבר', 'noun::כי']);
  });

  it('includes function words when toggled on', () => {
    const result = runFrequencyQuery(fixture, {
      bookId: 'genesis',
      startChapter: 1,
      endChapter: 1,
      includeFunctionWords: true,
    });

    expect(result.totalTokens).toBe(6);
    expect(result.uniqueLemmas).toBe(3);
    expect(result.rows.map((row) => row.lemmaId)).toEqual([
      'noun::דבר',
      'conjunction::כי',
      'noun::כי',
    ]);
    expect(result.rows[1].glossBreakdown).toEqual([
      { gloss: 'for', count: 1 },
      { gloss: 'that', count: 1 },
    ]);
  });
});
