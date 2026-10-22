# Composable Tracked Entity Finder (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `tracked-entity-finder` registry block as a root, small composable parts and hooks that search one DHIS2 program under its search rules, plus a copy-and-edit example block (`tracked-entity-finder-01`), demo, e2e and README.

**Architecture:** A pure `rules` module turns program metadata into a frozen model and judges each `FinderForm`'s composed fields into a verdict that alone can hold a sealed, branded search. An `api` module fetches metadata and runs sealed searches (cap check, 409, paging). A React layer (`Finder` root holding values, form registrations and the last search; `Finder*` parts; `useFinder*` hooks) only reads verdicts and submits sealed searches.

**Tech Stack:** React 18, TypeScript (strict), TanStack Query 5, zod 4, `@dhis2/app-runtime`, `@dhis2/ui` (`CalendarInput`), `@dhis2/multi-calendar-dates`, `@dhis2/d2-i18n`, shared `ui` primitives via `@/registry/dhis2/ui/*`, Vitest 4 (node + Playwright browser projects), Playwright e2e, shadcn registry.

**Spec:** `docs/superpowers/specs/2026-10-22-finder-composable-design.md` (approved 2026-10-22). Read it first; this plan does not repeat its rules.

## Global Constraints

- Branch `jc/feat/finder-composable` (based on `jc/feat/shared-ui`). Never push, open PRs, merge or switch branches. Never touch `jc/feat/tracked-entity-finder`.
- Commits: unsigned local, one per task: `git -c commit.gpgsign=false commit -m "<type>(tracked-entity-finder): …"` ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Standalone from v1: write fresh. Reading v1 (`git show jc/feat/tracked-entity-finder:packages/blocks/tracked-entity-finder/<path>`) or working-list for a helper is fine; copy only small self-contained helpers that fit as is.
- Package shape mirrors `packages/blocks/working-list` (package.json scripts, tsconfig + tsconfig.test.json, vitest node project `src/**/*.test.ts` and browser project `src/**/*.test.tsx`, `test/setup.ts`, alias `@/registry/dhis2/ui` → `../ui/src`). Dependency versions copied from working-list's package.json.
- Program only: no tracked entity type scope anywhere. `program` is a plain prop; changing it resets values, registrations' values and results.
- Requests: `GET programs/<uid>` for metadata; `GET tracker/trackedEntities` with `program`, `filter[]`, `orgUnitMode=ACCESSIBLE`, `page`, `pageSize=10`, `totalPages=true`, `fields=trackedEntity,trackedEntityType,orgUnit,programOwners[orgUnit,program],attributes[attribute,value]`. No `orgUnits`, ever.
- Copy fixed by the spec: "Too many matches. Add another detail.", "No one found", "This search isn't set up correctly". All user-facing text goes through the `FinderTextProvider` translate function (default `i18n.t`).
- Public names: `Finder`, `FinderForm`, `FinderField`, `FinderSubmit`, `FinderResults`, `FinderEmpty`, `FinderTooMany`, `FinderError`, `FinderList`, `FinderItem`, `FinderValue`, `FinderPagination`, `useFinderField`, `useFinderSearch`, `useFinderResults`, `useFinderProgram`, `FinderTextProvider`, `createTrackedEntityFinderClient`, types `FinderPerson`, `TrackedEntityFinderClient`, `DataEngineLike`.
- Root checks must end green: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm registry:check`, `pnpm dead-code:audit`.

## Review Focus

1. **The program changes mid-search** (a dropdown above the finder): an in-flight search for the old program must never show under the new one, and values reset. Test in Task 7.
2. **"No ID?" swap unmounts a form:** its registrations disappear, the other form's verdict is unaffected, and results stay until the next Search. Test in Task 6.
3. **Pasted IDs with spaces or `:` `,` `/`:** trimmed, escaped, still exact `eq`. Tests in Tasks 3 and 4.
4. **An admin makes a composed attribute non-searchable after the app ships:** production build shows the short message in place, logs the full one, never throws, and never sends that attribute. Test in Task 6.
5. **Double-clicking Search or paging while loading:** the older request is aborted or ignored; the screen shows only the newest answer. Test in Task 7.

---

## File Structure

```
packages/blocks/tracked-entity-finder/
  package.json  tsconfig.json  tsconfig.test.json  vitest.config.ts  README.md  registry.json
  test/setup.ts  test/styles.css
  type-tests/public-surface.ts
  src/index.ts
  src/registry.manifest.test.ts
  src/api/client.ts            DataEngineLike, opaque client, FinderRequestError, retry policy
  src/api/runtimeClient.ts     useTrackedEntityFinderClient (app-runtime engine)
  src/api/schemas.ts           program metadata + tracked entities response schemas, normalisers
  src/api/queries.ts           finderKeys, programMetadataQueryOptions
  src/api/systemInfo.ts        calendar + dateFormat
  src/api/search.ts            runSearch (cap, 409, paging) → SearchOutcome
  src/rules/types.ts           FinderAttribute, ProgramModel, FieldValue, FieldIssue, ConfigProblem, FormVerdict
  src/rules/programModel.ts    buildProgramModel
  src/rules/evaluateForm.ts    evaluateForm, findRangeConflicts
  src/rules/seal.ts            ValidatedSearch brand + seal (only module that builds one)
  src/rules/describeProblem.ts agent-friendly config messages
  src/rules/searchParams.ts    serializeFilter, toSearchParams
  src/rules/__fixtures__/program.ts   shared test metadata (HIV-style)
  src/calendar/calendarDates.ts       system calendar ↔ ISO
  src/calendar/CalendarDateInput.tsx  CalendarInput wrapper with crash fallback
  src/format/formatValue.ts           value display by value type
  src/ui/FinderText.tsx
  src/ui/root/Finder.tsx  src/ui/root/FinderContext.tsx  src/ui/root/useFinderController.ts
  src/ui/form/FinderForm.tsx  src/ui/form/FinderField.tsx  src/ui/form/FinderSubmit.tsx
  src/ui/form/inputs/*.tsx     one input per field kind + range pairs
  src/ui/form/ConfigError.tsx
  src/ui/results/*.tsx         FinderResults, FinderList, FinderItem, FinderValue, FinderPagination, state parts
  src/ui/hooks.ts              useFinderField, useFinderSearch, useFinderResults, useFinderProgram
  src/ui/__tests__/*.test.tsx, src/ui/__tests__/finderTestSupport.tsx
  src/examples/tracked-entity-finder-01/FindPerson.tsx, index.ts
```

The example lives under the finder's `src/examples/` and imports the finder with a relative path (`../../index`), so the same import works in the repo and after install (its registry item targets `@components/tracked-entity-finder/examples/tracked-entity-finder-01/…`). The finder item's manifest test excludes `src/examples/`.

---

### Task 1: Package scaffold and API layer

**Files:**
- Create: package files listed above (`package.json` named `@dhis2-blocks/tracked-entity-finder`, exports `"."` → `./src/index.ts` and `"./examples/tracked-entity-finder-01"` → `./src/examples/tracked-entity-finder-01/index.ts`), `src/api/{client,runtimeClient,schemas,queries,systemInfo}.ts`, `src/index.ts` (temporary: exports `createTrackedEntityFinderClient` and types only).
- Create: `registry.json` with item `tracked-entity-finder` (`registry:block`), files so far; `src/registry.manifest.test.ts` (same three checks as working-list/v1: registry deps = imported `@/registry/dhis2/ui/*` + `dhis2-theme`; every non-test, non-`src/examples/` source file shipped; dependencies = imported packages with versions).
- Modify: root `registry.json` (`include` the new file), `tools/registry/installCheck.ts` (add `${origin}/tracked-entity-finder.json`), `knip.json` (workspace entry like v1's), `.gitignore` (`__screenshots__/`), `pnpm-lock.yaml` via `pnpm install`.
- Test: `src/api/client.test.ts`, `src/api/schemas.test.ts`, `src/api/queries.test.ts`.

**Interfaces:**
- Produces:
  - `interface DataEngineLike { query(query, options?: { signal?: AbortSignal }): Promise<Record<string, DataEngineValue>> }`
  - `interface TrackedEntityFinderClient` (opaque, frozen, no methods); `createTrackedEntityFinderClient(engine: DataEngineLike): TrackedEntityFinderClient`; internal `resourceClientOf(client): FinderResourceClient` (throws for a foreign object); `FinderResourceClient.query<T>(request: { resource; id?; params? }, schema: ZodType<T>, signal?): Promise<T>`.
  - `class FinderRequestError extends Error { status?: number; serverMessage?: string }`; status read from `details.httpStatusCode ?? httpStatusCode ?? status ?? response.status`.
  - `shouldRetryFinderRequest(failureCount, cause): boolean` (no retry on zod errors, 4xx, or after 2).
  - `useTrackedEntityFinderClient(): TrackedEntityFinderClient`.
  - `interface ProgramMetadata { program; name; trackedEntityType; minAttributesRequiredToSearch; maxTeiCountToReturn; attributes: AttributeMetadata[] }` with `AttributeMetadata { id; label (displayFormName ?? displayName); valueType; unique; searchable; displayInList; options?: {code,name}[]; preferredSearchOperator?: string (lower-case); blockedSearchOperators: string[] (lower-case); minCharactersToSearch: number }`, attributes sorted by `sortOrder` then response order. Defaults: min 1, cap 0.
  - `TrackedEntitiesResponseSchema` accepting `trackedEntities` or legacy `instances`, and the pager either under `pager` or top level (`page`, `pageSize`, `total`); `normaliseTrackedEntities(response) → { rows: RawTrackedEntity[]; total?: number }`.
  - `finderKeys = { all, systemInfo(), program(program), search(program, submission, page) }`; `programMetadataQueryOptions(client: FinderResourceClient, program: string)` (staleTime ∞, retry policy).
  - `systemInfoQueryOptions(client) → { calendar: FinderCalendar; dateFormat: 'YYYY-MM-DD' | 'DD-MM-YYYY' }`.

- [ ] **Step 1: Write failing tests**
  - `client.test.ts`: `it('maps a 409 under error.details to status 409')`, `it('keeps the server message')`, `it('does not retry a 409 or a zod error, retries a 500 twice')`, `it('rejects a client it did not create')`.
  - `schemas.test.ts`: `it('orders attributes by sortOrder')`, `it('defaults min to 1 and cap to 0')`, `it('lower-cases operators')`, `it('reads legacy instances and a top-level pager')`.
  - `queries.test.ts`: `it('requests the program fields the rules need')` asserting `params.fields` contains `minAttributesRequiredToSearch`, `maxTeiCountToReturn`, `programTrackedEntityAttributes[searchable,displayInList,sortOrder,` and `blockedSearchOperators`.
- [ ] **Step 2: Run `pnpm --filter @dhis2-blocks/tracked-entity-finder test` — expect FAIL (modules missing).**
- [ ] **Step 3: Implement the files above.**
- [ ] **Step 4: Run the package tests and `pnpm --filter @dhis2-blocks/tracked-entity-finder typecheck` — expect PASS.**
- [ ] **Step 5: Commit** `feat(tracked-entity-finder): scaffold the v2 package and API layer`.

### Task 2: Program model

**Files:**
- Create: `src/rules/types.ts`, `src/rules/programModel.ts`, `src/rules/__fixtures__/program.ts`
- Test: `src/rules/programModel.test.ts`

**Interfaces:**
- Consumes: `ProgramMetadata` (Task 1).
- Produces:
  - `type FieldKind = 'text' | 'option' | 'boolean' | 'trueOnly' | 'number' | 'date' | 'dateTime' | 'unsupported'` (option set wins; text = TEXT, LONG_TEXT, LETTER, PHONE_NUMBER, EMAIL, URL, USERNAME; number = NUMBER, INTEGER*, PERCENTAGE; date = DATE, AGE; dateTime = DATETIME).
  - `interface FinderAttribute { readonly id; label; valueType; kind; unique; searchable; displayInList; options?; textOperator?: 'like'|'sw'|'eq'; blocked: BlockedOperators; minCharacters; usable: boolean }` — `usable` = searchable, supported kind, and some operator it would send is not blocked (unique: `eq`; text: a `textOperator` exists; number/date/dateTime: `eq`, or `ge`/`le` for ranges; others `eq`).
  - `interface ProgramModel { readonly program; name; trackedEntityType; attributes: readonly FinderAttribute[] (metadata order); minAttributes; maxResults }` frozen deep; `attributeOf(model, id): FinderAttribute | undefined`; `searchableAttributes(model): readonly FinderAttribute[]` (usable ones, metadata order).
  - `buildProgramModel(meta: ProgramMetadata): ProgramModel`.
  - Fixture `hivProgram: ProgramMetadata` (program `hivProgram`, name "HIV Program", min 2, cap 5) with attributes: `artNumber` ART number TEXT unique searchable displayInList; `legacyId` Legacy ID TEXT unique **not** searchable; `firstName` First name TEXT searchable displayInList minChars 2; `lastName` Last name TEXT displayInList not searchable; `dob` Date of birth DATE searchable displayInList; `sex` Sex TEXT option set (`F` Female, `M` Male) searchable displayInList; `weight` Weight INTEGER searchable; `visit` Last visit DATETIME searchable; `photo` Photo IMAGE searchable; `nickname` Nickname TEXT searchable blocked `like, sw, eq`.

- [ ] **Step 1: Write failing tests** — `it('marks unique-but-not-searchable attributes unusable')` (`legacyId.usable === false`), `it('marks unsupported value types unusable')` (`photo`), `it('marks a text attribute with every operator blocked unusable')` (`nickname`), `it('uses preferredSearchOperator unless blocked, else like, sw, eq')`, `it('lists searchable attributes in metadata order')` → `['artNumber','firstName','dob','sex','weight','visit']`, `it('freezes the model all the way down')` (`Object.isFrozen` on model, attributes array, an attribute, options; `blocked` has no `add`).
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(tracked-entity-finder): build the frozen program model`.

### Task 3: Form rules, sealed search, config messages

**Files:**
- Create: `src/rules/seal.ts`, `src/rules/evaluateForm.ts`, `src/rules/describeProblem.ts`
- Test: `src/rules/evaluateForm.test.ts`, `src/rules/describeProblem.test.ts`, `src/rules/sealGuard.test.ts`

**Interfaces:**
- Consumes: `ProgramModel`, `FinderAttribute`, fixture (Task 2).
- Produces:
  - `type FieldValue = { kind: 'text'; text: string } | { kind: 'option'; code?: string } | { kind: 'boolean'; value?: 'true' | 'false' } | { kind: 'trueOnly'; checked: boolean } | { kind: 'number'; value: string } | { kind: 'numberRange'; min: string; max: string } | { kind: 'date'; date?: string } | { kind: 'dateRange'; from?: string; to?: string }` (dates are ISO `yyyy-mm-dd`; anything else is invalid input).
  - `type FieldIssue = 'too-short' | 'invalid-number' | 'not-integer' | 'invalid-date' | 'reversed'`.
  - `interface FormField { attribute: string; range: boolean }`.
  - `type ConfigProblem = { kind: 'unknown-attribute' | 'not-searchable' | 'unsupported-type' | 'operators-blocked' | 'range-not-supported' | 'range-conflict'; attribute: string } | { kind: 'form-cannot-search' }`.
  - `type ValidatedSearch` (branded, frozen `{ filters: readonly { attribute; conditions: readonly { op; value }[] }[] }`); `seal(filters)` exported only to rules modules.
  - `interface FormVerdict { problems: readonly ConfigProblem[]; issues: Readonly<Record<string, FieldIssue>>; missing: number; reason: 'empty' | 'needs-more' | 'two-ids' | 'has-issues' | 'not-set-up' | 'ready'; searchingBy?: string /* unique attribute id when the ID wins */; search?: ValidatedSearch }` — frozen; `search` present iff `reason === 'ready'`.
  - `evaluateForm(model: ProgramModel, fields: readonly FormField[], values: Readonly<Record<string, FieldValue>>): FormVerdict`.
  - `findRangeConflicts(fields: readonly FormField[]): readonly string[]` (attribute ids composed both with and without `range` anywhere under the root).
  - `describeProblem(model, problem, translate): string` — full message, e.g. ``"`xyz` isn't searchable in HIV Program. Searchable: ART number (`artNumber`, unique), First name (`firstName`), Date of birth (`dob`), Sex (`sex`), Weight (`weight`), Last visit (`visit`). This program needs 2 details unless an ID is used."``

Rules (spec §5): unusable/unknown fields → problem and excluded; `range` on unique, text, option, boolean or trueOnly → `range-not-supported`; no usable unique field and fewer usable non-unique fields than `max(min, 1)` → `form-cannot-search` and `reason: 'not-set-up'`. Any field issue → `has-issues`. Two filled unique fields → `two-ids`. One filled unique field → `ready`, `searchingBy`, single filter `[{op:'eq', value: trimmed}]`, other fields not sent. Otherwise count filled non-unique fields: `missing = max(0, max(min,1) - filled)`; nothing filled → `empty`; missing > 0 → `needs-more`. Text: trim, `minCharacters` → `too-short` (also for unique text), operator = `textOperator` (unique always `eq`). Number: `eq`; integer types reject decimals (`not-integer`); range sends `ge`/`le`, either side alone fills, min > max → `reversed`. Date: `eq`; DATETIME exact → `ge yyyy-mm-ddT00:00:00.000` + `le yyyy-mm-ddT23:59:59.999`; date ranges `ge`/`le` (datetime sides widened to day start/end). A condition whose operator is blocked makes the field unusable for that shape (`operators-blocked` problem). Option: `eq` code, only a known code fills.

- [ ] **Step 1: Write failing tests** (fixture `hivProgram`; each asserts `reason` and `search?.filters` exactly):
  - `it('searches a filled ID alone with an exact match')` — fields artNumber+firstName+dob, values artNumber `"  ART-1  "`, firstName `"Am"` → `ready`, `searchingBy: 'artNumber'`, filters `[{attribute:'artNumber', conditions:[{op:'eq', value:'ART-1'}]}]`.
  - `it('refuses two IDs at once')` — a second unique usable attribute added to a local fixture copy → `two-ids`, no search.
  - `it('needs the minimum of details without an ID')` — firstName `"Am"` only → `needs-more`, `missing: 1`; plus dob `2000-01-02` → `ready`, filters firstName `like Am`, dob `eq 2000-01-02`.
  - `it('counts a one-sided range as filled')` — dob range `{from:'2000-01-01'}` + firstName → `ge 2000-01-01` only.
  - `it('sends a datetime day as ge/le bounds')`.
  - `it('flags short text, decimals in integers, bad dates and reversed ranges as issues and blocks search')` → `has-issues` with each issue.
  - `it('reports non-searchable, unknown, unsupported and fully blocked fields and leaves them out')` → problems for `legacyId`, `nope`, `photo`, `nickname`; their values never appear in filters.
  - `it('reports a form that can never search')` — fields `[firstName]` with min 2 → `form-cannot-search`, `not-set-up`.
  - `it('rejects range on an ID or text field')`.
  - `it('finds an attribute composed with and without range')`.
  - `it('freezes the verdict and the search all the way down')`.
  - `describeProblem.test.ts`: the exact message above for `not-searchable` `xyz`; `form-cannot-search` names the minimum.
  - `sealGuard.test.ts`: `it('only rules modules import seal')` — scan `src/**` (non-test) for imports of `rules/seal` outside `src/rules/`; expect none.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(tracked-entity-finder): judge composed forms under the program's search rules`.

### Task 4: Running a search

**Files:**
- Create: `src/rules/searchParams.ts`, `src/api/search.ts`
- Test: `src/rules/searchParams.test.ts`, `src/api/search.test.ts`

**Interfaces:**
- Consumes: `ValidatedSearch`, `ProgramModel` (Tasks 2–3), `FinderResourceClient`, `TrackedEntitiesResponseSchema` (Task 1).
- Produces:
  - `PAGE_SIZE = 10`; `serializeFilter(filter): string` (escape `/` → `//`, `:` → `/:`, `,` → `/,`); `toSearchParams(model, search, page)` → exactly the request params in Global Constraints.
  - `interface FinderPerson { trackedEntity; trackedEntityType; orgUnit; programOwner?: string; attributes: Record<string, string> }` (`programOwner` = owner orgUnit for the model's program).
  - `type SearchOutcome = { kind: 'results'; people: FinderPerson[]; page: number; hasNext: boolean } | { kind: 'too-many' }`.
  - `runSearch(client, model, search, page, signal?): Promise<SearchOutcome>` — total > `maxResults` (when > 0) → `too-many` with no people; 409 whose message contains `maxteicountreached` (case-insensitive) → `too-many` unless aborted; other errors throw. `hasNext` from total when present, else `people.length === PAGE_SIZE`.

- [ ] **Step 1: Write failing tests** — `it('escapes : , / in values')` (`ART:1,2/3` → `artNumber:eq:ART/:1/,2//3`), `it('sends orgUnitMode ACCESSIBLE and no orgUnits')`, `it('returns too-many over the cap and shows no one')` (total 6, cap 5), `it('treats cap 0 as no cap')`, `it('maps a 409 maxteicountreached to too-many, from either error shape')`, `it('rethrows other failures')`, `it('picks the program owner for the program')`, `it('works out hasNext with and without a total')`.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(tracked-entity-finder): run sealed searches with the result cap`.

### Task 5: Calendar dates and value formatting

**Files:**
- Create: `src/calendar/calendarDates.ts`, `src/calendar/CalendarDateInput.tsx`, `src/format/formatValue.ts`
- Test: `src/calendar/calendarDates.test.ts`, `src/format/formatValue.test.ts`, `src/calendar/CalendarDateInput.test.tsx`

**Interfaces:**
- Consumes: `FinderSystemInfo` (Task 1), `FinderAttribute` (Task 2).
- Produces:
  - `calendarDateToIso(value: string, info): string | undefined` and `isoToCalendarDate(iso: string, info): string` (system calendar + `dateFormat`, via `@dhis2/multi-calendar-dates`; Ethiopian/coptic era years handled as working-list's `registry/transformers.ts` does).
  - `CalendarDateInput({ label, value /* ISO or invalid text */, onChange(next: string /* ISO, '' or the raw text when invalid */), info, dataTest })` — renders `@dhis2/ui` `CalendarInput` in the system calendar; wrapped in an error boundary that, if `CalendarInput` throws, falls back to a labelled plain text input in the system date format (converted the same way). An injectable component via `CalendarInputProvider` for tests, like working-list.
  - `formatValue(attribute: FinderAttribute | undefined, raw: string, info, translate): string` — option code → name, DATE/AGE → system calendar date, DATETIME → date + time, BOOLEAN → Yes/No, TRUE_ONLY → Yes, empty → `—`, unknown attribute → raw.

- [ ] **Step 1: Write failing tests** — round-trips for gregorian `YYYY-MM-DD` and `DD-MM-YYYY`, nepali and ethiopian known dates (take reference pairs from working-list's calendar tests); `formatValue` cases above; browser test `it('does not crash on the ethiopian calendar')` rendering the **real** `CalendarInput` with `calendar: 'ethiopian'`, typing a date, and asserting `onChange` received the ISO date (fallback path acceptable, crash not).
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(tracked-entity-finder): system calendar dates and value display`.

### Task 6: Root, forms, fields, submit

**Files:**
- Create: `src/ui/FinderText.tsx`, `src/ui/root/{Finder,FinderContext,useFinderController}.ts(x)`, `src/ui/form/{FinderForm,FinderField,FinderSubmit,ConfigError}.tsx`, `src/ui/form/inputs/*`, `src/ui/hooks.ts` (field, search, program hooks), `src/ui/__tests__/finderTestSupport.tsx`
- Test: `src/ui/__tests__/FinderForm.test.tsx`, `src/ui/__tests__/ConfigErrors.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `Finder({ program: string; onSelect(person: FinderPerson): void; client?: TrackedEntityFinderClient; children?: ReactNode })` — keyed on `program`; renders children only; dev `console.warn` when children are empty.
  - Internal controller (context) used by Task 7: `{ model?: ProgramModel; status: 'loading' | 'ready' | 'error'; info?: FinderSystemInfo; values; setValue(id, value); register(formId, key, field): () => void; submit(search: ValidatedSearch): void; submission?: { search; id: number }; page: number; setPage(n): void; onSelect }`.
  - `FinderForm({ children, className? })`, `FinderField({ attribute: string; range?: boolean; label?; description?; placeholder? })`, `FinderSubmit({ children? })`.
  - `useFinderField(uid, options?: { range?: boolean }) → { attribute?: { label; valueType; unique; options? }; value?: FieldValue; setValue(value: FieldValue): void; issue?: FieldIssue; problem?: string }` — must be inside `FinderForm` (throws otherwise); registers via `useLayoutEffect`, unregisters on unmount.
  - `useFinderSearch() → { canSearch: boolean; missing: number; reason: FormVerdict['reason']; searchingBy?: string; submit(): void }` (inside `FinderForm`). `submit` sends only `verdict.search`.
  - `useFinderProgram() → { status; name?; searchableAttributes: readonly { id; label; valueType; unique }[] }` (frozen).
  - `FinderTextProvider({ translate, children })`.

Hints (`FinderSubmit`): `needs-more` → "Add 1 more detail to search" / "Add {{count}} more details to search"; `ready` with `searchingBy` → "Searching by {{label}} only"; `two-ids` → "Search by one ID at a time". Config errors: development (`process.env.NODE_ENV !== 'production'`) shows `describeProblem` text inline with `role="alert"`; production shows "This search isn't set up correctly" and `console.error`s the full text once per problem. Loading: fields disabled + spinner in the form; metadata error: inline error per form.

- [ ] **Step 1: Write failing browser tests** (fake client from `finderTestSupport` serving `hivProgram` and canned search responses; record requests):
  - `it('renders one input per composed field with metadata labels')` — text, option select, date, number.
  - `it('keeps Search disabled until the form can search, with a hint')` — firstName only → disabled + "Add 1 more detail to search"; add dob → enabled.
  - `it('searches by an ID alone and says so')` — artNumber + firstName filled → hint "Searching by ART number only"; the recorded request has one filter `artNumber:eq:ART-1`.
  - `it('keeps two forms apart in one root')` — ID form and details form; submitting the details form sends only its fields.
  - `it('drops a form's fields when it unmounts')` (Review Focus 2) — toggle forms; the remaining form's verdict unchanged.
  - `it('submits on Enter')`.
  - `ConfigErrors.test.tsx`: `it('shows the full message in development')` for `legacyId`; `it('shows the short message and logs in production')` (stub `process.env.NODE_ENV`), never sends `legacyId` (Review Focus 4); `it('throws when a field is outside a form or a part is outside the root')`.
- [ ] **Step 2: Run `pnpm --filter @dhis2-blocks/tracked-entity-finder test:browser` — expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(tracked-entity-finder): compose search forms from fields`.

### Task 7: Results parts

**Files:**
- Create: `src/ui/results/{FinderResults,FinderList,FinderItem,FinderValue,FinderPagination,FinderStates}.tsx`; add `useFinderResults` to `src/ui/hooks.ts`
- Test: `src/ui/__tests__/FinderResults.test.tsx`

**Interfaces:**
- Consumes: controller (Task 6), `runSearch`, `finderKeys` (Tasks 1, 4), `formatValue` (Task 5).
- Produces:
  - `useFinderResults() → { status: 'idle' | 'searching' | 'results' | 'empty' | 'too-many' | 'error'; people: readonly FinderPerson[]; page: number; hasNext: boolean; hasPrevious: boolean; refreshing: boolean; next(): void; previous(): void; select(person): void }` — one TanStack query keyed `finderKeys.search(program, submission.id, page)` with the query `signal`; the previous page stays on screen while the next loads (placeholder only within the same submission); a new submission resets page to 1.
  - `FinderResults({ children? })`, `FinderEmpty|FinderTooMany|FinderError({ children })`, `FinderList({ children: (person) => ReactNode })`, `FinderItem({ person, children, className? })` (a `<button type="button">` row; Enter/Space select), `FinderValue({ person, attribute })`, `FinderPagination()`.
  - Default rows: `displayInList` attributes in metadata order, each "label: value", inside `FinderItem`.
  - Override registration: state parts and `FinderPagination` register with the nearest `FinderResults`; unregistered states render their default in place of the list; the default pager follows the children unless one is registered.

- [ ] **Step 1: Write failing browser tests** — `it('shows nothing before the first search')`, `it('shows searching, then rows from displayInList attributes')`, `it('says No one found')`, `it('says Too many matches. Add another detail. with no rows')`, `it('shows a request error')`, `it('selects a person by click and by keyboard')` (`onSelect` receives the `FinderPerson`), `it('pages with previous and next')`, `it('renders custom rows with FinderList, FinderItem and FinderValue, keeping default states and pager')`, `it('uses FinderEmpty and FinderTooMany overrides')`, `it('shows a non-displayInList attribute through FinderValue')` (`weight`), `it('drops an old program's in-flight search when the program changes')` (Review Focus 1: rerender with another `program` while the fake response is pending; resolve it; expect idle and empty fields), `it('shows only the newest answer after a double submit')` (Review Focus 5).
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(tracked-entity-finder): results parts and the results hook`.

### Task 8: Public surface and registry item

**Files:**
- Modify: `src/index.ts` (exactly the Global Constraints public names plus `FieldValue`, `FinderPerson` types), `registry.json` (all shipped files and dependencies; manifest test green)
- Create: `type-tests/public-surface.ts`, `README.md` (package: one paragraph + link to the root README section)

**Interfaces:**
- Consumes: everything above.
- Produces: the published API.

- [ ] **Step 1: Write the type test** — `@ts-expect-error` on `Finder` props `minAttributes`, `maxResults`, `orgUnitMode`, `filters`, `trackedEntityType`, `scope`; on `FinderField` props `operator`, `unique`, `searchable`; on `useFinderField(uid, { operator: 'like' })`; `ValidatedSearch` is not constructible from a plain object; `TrackedEntityFinderClient` has no `query`; returned model/verdict-derived objects are `readonly`.
- [ ] **Step 2: Run `pnpm --filter @dhis2-blocks/tracked-entity-finder typecheck` — expect FAIL until exports match.**
- [ ] **Step 3: Finalise exports and `registry.json`.**
- [ ] **Step 4: Run package `test`, `typecheck`, `lint` and root `pnpm registry:check` — expect PASS.**
- [ ] **Step 5: Commit** `feat(tracked-entity-finder): publish the composable surface`.

### Task 9: Example block `tracked-entity-finder-01`

**Files:**
- Create: `src/examples/tracked-entity-finder-01/FindPerson.tsx`, `src/examples/tracked-entity-finder-01/index.ts`
- Modify: `registry.json` (second item `tracked-entity-finder-01`, `registry:block`, title "Find a person by ID, with a 'No ID?' fallback", `registryDependencies: ["devotta-labs/dhis2-blocks/tracked-entity-finder", "devotta-labs/dhis2-blocks/button"]` plus any primitives it imports, file target `@components/tracked-entity-finder/examples/tracked-entity-finder-01/FindPerson.tsx`), `src/registry.manifest.test.ts` (checks for the example item), `tools/registry/installCheck.ts` (add `${origin}/tracked-entity-finder-01.json`)
- Test: `src/examples/tracked-entity-finder-01/FindPerson.test.tsx`

**Interfaces:**
- Consumes: public API via `../../index`.
- Produces: `FindPerson({ onSelect(person: FinderPerson): void })`; constants at the top: `PROGRAM = 'TfPrg000001'`, `ART_NUMBER = 'TfAtArtNo01'`, `FIRST_NAME = 'TfAtFirst01'`, `DATE_OF_BIRTH = 'TfAtDob0001'`, with the comment "Replace with your program's uids. List them with: GET /api/programs/<program>?fields=name,minAttributesRequiredToSearch,programTrackedEntityAttributes[searchable,displayInList,trackedEntityAttribute[id,displayName,valueType,unique]]".

Layout: ID form (ART number + Search); a link-style button "No ID?" swapping to the fallback form (first name + date of birth + Search) with "Search by ID instead" back; `<FinderResults />` below. Comments mark the places a developer or agent edits.

- [ ] **Step 1: Write failing browser test** (fixture metadata mirroring the seed uids) — `it('finds by ART number')`, `it('swaps to first name and date of birth with No ID?')`, `it('swaps back with Search by ID instead')`.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run package tests and `pnpm registry:check` (both items install and typecheck in the consumer) — expect PASS.**
- [ ] **Step 5: Commit** `feat(tracked-entity-finder): add the find-person example block`.

### Task 10: Demo, translations, e2e seed and spec, README

**Files:**
- Create: `apps/web/src/app/TrackedEntityFinderDemo/{TrackedEntityFinderDemo.tsx,index.ts}`, `apps/web/src/app/__tests__/TrackedEntityFinderDemo.test.tsx`, `apps/web/src/trackedEntityFinderTranslationCatalog.ts`, `e2e/metadata/tracked-entity-finder-metadata.json`, `e2e/metadata/tracked-entity-finder-tracker-data.json`, `e2e/specs/tracked-entity-finder.spec.ts`
- Modify: `apps/web/package.json` (workspace dep), `apps/web/src/AppWrapper.tsx` (route `/tracked-entity-finder`), `apps/web/src/app/AppShell/AppShell.tsx` (footer link "Tracked entity finder"), `apps/web/i18n/en.pot`, `knip.json` (catalog entry), `scripts/e2e/seed-metadata.sh` (import both files + check `TfPrg000001` has min 2, cap 5), root `README.md` (new "Tracked Entity Finder block" section)

**Interfaces:**
- Consumes: `FindPerson` via `@dhis2-blocks/tracked-entity-finder/examples/tracked-entity-finder-01`.

Seed (HIV-style): program `TfPrg000001` "HIV care (finder E2E)", WITH_REGISTRATION, min 2, cap 5, Person-like TET, accessible to admin on the e2e org unit. Attributes: `TfAtArtNo01` ART number (TEXT, unique, searchable, displayInList), `TfAtFirst01` First name (TEXT, searchable, displayInList), `TfAtLast001` Last name (TEXT, displayInList), `TfAtDob0001` Date of birth (DATE, searchable, displayInList), `TfAtSex0001` Sex (option set F/M, searchable, displayInList), `TfAtLegId01` Legacy ID (TEXT, unique, not searchable), `TfAtPhone01` Phone (PHONE_NUMBER, not searchable). People: `TfTei000001` ART-0001 Amina Kamara 1990-04-12; six people first name "Fatmata" born 2000-01-01 (ART-0002…0007); `TfTei000008` ART-0008 Fatmata Sesay 1995-03-02; four others.

Demo: heading, `<FindPerson onSelect={setSelected} />`, a "Selected" region (`aria-label`) with the JSON of the selection, and a note that it runs against the seeded e2e stack.

- [ ] **Step 1: Write failing tests** — demo browser test (fake engine): `it('shows the example and the selection')`. e2e spec (`AxeBuilder` from `./capture-parity.support`): `finds a person by ART number and selects them` (ART-0001 → Selected contains `TfTei000001`); `No ID? needs both details` (first name "Fatmata" → Search disabled, "Add 1 more detail to search"; DOB 1995-03-02 → one row); `too many matches shows no rows` (Fatmata + 2000-01-01 → "Too many matches. Add another detail.", zero rows); `has no serious accessibility violations`.
- [ ] **Step 2: Run `pnpm --filter @dhis2-blocks/web test` — expect FAIL.**
- [ ] **Step 3: Implement demo, catalog (every finder string as a literal `i18n.t`), `en.pot`, seed, script, README** (idea; the attribute-listing API call; rules in plain words; parts and hooks; recipes: zero-config results, custom rows, headless; a two-program switch snippet showing `program` from a dropdown; the example block as one starting point, not the only way; demo needs `pnpm e2e:up 43`).
- [ ] **Step 4: Run app tests; if Docker is available run `pnpm e2e:43` — expect PASS (otherwise record that e2e was not run).**
- [ ] **Step 5: Commit** `feat(web): demo the composable tracked entity finder` (restore any `en.pot` timestamp-only churn first).

### Task 11: Final verification

- [ ] **Step 1: Run root `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm registry:check`, `pnpm dead-code:audit` — all PASS.**
- [ ] **Step 2: Check spec coverage against `docs/superpowers/specs/2026-10-22-finder-composable-design.md` §2–§11; fix gaps.**
- [ ] **Step 3: Commit any fixes** `fix(tracked-entity-finder): …`.
