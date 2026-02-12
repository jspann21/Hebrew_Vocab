import type { FrequencyRowDetail } from '../../types/data';

function quoteCsv(value: string | number): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: FrequencyRowDetail[]): string {
  const header = 'rank,headword,pos,gloss,count,percent,chapter_spread,variants';

  const body = rows.map((row) => {
    return [
      row.rank,
      quoteCsv(row.headword),
      quoteCsv(row.pos),
      quoteCsv(row.gloss),
      row.count,
      row.percent.toFixed(2),
      row.chapterSpread,
      quoteCsv(row.variants.join('; ')),
    ].join(',');
  });

  return [header, ...body].join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeTag(text: string): string {
  return text.trim().replace(/\s+/g, '_').replace(/[":]/g, '');
}

export function toAnkiTsv(
  rows: FrequencyRowDetail[],
  _bookId: string, // Kept for backwards compatibility if needed, but primarily using bookName now
  bookName: string,
  startChapter: number,
  endChapter: number,
): string {
  const header = '#separator:tab\n#html:true\n#tags column:3';
  const body = rows
    .map((row) => {
      const front = escapeHtml(row.headword);
      const back = `${escapeHtml(row.gloss)}<br/>POS: ${escapeHtml(row.pos)}<br/>Count: ${row.count}<br/>Range: ${escapeHtml(bookName)} ${startChapter}-${endChapter}`;

      const safeBook = sanitizeTag(bookName);
      const safePos = sanitizeTag(row.pos);

      const tags = [
        `HebrewVocab::${safeBook}`,
        `HebrewVocab::${safeBook}::Ch${startChapter}-${endChapter}`,
        `Part_of_Speech::${safePos}`,
      ].join(' ');

      return [front, back, tags]
        .map((part) => String(part).replace(/\t/g, ' ').replace(/\n/g, '<br>'))
        .join('\t');
    })
    .join('\n');

  return `${header}\n${body}`;
}

const UTF8_BOM = '\uFEFF';

export function downloadText(filename: string, content: string, mimeType: string): void {
  const withBom = mimeType.includes('charset=utf-8') ? UTF8_BOM + content : content;
  const blob = new Blob([withBom], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
