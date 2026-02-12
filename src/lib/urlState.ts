export type UrlState = {
  bookId?: string;
  from?: number;
  to?: number;
  includeFunctionWords?: boolean;
};

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const bookId = params.get('book') ?? undefined;
  const fromValue = Number(params.get('from'));
  const toValue = Number(params.get('to'));
  const includeFlag = params.get('fn');

  return {
    bookId,
    from: Number.isFinite(fromValue) && fromValue > 0 ? fromValue : undefined,
    to: Number.isFinite(toValue) && toValue > 0 ? toValue : undefined,
    includeFunctionWords: includeFlag === '1',
  };
}

export function writeUrlState(state: {
  bookId: string;
  from: number;
  to: number;
  includeFunctionWords: boolean;
}): void {
  const params = new URLSearchParams(window.location.search);
  params.set('book', state.bookId);
  params.set('from', String(state.from));
  params.set('to', String(state.to));
  params.set('fn', state.includeFunctionWords ? '1' : '0');

  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', next);
}
