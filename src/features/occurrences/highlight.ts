function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightForms(verseText: string, forms: string[]): string {
  if (!verseText || forms.length === 0) {
    return verseText;
  }

  const uniqueForms = Array.from(new Set(forms.filter(Boolean))).sort((a, b) => b.length - a.length);
  if (uniqueForms.length === 0) {
    return verseText;
  }

  const pattern = uniqueForms.map((form) => escapeRegex(form)).join('|');
  const regex = new RegExp(`(${pattern})`, 'g');

  return verseText.replace(regex, '<mark>$1</mark>');
}
