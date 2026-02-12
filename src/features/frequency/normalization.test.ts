import { describe, expect, it } from 'vitest';
import {
  assembleVerseText,
  buildLemmaId,
  cleanGloss,
  isFunctionWord,
  normalizeLexeme,
  normalizePos,
} from './normalization';

describe('normalization helpers', () => {
  it('normalizes gloss text conservatively', () => {
    expect(cleanGloss('<relative>')).toBe('');
    expect(cleanGloss('  be   strong  ')).toBe('be strong');
  });

  it('normalizes lexemes and parts of speech', () => {
    expect(normalizeLexeme(' דָבָר ')).toBe('דָבָר');
    expect(normalizePos({ pdp: 'subs' })).toBe('noun');
    expect(normalizePos({ pdp: 'conj' })).toBe('conjunction');
  });

  it('classifies function words by raw POS tag', () => {
    expect(isFunctionWord({ pdp: 'prep' })).toBe(true);
    expect(isFunctionWord({ pdp: 'conj' })).toBe(true);
    expect(isFunctionWord({ pdp: 'verb' })).toBe(false);
  });

  it('builds stable lemma ids from normalized lexeme and POS', () => {
    expect(buildLemmaId('אמר', 'verb')).toBe('verb::אמר');
  });

  it('assembles verses with clitic attachment', () => {
    const verse = assembleVerseText([
      {
        pos_tag: { pdp: 'conj' },
        word_forms: ['וְ', 'וְ', 'ו', 'ו'],
      },
      {
        pos_tag: { pdp: 'verb' },
        word_forms: ['אָמַר', 'אָמַר', 'אמר', 'אמר'],
      },
    ]);

    expect(verse).toBe('וְאָמַר');
  });
});
