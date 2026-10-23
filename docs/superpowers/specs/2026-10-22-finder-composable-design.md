# Tracked Entity Finder v2 (composable): design

Date: 2026-10-22, revised 2026-10-23 for master's conventions (§13) · Status: approved 2026-10-22; revision
awaiting approval
Branch: `jc/feat/finder-composable`, based on `master` @ b11e89e (shared-ui has landed there; rebased 2026-10-23).
The v1 work stays untouched on `jc/feat/tracked-entity-finder` @ b3359b9 and is not on this branch.
Composition rules: `.agents/skills/vercel-composition-patterns/` on master, and how master's blocks apply them
(`sidebar`, `working-list`, `context-selector`). §13 lists what the revision changed and why.
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
constant, a dropdown above or outside the finder, a route parameter or anything else the host has. Each provider
searches one program at a time; changing `program` resets values and results. Fields are composed per program
(uids differ between programs), so a two-program app renders a different set of fields for each, typically by
switching on the selected program.

The developer, often working with an AI agent that has the program metadata JSON or server access, should
**compose exactly the form and results they need** from small parts, shadcn-style (like `Command` →
`CommandInput`, `CommandList`, `CommandItem`). The block's job is to make that easy **and** keep DHIS2's search
rules unbreakable, invisibly.

**Standalone from v1 (the user's instruction, 2026-10-22).** v2 is a fresh build, not a refactor of v1. v1 is a
reference for the search rules, the edge cases its tests caught, and the DHIS2 quirks it learned (listed in §9),
not a codebase to carry forward. The block `packages/registry/blocks/tracked-entity-finder/`, the example block,
the docs page and examples, and the docs e2e are all created fresh on this branch.
Looking at v1 (`git show jc/feat/tracked-entity-finder:<path>`) or at working-list for a small helper (filter
escaping, calendar ↔ ISO conversion, the 409 check) is fine; write what fits the new shape.

## 2. Goals

1. One registry block, `tracked-entity-finder`, exporting a provider, small composable parts and hooks for finding
   one tracked entity in **one program** and handing it to `onSelect`.
2. The developer chooses every field, by attribute uid. There is no auto-generated form anywhere.
3. Results work with zero wiring (`<FinderResults />`), can be composed from their parts, or built fully headless.
4. Search rules (§5) are enforced by the provider at Search time, for every composition, with no way to loosen them.
5. Developer mistakes fail loudly with messages an AI agent can act on (§6).
6. A separate, copy-and-edit **example block** (§8): ID search + "No ID?" fallback + results. A clear starting
   point, explicitly not the only way.
7. A docs page with live examples, docs e2e and a block README, built around that example.

## 3. Non-goals

- Tracked entity type scope, and the Program/TET toggle. The provider takes a program only.
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
3. **Each `<FinderForm>` is one search.** Its fields are the `FinderField`s, `FinderRangeField`s and field hooks
   inside it.
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
5. **Ranges are opt-in by the developer, never an end-user switch.** The developer composes `FinderRangeField`
   (an explicit part, not a boolean prop, §13) for a date, age, datetime or number attribute; it renders
   From–To and either side alone counts as filled (as Capture). `FinderField` on those types is a single exact
   input. Ranges are legitimate DHIS2 search (Capture offers them), so this does not loosen anything.
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
- `FinderRangeField` on an attribute that cannot be a range (unique, text, option, boolean, true-only), or the
  same uid composed as both `FinderField` and `FinderRangeField` under one provider (they cannot share a value).
- A field part or field hook outside a `FinderForm`, or any part outside `FinderProvider`.

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
- Programmer errors that metadata cannot cause (a part outside the provider, a field outside a form) throw, like
  any React context misuse.
- An empty provider (no children) logs a development warning.

The README and docs page give the single API call that lists a program's searchable attributes (and their unique flag,
value type, `displayInList`), so a developer or agent can pick uids before writing code.

## 7. Public surface (decided parts; revised 2026-10-23, §13)

```tsx
<FinderProvider program="ART_PROGRAM_UID" onSelect={(person) => …}>
  <FinderForm>                        {/* one search; rules apply to its fields */}
    <FinderField attribute="ART_NUMBER_UID" />
    <FinderHint />                    {/* "Add 1 more detail to search", … */}
    <FinderSubmit />                  {/* "Search"; disabled until the form can search */}
  </FinderForm>
  <FinderResults />                   {/* zero-config results for the last search */}
</FinderProvider>
```

All names are `Finder*`; the block and registry item stay `tracked-entity-finder`. Every part that renders an
element takes that element's native props and `className`, like master's blocks (`SidebarProps =
ComponentPropsWithoutRef<'aside'>`).

**Provider, `FinderProvider`.** Props: `program` (uid), `onSelect(person)`, optional `client`, `children`. It is
the only place that knows how state is held: program metadata, field values, form registrations, the last
submitted search, the page. It renders only its children, so any UI inside it (a dropdown, a dialog's buttons, a
custom preview) can use the hooks. Changing `program` resets everything. Internally its context follows master's
`{ state, actions, meta }` shape (as `SidebarProvider` does). **Deliberately not injectable:** the context is not
exported and there is no way to supply another provider, because a swapped-in provider would be an escape hatch
(§4); this is the one place the block departs from the "dependency-injectable state" rule, on purpose.

**Form parts.**

- `FinderForm` (`<form>` props): Enter submits. Groups the fields that form one search (§5.3). Several forms may
  share one provider (the ID form and the "No ID?" form); results show the last submitted search until the next
  one. Field values live in the provider keyed by uid, so the same uid in two forms shares its value.
- `FinderField attribute="uid"`: label + exact input chosen by value type (text, option select, yes/no select,
  true-only checkbox, number, system-calendar date). Optional `label`, `description`, `placeholder`. Shows its own
  issue inline (too short, invalid number or date).
- `FinderRangeField attribute="uid"`: label + From–To for date, age, datetime and number attributes. Same optional
  props; also shows "reversed range".
- `FinderHint`: the live hint for its form ("Add 1 more detail to search", "Searching by ART number only",
  "Search by one ID at a time"); renders nothing when there is nothing to say. Separate from the button so the
  developer places it.
- `FinderSubmit` (button props): the submit button, disabled until the form can search. Children replace the
  "Search" label.

**Results parts.** All read provider state; nothing to wire. Composition is explicit: what you compose is what
renders, with no hidden fallbacks.

- `FinderResults` (`<div>` props): the results region (`aria-live`). With **no children** it renders the default
  composition, exactly:
  `<FinderSearching /><FinderEmpty /><FinderTooMany /><FinderError /><FinderList><FinderItem /></FinderList><FinderPagination />`.
  With children it renders only the children.
- `FinderSearching`, `FinderEmpty`, `FinderTooMany`, `FinderError`: each renders only in its state. Without
  children each shows its default text ("Searching…", "No one found", "Too many matches. Add another detail.",
  a request error); children replace it.
- `FinderList` (`<ul>` props): renders its children once per person on the current page, each inside a person
  context (`<li>`). Renders nothing unless there are results.
- `FinderItem` (button props): the clickable, keyboard-accessible row for the current person; calls `onSelect`.
  Without children it shows the program's `displayInList` attributes (IDs included) in metadata order, each as
  label and formatted value. Children replace that.
- `FinderValue attribute="uid"`: one value of the current person, formatted by value type (option names,
  system-calendar dates, yes/no). **Change from v1:** any attribute the API returned may be shown, not only
  `displayInList` ones; the server only returns what the user may read. A uid outside the program's attributes
  shows the raw value.
- `FinderPagination`: previous/next for the current results; renders nothing when there is one page.

Custom rows, for example:

```tsx
<FinderResults>
    <FinderEmpty>
        No one with that ID. Check the card and try again.
    </FinderEmpty>
    <FinderTooMany />
    <FinderError />
    <FinderList>
        <FinderItem>
            <FinderValue attribute={ART_NUMBER} /> ·{' '}
            <FinderValue attribute={FIRST_NAME} />
        </FinderItem>
    </FinderList>
    <FinderPagination />
</FinderResults>
```

**Hooks (headless).**

- `useFinderField(uid)` / `useFinderRangeField(uid)` → `{ attribute: { label, valueType, unique, options? }, value,
setValue, issue, problem? }`. Must be inside a `FinderForm`; they register the field there like the parts do.
  Two hooks rather than an options flag, matching the two parts.
- `useFinderSearch()` (inside a `FinderForm`) → `{ canSearch, missing, reason, searchingBy, submit }`.
- `useFinderResults()` → `{ status: 'idle' | 'searching' | 'results' | 'empty' | 'too-many' | 'error', people,
page, hasNext, hasPrevious, next(), previous(), select(person) }`.
- `useFinderPerson()` (inside `FinderList`) → the current person, for custom row content (joining names is the
  developer's call, §3).
- `useFinderProgram()` → `{ status: 'loading' | 'ready' | 'error', name, searchableAttributes }` (read-only,
  frozen), for developers building their own labels or empty states.

**Loading and errors before search (my call):** while program metadata loads, fields render disabled with a
spinner in the form; a metadata request failure renders an error in each form and in `FinderError`.

**Person shape** (`onSelect`, `useFinderPerson`, `useFinderResults`): `{ trackedEntity, trackedEntityType, orgUnit,
programOwner?, attributes: { [uid]: value } }`, as v1.

**Text (revised):** parts use `i18n.t` directly with literal strings, as `sidebar` and `context-selector` do;
custom text comes through children and props (composition), so there is no text provider. Strings are listed in
an `apps/web` translation catalog (`trackedEntityFinderTranslationCatalog.ts`, like `sidebarTranslationCatalog.ts`)
and `en.pot`.

## 8. Example block (decided: separate registry item)

A second registry block, shadcn "blocks" style (like `login-01`): **`tracked-entity-finder-01`**, "Find a person by
ID, with a 'No ID?' fallback", at `packages/registry/blocks/tracked-entity-finder-01/`. It imports the finder from
`@/components/tracked-entity-finder`, so the registry build lists the finder as its registry dependency, as
master does for any block importing another. One readable component built only from the public parts:

- An ID form: `FinderField` for the unique ID, `FinderHint`, `FinderSubmit`.
- A "No ID?" link button under it (like "Forgot password?") that swaps to a second form (first name + date of
  birth), with a "Search by ID instead" link back. Two explicit forms, not one form with a mode prop.
- `<FinderResults />` below; selecting calls the component's `onSelect` prop.
- The program and attribute uids are named constants at the top of the file, commented "Replace with your
  program's uids" with the API call that lists them. **Revised (my call):** they point at the Sierra Leone demo
  database, like every docs example on master, so the example runs on the docs stack and on public DHIS2 demo
  servers. Which SL program: one with a searchable unique ID and searchable first name and date of birth,
  confirmed against `pnpm docs:up` before writing the example (the TB program is the likely candidate).

It must read as a well-made, very clear starting point (the user's requirement), commented where a developer or
agent would edit, and the docs say plainly that it is one way to compose the parts, not the only way.

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

## 10. Docs, e2e, README (revised 2026-10-23, §13)

Master moved demos into the docs app (`apps/docs`), with live examples run against the docs stack, so:

- **Docs page** `apps/docs/src/pages/blocks/tracked-entity-finder.mdx`, linked from `apps/docs/src/navigation.ts`,
  in the shape of the other block pages: the example first, install command, then sections: listing a program's
  searchable attributes (the API call), the rules in plain words, forms and fields, results (zero-config,
  composed, headless), a program from a dropdown, and setup errors.
- **Docs examples** in `apps/docs/src/examples/tracked-entity-finder/`, registered in `examples/registry.ts`
  (`live: true`): `FindPerson` (the example block's composition), `CustomRows` (composed results), and
  `ProgramPicker` (HIV/TB-style switch: `program` from a select above the finder, a field set per program).
- **No `apps/web` route and no custom e2e seed** (my call): master keeps per-block demos in the docs app, and the
  rule edge cases (minimum, cap, too many, 409) are covered by browser tests with fixtures (§11).
- **Docs e2e** `e2e/specs-docs/tracked-entity-finder.spec.ts` against the live examples: find by ID and select;
  "No ID?" swap and search by first name + date of birth; Search disabled until the minimum; no serious axe
  violations.
- **Block README** (`packages/registry/blocks/tracked-entity-finder/README.md`, like context-selector's) and the
  `block.json` `docs` string: what it is, the parts, and a pointer to the docs page.

## 11. Testing

- Node unit tests on the pure rule module, one per rule in §5 and per error in §6 (searchable-only, unique alone
  and exact, ID wins, two IDs refused, min gate incl. one-sided ranges and `minCharactersToSearch`, operator
  choice with preferred/blocked, escaping, datetime whole day, cap total, 0 = no cap, 409 both shapes, frozen
  outputs, re-check of registered uids).
- Browser tests (vitest browser project) on the parts: field per value type, Submit gating and hints, two forms
  under one provider, the default results composition, composed results, `FinderItem` keyboard select, pagination, config error
  rendering in dev and prod modes.
- A browser test of the example block against fixture metadata.
- Type test on the public surface: no rule-override props or hook options, no boolean mode props.
- Root `pnpm lint` (including master's anti-slop rules), `pnpm typecheck`, `pnpm test`, `pnpm registry:check`
  (generated `registry.json` up to date, both items install) green; `pnpm docs:e2e` green when Docker is
  available.

## 12. Left to the builder

- Internal structure (store vs context/reducer, file layout), as long as the rule module stays pure and is the
  only way to build a request.
- Visual details within the existing `ui` primitives; default row layout.
- Exact wording of hints and errors, within the meaning above.
- Which Sierra Leone program the examples use, within §8.

## 13. Revision 2026-10-23: master's conventions

The user asked to align the spec with what has merged to master. Changes, with the rule each follows:

| Change                                                                                                                                                                                                      | Why                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Based on `master`; block at `packages/registry/blocks/tracked-entity-finder/` with `block.json`; imports `@/components/dhis2/ui/*`; `registry.json` generated by `pnpm registry:write`                      | master collapsed the registry into one package (#46)                           |
| Root renamed `Finder` → `FinderProvider`; it holds all state and renders only children                                                                                                                      | `state-lift-state`, `state-decouple-implementation`; matches `SidebarProvider` |
| Internal context is `{ state, actions, meta }`, but not injectable                                                                                                                                          | `state-context-interface`; injection would be an escape hatch (§4)             |
| `FinderField range` → separate `FinderRangeField`; `useFinderField(uid, { range })` → `useFinderRangeField(uid)`                                                                                            | `architecture-avoid-boolean-props`, `patterns-explicit-variants`               |
| Hint split from `FinderSubmit` into `FinderHint`                                                                                                                                                            | `architecture-compound-components`: one job per part, placed by the developer  |
| `FinderList` render function → children rendered per person with `useFinderPerson()`; `FinderItem`/`FinderValue` read the person from context instead of a `person` prop                                    | `patterns-children-over-render-props`                                          |
| Results: explicit composition. `<FinderResults />` alone renders a fixed default composition; with children only what is composed renders (no registration or hidden fallbacks); new `FinderSearching` part | `architecture-compound-components`: no hidden conditionals                     |
| Parts take native element props and `className`                                                                                                                                                             | how master's blocks expose parts                                               |
| Text provider dropped; `i18n.t` in parts, custom text through children                                                                                                                                      | master's newer blocks (`sidebar`, `context-selector`)                          |
| Demo route + HIV e2e seed → docs page, live docs examples on Sierra Leone data, docs e2e                                                                                                                    | master moved demos to `apps/docs`                                              |
| Example block imports `@/components/tracked-entity-finder`                                                                                                                                                  | how master's registry build links blocks                                       |
