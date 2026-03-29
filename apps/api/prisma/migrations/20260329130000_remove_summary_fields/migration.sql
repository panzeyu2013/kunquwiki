ALTER TABLE "Entity"
DROP COLUMN IF EXISTS "summary";

ALTER TABLE "EntityRevision"
DROP COLUMN IF EXISTS "summary";

ALTER TABLE "SearchIndex"
DROP COLUMN IF EXISTS "summary";

ALTER TABLE "SearchIndex"
DROP COLUMN IF EXISTS "previewText";
