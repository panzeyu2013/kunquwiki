"use client";

import { getStoredToken, setStoredToken } from "./auth";
import { apiBase, buildApiUrl, readApiError, withQuery } from "./api-core";
import { normalizeSlugPathSegment } from "./slug";
import type {
  ArticleType,
  EventStatus,
  EventType,
  IdentityOption,
  TroupeType,
  WorkType
} from "@kunquwiki/shared";

async function request<T>(path: string, init?: RequestInit, useAuth = false): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  if (useAuth) {
    const token = getStoredToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      headers
    });
  } catch {
    throw new Error(`无法连接到 API：${apiBase}。请确认后端服务已经启动。`);
  }

  if (!response.ok) {
    throw new Error(await readApiError(response, `请求失败，状态码 ${response.status}`));
  }

  return response.json() as Promise<T>;
}

export async function login(identifier: string, password: string) {
  const data = await request<{ token: string; user: { id: string; username: string; displayName: string; roles: string[] } }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ identifier, password })
    }
  );
  setStoredToken(data.token);
  return data;
}

export async function register(input: { username: string; displayName: string; email: string; password: string }) {
  const data = await request<{ token: string; user: { id: string; username: string; displayName: string; roles: string[] } }>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
  setStoredToken(data.token);
  return data;
}

export function getMe() {
  return request<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    roles: string[];
    status: string;
    reputation: number;
  }>("/auth/me", undefined, true);
}

export function getEntityPublic(slug: string) {
  return request<{
    id: string;
    entityType: string;
    slug: string;
    title: string;
    body?: string;
    coverImageId?: string;
    coverImage?: { id: string; assetType: string; url: string; mimeType?: string; altText?: string; width?: number; height?: number };
    synopsis?: string;
    plot?: string;
    bio?: string;
    description?: string;
    workType?: WorkType;
    originalAuthor?: string;
    dynastyPeriod?: string;
    genreNote?: string;
    parentWorkId?: string;
    durationMinutes?: number;
    firstKnownDate?: string;
    roles?: string[];
    personTypeNote?: string;
    troupeIds?: string[];
    troupeType?: TroupeType;
    foundedDate?: string;
    dissolvedDate?: string;
    cityId?: string;
    cityText?: string;
    regionText?: string;
    address?: string;
    venueType?: string;
    countryText?: string;
    latitude?: number;
    longitude?: number;
    capacity?: number;
    officialWebsite?: string;
    gender?: string;
    birthDate?: string;
    deathDate?: string;
    birthCityId?: string;
    isLiving?: boolean | null;
    personIdentities?: Array<{ id?: string; identityTerm?: string; startDate?: string; endDate?: string }>;
    troupeMemberships?: Array<{
      id?: string;
      troupeEntityId?: string;
      membershipRole?: string;
      startDate?: string;
      endDate?: string;
      isCurrent?: boolean;
    }>;
    representativeWorkIds?: string[];
    representativeExcerptIds?: string[];
    eventType?: EventType;
    businessStatus?: string;
    startAt?: string;
    endAt?: string;
    venueId?: string;
    ticketUrl?: string;
    duration?: string;
    ticketStatus?: string;
    noteText?: string;
    posterImageId?: string;
    posterImage?: { id: string; assetType: string; url: string; mimeType?: string; altText?: string; width?: number; height?: number };
    program?: Array<{ workId?: string; workType?: WorkType }>;
    programDetailed?: Array<{
      id?: string;
      workEntityId?: string;
      titleOverride?: string;
      sequenceNo?: number;
      durationMinutes?: number;
      notes?: string;
      casts?: Array<{ id?: string; roleEntityId?: string; personEntityId?: string; castNote?: string }>;
    }>;
    abstract?: string;
    articleType?: ArticleType;
    difficultyLevel?: string;
    bodySourceType?: string;
    province?: string;
    upcomingEvents?: Array<{
      id: string;
      slug: string;
      title: string;
      startAt: string;
      city?: string;
      venue?: string;
      troupe?: string;
    }>;
    pastEvents?: Array<{
      id: string;
      slug: string;
      title: string;
      startAt: string;
      city?: string;
      venue?: string;
      troupe?: string;
    }>;
  }>(`/entities/${normalizeSlugPathSegment(slug)}`);
}

export function listPublicEntities(type: string) {
  return request<Array<{ id: string; slug: string; title: string }>>(withQuery("/entities", { type }));
}

export function getEditorOptions(entityType?: string, excludeEntityId?: string) {
  return request<{
    identityOptions: IdentityOption[];
    workTypeOptions: WorkType[];
    troupeTypeOptions: TroupeType[];
    articleTypeOptions: ArticleType[];
    eventTypeOptions: EventType[];
    eventStatusOptions: EventStatus[];
    works: Array<{ id: string; slug: string; title: string }>;
    fullWorks: Array<{ id: string; slug: string; title: string }>;
    excerpts: Array<{ id: string; slug: string; title: string }>;
    people: Array<{ id: string; slug: string; title: string }>;
    troupes: Array<{ id: string; slug: string; title: string }>;
    venues: Array<{ id: string; slug: string; title: string }>;
    cities: Array<{ id: string; slug: string; title: string }>;
    roleEntities: Array<{ id: string; slug: string; title: string }>;
  }>(withQuery("/editor/options", { entityType, excludeEntityId }));
}

export function createQuickEntityClient(input: {
  entityType: string;
  title: string;
  workType?: WorkType;
  parentWorkId?: string;
  initialData?: Record<string, unknown>;
}) {
  return request<{ id: string; slug: string; title: string }>("/editor/quick-create", {
    method: "POST",
    body: JSON.stringify(input)
  }, true);
}

export function submitCreateProposal(payload: {
  entityType: string;
  proposalType: string;
  editSummary: string;
  payload: Record<string, unknown>;
}) {
  return request("/entities/proposals", {
    method: "POST",
    body: JSON.stringify(payload)
  }, true);
}

export function submitProposal(
  slug: string,
  payload: {
    proposalType: string;
    editSummary: string;
    payload: Record<string, unknown>;
  }
) {
  return request(`/entities/${normalizeSlugPathSegment(slug)}/proposals`, { method: "POST", body: JSON.stringify(payload) }, true);
}

export function getModerationQueueClient() {
  return request<
    Array<{
      id: string;
      entityId: string | null;
      proposalType: string;
      payloadJson: Record<string, unknown>;
      status: string;
      createdAt: string;
      targetEntityType: string | null;
      proposer: { id: string; username: string; displayName: string; roles: string[] };
      entity: { id: string; entityType: string; slug: string; title: string } | null;
    }>
  >("/moderation/queue", undefined, true);
}

export function getRecentChangesClient() {
  return request<
    Array<{
      id: string;
      entityId: string;
      revisionNo: number;
      reviewStatus: string;
      editorName: string;
      editSummary: string;
      createdAt: string;
    }>
  >("/changes");
}

export function reviewProposal(id: string, decision: "approved" | "rejected", reviewComment?: string) {
  return request(`/moderation/proposals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ decision, reviewComment })
  }, true);
}

export function getAdminOverviewClient() {
  return request<{
    pendingProposals: number;
    totalUsers: number;
    recentAuditLogs: Array<{ id: string; actionType: string; targetType: string; targetId: string; actor: string; createdAt: string }>;
    recentRevisions: Array<{ id: string; entityId: string; revisionNo: number; editSummary: string; editor: string; createdAt: string }>;
  }>("/admin/overview", undefined, true);
}

export function getAdminUsersClient() {
  return request<
    Array<{
      id: string;
      username: string;
      displayName: string;
      email: string;
      roles: string[];
      status: string;
      reputation: number;
      createdAt: string;
      updatedAt: string;
    }>
  >("/admin/users", undefined, true);
}

export function deleteEntityClient(entityId: string) {
  return request(`/admin/entities/${entityId}`, { method: "DELETE" }, true);
}

export function updateAdminUserClient(
  id: string,
  input: { roles?: string[]; status?: string; reputation?: number }
) {
  return request(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  }, true);
}
