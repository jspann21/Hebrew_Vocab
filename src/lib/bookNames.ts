const DISPLAY_NAME_MAP: Record<string, string> = {
  Genesis: 'Genesis',
  Exodus: 'Exodus',
  Leviticus: 'Leviticus',
  Numeri: 'Numbers',
  Deuteronomium: 'Deuteronomy',
  Josua: 'Joshua',
  Judices: 'Judges',
  'Samuel I': '1 Samuel',
  'Samuel II': '2 Samuel',
  'Reges I': '1 Kings',
  'Reges II': '2 Kings',
  Jesaia: 'Isaiah',
  Jeremia: 'Jeremiah',
  Ezechiel: 'Ezekiel',
  Hosea: 'Hosea',
  Joel: 'Joel',
  Amos: 'Amos',
  Obadia: 'Obadiah',
  Jona: 'Jonah',
  Micha: 'Micah',
  Nahum: 'Nahum',
  Habakuk: 'Habakkuk',
  Zephania: 'Zephaniah',
  Haggai: 'Haggai',
  Sacharia: 'Zechariah',
  Maleachi: 'Malachi',
  Psalmi: 'Psalms',
  Iob: 'Job',
  Proverbia: 'Proverbs',
  Ruth: 'Ruth',
  Canticum: 'Song of Songs',
  Ecclesiastes: 'Ecclesiastes',
  Threni: 'Lamentations',
  Esther: 'Esther',
  Daniel: 'Daniel',
  Esra: 'Ezra',
  Nehemia: 'Nehemiah',
  'Chronica I': '1 Chronicles',
  'Chronica II': '2 Chronicles',
};

export function toDisplayBookName(datasetName: string): string {
  return DISPLAY_NAME_MAP[datasetName] ?? datasetName;
}

export function toBookId(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toDatasetFolder(datasetName: string): string {
  return datasetName.replace(/\s+/g, '_');
}

export function toDatasetNameFromFolder(folderName: string): string {
  return folderName.replace(/_/g, ' ');
}
