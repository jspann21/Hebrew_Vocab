// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  ensureWordForms,
  parseArgs,
  parseTfDenseIntValues,
  parseTfDenseValues,
} from './enrich-lexemes';

describe('enrich-lexemes helpers', () => {
  it('parses dense TF values and stops at node jump anchor', () => {
    const content = [
      '@node',
      '@valueType=str',
      '',
      'א',
      'ב',
      'ג',
      '1437602\tא',
      'should-not-parse',
    ].join('\n');

    expect(parseTfDenseValues(content, 'lex_utf8')).toEqual(['א', 'ב', 'ג']);
  });

  it('parses dense integer TF values', () => {
    const content = ['@node', '@valueType=int', '', '1', '2', '3', '1437602\t4'].join('\n');
    expect(parseTfDenseIntValues(content, 'freq_lex')).toEqual([1, 2, 3]);
  });

  it('pads word_forms to length five', () => {
    const { forms, padded } = ensureWordForms({ word_forms: ['a', 'b', 'c'] });
    expect(padded).toBe(true);
    expect(forms).toEqual(['a', 'b', 'c', '', '']);
  });

  it('defaults to dry-run mode and supports apply mode', () => {
    expect(parseArgs([])).toEqual({ mode: 'dry-run' });
    expect(parseArgs(['--apply'])).toEqual({ mode: 'apply' });
    expect(() => parseArgs(['--apply', '--dry-run'])).toThrow();
  });
});
