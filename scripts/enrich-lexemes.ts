import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toDatasetFolder } from '../src/lib/bookNames';

const SOURCE_COMMIT = 'af70cebe9d23ea736bb40e3ccd6768875b52a49d';
const SOURCE_BASE = `https://raw.githubusercontent.com/ETCBC/bhsa/${SOURCE_COMMIT}/tf/2021`;
const LEX_URL = `${SOURCE_BASE}/lex_utf8.tf`;
const VOC_LEX_URL = `${SOURCE_BASE}/voc_lex_utf8.tf`;
const FREQ_URL = `${SOURCE_BASE}/freq_lex.tf`;
const EXPECTED_WORD_NODES = 426590;
const SAMPLE_LIMIT = 20;

type RawBook = {
  english: string;
  hebrew?: string;
};

type RawWord = {
  freq_lex?: number | string;
  word_forms?: string[];
};

type RawChapter = Record<string, RawWord[]>;

type ChangeSample = {
  index: number;
  ref: string;
  pointed: string;
  oldLexeme: string;
  newLexeme: string;
  oldVocLexeme: string;
  newVocLexeme: string;
};

type RunReport = {
  mode: 'dry-run' | 'apply';
  generatedAt: string;
  source: {
    provider: string;
    commit: string;
    lexUrl: string;
    vocLexUrl: string;
    freqUrl: string;
  };
  totals: {
    tokensProcessed: number;
    expectedWordNodes: number;
    chapterFilesProcessed: number;
    chapterFilesWritten: number;
    tokensWithLemmaChange: number;
    tokensWithVocLexemeChange: number;
    tokensWithWordFormsPadding: number;
    uniqueOldWordForm4: number;
    uniqueNewWordForm4: number;
    uniqueOldWordForm5: number;
    uniqueNewWordForm5: number;
  };
  topChanges: Array<{
    from: string;
    to: string;
    count: number;
  }>;
  samples: ChangeSample[];
  targetMatches: ChangeSample[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const corpusRoot = path.join(projectRoot, 'bhsa_json');
const reportDir = path.join(projectRoot, 'reports');
const reportPath = path.join(reportDir, 'lexeme-enrichment-report.json');

function getChapterNumber(fileName: string): number | null {
  const match = fileName.match(/_chapter_(\d+)\.json$/);
  return match ? Number(match[1]) : null;
}

export function parseTfDenseValues(content: string, featureName: string): string[] {
  const values: string[] = [];
  let started = false;

  for (const line of content.split(/\r?\n/u)) {
    if (line.startsWith('@')) {
      continue;
    }
    if (/^\d+\t/u.test(line)) {
      break;
    }
    if (!started) {
      if (!line) {
        continue;
      }
      started = true;
    }
    values.push(line.trim());
  }

  if (!values.length) {
    throw new Error(`Parsed 0 values for TF feature '${featureName}'.`);
  }

  return values;
}

export function parseTfDenseIntValues(content: string, featureName: string): number[] {
  const rawValues = parseTfDenseValues(content, featureName);
  return rawValues.map((value, index) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid integer in '${featureName}' at index ${index + 1}: '${value}'`);
    }
    return parsed;
  });
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status} ${response.statusText})`);
  }

  return response.text();
}

function formatRef(bookName: string, chapter: number, verse: number, tokenIndex: number): string {
  return `${bookName} ${chapter}:${verse} token ${tokenIndex + 1}`;
}

export function parseArgs(argv: string[]): { mode: 'dry-run' | 'apply' } {
  const hasApply = argv.includes('--apply');
  const hasDryRun = argv.includes('--dry-run');

  if (hasApply && hasDryRun) {
    throw new Error('Choose one mode only: --dry-run (default) or --apply');
  }

  return { mode: hasApply ? 'apply' : 'dry-run' };
}

export function ensureWordForms(word: RawWord, minLength = 5): { forms: string[]; padded: boolean } {
  const forms = Array.isArray(word.word_forms) ? [...word.word_forms] : [];
  let padded = false;

  while (forms.length < minLength) {
    forms.push('');
    padded = true;
  }

  return { forms, padded };
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(`Mode: ${args.mode}`);
  console.log(`Fetching pinned ETCBC BHSA tf/2021 data from commit ${SOURCE_COMMIT}...`);

  const [lexContent, vocLexContent, freqContent] = await Promise.all([
    fetchText(LEX_URL),
    fetchText(VOC_LEX_URL),
    fetchText(FREQ_URL),
  ]);
  const tfLexemes = parseTfDenseValues(lexContent, 'lex_utf8');
  const tfVocLexemes = parseTfDenseValues(vocLexContent, 'voc_lex_utf8');
  const tfFreqLex = parseTfDenseIntValues(freqContent, 'freq_lex');

  if (tfLexemes.length !== tfVocLexemes.length || tfLexemes.length !== tfFreqLex.length) {
    throw new Error(
      `TF feature length mismatch: lex_utf8=${tfLexemes.length}, voc_lex_utf8=${tfVocLexemes.length}, freq_lex=${tfFreqLex.length}`,
    );
  }

  if (tfLexemes.length !== EXPECTED_WORD_NODES) {
    throw new Error(
      `Unexpected TF word-node count ${tfLexemes.length}; expected ${EXPECTED_WORD_NODES}.`,
    );
  }

  const booksPath = path.join(corpusRoot, 'books.json');
  const books = JSON.parse(await readFile(booksPath, 'utf8')) as RawBook[];

  let globalIndex = 0;
  let chapterFilesProcessed = 0;
  let chapterFilesWritten = 0;
  let tokensWithLemmaChange = 0;
  let tokensWithVocLexemeChange = 0;
  let tokensWithWordFormsPadding = 0;

  const uniqueOldWordForm4 = new Set<string>();
  const uniqueNewWordForm4 = new Set<string>();
  const uniqueOldWordForm5 = new Set<string>();
  const uniqueNewWordForm5 = new Set<string>();
  const changeCounts = new Map<string, number>();
  const samples: ChangeSample[] = [];
  const targetMatches: ChangeSample[] = [];

  for (const book of books) {
    const folderName = toDatasetFolder(book.english);
    const folderPath = path.join(corpusRoot, folderName);
    const files = await readdir(folderPath);
    const chapterFiles = files
      .map((name) => ({ name, chapter: getChapterNumber(name) }))
      .filter((item): item is { name: string; chapter: number } => item.chapter !== null)
      .sort((a, b) => a.chapter - b.chapter);

    for (const chapterFile of chapterFiles) {
      chapterFilesProcessed += 1;
      const chapterPath = path.join(folderPath, chapterFile.name);
      const chapterData = JSON.parse(await readFile(chapterPath, 'utf8')) as RawChapter;
      let chapterDirty = false;

      const verseNumbers = Object.keys(chapterData)
        .map((verse) => Number(verse))
        .filter((verse) => Number.isFinite(verse))
        .sort((a, b) => a - b);

      for (const verseNumber of verseNumbers) {
        const words = chapterData[String(verseNumber)] ?? [];

        for (let tokenIndex = 0; tokenIndex < words.length; tokenIndex += 1) {
          if (globalIndex >= tfLexemes.length) {
            throw new Error(
              `Corpus token stream exceeded TF token stream at index ${globalIndex + 1} (${formatRef(
                book.english,
                chapterFile.chapter,
                verseNumber,
                tokenIndex,
              )}).`,
            );
          }

          const word = words[tokenIndex];
          const tfLexeme = tfLexemes[globalIndex];
          const tfVocLexeme = tfVocLexemes[globalIndex];
          const tfFreq = tfFreqLex[globalIndex];

          if (!tfLexeme) {
            throw new Error(
              `Empty TF lexeme at index ${globalIndex + 1} (${formatRef(
                book.english,
                chapterFile.chapter,
                verseNumber,
                tokenIndex,
              )}).`,
            );
          }

          const localFreq = Number(word.freq_lex);
          if (!Number.isFinite(localFreq)) {
            throw new Error(
              `Local freq_lex is missing/invalid at index ${globalIndex + 1} (${formatRef(
                book.english,
                chapterFile.chapter,
                verseNumber,
                tokenIndex,
              )}).`,
            );
          }

          if (localFreq !== tfFreq) {
            throw new Error(
              `freq_lex mismatch at index ${globalIndex + 1} (${formatRef(
                book.english,
                chapterFile.chapter,
                verseNumber,
                tokenIndex,
              )}): local=${localFreq}, tf=${tfFreq}`,
            );
          }

          const missingWordForms = !Array.isArray(word.word_forms);
          const { forms, padded } = ensureWordForms(word);
          const oldLexeme = String(forms[3] ?? '').trim();
          const oldVocLexeme = String(forms[4] ?? '').trim();
          const newLexeme = tfLexeme.trim();
          const newVocLexeme = String(tfVocLexeme ?? '').trim();
          const pointed = String(forms[1] ?? forms[0] ?? '').trim();

          uniqueOldWordForm4.add(oldLexeme);
          uniqueNewWordForm4.add(newLexeme);
          uniqueOldWordForm5.add(oldVocLexeme);
          uniqueNewWordForm5.add(newVocLexeme);

          if (padded) {
            tokensWithWordFormsPadding += 1;
          }

          if (oldVocLexeme !== newVocLexeme) {
            tokensWithVocLexemeChange += 1;
          }

          if (oldLexeme !== newLexeme) {
            tokensWithLemmaChange += 1;
            const changeKey = `${oldLexeme}\u0000${newLexeme}`;
            changeCounts.set(changeKey, (changeCounts.get(changeKey) ?? 0) + 1);

            const sample: ChangeSample = {
              index: globalIndex + 1,
              ref: formatRef(book.english, chapterFile.chapter, verseNumber, tokenIndex),
              pointed,
              oldLexeme,
              newLexeme,
              oldVocLexeme,
              newVocLexeme,
            };

            if (samples.length < SAMPLE_LIMIT) {
              samples.push(sample);
            }

            if (pointed === 'תֹאכַל' && targetMatches.length < SAMPLE_LIMIT) {
              targetMatches.push(sample);
            }
          }

          if (
            args.mode === 'apply' &&
            (missingWordForms || padded || oldLexeme !== newLexeme || oldVocLexeme !== newVocLexeme)
          ) {
            forms[3] = newLexeme;
            forms[4] = newVocLexeme;
            word.word_forms = forms;
            chapterDirty = true;
          }

          globalIndex += 1;
        }
      }

      if (args.mode === 'apply' && chapterDirty) {
        await writeFile(chapterPath, JSON.stringify(chapterData, null, 4), 'utf8');
        chapterFilesWritten += 1;
      }
    }
  }

  if (globalIndex !== tfLexemes.length) {
    throw new Error(
      `Token count mismatch after traversal: local=${globalIndex}, tf=${tfLexemes.length}.`,
    );
  }

  const topChanges = Array.from(changeCounts.entries())
    .map(([key, count]) => {
      const [from, to] = key.split('\u0000');
      return { from, to, count };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.from !== b.from) return a.from.localeCompare(b.from);
      return a.to.localeCompare(b.to);
    })
    .slice(0, 30);

  const report: RunReport = {
    mode: args.mode,
    generatedAt: new Date().toISOString(),
    source: {
      provider: 'ETCBC/bhsa tf/2021',
      commit: SOURCE_COMMIT,
      lexUrl: LEX_URL,
      vocLexUrl: VOC_LEX_URL,
      freqUrl: FREQ_URL,
    },
    totals: {
      tokensProcessed: globalIndex,
      expectedWordNodes: EXPECTED_WORD_NODES,
      chapterFilesProcessed,
      chapterFilesWritten,
      tokensWithLemmaChange,
      tokensWithVocLexemeChange,
      tokensWithWordFormsPadding,
      uniqueOldWordForm4: uniqueOldWordForm4.size,
      uniqueNewWordForm4: uniqueNewWordForm4.size,
      uniqueOldWordForm5: uniqueOldWordForm5.size,
      uniqueNewWordForm5: uniqueNewWordForm5.size,
    },
    topChanges,
    samples,
    targetMatches,
  };

  await mkdir(reportDir, { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Validated ${globalIndex.toLocaleString()} tokens.`);
  console.log(`Lemma changes detected: ${tokensWithLemmaChange.toLocaleString()}`);
  console.log(`Vocalized lexeme changes detected: ${tokensWithVocLexemeChange.toLocaleString()}`);
  console.log(`word_forms padded to length>=5: ${tokensWithWordFormsPadding.toLocaleString()}`);
  if (args.mode === 'apply') {
    console.log(`Chapter files written: ${chapterFilesWritten.toLocaleString()}`);
  }

  if (targetMatches.length) {
    const first = targetMatches[0];
    console.log(`Sample target check: ${first.pointed} -> ${first.newLexeme} at ${first.ref}`);
  } else {
    console.log('Sample target check: no pointed form "תֹאכַל" encountered in changed tokens.');
  }

  console.log(`Report written to ${path.relative(projectRoot, reportPath)}`);
}

const invokedAsScript =
  typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename;

if (invokedAsScript) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
