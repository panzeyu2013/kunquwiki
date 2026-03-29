export function decodeSlugForDisplay(slug: string) {
  const trimmed = slug.trim();
  return /%[0-9A-Fa-f]{2}/.test(trimmed) ? decodeURIComponent(trimmed) : trimmed;
}

export function normalizeSlugPathSegment(slug: string) {
  return encodeURIComponent(decodeSlugForDisplay(slug));
}
