-- Drop duplicate subtype entityType columns.
ALTER TABLE "City" DROP COLUMN IF EXISTS "entityType";
ALTER TABLE "Work" DROP COLUMN IF EXISTS "entityType";
ALTER TABLE "Person" DROP COLUMN IF EXISTS "entityType";
ALTER TABLE "Troupe" DROP COLUMN IF EXISTS "entityType";
ALTER TABLE "Venue" DROP COLUMN IF EXISTS "entityType";
ALTER TABLE "Event" DROP COLUMN IF EXISTS "entityType";
ALTER TABLE "Article" DROP COLUMN IF EXISTS "entityType";
ALTER TABLE "Role" DROP COLUMN IF EXISTS "entityType";
ALTER TABLE "Topic" DROP COLUMN IF EXISTS "entityType";

-- Rename fallback location text fields to explicit *Text names.
ALTER TABLE "Troupe" RENAME COLUMN "city" TO "cityText";
ALTER TABLE "Troupe" RENAME COLUMN "region" TO "regionText";

ALTER TABLE "Venue" RENAME COLUMN "country" TO "countryText";
ALTER TABLE "Venue" RENAME COLUMN "city" TO "cityText";
ALTER TABLE "Venue" RENAME COLUMN "region" TO "regionText";

-- Restore media assets and formal relations for entity covers and event posters.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssetType') THEN
    CREATE TYPE "AssetType" AS ENUM ('image', 'audio', 'video', 'document');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MediaAsset" (
  "id" TEXT NOT NULL,
  "assetType" "AssetType" NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT,
  "altText" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Entity_coverImageId_idx" ON "Entity"("coverImageId");
CREATE INDEX IF NOT EXISTS "Event_posterImageId_idx" ON "Event"("posterImageId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Entity_coverImageId_fkey'
      AND table_name = 'Entity'
  ) THEN
    ALTER TABLE "Entity"
      ADD CONSTRAINT "Entity_coverImageId_fkey"
      FOREIGN KEY ("coverImageId") REFERENCES "MediaAsset"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Event_posterImageId_fkey'
      AND table_name = 'Event'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_posterImageId_fkey"
      FOREIGN KEY ("posterImageId") REFERENCES "MediaAsset"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Reject meaningless cast rows where both role and person are missing.
ALTER TABLE "PerformanceCast" DROP CONSTRAINT IF EXISTS "PerformanceCast_role_or_person_required";
ALTER TABLE "PerformanceCast"
  ADD CONSTRAINT "PerformanceCast_role_or_person_required"
  CHECK ("roleEntityId" IS NOT NULL OR "personEntityId" IS NOT NULL);
