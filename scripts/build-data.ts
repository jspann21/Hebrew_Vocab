import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assembleVerseText,
  buildLemmaId,
  cleanGloss,
  isFunctionWord,
  normalizeLexeme,
  normalizePos,
  stripHebrewDiacritics,
  type RawPosTag,
} from '../src/features/frequency/normalization';
import { toBookId, toDatasetFolder, toDisplayBookName } from '../src/lib/bookNames';
import type { BookArtifact, Catalog, CatalogBook, LemmaMeta, OccurrenceRef } from '../src/types/data';

type RawBook = {
  english: string;
  hebrew?: string;
};

type RawWord = {
  pos_tag?: RawPosTag;
  word_forms?: string[];
  gloss?: string;
};

type RawChapter = Record<string, RawWord[]>;

type TempLemma = {
  lemmaId: string;
  headword: string;
  pos: string;
  glosses: Map<string, string>;
  variants: Set<string>;
  isFunctionWord: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const corpusRoot = path.join(projectRoot, 'bhsa_json');
const outputRoot = path.join(projectRoot, 'public', 'data');
const booksOutputRoot = path.join(outputRoot, 'books');
const strongXmlPath = path.join(projectRoot, 'HebrewStrong.xml');

function getChapterNumber(fileName: string): number | null {
  const match = fileName.match(/_chapter_(\d+)\.json$/);
  return match ? Number(match[1]) : null;
}

function addGloss(glosses: Map<string, string>, gloss: string): void {
  if (!gloss) {
    return;
  }

  const key = gloss.toLowerCase();
  if (!glosses.has(key)) {
    glosses.set(key, gloss);
  }
}

function lettersOnlyHebrew(text: string): string {
  return stripHebrewDiacritics(text).replace(/[^\u05D0-\u05EA]/g, '');
}

function hasHebrewPointing(text: string): boolean {
  return /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/u.test(text);
}

function normalizeStrongPos(rawPos: string): string | null {
  const pos = rawPos.toLowerCase();
  if (pos.startsWith('v')) return 'verb';
  if (pos.startsWith('n-pr')) return 'proper noun';
  if (pos.startsWith('n')) return 'noun';
  if (pos.startsWith('a')) return 'adjective';
  if (pos.startsWith('adv')) return 'adverb';
  if (pos.startsWith('prep')) return 'preposition';
  if (pos.startsWith('conj')) return 'conjunction';
  if (pos.startsWith('pron')) return 'pronoun';
  if (pos.startsWith('interj') || pos.startsWith('inj')) return 'interjection';
  return null;
}

async function loadStrongHeadwordMap(): Promise<Map<string, string>> {
  const xml = await readFile(strongXmlPath, 'utf8');
  const preferredCandidates = new Map<string, Set<string>>();
  const fallbackCandidates = new Map<string, Set<string>>();
  const entryRegex = /<entry id="H\d+">([\s\S]*?)<\/entry>/gu;

  for (const entryMatch of xml.matchAll(entryRegex)) {
    const entry = entryMatch[1];
    const wordMatch = entry.match(/<w pos="([^"]+)"[^>]*xml:lang="([^"]+)"[^>]*>([^<]+)<\/w>/u);
    if (!wordMatch) {
      continue;
    }

    const normalizedPos = normalizeStrongPos(wordMatch[1]);
    if (!normalizedPos) {
      continue;
    }

    const language = wordMatch[2].trim().toLowerCase();
    const pointed = wordMatch[3].trim();
    const lexeme = lettersOnlyHebrew(pointed);
    if (!lexeme) {
      continue;
    }

    const key = `${normalizedPos}::${lexeme}`;
    const target =
      language === 'heb' || language === 'x-pn' ? preferredCandidates : fallbackCandidates;
    if (!target.has(key)) {
      target.set(key, new Set<string>());
    }
    target.get(key)?.add(pointed);
  }

  const out = new Map<string, string>();

  const allKeys = new Set<string>([
    ...Array.from(preferredCandidates.keys()),
    ...Array.from(fallbackCandidates.keys()),
  ]);

  for (const key of allKeys) {
    const preferred = preferredCandidates.get(key);
    if (preferred && preferred.size === 1) {
      out.set(key, Array.from(preferred)[0]);
      continue;
    }

    if (!preferred || preferred.size === 0) {
      const fallback = fallbackCandidates.get(key);
      if (fallback && fallback.size === 1) {
        out.set(key, Array.from(fallback)[0]);
      }
    }
  }
  return out;
}

function chooseDisplayHeadword(
  lexeme: string,
  normalizedPos: string,
  pointedLexeme: string,
  strongHeadwordMap: Map<string, string>,
): string {
  const strippedPointed = lettersOnlyHebrew(pointedLexeme);
  if (pointedLexeme && strippedPointed === lexeme && hasHebrewPointing(pointedLexeme)) {
    return pointedLexeme;
  }

  const strongKey = `${normalizedPos}::${lexeme}`;
  const strongHeadword = strongHeadwordMap.get(strongKey);
  if (strongHeadword) {
    return strongHeadword;
  }

  if (pointedLexeme && strippedPointed === lexeme) {
    return pointedLexeme;
  }

  return lexeme;
}

async function buildBookArtifact(
  rawBook: RawBook,
  strongHeadwordMap: Map<string, string>,
): Promise<{ catalogBook: CatalogBook; artifact: BookArtifact }> {
  const displayName = toDisplayBookName(rawBook.english);
  const bookId = toBookId(displayName);
  const folderName = toDatasetFolder(rawBook.english);
  const folderPath = path.join(corpusRoot, folderName);

  const files = await readdir(folderPath);
  const chapterFiles = files
    .map((name) => ({ name, chapter: getChapterNumber(name) }))
    .filter((item): item is { name: string; chapter: number } => item.chapter !== null)
    .sort((a, b) => a.chapter - b.chapter);

  const lemmas = new Map<string, TempLemma>();
  const chapters = [] as BookArtifact['chapters'];
  const verses: BookArtifact['verses'] = {};
  const versesPerChapter: number[] = [];

  for (const chapterFile of chapterFiles) {
    const chapterPath = path.join(folderPath, chapterFile.name);
    const chapterData = JSON.parse(await readFile(chapterPath, 'utf8')) as RawChapter;

    const counts: Record<string, number> = {};
    const glossCounts: Record<string, Record<string, number>> = {};
    const occurrences: Record<string, OccurrenceRef[]> = {};

    const verseNumbers = Object.keys(chapterData)
      .map((verse) => Number(verse))
      .filter((verse) => Number.isFinite(verse))
      .sort((a, b) => a - b);

    versesPerChapter.push(verseNumbers.length ? Math.max(...verseNumbers) : 0);

    for (const verseNumber of verseNumbers) {
      const words = chapterData[String(verseNumber)] ?? [];
      verses[`${chapterFile.chapter}:${verseNumber}`] = assembleVerseText(words);

      for (const word of words) {
        const posTag = word.pos_tag;
        const normalizedPos = normalizePos(posTag);
        const tokenIsFunctionWord = isFunctionWord(posTag);
        const pointed = (word.word_forms?.[1] ?? '').trim();
        const pointedLexeme = (word.word_forms?.[4] ?? '').trim();
        const consonantalLexeme = normalizeLexeme(word.word_forms?.[3] ?? word.word_forms?.[2] ?? pointed);
        const groupingLexeme = normalizeLexeme(pointedLexeme || consonantalLexeme);

        if (!groupingLexeme) {
          continue;
        }

        const lemmaId = buildLemmaId(groupingLexeme, normalizedPos);
        const gloss = cleanGloss(word.gloss);
        const variant = pointed || consonantalLexeme;

        if (!lemmas.has(lemmaId)) {
          lemmas.set(lemmaId, {
            lemmaId,
            headword: chooseDisplayHeadword(
              consonantalLexeme,
              normalizedPos,
              pointedLexeme,
              strongHeadwordMap,
            ),
            pos: normalizedPos,
            glosses: new Map<string, string>(),
            variants: new Set<string>(),
            isFunctionWord: tokenIsFunctionWord,
          });
        }

        const lemma = lemmas.get(lemmaId);
        if (!lemma) {
          continue;
        }

        lemma.isFunctionWord = lemma.isFunctionWord || tokenIsFunctionWord;

        if (variant) {
          lemma.variants.add(variant);
        }
        addGloss(lemma.glosses, gloss);

        counts[lemmaId] = (counts[lemmaId] ?? 0) + 1;
        if (gloss) {
          if (!glossCounts[lemmaId]) {
            glossCounts[lemmaId] = {};
          }
          glossCounts[lemmaId][gloss] = (glossCounts[lemmaId][gloss] ?? 0) + 1;
        }
        if (!occurrences[lemmaId]) {
          occurrences[lemmaId] = [];
        }
        occurrences[lemmaId].push({
          verse: verseNumber,
          form: variant,
        });
      }
    }

    chapters.push({
      chapter: chapterFile.chapter,
      counts,
      glossCounts,
      occurrences,
    });
  }

  const lemmaRecord: Record<string, LemmaMeta> = {};
  const sortedLemmaIds = Array.from(lemmas.keys()).sort();
  for (const lemmaId of sortedLemmaIds) {
    const lemma = lemmas.get(lemmaId);
    if (!lemma) {
      continue;
    }

    const variants = Array.from(lemma.variants).sort((a, b) => a.localeCompare(b));
    const headwordFirst = [lemma.headword, ...variants.filter((variant) => variant !== lemma.headword)];

    lemmaRecord[lemmaId] = {
      lemmaId,
      headword: lemma.headword,
      pos: lemma.pos,
      glosses: Array.from(lemma.glosses.values()).sort((a, b) => a.localeCompare(b)),
      variants: headwordFirst,
      isFunctionWord: lemma.isFunctionWord,
    };
  }

  const artifact: BookArtifact = {
    bookId,
    lemmas: lemmaRecord,
    chapters,
    verses,
  };

  const catalogBook: CatalogBook = {
    id: bookId,
    name: displayName,
    hebrew: rawBook.hebrew,
    chapters: chapterFiles.length,
    versesPerChapter,
  };

  return { catalogBook, artifact };
}

async function run(): Promise<void> {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(booksOutputRoot, { recursive: true });

  const booksPath = path.join(corpusRoot, 'books.json');
  const rawBooks = JSON.parse(await readFile(booksPath, 'utf8')) as RawBook[];
  const strongHeadwordMap = await loadStrongHeadwordMap();

  const catalogBooks: CatalogBook[] = [];

  for (const rawBook of rawBooks) {
    const { catalogBook, artifact } = await buildBookArtifact(rawBook, strongHeadwordMap);
    catalogBooks.push(catalogBook);

    const outPath = path.join(booksOutputRoot, `${catalogBook.id}.json`);
    await writeFile(outPath, JSON.stringify(artifact), 'utf8');
    console.log(`Built ${catalogBook.name} -> ${path.relative(projectRoot, outPath)}`);
  }

  const catalog: Catalog = {
    generatedAt: new Date().toISOString(),
    books: catalogBooks,
  };

  await writeFile(path.join(outputRoot, 'catalog.json'), JSON.stringify(catalog), 'utf8');
  console.log(`Wrote catalog with ${catalogBooks.length} books.`);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
