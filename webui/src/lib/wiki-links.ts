/** Build the canonical Wiki browser URL for a wiki file path (e.g. `glossary/foo.md`). */
export function wikiHref(path: string, category?: string): string {
  const cat = category ?? path.split('/')[0];
  const params = new URLSearchParams({ category: cat, page: path });
  return `/knowledge-base/wiki?${params.toString()}`;
}

const KB_STATIC_SEGMENTS = new Set(['wiki', 'graph', 'ingest', 'overview', 'query', 'tasks']);

/** Normalize markdown / deep links to the Wiki browser URL when they point at wiki files. */
export function resolveWikiMarkdownLink(raw: string): string {
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('#')) {
    return raw;
  }
  if (raw.startsWith('../')) {
    return '/knowledge-base/wiki';
  }
  if (raw.startsWith('/knowledge-base/wiki')) {
    return raw;
  }
  const kbPrefix = '/knowledge-base/';
  if (raw.startsWith(kbPrefix)) {
    const rest = raw.slice(kbPrefix.length).replace(/^\//, '');
    const top = rest.split('/')[0];
    if (!KB_STATIC_SEGMENTS.has(top)) {
      return wikiHref(rest);
    }
    return raw;
  }
  if (raw.includes('/')) {
    return wikiHref(raw);
  }
  return raw;
}
