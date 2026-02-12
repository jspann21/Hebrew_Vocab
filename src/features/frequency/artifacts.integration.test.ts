// @vitest-environment node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function loadJson(relativePath: string): unknown {
  const fullPath = path.join(root, relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf8'));
}

describe('generated artifacts integration', () => {
  it('loads catalog with expected book count', () => {
    const catalog = loadJson('public/data/catalog.json') as { books: unknown[] };
    expect(catalog.books.length).toBe(39);
  });

  it('includes Psalms high chapter verse references', () => {
    const psalms = loadJson('public/data/books/psalms.json') as {
      verses: Record<string, string>;
      chapters: Array<{ chapter: number }>;
    };

    expect(psalms.chapters.length).toBe(150);
    expect(psalms.verses['119:1']).toBeTruthy();
    expect(psalms.verses['150:6']).toBeTruthy();
  });
});
