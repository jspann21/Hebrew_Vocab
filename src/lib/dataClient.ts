import type { BookArtifact, Catalog } from '../types/data';
import { bookArtifactSchema, catalogSchema } from '../types/schemas';

const bookCache = new Map<string, BookArtifact>();
let catalogCache: Catalog | null = null;

export async function loadCatalog(): Promise<Catalog> {
  if (catalogCache) {
    return catalogCache;
  }

  const response = await fetch('./data/catalog.json');
  if (!response.ok) {
    throw new Error('Unable to load catalog data.');
  }

  const parsed = catalogSchema.parse(await response.json());
  catalogCache = parsed;
  return parsed;
}

export async function loadBookArtifact(bookId: string): Promise<BookArtifact> {
  if (bookCache.has(bookId)) {
    return bookCache.get(bookId) as BookArtifact;
  }

  const response = await fetch(`./data/books/${bookId}.json`);
  if (!response.ok) {
    throw new Error(`Unable to load data for book '${bookId}'.`);
  }

  const parsed = bookArtifactSchema.parse(await response.json());
  bookCache.set(bookId, parsed);
  return parsed;
}
