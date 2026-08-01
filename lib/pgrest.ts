// PostgREST `.or()` / `.filter()` strings are comma-separated `column.op.value` triples, with
// parentheses for grouping. When a raw user value is interpolated into one of those strings, a
// comma or paren lets the caller inject extra conditions (filter injection, item D). Usernames
// and spotify_ids never legitimately contain these characters, so stripping them neutralises the
// attack without affecting real lookups.
export function sanitizeFilterValue(value: string): string {
  return value.replace(/[,()]/g, "");
}

// For ilike prefix search, also drop the wildcard characters so a caller can't widen the match
// (e.g. "%" to match everything) — the route appends its own trailing "%".
export function sanitizeSearchTerm(value: string): string {
  return value.replace(/[,()%*]/g, "");
}
