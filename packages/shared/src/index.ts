export type EntityType =
  | "work"
  | "person"
  | "troupe"
  | "venue"
  | "event"
  | "city"
  | "article"
  | "role"
  | "topic";

export type PublishStatus = "draft" | "published" | "archived" | "pending_review";
export type EventStatus = "announced" | "scheduled" | "completed" | "cancelled" | "postponed";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type WorkType = "full_play" | "excerpt" | "adapted_piece";
export type TroupeType = "troupe" | "school" | "research_org";
export type EventType = "performance" | "festival" | "lecture" | "memorial";
export type ArticleType = "term" | "costume" | "music" | "history" | "technique";
export type IdentityOption = "actor" | "teacher" | "director" | "writer" | "researcher" | "promoter";


export interface BaseEntity {
  id: string;
  entityType: EntityType;
  slug: string;
  title: string;
  subtitle?: string;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
  references?: Array<{
    title: string;
    url?: string;
    publisher?: string;
  }>;
  relatedEntities?: SearchResult[];
  upcomingEvents?: RelatedEventRecord[];
  pastEvents?: RelatedEventRecord[];
}

export interface WorkEntity extends BaseEntity {
  entityType: "work";
  workType: WorkType;
  originalAuthor?: string;
  dynastyPeriod?: string;
  parentWorkId?: string;
  synopsis: string;
  plot: string;
}

export interface PersonEntity extends BaseEntity {
  entityType: "person";
  roles: IdentityOption[];
  gender?: string;
  birthCityId?: string;
  troupeIds: string[];
  representativeWorkIds: string[];
  representativeExcerptIds: string[];
  bio: string;
}

export interface TroupeEntity extends BaseEntity {
  entityType: "troupe";
  cityId?: string;
  city: string;
  region: string;
  troupeType: TroupeType;
  description: string;
  officialWebsite?: string;
}

export interface VenueEntity extends BaseEntity {
  entityType: "venue";
  cityId?: string;
  city: string;
  region: string;
  address: string;
  capacity?: number;
  description?: string;
}

export interface CityEntity extends BaseEntity {
  entityType: "city";
  province: string;
}

export interface ProgramItem {
  id: string;
  title: string;
  workId?: string;
  workType?: WorkType;
  sequenceNo: number;
  durationMinutes?: number;
  casts?: Array<{
    id: string;
    roleId?: string;
    personId?: string;
    castNote?: string;
  }>;
}

export interface EventEntity extends BaseEntity {
  entityType: "event";
  eventType: EventType;
  businessStatus: EventStatus;
  startAt: string;
  endAt?: string;
  cityId?: string;
  venueId?: string;
  troupeIds: string[];
  ticketUrl?: string;
  duration?: string;
  ticketStatus?: string;
  noteText?: string;
  body: string;
  program: ProgramItem[];
}

export interface ArticleEntity extends BaseEntity {
  entityType: "article";
  articleType: ArticleType;
  body: string;
}

export type Entity = WorkEntity | PersonEntity | TroupeEntity | VenueEntity | EventEntity | CityEntity | ArticleEntity;

export interface RelatedEventRecord {
  id: string;
  slug: string;
  title: string;
  startAt: string;
  city?: string;
  venue?: string;
  troupe?: string;
}

export interface RevisionRecord {
  id: string;
  entityId: string;
  revisionNo: number;
  reviewStatus: ReviewStatus;
  editorName: string;
  editSummary: string;
  createdAt: string;
}

export interface SearchResult {
  id: string;
  slug: string;
  title: string;
  entityType: EntityType;
}

export interface StatsOverview {
  totalPublishedEntries: number;
  totalUpcomingEvents: number;
  totalHistoricalEvents: number;
  totalWorks: number;
  totalPeople: number;
  totalTroupes: number;
  topWorks: Array<{ title: string; count: number }>;
  topCities: Array<{ city: string; count: number }>;
}
