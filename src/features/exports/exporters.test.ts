import { describe, expect, it } from 'vitest';
import { toAnkiTsv, toCsv } from './exporters';
import type { FrequencyRowDetail } from '../../types/data';

const rows: FrequencyRowDetail[] = [
  {
    rank: 1,
    lemmaId: 'verb::אמר',
    headword: 'אָמַר',
    pos: 'verb',
    gloss: 'say',
    glossCount: 12,
    glossBreakdown: [
      { gloss: 'say', count: 12 },
      { gloss: 'speak', count: 2 },
      { gloss: 'declare', count: 1 },
    ],
    glosses: ['say', 'speak', 'declare'],
    count: 12,
    percent: 16.67,
    chapterSpread: 3,
    variants: ['אָמַר', 'יֹאמַר'],
    occurrencesByChapter: {},
  },
];

describe('exporters', () => {
  it('exports csv with required column order', () => {
    const csv = toCsv(rows);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('rank,headword,pos,gloss,count,percent,chapter_spread,variants');
    expect(lines[1]).toContain('1');
    expect(lines[1]).toContain('אָמַר');
  });

  it('exports anki tsv front/back/tags', () => {
    const tsv = toAnkiTsv(rows, 'genesis', 'Genesis', 1, 3);
    const lines = tsv.split('\n');

    expect(lines[0]).toBe('#separator:tab');
    expect(lines[1]).toBe('#html:true');
    expect(lines[2]).toBe('#tags column:3');

    const columns = lines[3].split('\t');

    expect(columns).toHaveLength(3);
    expect(columns[0]).toBe('אָמַר');
    expect(columns[1]).toContain('POS: verb');

    // Check for hierarchical tags
    const tags = columns[2];
    expect(tags).toContain('HebrewVocab::Genesis');
    expect(tags).toContain('HebrewVocab::Genesis::Ch1-3');
    expect(tags).toContain('Part_of_Speech::verb');
  });

  it('escapes html in anki export', () => {
    const specialRows: FrequencyRowDetail[] = [
      {
        ...rows[0],
        gloss: 'bread & butter',
        pos: '<noun>',
      },
    ];
    const tsv = toAnkiTsv(specialRows, 'genesis', 'Genesis', 1, 3);
    const lines = tsv.split('\n');
    const columns = lines[3].split('\t');

    expect(columns[1]).toContain('bread &amp; butter');
    expect(columns[1]).toContain('POS: &lt;noun&gt;');
  });
});
