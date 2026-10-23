# Tracked Entity Record Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A headless registry block, `tracked-entity-record`, that loads one tracked entity with every enrollment,
event and relationship the user may read plus the metadata to interpret them, and exposes it through
`TrackedEntityRecordProvider` / `useTrackedEntityRecord()` and a few pure helpers. It ships with a demo route, e2e
coverage and a docs site page.

**Architecture:** API responses are parsed with zod and turned into a self-describing record by pure functions,
tested against fixtures recorded from DHIS2 2.41, 2.42 and 2.43. A provider combines plain TanStack Query queries into
a `{ state, actions, meta }` context. No UI ships; recipes live in the demo and docs.

**Tech Stack:** React 18, TypeScript, `@tanstack/react-query` 5, `zod` 4, `better-result`, `@dhis2/app-runtime`
data engine, vitest (node + browser projects), Playwright e2e, the docs site (`apps/docs`, MDX).

**Spec:** `docs/superpowers/specs/2026-10-23-tracked-entity-record-design.md`. Read it first: the types in spec §6–§9
are the contract and are not repeated here.

## Global Constraints

- Branch: the worktree branch, cut from `origin/master` (`b11e89e`). Nothing from Event Form, Program Rules,
  Timeline, Observation Cards or Finder branches is imported or copied.
- Block location: `packages/registry/blocks/tracked-entity-record/`, with `block.json` (`title`, `description`,
  `docs`). Inside the block, imports are relative. Tests and fixtures go in `__tests__/` (not shipped); public type
  checks go in `type-tests/public-surface.ts`.
- Context shape `{ state, actions, meta }`; `useTrackedEntityRecord()` throws outside the provider, as `useSidebar`
  does.
- Plain TanStack Query: keys under `['tracked-entity-record']`; metadata queries `staleTime: 30 * 60_000`; tracker
  queries (person, relationships) use the host's defaults (no `staleTime` override, no `refetchOnWindowFocus`
  override).
- No prop, option or export loosens access. No break-the-glass. No request made without `program` to compensate for a
  hidden program.
- Lint rules that shape the code (`.oxlintrc.json`, `tools/oxlint/anti-slop`): no module mocking in tests (use the
  app-runtime `CustomDataProvider`), named types for object parameters, no `unknown` parameters (except `cause`) or
  returns, no symbol names containing "shape", a `// SAFETY:` comment on every type assertion, max 600 lines per file.
- Values stay as API strings. Dates compare as stored `YYYY-MM-DD` strings, never through `Date`.
- User-facing strings in the demo and docs go through `@dhis2/d2-i18n`. `debug` strings in the block are English
  and not translated.
- **Commits:** never commit without the user's explicit OK. Each task's commit step means: stage the files, then
  ask before `git commit`. Never open PRs or merge.
- Root checks that must pass at the end: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm dead-code:audit`,
  `pnpm registry:check`, `pnpm e2e:41`, `pnpm e2e:42`, `pnpm e2e:43`, `pnpm docs:e2e`.

## Review Focus

1. **Switching `trackedEntityId` while a record is shown** must never show the previous person's data, not even for
   one render. Expect `pending` until the new person loads. → Task 6 test `does not show the previous person after
the id changes`.
2. **A person with no visible enrollments and no `programs` prop** must become `ready` with an empty `programs`
   map, not stay `pending` (the programs query has no ids to load). → Task 6 test `is ready with no programs when the
person has no visible enrollments`.
3. **An inline `programs={['a', 'b']}` literal** (new array every render) must not refetch in a loop or reset the
   record. → Task 6 test `keeps one programs query when the programs prop is a new array with the same ids`.
4. **SCHEDULE events without `scheduledAt`, and events without `occurredAt`**, must neither crash sorting nor read
   as overdue. → Task 4 tests `a SCHEDULE event without scheduledAt is scheduled` and `sorts events without
occurredAt by scheduledAt, then createdAt`.
5. **Empty-string values** (`""` on a data value or attribute) count as missing in `latestValues`,
   `displayAttributes` and `person.attributes`. → Task 4 test `skips empty values` and Task 3 test `drops empty
attribute values`.

---

## File map

```
packages/registry/blocks/tracked-entity-record/
  block.json
  index.ts                         public exports (spec §6)
  types.ts                         public types (spec §6–§9)
  client.ts                        read-only engine client, request errors
  runtimeClient.ts                 useRecordClient(): client over useDataEngine
  requests.ts                      fields constants and request builders (spec §8.2)
  schemas.ts                       zod schemas for every response
  programState.ts                  one program's state (spec §7.2–§7.5)
  buildRecord.ts                   responses → TrackedEntityRecord
  currentEnrollment.ts             §8.1
  enrollmentAllowance.ts           §9.4
  eventStatus.ts                   §9.2, todayIso
  latestValues.ts                  §9.1
  displayAttributes.ts             §9.3
  keys.ts                          §10
  queries.ts                       queryOptions factories
  useRecordState.ts                queries → TrackedEntityRecordState, latching (spec §8.4)
  context.ts                       context + useTrackedEntityRecord
  TrackedEntityRecordProvider.tsx
  __tests__/fixtures/v41|v42|v43/*.json, __tests__/*.test.ts(x)
  type-tests/public-surface.ts
scripts/e2e/record-tracked-entity-record-fixtures.sh
e2e/metadata/tracked-entity-record-{metadata,users,tracker-data}.json
e2e/specs/tracked-entity-record.spec.ts
apps/web/src/app/TrackedEntityRecordDemo/…
apps/docs/src/pages/blocks/tracked-entity-record.mdx, apps/docs/src/examples/tracked-entity-record/…
e2e/specs-docs/tracked-entity-record.spec.ts
```

---

### Task 1: Seed data, recorded fixtures and the three API checks

The record mapping is written against real responses, so this comes first (spec §8.2, §15).

**Files:**

- Create: `e2e/metadata/tracked-entity-record-metadata.json`, `e2e/metadata/tracked-entity-record-users.json`,
  `e2e/metadata/tracked-entity-record-tracker-data.json`
- Modify: `scripts/e2e/seed-metadata.sh` (import the three files after the working-list ones, same idempotent style)
- Create: `scripts/e2e/record-tracked-entity-record-fixtures.sh`
- Create: `packages/registry/blocks/tracked-entity-record/__tests__/fixtures/v41|v42|v43/*.json`
- Modify: the spec, §15 (add a "Verified API facts" table, as Timeline v2's spec has)

**Interfaces:**

- Produces: fixture files named after the request (`person-P1.json`, `person-P2.json`, `person-P3.json`,
  `person-missing.status.json` (status + body), `programs.json`, `tracked-entity-type.json`,
  `relationships-P1.json`, `relationship-types.json`, `user-scopes.json`, `org-unit-paths.json`), all recorded **as
  the restricted user**. Seed ids below are used by Tasks 3, 7 and 8.

Seed (uids are 11 characters; the builder picks Sierra Leone org units and records them in the metadata file):

| Id            | What                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TrE2eTet001` | Tracked entity type "TER Person", attribute `TrE2eAtt001` (first name, `displayInList`) and `TrE2eAtt003` (date of birth, not in list)                                                                                                                                                                                                                       |
| `TrE2ePrg001` | OPEN, not `onlyEnrollOnce`. Attributes `TrE2eAtt001` + `TrE2eAtt002` (program id, `displayInList`). Stages `TrE2eStg001` (repeatable, data element `TrE2eDe0001` NUMBER, `TrE2eDe0002` TEXT) and `TrE2eStg002` (no data read for the restricted user's role/group)                                                                                           |
| `TrE2ePrg002` | OPEN, `onlyEnrollOnce: true`, one stage                                                                                                                                                                                                                                                                                                                      |
| `TrE2ePrg003` | PROTECTED, one stage                                                                                                                                                                                                                                                                                                                                         |
| `TrE2eUsr001` | `ter_e2e_nurse`: capture scope facility A, search scope A's district; data read+write on the three programs except stage `TrE2eStg002`                                                                                                                                                                                                                       |
| `TrE2eTei001` | P1. Prg001: one COMPLETED enrollment (older) and one ACTIVE; events in Stg001 with values on several dates, one with `TrE2eDe0001: ""`, one SCHEDULE in the past, one SCHEDULE in the future; one event in Stg002. Prg002: one COMPLETED enrollment. Prg003: one ACTIVE enrollment owned at facility B (in A's district, outside A). One relationship to P2. |
| `TrE2eTei002` | P2: `inactive: true`, one ACTIVE enrollment in Prg001                                                                                                                                                                                                                                                                                                        |
| `TrE2eTei003` | P3: one enrollment in Prg001 that the seed script then deletes (`importStrategy=DELETE`, skipped if already deleted), leaving the owner row                                                                                                                                                                                                                  |

- [ ] **Step 1: Write the three metadata files and extend `seed-metadata.sh`** (users via the existing
      `ensure_test_users` pattern; password `TrackedEntity123!`).
- [ ] **Step 2: Seed 2.42 and check the seed.** Run: `pnpm e2e:up 42`. Expected: the script ends with its "ready"
      line; `curl -u admin:district …/api/tracker/trackedEntities/TrE2eTei001?fields=enrollments[enrollment]` lists 4
      enrollments.
- [ ] **Step 3: Write `record-tracked-entity-record-fixtures.sh <version>`.** It logs in as `ter_e2e_nurse`, makes
      each request from spec §8.2 using the `fields` strings Task 2 will define (write them in the script first and copy
      them into `requests.ts` in Task 2), pipes each body through `jq -S .` into
      `__tests__/fixtures/v<version>/`, and records the missing-person request (`TrE2eMis001`) status and body.
- [ ] **Step 4: Record 2.41, 2.42 and 2.43.** Run, for each version: `pnpm e2e:up <v>`, the script, then
      `pnpm e2e:down <v>`. Expected: 11 files per version.
- [ ] **Step 5: Answer the three checks from the fixtures and write them into spec §15 as a table** (version ×
      finding):
    1. `person-P1.json` has embedded events for Stg001 in every status and none for Stg002. **If not on some
       version:** use the spec's default (one `tracker/events?trackedEntity=&program=&paging=false` per program),
       record those responses too, and note it.
    2. `person-P1.json` / `person-P3.json` `programOwners` include Prg003 (P1) and Prg001 (P3). **If not:** apply
       the spec's §7.3 default and note it.
    3. Whether top-level `attributes` include program attributes (`TrE2eAtt002`) or only type attributes.
- [ ] **Step 6: Stage the files and ask the user for an OK to commit.**
      `git commit -m "test(tracked-entity-record): seed data and recorded API fixtures"`

### Task 2: Client, requests and schemas

**Files:**

- Create: `client.ts`, `runtimeClient.ts`, `requests.ts`, `schemas.ts`
- Test: `__tests__/client.test.ts`, `__tests__/schemas.test.ts`

**Interfaces:**

- Produces:
    - `interface DataEngineLike { query(query: DataEngineQuery, options?: QueryOptions): Promise<Record<string, DataEngineValue>> }`
      (read-only; the same structural types as Timeline v2's client).
    - `class RecordRequestError extends Error { readonly kind: 'http' | 'network' | 'invalid-response'; readonly status?: number }`
    - `interface RecordClient { query<T>(request: ResourceRequest, schema: ZodType<T>, signal?: AbortSignal): Promise<Result<T, RecordRequestError>> }`
    - `createRecordClient(engine: DataEngineLike): RecordClient`
    - `httpStatusOf(error: Error): number | undefined`: reads `details.httpStatusCode` through `cause`, else a
      trailing `(NNN)` in a FetchError message.
    - `isUnavailableResponse(error: RecordRequestError): boolean`: `kind === 'http'` and status ∈ {403, 404, 409}
      (spec §7.1; a 401 is an ended session, so an error).
    - `useRecordClient(): RecordClient`, memoised over `useDataEngine()`.
    - Request builders, each returning `ResourceRequest`: `personRequest(id)`, `programsRequest(ids)`,
      `trackedEntityTypeRequest(id)`, `relationshipsRequest(id)`, `relationshipTypesRequest(ids)`,
      `userScopesRequest()`, `orgUnitPathsRequest(ids)`. Fields as in Task 1's script. `programsRequest` uses
      `filter: id:in:[…]` with ids sorted and `paging: false`.
    - Schemas and inferred types: `PersonResponseSchema`/`PersonResponse`, `ProgramsResponseSchema`/
      `ProgramsResponse`, `TrackedEntityTypeResponseSchema`, `RelationshipsResponseSchema`,
      `RelationshipTypesResponseSchema`, `UserScopesResponseSchema` (`organisationUnits[id]`,
      `teiSearchOrganisationUnits[id]`), `OrgUnitPathsResponseSchema`. Use `z.looseObject`; optional booleans
      default as the API does (`displayInList` false, `inactive` false).

- [ ] **Step 1: Write failing tests.**
    - `client.test.ts`: `returns ok with the parsed resource`; `wraps an engine rejection as http with the status
from details.httpStatusCode`; `reads the status from a trailing (404) in the message`; `marks a schema
mismatch as invalid-response`; `isUnavailableResponse is true for 403, 404, 409 and false for 400, 401, 500
and network`.
    - `schemas.test.ts`: `parses every recorded fixture` (loop over `fixtures/v41|v42|v43`, each file through its
      schema, `expect(result.success).toBe(true)`).
- [ ] **Step 2: Run:** `pnpm --filter @dhis2-blocks/registry exec vitest run --project node blocks/tracked-entity-record`.
      Expected: FAIL (modules missing).
- [ ] **Step 3: Implement the four files.**
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Stage and ask before committing.** `feat(tracked-entity-record): read-only client, requests and schemas`

### Task 3: Program state and the record builder

**Files:**

- Create: `types.ts` (all public types from spec §6–§9, verbatim names), `programState.ts`, `buildRecord.ts`
- Test: `__tests__/programState.test.ts`, `__tests__/buildRecord.test.ts`

**Interfaces:**

- Consumes: Task 2's response types.
- Produces:
    - `interface UserScopes { capture: ReadonlySet<string>; search: ReadonlySet<string> }` (org unit ids)
    - `ownerInUserScope(ownerPath: string, accessLevel: AccessLevel, scopes: UserScopes): boolean`: a path is in
      scope when any id on it is in the set. OPEN/AUDITED check capture ∪ search; PROTECTED/CLOSED capture only.
    - `interface RecordSources { person: PersonResponse; programs: ProgramsResponse; trackedEntityType: TrackedEntityTypeResponse; requestedPrograms?: readonly string[]; scopes?: UserScopes; ownerPaths?: ReadonlyMap<string, string>; programsError?: { error: Error; retry(): void }; relationships: RelationshipsResult }`
    - `programIdsToLoad(person: PersonResponse, requestedPrograms?: readonly string[]): string[]`: requested ids, or
      else visible enrollments' programs ∪ `programOwners` programs, deduplicated and sorted.
    - `ownerOrgUnitsToCheck(person: PersonResponse, programs: ProgramsResponse, requestedPrograms?: readonly string[]): string[]`:
      owner org units of programs with an owner row and no visible enrollment (spec §7.3 case 2). Empty means no
      scope lookups.
    - `resolveProgramState(programId: string, sources: RecordSources): ProgramRecord`
    - `buildRecord(sources: RecordSources): TrackedEntityRecord`
    - `buildRelationships(personId: string, relationships: RelationshipsResponse, types: RelationshipTypesResponse): Relationship[]`
      (spec §8.3): `direction` is `'from'` when `from.trackedEntity.trackedEntity === personId`; `other` is the
      opposite side; a relationship whose type isn't in `types` keeps its id as the name.
    - `AccessLevel = 'OPEN' | 'AUDITED' | 'PROTECTED' | 'CLOSED'` is exported from `types.ts` with the rest.

Rules (spec §7–§8): program order follows `requestedPrograms`, else metadata name order. Without `requestedPrograms`,
`programOwners` programs whose metadata isn't returned are left out. Stages: readable only, by `sortOrder`;
`canWrite` per §7.4; everything false when `inactive`. Enrollments: newest `enrolledAt` first. Events: by
`occurredAt ?? scheduledAt` descending, then `createdAt` descending. `person.attributes` = top-level attributes plus
every visible enrollment's attributes (fixture finding 3 decides whether the merge is needed). Empty strings dropped.

- [ ] **Step 1: Write failing tests**, from the v42 fixtures unless named:
    - `programState.test.ts`: `enrolled in Prg001 with two enrollments, newest first`; `not-enrolled when readable,
same type, no enrollment and no owner`; `unavailable when the owner is outside capture scope for PROTECTED`
      (P1 / Prg003); `not-enrolled when the owner is in capture scope and the enrollment was deleted` (P3 / Prg001);
      `OPEN owner in search scope only is not-enrolled`; `unavailable when metadata is missing`; `unavailable
without data read`; `unavailable for a program of another tracked entity type`; `unavailable for an event
program`; `error for every program when the programs request failed`; each `unavailable` carries a non-empty
      `debug`.
    - `buildRecord.test.ts`: `hides Stg002 and has no Stg002 events`; `stage canWrite needs stage and program
write`; `everything read-only for an inactive person` (P2); `orders programs as requested`;
      `lists programOwners programs without the prop`; `drops empty attribute values`; `sorts events without
occurredAt by scheduledAt, then createdAt`; `builds the same record from v41, v42 and v43 fixtures`
      (`expect(build(v41)).toEqual(build(v42))`, same for v43, after normalising server timestamps if they differ);
      `buildRelationships gives P1 one relationship to P2 with direction from and the type's names`;
      `buildRelationships names an unknown type by its id`.
- [ ] **Step 2: Run** the node project for the block. Expected: FAIL.
- [ ] **Step 3: Implement** `types.ts`, `programState.ts`, `buildRecord.ts`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Stage and ask before committing.** `feat(tracked-entity-record): program states and the record builder`

### Task 4: Helpers

**Files:**

- Create: `currentEnrollment.ts`, `enrollmentAllowance.ts`, `eventStatus.ts`, `latestValues.ts`, `displayAttributes.ts`
- Test: one `__tests__/<name>.test.ts` per file

**Interfaces:**

- Consumes: `types.ts`.
- Produces (spec §6, §8.1, §9):
    - `currentEnrollment(program: ProgramRecord, selectedEnrollmentId?: string): Enrollment | undefined`
    - `enrollmentAllowance(program: ProgramRecord): EnrollmentAllowance`
    - `eventStatus(event: TrackerEvent, today: string): DerivedEventStatus`, `isOverdue(event: TrackerEvent, today: string): boolean`, `todayIso(): string`
    - `latestValues(events: readonly TrackerEvent[], dataElementIds?: readonly string[]): Map<string, LatestValue>`
    - `interface DisplayAttributesOptions { onlyDisplayInList?: boolean }`;
      `displayAttributes(record: TrackedEntityRecord, programId?: string, options?: DisplayAttributesOptions): DisplayAttribute[]`

- [ ] **Step 1: Write failing tests** (hand-built records via a small `__tests__/builders.ts`, plus the P1 fixture
      record for one end-to-end case each):
    - `currentEnrollment`: `the selected one when it belongs to the program`; `ignores a selected id from another
program`; `the only enrollment`; `the newest ACTIVE of several`; `undefined when several and none active`;
      `undefined for not-enrolled`.
    - `enrollmentAllowance`, the reasons in spec order: `unavailable`; `no-write-access` (also for an inactive
      person); `active-enrollment-exists`; `only-enroll-once` (P1 / Prg002); `allowed` for a not-enrolled program
      with write access; `unavailable wins over the other reasons`.
    - `eventStatus` with `today = '2026-10-23'`: `SCHEDULE due 2026-10-22 is overdue`; `SCHEDULE due today is
scheduled`; `a SCHEDULE event without scheduledAt is scheduled`; `stored OVERDUE is overdue`; `VISITED and an
unknown status are active`; `a scheduledAt with a time and offset compares by its stored day`.
      `todayIso matches /^\d{4}-\d{2}-\d{2}$/`.
    - `latestValues`: `newest ACTIVE or COMPLETED event with a value wins`; `skips SCHEDULE, SKIPPED and OVERDUE
events`; `skips empty values` (P1's `""` falls through to the older value); `ties on occurredAt go to the
newer createdAt`; `limits to the requested data elements`; `returns the event the value came from`.
    - `displayAttributes`: `program attributes in program order when enrolled`; `type attributes when not
enrolled`; `type attributes without a program`; `onlyDisplayInList filters`; `lists attributes without a
value`.
- [ ] **Step 2: Run** the node project for the block. Expected: FAIL.
- [ ] **Step 3: Implement** the five files.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Stage and ask before committing.** `feat(tracked-entity-record): enrollment, event and attribute helpers`

### Task 5: Keys and queries

**Files:**

- Create: `keys.ts`, `queries.ts`
- Test: `__tests__/queries.test.ts`

**Interfaces:**

- Consumes: Task 2 (`RecordClient`, request builders, schemas).
- Produces:
    - `trackedEntityRecordKeys` exactly as spec §10, with `userScopes()` and `orgUnitPaths(sortedIds)`.
    - Query option factories (`queryOptions` from TanStack), each unwrapping the `Result` by throwing its error:
      `personQuery(client, id)`, `relationshipsQuery(client, id)`, `programsQuery(client, ids)`,
      `trackedEntityTypeQuery(client, id)`, `relationshipTypesQuery(client, ids)`, `userScopesQuery(client)`,
      `orgUnitPathsQuery(client, ids)`. Metadata ones set `staleTime: METADATA_STALE_TIME` (30 minutes).
    - `retryRecordRequest(failureCount: number, error: Error): boolean`: no retry for `invalid-response` or for
      statuses < 500; up to 2 retries otherwise.
- [ ] **Step 1: Write failing tests:** `person and relationships keys share the person prefix`;
      `programs key sorts ids`; `metadata queries have the 30 minute staleTime`; `tracker queries set no staleTime`;
      `retryRecordRequest does not retry 404 or invalid-response and retries 503 twice`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Stage and ask before committing.** `feat(tracked-entity-record): query keys and options`

### Task 6: Provider, context and the public surface

**Files:**

- Create: `useRecordState.ts`, `context.ts`, `TrackedEntityRecordProvider.tsx`, `index.ts`, `block.json`,
  `type-tests/public-surface.ts`
- Modify: `registry.json` (via `pnpm registry:write`), `README.md` (a "Tracked Entity Record block" section after
  Sidebar, in the same style)
- Test: `__tests__/TrackedEntityRecordProvider.test.tsx` (browser project)

**Interfaces:**

- Consumes: Tasks 2–5.
- Produces:
    - `interface TrackedEntityRecordProviderProps { trackedEntityId: string; programs?: readonly string[]; children: ReactNode }`
    - `TrackedEntityRecordProvider(props: TrackedEntityRecordProviderProps)`
    - `interface TrackedEntityRecordContextValue { state: TrackedEntityRecordState; actions: { refresh(): Promise<void> }; meta: { trackedEntityId: string; isFetching: boolean } }`
    - `useTrackedEntityRecord(): TrackedEntityRecordContextValue`
    - `useRecordState(trackedEntityId: string, programs?: readonly string[]): TrackedEntityRecordContextValue` (internal)
    - `index.ts` exports exactly spec §6's names plus the public types.

Behaviour (spec §8.2, §8.4): person, type, relationships, and programs (when `programs` is given) start together;
otherwise programs wait for the person. User scopes and owner paths load only when `ownerOrgUnitsToCheck` is
non-empty. The programs query is skipped when there are no ids. `pending` until person, type, programs (if any ids)
and scope lookups (if needed) have answered. The last `ready` record is kept **per `trackedEntityId`** while
refetching. A person answer that `isUnavailableResponse` replaces it; a network or 5xx failure after `ready` keeps it.
`refresh()` = `queryClient.invalidateQueries({ queryKey: trackedEntityRecordKeys.person(id) }, { throwOnError: true })`.
The `programs` prop is reduced to a sorted, deduplicated key before it reaches any query.

`block.json`:
`{ "title": "Tracked Entity Record", "description": "Headless data for one person's record across programs: enrollments, events, relationships and metadata, with access honoured.", "docs": "Wrap a screen in TrackedEntityRecordProvider trackedEntityId={id} (optionally programs={[…]}); read useTrackedEntityRecord().state. Call actions.refresh() after any write. Helpers: currentEnrollment, enrollmentAllowance, eventStatus, latestValues, displayAttributes." }`

- [ ] **Step 1: Write failing browser tests**, wrapping in a fresh `QueryClient({ defaultOptions: { queries: { retry: false } } })`
      and app-runtime `CustomDataProvider` whose resolvers serve the v42 fixtures (a resolver throws an `Error` with
      `details: { httpStatusCode }` to simulate HTTP errors):
    - `goes from pending to ready with P1`
    - `is unavailable for a missing person, with the server message in debug`
    - `is error with a working retry on a 500`
    - `is error when the tracked entity type request fails`
    - `orders programs as the programs prop lists them`
    - `makes every program error when the programs request fails, and the person stays ready`
    - `keeps the record shown with isFetching during refresh, then shows the new data`
    - `replaces the record with unavailable when a refresh answers 404`
    - `keeps the record when a refresh fails with 500, and refresh() rejects`
    - `relationships failing do not block the record`
    - `does not show the previous person after the id changes` (Review Focus 1: render P1, rerender with P2's id,
      assert no render observed `record.person.id === 'TrE2eTei001'` after the change)
    - `is ready with no programs when the person has no visible enrollments` (Review Focus 2)
    - `keeps one programs query when the programs prop is a new array with the same ids` (Review Focus 3: count
      resolver calls across 5 rerenders)
    - `makes no scope requests when no program needs a scope check`
    - `useTrackedEntityRecord throws outside the provider`
- [ ] **Step 2: Run:** `pnpm --filter @dhis2-blocks/registry exec vitest run --project browser blocks/tracked-entity-record`.
      Expected: FAIL.
- [ ] **Step 3: Implement** the files; write `type-tests/public-surface.ts` importing every public name from `'..'`;
      run `pnpm registry:write`.
- [ ] **Step 4: Run** the browser and node projects, then `pnpm typecheck && pnpm lint && pnpm dead-code:audit && pnpm registry:check`.
      Expected: all PASS.
- [ ] **Step 5: Stage and ask before committing.** `feat(tracked-entity-record): provider, context and registry item`

### Task 7: Demo route and its e2e

**Files:**

- Create: `apps/web/src/app/TrackedEntityRecordDemo/` (`index.ts`, `TrackedEntityRecordDemo.tsx` and one file per
  recipe: `PersonHeader.tsx`, `ProgramViews.tsx` (switcher and side-by-side toggle), `LatestValues.tsx`,
  `Visits.tsx` (upcoming and overdue), `AddNote.tsx`, `UnavailableNotice.tsx`)
- Modify: `apps/web/src/AppWrapper.tsx` (route `/tracked-entity-record`), `AppShell.tsx` footer (link next to the
  Context Selector showcase link), the web app's translation catalog
- Create: `e2e/specs/tracked-entity-record.spec.ts`

**Interfaces:**

- Consumes: the public surface from Task 6 only (`@/components/tracked-entity-record`).
- Produces: route `#/tracked-entity-record?trackedEntity=<id>&programs=<id,id>`. Without `trackedEntity`, a small
  form with an id input.

Recipes use the shared primitives (`@/components/dhis2/ui/*`). `AddNote` posts
`tracker?async=false&importStrategy=CREATE_AND_UPDATE` with the current enrollment (`enrollment`, `trackedEntity`,
`program`, `orgUnit`, `status`, `enrolledAt`, `occurredAt`) and `notes: [{ value }]` (the server assigns the note id),
then awaits `refresh()`. It renders only when the program's `canWrite` is true. Confirm in the e2e run that existing
notes are kept on every version.

- [ ] **Step 1: Write the failing e2e spec** with `test.use({ e2eCredentials: { username: 'ter_e2e_nurse', password: 'TrackedEntity123!' } })`:
    - `shows P1's programs, with Prg003 unavailable`
    - `opens Prg001 on the ACTIVE enrollment and offers the older one`
    - `labels the past scheduled visit overdue and the future one upcoming`
    - `does not show Stg002 visits`
    - `Prg002 says the person can only be enrolled once` (from `enrollmentAllowance`)
    - `P3 is not enrolled in Prg001`
    - `P2 is read-only` (no Add note)
    - `an unknown id shows the unavailable message`
    - `adding a note refreshes every view` (note listed; `isFetching` indicator seen; the latest-values card still
      shows)
    - `shows two programs side by side from one record`
    - `has no axe violations`
- [ ] **Step 2: Run:** `pnpm e2e:42`. Expected: the new spec FAILS (route missing), the existing specs pass.
- [ ] **Step 3: Implement** the demo and the route.
- [ ] **Step 4: Run** `pnpm e2e:41`, `pnpm e2e:42`, `pnpm e2e:43`. Expected: all PASS. Restore
      `apps/web/i18n/en.pot` timestamp churn if the dev server rewrote it.
- [ ] **Step 5: Stage and ask before committing.** `feat(web): tracked entity record demo route`

### Task 8: Docs site page

**Files:**

- Create: `apps/docs/src/pages/blocks/tracked-entity-record.mdx`,
  `apps/docs/src/examples/tracked-entity-record/` (`RecordHeader.tsx`, `RecordSideBySide.tsx`,
  `RecordVisits.tsx`, `RecordUnavailable.tsx`, `RecordPlaceholders.tsx`)
- Modify: `apps/docs/src/examples/registry.ts` (four `live: true` entries, slugs `tracked-entity-record/<name>`),
  `apps/docs/src/navigation.ts` (Blocks: "Tracked Entity Record"), `apps/docs/src/App.tsx` (`docRoute` for
  `/blocks/tracked-entity-record`)
- Create: `e2e/specs-docs/tracked-entity-record.spec.ts`

**Interfaces:**

- Consumes: the public surface from Task 6 only.

Examples use `PQfMcpmXeFE` with Child Programme `IpHINAT79UW` and TB program `ur1Edk5Oe2n`, each with a comment that
they are Sierra Leone demo ids to replace (as `WorkingListDefault.tsx` does). `RecordUnavailable` uses a made-up id.
The page follows `sidebar.mdx`: first example, `<InstallCommand item="tracked-entity-record" />`, then sections for
the provider and state, programs (enrolled / not enrolled / unavailable, and that the docs session can't show a
locked program), refresh after writes, each helper, and "Using it with views that fetch their own data" (spec §12).

- [ ] **Step 1: Write the failing docs e2e:** `renders the header example with PQfMcpmXeFE's attributes`;
      `renders both programs side by side`; `renders visits with status labels`; `renders the unavailable example`;
      `the page has no axe violations`.
- [ ] **Step 2: Run:** `pnpm docs:e2e`. Expected: the new spec FAILS.
- [ ] **Step 3: Implement** the page and examples.
- [ ] **Step 4: Run** `pnpm docs:e2e` and `pnpm build:docs`. Expected: PASS.
- [ ] **Step 5: Stage and ask before committing.** `docs: tracked entity record page and live examples`

### Task 9: Final verification

- [ ] **Step 1: Run** every root check in Global Constraints. Expected: all PASS. Report any failure with its output;
      don't mark the work done.
- [ ] **Step 2: Check spec coverage** against spec §2 goals 1–6 and §14, and list anything not done in the hand-off.
- [ ] **Step 3: Write a hand-off note** in the shared notes folder (`tracked-entity-record-status.md`): branch,
      head, checks run, fixture findings, follow-ups (adapters for Timeline and Observation Cards; stage availability;
      enrollment-level rules; lifecycle).
