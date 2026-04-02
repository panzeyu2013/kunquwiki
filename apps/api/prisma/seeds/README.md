# Seed System Overview

This directory separates seed **execution logic** from **data**. The goal is to keep runtime logic stable while allowing data growth via JSON updates only.

## Structure

- `index.ts`: main seed orchestration (clear, import, relations, search index)
- `types.ts`: JSON data types
- `loaders/`: JSON loading + validations
- `importers/`: database writers by module
- `utils/`: shared helpers (date, validation, entity creation)
- `data/`: all seed data (JSON)

## Execution Flow (Order & Dependencies)

1. **Clear existing data**
   - Deletes dependent tables first, then entities, then users
2. **Users**
   - Required for `createdBy` / `updatedBy` on entities, and for revisions/proposals/discussions
3. **Sources**
   - Needed for entity source refs
4. **Media assets**
   - Needed for `coverImageKey` and event posters
5. **Core entities**
   - Cities → Works → Persons → Troupes → Venues → Events → Articles → Roles → Topics
   - Entities are created with content, aliases, and source refs in one helper
6. **Identities & memberships**
   - Person identities and person–troupe memberships
7. **Entity relations**
   - `fromSlug` / `toSlug` references must exist
8. **Event program items & casts**
   - Program items depend on events/works; casts depend on program items
9. **Revisions / Proposals / Discussions**
   - Requires entities and users
10. **Search index**
   - Aggregates title, content, aliases, sources, and relation titles

## Data Dependencies (Quick Map)

- `users.json` → revisions, proposals, discussions, entities (createdBy/updatedBy)
- `sources.json` → all entity `sources` arrays
- `mediaAssets.json` → entity `coverImageKey`, event `posterImageKey`
- `cities.json` → persons `birthCitySlug`, troupes/venues/events `citySlug`
- `works.json` → works `parentWorkSlug`, roles `workSlug`, event program items `workSlug`
- `persons.json` → identities, memberships, casts, participants
- `troupes.json` → memberships, event troupes
- `venues.json` → events
- `events.json` → program items, participants, troupes
- `roles.json` → performance casts
- `topics.json` → relations
- `relations.json` → must reference existing entity slugs

## Add / Update Data

- New person: edit `data/persons.json`
  - Optional: identities in `data/personIdentities.json`
  - Optional: memberships in `data/memberships.json`
- New event: edit `data/events.json`
  - Program items in `data/eventProgramItems.json`
  - Casts in `data/performanceCasts.json`
  - Participants in `data/eventParticipants.json`
  - Troupes in `data/eventTroupes.json`
- New work/role/topic: edit corresponding JSON and link via `relations.json`

## Validation Notes

- Slugs and keys must be unique.
- All references are by `slug` / `key` / `username` (no database ids).
- Invalid references will throw with file-specific messages (e.g., `events.json: Unknown venueSlug ...`).
