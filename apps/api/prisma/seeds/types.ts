import {
  ArticleType,
  EntityType,
  EventStatus,
  EventType,
  IdentityTerm,
  ProposalStatus,
  PublishStatus,
  ReviewStatus,
  TroupeType,
  UserRole,
  UserStatus,
  WorkType
} from "@prisma/client";

export type SeedUser = {
  username: string;
  displayName: string;
  email: string;
  roles: UserRole[];
  status?: UserStatus;
  password?: string;
};

export type SeedSource = {
  key: string;
  sourceType: string;
  title: string;
  publisher?: string;
  author?: string;
  sourceUrl?: string;
  publicationDate?: string | null;
  reliabilityLevel: string;
  archivedUrl?: string | null;
  notes?: string | null;
};

export type SeedMediaAsset = {
  key: string;
  assetType: "image" | "video" | "audio" | "document";
  url: string;
  mimeType?: string;
  altText?: string;
  width?: number | null;
  height?: number | null;
};

export type SeedAlias = {
  alias: string;
  aliasType: string;
  isPrimary?: boolean;
};

export type SeedSourceRef = {
  sourceKey: string;
  refNote?: string | null;
  citationText?: string | null;
  sortOrder?: number;
};

export type SeedBaseEntity = {
  slug: string;
  title: string;
  subtitle?: string | null;
  status?: PublishStatus;
  visibility?: string;
  coverImageKey?: string | null;
  createdBy?: string;
  updatedBy?: string;
  publishedAt?: string | null;
  content?: {
    bodyMarkdown: string;
  };
  aliases?: SeedAlias[];
  sources?: SeedSourceRef[];
};

export type SeedCity = SeedBaseEntity & {
  province: string;
};

export type SeedWork = SeedBaseEntity & {
  workType: WorkType;
  parentWorkSlug?: string | null;
  originalAuthor?: string | null;
  dynastyPeriod?: string | null;
  genreNote?: string | null;
  synopsis: string;
  plot: string;
  durationMinutes?: number | null;
  firstKnownDate?: string | null;
};

export type SeedPerson = SeedBaseEntity & {
  personTypeNote?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  birthCitySlug?: string | null;
  bio: string;
  isLiving?: boolean | null;
};

export type SeedTroupe = SeedBaseEntity & {
  troupeType: TroupeType;
  foundedDate?: string | null;
  dissolvedDate?: string | null;
  citySlug?: string | null;
  cityText?: string | null;
  regionText?: string | null;
  description: string;
  officialWebsite?: string | null;
};

export type SeedVenue = SeedBaseEntity & {
  venueType: string;
  countryText?: string | null;
  citySlug?: string | null;
  regionText: string;
  cityText: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number | null;
  description?: string | null;
};

export type SeedEvent = SeedBaseEntity & {
  eventType: EventType;
  businessStatus: EventStatus;
  startAt: string;
  endAt?: string | null;
  timezone?: string | null;
  citySlug?: string | null;
  venueSlug?: string | null;
  organizerText?: string | null;
  ticketUrl?: string | null;
  durationText?: string | null;
  ticketStatus?: string | null;
  noteText?: string | null;
  posterImageKey?: string | null;
  lastVerifiedAt?: string | null;
};

export type SeedArticle = SeedBaseEntity & {
  articleType: ArticleType;
  abstract?: string | null;
  difficultyLevel?: string | null;
  bodySourceType?: string | null;
};

export type SeedRole = SeedBaseEntity & {
  workSlug?: string | null;
  roleCategory?: string | null;
  description?: string | null;
};

export type SeedTopic = SeedBaseEntity & {
  topicType: string;
  heroText?: string | null;
  layoutJson?: Record<string, unknown> | null;
};

export type SeedPersonIdentity = {
  personSlug: string;
  identityTerm: IdentityTerm;
  startDate?: string | null;
  endDate?: string | null;
};

export type SeedMembership = {
  personSlug: string;
  troupeSlug: string;
  membershipRole: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
};

export type SeedEventProgramItem = {
  key: string;
  eventSlug: string;
  workSlug?: string | null;
  titleOverride?: string | null;
  sequenceNo: number;
  durationMinutes?: number | null;
  notes?: string | null;
};

export type SeedPerformanceCast = {
  programItemKey: string;
  roleSlug?: string | null;
  personSlug?: string | null;
  castNote?: string | null;
};

export type SeedEventParticipant = {
  eventSlug: string;
  personSlug?: string | null;
  participationRole: string;
  creditedAs?: string | null;
  sortOrder?: number | null;
};

export type SeedEventTroupe = {
  eventSlug: string;
  troupeSlug: string;
  sortOrder?: number | null;
};

export type SeedEntityRelation = {
  fromSlug: string;
  toSlug: string;
  relationType: string;
  note?: string | null;
  sortOrder?: number | null;
};

export type SeedRevision = {
  entitySlug: string;
  revisionNo: number;
  title: string;
  bodyMarkdown?: string | null;
  structuredDataJson?: Record<string, unknown> | null;
  editSummary: string;
  reviewStatus: ReviewStatus;
  editorUsername: string;
  reviewerUsername?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

export type SeedProposal = {
  entitySlug?: string | null;
  targetEntityType?: EntityType | null;
  proposerUsername: string;
  proposalType: string;
  payloadJson: Record<string, unknown>;
  status?: ProposalStatus;
  reviewerUsername?: string | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
};

export type SeedDiscussionPost = {
  authorUsername: string;
  body: string;
  createdAt?: string | null;
};

export type SeedDiscussionThread = {
  entitySlug: string;
  title: string;
  createdByUsername: string;
  status?: string;
  createdAt?: string | null;
  posts?: SeedDiscussionPost[];
};

export type SeedData = {
  users: SeedUser[];
  sources: SeedSource[];
  mediaAssets: SeedMediaAsset[];
  cities: SeedCity[];
  works: SeedWork[];
  persons: SeedPerson[];
  troupes: SeedTroupe[];
  venues: SeedVenue[];
  events: SeedEvent[];
  articles: SeedArticle[];
  roles: SeedRole[];
  topics: SeedTopic[];
  personIdentities: SeedPersonIdentity[];
  memberships: SeedMembership[];
  eventProgramItems: SeedEventProgramItem[];
  performanceCasts: SeedPerformanceCast[];
  eventParticipants: SeedEventParticipant[];
  eventTroupes: SeedEventTroupe[];
  relations: SeedEntityRelation[];
  revisions: SeedRevision[];
  proposals: SeedProposal[];
  discussions: SeedDiscussionThread[];
};
