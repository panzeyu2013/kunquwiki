export function stripMarkdown(value?: string | null) {
  const safeValue = typeof value === "string" ? value : "";
  return safeValue
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerptText(value?: string | null, limit = 120) {
  const plainText = stripMarkdown(value);
  if (plainText.length <= limit) {
    return plainText;
  }
  return `${plainText.slice(0, limit).trimEnd()}...`;
}
