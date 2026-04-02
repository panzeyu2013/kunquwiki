export function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  if (dupes.size > 0) {
    throw new Error(`${label} must be unique. Duplicates: ${Array.from(dupes).join(", ")}`);
  }
}

export function assertRequired(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEnumValue<T extends string>(value: T, allowed: readonly T[], message: string) {
  if (!allowed.includes(value)) {
    throw new Error(message);
  }
}

export function assertRefExists(map: Map<string, string>, ref: string | null | undefined, message: string) {
  if (!ref) return;
  if (!map.has(ref)) {
    throw new Error(message);
  }
}
