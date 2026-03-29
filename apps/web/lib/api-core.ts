export const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

type QueryValue = string | number | boolean | null | undefined;

export function buildApiUrl(path: string) {
  return `${apiBase}${path}`;
}

export function withQuery(path: string, params?: Record<string, QueryValue>) {
  if (!params) {
    return path;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const suffix = searchParams.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export async function readApiError(response: Response, fallbackMessage: string) {
  const text = await response.text();
  const normalized = text.replace(/^Error:\s*/i, "").trim();
  return normalized || fallbackMessage;
}
