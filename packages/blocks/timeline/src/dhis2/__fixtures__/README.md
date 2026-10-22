# DHIS2 tracker API fixtures (2.41, 2.42, 2.43)

Recorded on 2026-10-22 from the local e2e stacks (`scripts/e2e`, Sierra Leone
demo database): **2.41.10**, **2.42.6** and **2.43.2**, all with the `iso8601`
system calendar. These files are the source of truth for the timeline's
requests and schemas (`../queries.ts`, `../schemas.ts`).

## The record

The demo database has no tracked entity in the RMNCH program (`WSGAb5XwJ3Y`)
with completed, scheduled and skipped events (on 2.42 only one tracked entity
had a scheduled event, and none had a skipped one), so `seed/` creates one with
the tracker importer:

| What                                                | Ids                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Tracked entity (Person, Ngelehun CHC `DiszpKrYNg8`) | `TlE2eTei001`                                                                        |
| Enrollment, COMPLETED (2024)                        | `TlE2eEnr001`, note `TlE2eNot001`                                                    |
| Enrollment, ACTIVE (2026)                           | `TlE2eEnr002`, note `TlE2eNot002`                                                    |
| COMPLETED events                                    | `TlE2eEvt007` (enrollment 1), `TlE2eEvt001` (with note `TlE2eNot003`), `TlE2eEvt002` |
| SKIPPED event                                       | `TlE2eEvt003` (scheduled 2026-04-20)                                                 |
| ACTIVE event                                        | `TlE2eEvt004` (the one with data value changes)                                      |
| SCHEDULE, past due                                  | `TlE2eEvt005` (scheduled 2026-08-01)                                                 |
| SCHEDULE, future                                    | `TlE2eEvt006` (scheduled 2027-01-15)                                                 |

`seed/timeline-tracker-updates-1.json` then `-2.json` make the changelog rows:
first name `Amina` → `Aminata` (UPDATE), address added then removed (CREATE,
DELETE), and on `TlE2eEvt004` `roKuXYfw1BW` 24 → 26 (UPDATE) with
`dyYdfamSY2Z` added then removed (CREATE, DELETE). Completed events can't be
edited (the stage blocks the form after completion), so the changes are on the
active event.

To re-record: `pnpm e2e:up <v>`, `bash seed/record.sh <v>`, `pnpm e2e:down <v>`,
then `pnpm format` (the script writes 2-space JSON). Fixtures are recorded
whole; only `program-metadata.json` is trimmed (two `displayInReports` data
elements and one not per stage, four attributes, three options per option set).

## Files (per version)

| File                                                                 | Request                                                                                             |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `events-page-1.json`, `events-page-2.json`                           | `tracker/events?trackedEntity&program&fields&order=occurredAt:desc,event:desc&page=1\|2&pageSize=4` |
| `events-schedule.json`, `events-skipped.json`, `events-overdue.json` | the same with `status=SCHEDULE\|SKIPPED\|OVERDUE&order=scheduledAt:asc,event:asc&pageSize=51`       |
| `tracked-entity.json`                                                | `tracker/trackedEntities/TlE2eTei001?program&fields=…,enrollments[…,notes[…]]`                      |
| `tracked-entity-changelog.json`                                      | `tracker/trackedEntities/TlE2eTei001/changeLogs?program&order=createdAt:desc&page=1&pageSize=50`    |
| `event-changelog.json`                                               | `tracker/events/TlE2eEvt004/changeLogs?order=createdAt:desc&page=1&pageSize=50`                     |
| `program-metadata.json`                                              | `programs/WSGAb5XwJ3Y?fields=…`                                                                     |
| `org-unit-names.json`                                                | `organisationUnits?filter=id:in:[…]&fields=id,displayName&paging=false`                             |

## Answers

1. **Events list**: `GET /api/tracker/events` on 41, 42 and 43, with `page`, `pageSize` and `order=<field>:<asc|desc>,…`; the list key is `events` on all three (2.41.10 also repeats `page` and `pageSize` at the top level; no version sent `instances`). `order` accepts `event`, so `<timeField>:desc,event:desc` is a total order. Descending puts events with no value in the field first (Postgres nulls first). The pager has `nextPage` on 42 and 43 but not on 41, and no total unless `totalPages=true`, so "more pages" is "the page came back full".
2. **Status filter**: single-valued only. `status=COMPLETED,ACTIVE` (or `;`) is HTTP 400 on 41, 42 and 43 ("Valid values are: [ACTIVE, COMPLETED, VISITED, SCHEDULE, OVERDUE, SKIPPED]"), and `statuses` is ignored. The past stream asks for every status and drops `SCHEDULE`, `SKIPPED` and `OVERDUE` client-side; the dropped events still count toward a full page. `status=OVERDUE` is derived by the server (SCHEDULE with `scheduledAt` before now: it returned `TlE2eEvt005`, whose stored status is `SCHEDULE`), and `status=SCHEDULE` already includes past-due events, so pinned events are `SCHEDULE` + `SKIPPED` only.
3. **Names on events**: `orgUnitName` is not on events on any version (asking for it returns nothing), so org unit names need the batched `organisationUnits` request. `createdBy` and `updatedBy` are `{ uid, username, firstName, surname }` on all three (no `displayName`); `completedBy` is a bare username string. Note `createdBy` adds `displayName`. Enrollments match events.
4. **Tracked entity changelog**: `GET /api/tracker/trackedEntities/{uid}/changeLogs` with `program`, `page`, `pageSize`, `order=createdAt:desc` (also the default order). Without `program` only the tracked entity type's attributes are returned (4 rows, not 7). Pager has `nextPage` when full, no total even with `totalPages=true`. Row: `{ createdAt, createdBy: { uid, username, firstName, surname }, type: CREATE|UPDATE|DELETE, change: { attributeValue: { attribute, previousValue?, currentValue? } } }`. **It exists on 2.41.10 with the same shape and parameters** (not a 404).
5. **Event changelog**: `GET /api/tracker/events/{uid}/changeLogs` with `page`, `pageSize`, `order`. Rows are `change: { dataValue: { dataElement, previousValue?, currentValue? } }` and, on 42 and 43 only, `change: { eventField: { field, previousValue?, currentValue? } }` for `occurredAt` / `scheduledAt` (values written `2026-06-12 00:00:00.000`, with a space). **On 2.41.10 it exists too**, returning data value rows only, no event field rows. Rows saved together share `createdAt` to the millisecond, and their order within a save differs between versions.
6. **Program metadata**: yes on all three. `programStages[hideDueDate,sortOrder,programStageDataElements[displayInReports,dataElement[…]]]` and `programTrackedEntityAttributes[trackedEntityAttribute[…]]` are readable via `/api/programs/{id}`; stages come back in `sortOrder`.

## Other observations

- 2.41 ignores `completedAt` on an imported enrollment and stores the import time instead (42 and 43 keep it), so `v41/tracked-entity.json` has a 2026 `completedAt` for `TlE2eEnr001`.
- Not checked: whether `tracker/trackedEntities/{uid}?program=` leaves out enrollments in other programs (the record has none). `fetchTrackedEntityWithEnrollments` keeps only the program's enrollments either way.
- 42 and 43 recordings match apart from timestamps and the order of the two enrollments.
