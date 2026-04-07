# Hebrew Vocab Modern

Modern static app for Hebrew OT vocabulary frequency by chapter range.

## Stack
- React 19 + TypeScript + Vite
- Zod runtime schema validation
- Vitest unit tests
- GitHub Pages workflows

## Data Build
Canonical source is `bhsa_json/`.

Generate precomputed artifacts:

```bash
pnpm build:data
```

This creates:
- `public/data/catalog.json`
- `public/data/books/{bookId}.json`

## App Commands
```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

## Query URL Contract
`?book={bookId}&from={n}&to={n}&fn={0|1}`

## Export Formats
- CSV: `rank,headword,pos,gloss,count,percent,chapter_spread,variants`
- Anki TSV: `front,back,tags`
