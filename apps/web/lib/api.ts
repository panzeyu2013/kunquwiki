import { Entity, EventEntity, RevisionRecord, SearchResult, StatsOverview } from "@kunquwiki/shared";
import { apiBase, buildApiUrl, readApiError, withQuery } from "./api-core";
import { normalizeSlugPathSegment } from "./slug";

async function request<T>(path: string, options?: { allowNotFound?: boolean }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      next: { revalidate: 60 }
    });
  } catch {
    throw new Error(`无法连接到 API：${apiBase}。请确认前后端服务都已启动。`);
  }

  if (options?.allowNotFound && response.status === 404) {
    return null as T;
  }

  if (!response.ok) {
    throw new Error(await readApiError(response, `请求失败：${path}（${response.status}）`));
  }

  return (await response.json()) as T;
}

export interface HomeData {
  hero: {
    title: string;
    subtitle: string;
  };
  featuredEvents: EventEntity[];
  featuredWorks: Entity[];
  featuredPeople: Entity[];
  recentChanges: RevisionRecord[];
  stats: StatsOverview;
}

export async function getHomeData(): Promise<HomeData> {
  return request("/home");
}

export async function getEntities(filters?: {
  type?: string;
  q?: string;
  city?: string;
  status?: string;
  troupe?: string;
  person?: string;
  work?: string;
  venue?: string;
}): Promise<Entity[]> {
  return request(withQuery("/entities", filters));
}

export async function getEntity(slug: string): Promise<Entity | null> {
  return request(`/entities/${normalizeSlugPathSegment(slug)}`, { allowNotFound: true });
}

export async function searchEntities(query: string, type?: string): Promise<SearchResult[]> {
  return request(withQuery("/search", { q: query, type }));
}

export async function getRecentChanges(): Promise<RevisionRecord[]> {
  return request("/changes");
}

export async function getStats(): Promise<StatsOverview> {
  return request("/stats");
}
