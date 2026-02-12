export type RawPosTag = {
  pdp?: string;
  vt?: string;
  gn?: string;
  nu?: string;
  st?: string;
  ps?: string;
  prs?: string;
  prp?: string;
};

const POS_DISPLAY_MAP: Record<string, string> = {
  verb: 'verb',
  subs: 'noun',
  nmpr: 'proper noun',
  advb: 'adverb',
  adjv: 'adjective',
  prps: 'preposition',
  prde: 'pronoun',
  conj: 'conjunction',
  intj: 'interjection',
  nega: 'negative',
  inrg: 'interrogative',
  art: 'article',
  prep: 'preposition',
};

const FUNCTION_POS_CODES = new Set(['prep', 'conj', 'art', 'prde', 'prps']);
const CLITIC_POS_CODES = new Set(['prep', 'conj', 'art', 'prps', 'prde']);

export function isParticipialForm(posTag?: RawPosTag): boolean {
  return Boolean(posTag?.vt && posTag.vt.startsWith('ptc'));
}

export function normalizePos(posTag?: RawPosTag): string {
  if (!posTag?.pdp) {
    return 'unknown';
  }

  if (posTag.pdp === 'subs' && isParticipialForm(posTag)) {
    return 'verb';
  }

  return POS_DISPLAY_MAP[posTag.pdp] ?? posTag.pdp;
}

export function isFunctionWord(posTag?: RawPosTag): boolean {
  return Boolean(posTag?.pdp && FUNCTION_POS_CODES.has(posTag.pdp));
}

export function cleanGloss(gloss?: string): string {
  if (!gloss) {
    return '';
  }

  return gloss
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLexeme(raw?: string): string {
  if (!raw) {
    return '';
  }

  return raw.replace(/\s+/g, '').trim();
}

function getVerbLemmaPriority(posTag?: RawPosTag): number {
  if (!posTag) return 0;

  const vt = (posTag.vt ?? '').toLowerCase();
  const gn = (posTag.gn ?? '').toLowerCase();
  const nu = (posTag.nu ?? '').toLowerCase();

  const isMasculine = !gn || gn === 'm' || gn === 'c' || gn === 'unknown';
  const isSingular = !nu || nu === 'sg' || nu === 'unknown';

  if (vt === 'perf' && isMasculine && isSingular) return 50;
  if (vt === 'perf') return 40;
  if (vt === 'impv') return 30;
  if (vt === 'impf' || vt === 'wayq') return 20;
  if (vt.startsWith('ptc') || vt.startsWith('inf')) return 10;

  return 0;
}

function getNominalLemmaPriority(posTag?: RawPosTag): number {
  if (!posTag) return 0;

  const status = (posTag.st ?? '').toLowerCase();
  const number = (posTag.nu ?? '').toLowerCase();
  const hasSuffix = Boolean(posTag.ps || posTag.prs || posTag.prp);

  let priority = 0;

  if (status === 'a') {
    priority += 100;
  } else if (status === 'c') {
    priority += 60;
  } else if (status) {
    priority += 40;
  }

  if (!number || number === 'sg') {
    priority += 20;
  } else if (number === 'pl') {
    priority += 15;
  } else if (number === 'du') {
    priority += 10;
  }

  if (!hasSuffix) {
    priority += 5;
  }

  return priority;
}

export function headwordPriority(posTag: RawPosTag | undefined, normalizedPos: string): number {
  if (normalizedPos === 'verb') {
    return getVerbLemmaPriority(posTag);
  }

  if (normalizedPos === 'noun' || normalizedPos === 'proper noun' || normalizedPos === 'adjective') {
    return getNominalLemmaPriority(posTag);
  }

  return 0;
}

export function buildLemmaId(lexeme: string, normalizedPos: string): string {
  return `${normalizedPos}::${lexeme}`;
}

export function stripHebrewDiacritics(text: string): string {
  return text.replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
}

function shouldAttachToNextWord(
  posTag: RawPosTag | undefined,
  displayText: string,
  hasMaqaf: boolean,
  hasTrailingSpace: boolean,
): boolean {
  if (hasTrailingSpace) return false;
  if (hasMaqaf) return true;

  const pdp = posTag?.pdp;
  if (!pdp || !CLITIC_POS_CODES.has(pdp)) return false;

  const lettersOnly = stripHebrewDiacritics(displayText).replace(/[^\u05D0-\u05EA]/g, '');
  return lettersOnly.length === 1;
}

type RawWord = {
  pos_tag?: RawPosTag;
  word_forms?: string[];
};

export function assembleVerseText(words: RawWord[]): string {
  if (!words.length) {
    return '';
  }

  let output = '';

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const rawForm = word.word_forms?.[0] ?? '';
    const displayText = (word.word_forms?.[1] ?? '').trim();

    if (!displayText) {
      continue;
    }

    const trimmedRaw = rawForm.replace(/\s+$/, '');
    const hasTrailingSpace = trimmedRaw.length !== rawForm.length;
    const hasMaqaf = trimmedRaw.endsWith('־');
    const token = hasMaqaf && !displayText.endsWith('־') ? `${displayText}־` : displayText;

    output += token;

    const attach = shouldAttachToNextWord(word.pos_tag, displayText, hasMaqaf, hasTrailingSpace);
    if (i < words.length - 1 && !attach) {
      output += ' ';
    }
  }

  return output.trim();
}
