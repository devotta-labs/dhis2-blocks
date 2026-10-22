# Tracked Entity Finder v2 (composable): design

Date: 2026-10-22 · Status: draft, awaiting approval
Branch: `jc/feat/finder-composable`, based on `jc/feat/shared-ui` @ 52d5020 (the user's call, 2026-10-22). The v1
work stays untouched on `jc/feat/tracked-entity-finder` @ b3359b9 and is not on this branch.
Research on what Capture and the server do: `patient-search-capture-research.md` in the session notes folder, and
§5 of the v1 spec (`docs/superpowers/specs/2026-10-21-tracked-entity-finder-design.md`).

## 1. Intent and why

v1 works and is fully tested, but it reproduced the Capture app's search: an auto-generated form from every
searchable attribute, an "ID route" and a "details route", an ID box that fans out over every unique attribute,
a number grammar, an Exact/Range switch and a Program/TET toggle. The user's verdict: "Capture all over again".

One real target is a country building a **narrow app for one program**, for example an HIV management app:

> Open the app → type the ART number → Search → pick the person → do HIV work.
> No ID? A "No ID?" link (like "Forgot password?") swaps to a small form the developer chose, say first name and
> date of birth → Search → pick the person.

Another is an app for two programs, where the user first picks HIV or TB and then sees the finder set up for that
program. **The finder is agnostic to where the program comes from:** `program` is a plain prop, so it can be a
constant, a dropdown above or outside the finder, a route parameter or anything else the host has. Each root
searches one program at a time; changing `program` resets values and results. Fields are composed per program
(uids differ between programs), so a two-program app renders a different set of fields for each, typically by
switching on the selected program.

The developer, often working with an AI agent that has the program metadata JSON or server access, should
**compose exactly the form and results they need** from small parts, shadcn-style (like `Command` →
`CommandInput`, `CommandList`, `CommandItem`). The block's job is to make that easy **and** keep DHIS2's search
rules unbreakable, invisibly.

**Standalone from v1 (the user's instruction, 2026-10-22).** v2 is a fresh build, not a refactor of v1. v1 is a
reference for the search rules, the edge cases its tests caught, and the DHIS2 quirks it learned (listed in §9),
not a codebase to carry forward. The package `packages/blocks/tracked-entity-finder`, its registry entry in the
root `registry.json`, the demo route, the e2e seed and the README section are all created fresh on this branch.
Looking at v1 (`git show jc/feat/tracked-entity-finder:<path>`) or at working-list for a small helper (filter
escaping, calendar ↔ ISO conversion, the 409 check) is fine; write what fits the new shape.

## 2. Goals

1. One registry block, `tracked-entity-finder`, exporting a root, small composable parts and hooks for finding one
   tracked entity in **one program** and handing it to `onSelect`.
2. The developer chooses every field, by attribute uid. There is no auto-generated form anywhere.
3. Results work with zero wiring (`<FinderResults />`), can be overridden part by part, or built fully headless.
4. Search rules (§5) are enforced by the root at Search time, for every composition, with no way to loosen them.
5. Developer mistakes fail loudly with messages an AI agent can act on (§6).
6. A separate, copy-and-edit **example block** (§8): ID search + "No ID?" fallback + results. A clear starting
   point, explicitly not the only way.
7. Demo route, e2e and README rebuilt around that example.

## 3. Non-goals

- Tracked entity type scope, and the Program/TET toggle. The root takes a program only.
- An auto-generated "all searchable attributes" form, ID fan-out across all unique attributes, the number query
  grammar and its read-backs, an end-user Exact/Range switch.
- Cross-program fallback, registering or enrolling, break the glass, an org unit picker, offline search.
- Searching by `ORGANISATION_UNIT`, `TIME`, `COORDINATE`, `GEOJSON`, `FILE_RESOURCE`, `IMAGE` attributes.
- Joining names, deriving age, or any other computed display. The block shows attribute values; the developer
  composes anything else.

## 4. Anti-goals: failure even if it technically works

- **Capture again.** If using the block means getting a big generic form the developer then hides bits of, it has
  failed.
- **An escape hatch.** Any prop, part, hook or export that lowers, skips or overrides a rule in §5. Developers
  can make search stricter (fewer fields), never looser.
- **An enumeration tool.** Partial ID matching, filling a minimum with junk, paging past the cap.
- **Silent misconfiguration.** A field that quietly does nothing, or a form that can never search, with no
  explanation.
- **Tissue-paper walls.** Client-only restrictions beyond what the metadata and Capture express (the v1 principle
  stays; the one deliberate exception, unique attributes must be `searchable`, stays too).

## 5. Search rules (decided; not configurable)

These are v1's rules, unchanged in substance. The difference is that they now apply to whatever fields the
developer composed, per form.

1. **Program metadata** read once per program: `minAttributesRequiredToSearch`, `maxTeiCountToReturn`,
   `trackedEntityType`, and every `programTrackedEntityAttribute` with `searchable, displayInList, sortOrder` and
   the attribute's `id, displayName/displayFormName, valueType, unique, optionSet[options[code, displayName]],
   preferredSearchOperator, blockedSearchOperators, minCharactersToSearch`. Missing operator/minimum-character
   fields on older servers mean "no restriction" for those two things only. `maxTeiCountToReturn: 0` means no cap.
2. **Only `searchable` attributes can be searched**, including unique ones (a unique attribute that is not
   `searchable` cannot be used; stricter than Capture, the user's earlier decision).
3. **Each `<FinderForm>` is one search.** Its fields are the `FinderField`s / `useFinderField` calls inside it.
   When the user presses Search in a form:
   - **A filled unique field searches alone**, with exactly one filter `uid:eq:value`, and that is enough on its
     own. Never `like`, `sw` or ranges for a unique attribute.
   - Otherwise at least `minAttributesRequiredToSearch` of the form's non-unique fields must hold a valid value
     (a minimum of 0 still needs one). Too few: Search is disabled and the form says what is missing.
   - **My call:** if a unique field is filled, other filled fields in the same form are not sent (the ID wins;
     the hint says "Searching by ART number only"). If two unique fields are filled, the form cannot search
     ("Search by one ID at a time").
4. **Operators** follow v1 (§6.4 of the v1 spec), minus the parts dropped in §3:
   text types use `preferredSearchOperator` if set and not blocked, else the first of `like, sw, eq` not blocked
   (all blocked → the field is a config error, §6); option sets, booleans, true-only, numbers, dates `eq`;
   `DATETIME` exact means the whole day (`ge` start, `le` end); `AGE` searches by date of birth. Blocked
   operators are never sent; `minCharactersToSearch` applies to text; values are trimmed (not option codes) and
   `:`, `,`, `/` are escaped as on the server.
5. **Ranges are opt-in by the developer, never an end-user switch (my call; please check).** `FinderField` takes
   `range` for date, age, datetime and number attributes and then renders From–To; either side alone counts as
   filled (as Capture). Without `range`, dates and numbers are a single exact input. Ranges are legitimate
   DHIS2 search (Capture offers them), so this does not loosen anything.
6. **Org units:** every request sends `orgUnitMode=ACCESSIBLE` and no `orgUnits`.
7. **Cap and paging:** requests ask for totals; if `maxTeiCountToReturn > 0` and the total exceeds it, show "Too
   many matches. Add another detail." and **no rows**. A 409 `maxteicountreached` (status on the error or under
   `error.details`) means the same. Pages of 10 with previous/next. No re-querying, splitting or paging around
   the cap.
8. **No bypass by construction:** the request is built by one pure function from (program metadata, a form's
   composed field uids, values, page). Composed uids are always re-checked against the metadata there, so
   registering a non-searchable uid (through a part or a hook) can never put it in a request. A validated search
   is a frozen, branded value only the rule module can create; the model and verdicts are frozen. The custom
   `client` export stays opaque (it cannot run requests). No prop or hook option touches min, cap, operators,
   org unit mode or raw filters; a type test asserts this.

## 6. Developer errors (decided: loud, agent-friendly)

A form is checked as soon as program metadata is loaded. Problems:

- A field uid that is not in the program, not `searchable`, of an unsupported value type, or whose operators are
  all blocked.
- A form that can never search: no usable unique field and fewer usable non-unique fields than the minimum.
- A `FinderField` / `useFinderField` outside a `FinderForm`, or a part outside the root.

Each problem produces a message naming the program and listing its searchable attributes with names, uids and
the unique flag, e.g.:

> `xyz` isn't searchable in HIV Program. Searchable: ART number (`abc`, unique), First name (`def`), Date of
> birth (`ghi`). This program needs 2 details unless an ID is used.

**How it surfaces (my call; please check):** metadata lives on the server and an admin can change it after the
app ships, so a config error must not crash a production app. Instead:

- The bad field (or the whole form, if it can never search) renders an inline error in place and is left out
  of the search; Search stays disabled if the form can no longer reach the rules.
- In development builds the inline error shows the full message above; in production builds it shows a short
  "This search isn't set up correctly" and the full message goes to `console.error`.
- Programmer errors that metadata cannot cause (a part outside the root, a field outside a form) throw, like any
  React context misuse.
- An empty root (no children) logs a development warning.

The README gives the single API call that lists a program's searchable attributes (and their unique flag,
value type, `displayInList`), so a developer or agent can pick uids before writing code.

## 7. Public surface (decided parts, names my call)

```tsx
<Finder program="ART_PROGRAM_UID" onSelect={(person) => …}>
  <FinderForm>                       {/* one search; rules apply to its fields */}
    <FinderField attribute="ART_NUMBER_UID" />
    <FinderSubmit />                 {/* "Search"; disabled until the form can search */}
  </FinderForm>
  <FinderResults />                  {/* zero-config results for the last search */}
</Finder>
```

**Root, `Finder`.** Props: `program` (uid), `onSelect(person)`, optional `client`, `children`. Renders only its
children (like an empty `<Command/>`). Holds metadata, field values, the last submitted search and its results.
Changing `program` resets everything. Naming (my call): parts are `Finder*`, matching the agreed names, while the
package and registry item stay `tracked-entity-finder`.

**Form parts.**

- `FinderForm`: a `<form>`; Enter submits. Groups the fields that form one search (§5.3). Several forms may share
  one root (the ID form and the "No ID?" form); results always show the last submitted one, until the next
  Search. Field values live in the root keyed by uid, so the same uid in two forms shares its value. **My call:**
  the same uid composed with `range` in one place and without it in another is a developer error (§6), since the
  two cannot share a value.
- `FinderField attribute="uid"`: label + input chosen by value type (text, option select, yes/no select,
  true-only checkbox, number, system-calendar date). Optional `label`, `description`, `placeholder`, `range`
  (§5.5). Shows its own issue inline (too short, invalid number/date, reversed range).
- `FinderSubmit`: submit button plus the live hint ("Add 1 more detail to search", "Searching by ART number
  only"). Optional children replace the label.

**Results parts.** All read root state; nothing to wire.

- `FinderResults`: with no children, renders the default: a searching state, "No one found", "Too many matches.
  Add another detail.", a request error, a list of rows and a pager. Default rows show the program's
  `displayInList` attributes (IDs included) in metadata order, values formatted; each row is a keyboard-accessible
  button that calls `onSelect`. **With children (my call):** it renders the children; the override parts below
  register with it, and any state the developer did not override (searching, empty, too many, error) still shows
  its default in place of the list, and the default pager follows the children unless a `FinderPagination` is
  among them. So `<FinderResults><FinderList>{…}</FinderList></FinderResults>` customises rows only and keeps
  every other default.
- `FinderEmpty`, `FinderTooMany`, `FinderError`: optional overrides for those states (children = content).
- `FinderList`: `children: (person) => ReactNode`; renders the current page.
- `FinderItem person={person}`: the clickable, keyboard-accessible row; calls `onSelect(person)`.
- `FinderValue person={person} attribute="uid"`: one value formatted by value type (option names,
  system-calendar dates, yes/no). **Change from v1:** any attribute the API returned may be shown, not only
  `displayInList` ones; the server only returns what the user may read, so this is the builder's call. A uid
  outside the program's attributes shows the raw value.
- `FinderPagination`: previous/next for the current results.

**Hooks (headless).**

- `useFinderField(uid)` → `{ attribute: { label, valueType, unique, options? }, value, setValue, issue,
  configError? }`. Must be inside a `FinderForm`; it registers the field there like `FinderField` does.
- `useFinderSearch()` (inside a `FinderForm`) → `{ canSearch, missing, reason, submit }`.
- `useFinderResults()` → `{ status: 'idle' | 'searching' | 'results' | 'empty' | 'too-many' | 'error', people,
  page, hasNext, hasPrevious, next(), previous(), select(person) }`.
- `useFinderProgram()` → `{ status: 'loading' | 'ready' | 'error', name, searchableAttributes }` (read-only,
  frozen), for developers building their own labels or empty states.

**Loading and errors before search (my call):** while program metadata loads, fields render disabled with a
spinner in the form; a metadata request failure renders an error in each form and in `FinderResults`.

**Person shape** (`onSelect`, `FinderList`, hooks): `{ trackedEntity, trackedEntityType, orgUnit, programOwner?,
attributes: { [uid]: value } }`, as v1.

**Text:** a `FinderTextProvider` (translate function, default `i18n.t`), keys in the `apps/web` catalog and
`en.pot`, as other blocks do.

## 8. Example block (decided: separate registry item)

A second registry item, shadcn "blocks" style (like `login-01`): **`tracked-entity-finder-01`**, "Find a person by
ID, with a 'No ID?' fallback". One readable component built only from the public parts:

- An ID form: `FinderField` for the unique ID + Search.
- A "No ID?" link button under it (like "Forgot password?") that swaps to a second form, e.g. first name + date of
  birth + Search, with a "Search by ID instead" link back.
- `<FinderResults />` below; selecting calls the component's `onSelect` prop.
- The program and attribute uids are named constants at the top of the file with a comment: "Replace with your
  program's uids; list them with <API call>". **My call:** the constants point at the e2e seed program (§10), so
  the example runs as-is in this repo's demo and e2e, and the swap point is obvious.

It must read as a well-made, very clear starting point (the user's requirement), commented where a developer or
agent would edit, and the README says plainly that it is one way to compose the parts, not the only way. It
depends on the `tracked-entity-finder` item through `registryDependencies`; where its source lives and how its
imports resolve after install is the builder's call, as long as `pnpm registry:check` installs both cleanly.

## 9. What v1 learned (reference, not code to keep)

Behaviour and edge cases the rewrite must still get right; v1's tests show concrete cases:

- Server 409 `maxteicountreached` may carry its status on the error or under `error.details` (Capture misses the
  latter).
- Tracker API names (`trackedEntities` vs `instances`) differ across 41–43; handle like working-list.
- **Dates follow the system calendar (the user's decision, 2026-10-22):** date fields are typed in the server's
  calendar (`keyUiCalendar`, e.g. Ethiopian, Nepali), converted to ISO for requests and back for display, as
  working-list does. v1's Ethiopian calendar input crashed; the v2 input must not, with a browser test on a
  non-Gregorian calendar.
- Freeze the model, verdicts and validated search all the way down; v1 found a mutable-verdict bypass late.
- Abort in-flight searches when a new one starts; keep the previous page on screen while the next page loads.
- Retry only operational failures (no retry on 4xx or schema errors).

## 10. Demo, e2e, README

- **Demo** `#/tracked-entity-finder`: renders the example block as-is (no program picker, no scope toggle), plus a
  "Selected" panel showing what `onSelect` returned. **My call:** it runs against the seeded e2e stack only
  (`pnpm e2e:up 43`, as the other demos are run); the README says so and points at the uid constants to try it
  elsewhere. Add the route lazily in `AppWrapper.tsx` with a footer link in `AppShell`, like the other demos.
- **e2e seed:** a new seed program (`e2e/metadata/tracked-entity-finder-*.json`, wired into
  `scripts/e2e/seed-metadata.sh`) telling the HIV-style story (unique, searchable ID; first name;
  date of birth; a couple of other attributes, one non-searchable and one unique-but-not-searchable for the
  negative cases; min 2; cap 5) with enough people to hit "too many". Exact data is the builder's call.
- **e2e spec:** find by ID and select; "No ID?" swap and search by first name + date of birth; Search disabled
  until the minimum; too many matches shows no rows; no serious axe violations.
- **README** (root section + package README): the idea in one paragraph; the API call to list searchable
  attributes; the rules in plain words; the parts and hooks; three short recipes (zero-config results, custom
  rows with `FinderList`/`FinderItem`/`FinderValue`, fully headless); the example block as a starting point.

## 11. Testing

- Node unit tests on the pure rule module, one per rule in §5 and per error in §6 (searchable-only, unique alone
  and exact, ID wins, two IDs refused, min gate incl. one-sided ranges and `minCharactersToSearch`, operator
  choice with preferred/blocked, escaping, datetime whole day, cap total, 0 = no cap, 409 both shapes, frozen
  outputs, re-check of registered uids).
- Browser tests (vitest browser project) on the parts: field per value type, Submit gating and hints, two forms
  in one root, default results states, overrides, `FinderItem` keyboard select, pagination, config error
  rendering in dev and prod modes.
- A browser test of the example block against fixture metadata.
- Type test on the public surface: no rule-override props or hook options.
- Registry manifest test covering both items; root `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm
  registry:check` green; `pnpm e2e:43` green when Docker is available.

## 12. Left to the builder

- Internal structure (store vs context/reducer, file layout), as long as the rule module stays pure and is the
  only way to build a request.
- Visual details within the existing `ui` primitives; default row layout.
- Exact wording of hints and errors, within the meaning above.
- Seed data details.
