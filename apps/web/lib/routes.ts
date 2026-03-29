import { EntityType } from "@kunquwiki/shared";

const entityRouteMap: Partial<Record<EntityType, string>> = {
  work: "/works",
  person: "/people",
  troupe: "/troupes",
  venue: "/venues",
  event: "/events",
  article: "/articles",
  city: "/cities"
};

export function getEntityCollectionPath(entityType: string) {
  return entityRouteMap[entityType as EntityType];
}

export function isRoutableEntityType(entityType: string): entityType is EntityType {
  return Boolean(getEntityCollectionPath(entityType));
}

export function getEntityDetailPath(entityType: string, slug: string) {
  const collectionPath = getEntityCollectionPath(entityType);
  return collectionPath ? `${collectionPath}/${slug}` : `/${slug}`;
}
