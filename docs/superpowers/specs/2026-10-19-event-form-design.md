# Event Form block: design

Date: 2026-10-19 · Status: approved
Origin: the Event Workspace prototype on `feat/event-workspace-prototype` in `capture-app`
(`docs/developer/event-workspace.md` and `docs/superpowers/specs/2026-09-28-event-workspace-design.md` on that branch).

## 1. Intent

The Capture prototype showed that tracker event entry can be a headless model (sections, fields, values,
rule effects, validation) with thin views on top: 7 components from form to input instead of D2Form's 54,
and one re-rendered row per answer in a 500-question form. It got there cheaply by borrowing Capture's redux
slices, rules epics, converters, save epics and HOCs.

This design ships that idea as a production block in `dhis2-blocks`, for **an external team that wants
something Capture-like without Capture's cruft**. The point is to leave Capture's problems behind: no redux,
no epics, no render foundation, no HOC stacks, no form-format value quirks. Only the _ideas_ from the
prototype come across, not its code.

It is also a chance to do program rules a better way: rule effects as a pure derivation of values, from the
official engine, explainable, instead of an async pipeline that writes effect slices.

## 2. Goals

1. A source-installed shadcn registry block that lets a host app **create a new event in a tracker
   enrollment and edit an existing one**, for a single program stage, with program rules working.
2. Program rules as **their own installable items** (a pure lib and a hook) usable without the form.
3. **Shallow, fast rendering**: few components from root to input; answering a question re-renders only the
   fields whose model changed.
4. **Explainable rules**: every effect carries the rule that caused it, so the form can say why a field is
   hidden, locked or mandatory.
5. **Offline-ready scaffolding** so an outbox block can be added later without changing the form.
6. Shared DHIS2-styled shadcn primitives used by both this block and Working List.

## 3. Non-goals (v1)

- Event programs without registration.
- Scheduling, referrals, relationships, assignee, attribute option combos (AOC), polygon geometry,
  file/image/username value types, ranges.
- The offline outbox itself (IndexedDB, retries, sync status UI, conflict handling for queued events).
- Custom HTML forms and form-field plugins. (Hosts can approximate custom layouts with the composable
  pieces in §7.)
- A custom visual design. v1 uses standard shadcn components; the prototype's look is not a requirement.
- Card deck, auto layout, tally or matrix layouts.
- Owning focus mode or section navigation layout: the host composes those.

## 4. Anti-goals: failure even if it technically works

- Recreating Capture's architecture in new clothes: a global store of effect slices, side-effect pipelines,
  HOC chains, deep wrapper trees.
- Rule effects that change data silently. Clearing a hidden field's value or overriding a typed value with an
  ASSIGN must be visible in the model and the UI.
- Saying an event is saved when it is only queued.
- The block fetching things or routing outside its scope. The host owns navigation (`onSaved`, `onCancel`).
- A second, divergent rules implementation. There is one engine: `@dhis2/rule-engine`.

## 5. Constraints

- Follows this repo's conventions as Working List does: React 18, TypeScript, Tailwind v4, shadcn on Base UI,
  `@tanstack/react-query` for server state, `zustand` for local stores where needed, `zod` at API
  boundaries, `better-result` for fallible operations, `@dhis2/d2-i18n` for strings, flat root-prefixed
  public names, oxlint/oxfmt, knip, vitest (node + browser projects).
- DHIS2 versions: whatever the e2e matrix supports (2.41, 2.42, 2.43, dev) against the Sierra Leone database.
- Calendars: non-Gregorian system calendars must work. Date logic comes from `@dhis2/multi-calendar-dates`,
  as in Working List; stock `react-day-picker` alone is not enough.
- `@dhis2/rule-engine` (Kotlin, shared with Android and the backend) is about 5.6 MB unpacked. It must be
  loaded lazily and its cost measured (§16).

## 6. Registry items

| Item                                                       | Type                  | Contents                                                                                                     | Depends on                      |
| ---------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| shared primitives (one item per primitive, plus the theme) | `registry:ui` / style | DHIS2-styled shadcn components moved out of Working List, plus any new ones this block needs                 | none                            |
| `program-rules`                                            | `registry:lib`        | Pure: metadata → engine context, evaluation, effect normalisation, dependency graph, explanations. No React. | none                            |
| `use-program-rules`                                        | `registry:hook`       | `useProgramRules(...)`: fetches rule metadata and context with React Query, memoises evaluation              | `program-rules`                 |
| `event-form`                                               | `registry:block`      | Model, value-type registry, fields, sections, details card, notes, actions, save                             | `use-program-rules`, primitives |

Blocks reference primitives through `registryDependencies`, so a consumer installs one set that both blocks
share. The primitives keep standard shadcn names but **install into a folder of their own**
(`components/dhis2/ui/…`), never the consumer's `components/ui/`, and the DHIS2 theme is **scoped to the
blocks** so it doesn't restyle the host app. Cross-item dependencies use GitHub addresses
(`devotta-labs/dhis2-blocks/<item>`), which the shadcn client resolves with no consumer configuration, so they
resolve to these items, not stock shadcn. (Changed from a `components.json` namespace during planning:
same isolation, no setup for consumers.) Working List's
install layout changes accordingly; nothing is released yet, so no migration is needed. Field widgets (answer buttons, date, org unit picker, coordinate) stay inside `event-form` until a
second block needs them.

### 6.1 Primitives refactor (first step)

Working List currently vendors its primitives in `packages/blocks/working-list/src/ui/primitives/` and ships
them as block files. Move them to a shared workspace package and registry items, change Working List to
import them and declare them as `registryDependencies`, and keep Working List's unit, browser and e2e suites
green. This happens on the new feature branch, which starts from `jc/feat/working-list-shadcn-primitives`
because that branch's shadcn swap is not on `master` yet.

## 7. Public surface of `event-form`

Flat, root-prefixed composition as in Working List (names indicative):

```tsx
<EventForm
    programId={programId}
    programStageId={stageId}
    enrollmentId={enrollmentId}
    orgUnitId={orgUnitId}
    eventId={eventId /* omit for a new event */}
    onSaved={result => ...}   // { eventId, outcome: 'saved' | 'queued' }
    onCancel={...}
>
    <EventFormDetails />       {/* report date, org unit, point coordinate */}
    <EventFormSectionNav />    {/* optional; host places it */}
    <EventFormSections />      {/* all sections in metadata order */}
    <EventFormNotes />
    <EventFormFeedback />      {/* DISPLAYTEXT / DISPLAYKEYVALUEPAIR effects */}
    <EventFormActions />       {/* Save, Complete, Cancel */}
</EventForm>
```

- Finer pieces (`EventFormSection id=…`, `EventFormField id=…`) let a host lay out a stage its own way.
- Hooks for hosts: state (values, dirty, status, validation summary), actions (save, complete, reset) and
  rule explanations.
- Focus mode is a host concern (a full-screen `Dialog` or a route). The form must not remount or lose input
  when moved, so state lives in the `EventForm` root, not in leaf components.
- Unsaved-changes protection on cancel uses `AlertDialog`. Route-level blocking is the host's job, exposed
  through a `dirty` flag.

## 8. The model

- **Values are held in API format**: the strings the tracker API sends and accepts. A per-value-type registry
  (the same approach as Working List's `registry/valueTypes`) owns parse, format, validation, field mask and
  the input widget for each type. No form-format strings, no `{ date, time }` objects.
- **Derived, not stored**: `fieldModels = build(metadata, values, effects, validation)`. With **structural
  sharing**, a field whose inputs are unchanged keeps its previous model object, and rows are memoised, so
  unchanged fields don't re-render. Rule outputs are compared by content.
- **Validation** is a pure function over all fields, mounted or not, honouring the stage's validation strategy
  (NONE / ON_COMPLETE / ON_UPDATE_AND_INSERT) and completing vs saving, as the prototype's
  `validateWorkspace` did: validator errors ∪ rule errors ∪ errors-on-complete when completing ∪
  rule-mandatory empty fields. Hidden fields are skipped.
- **Rule-driven data changes are an overlay, not writes.** Stored values are only what the user (or the loaded
  event) set. Rule clears (a hidden field) and ASSIGNs are computed on top: `effective = overlay(stored,
effects)`. Rules never write into stored values, so:
    - a field hidden and then shown again gets its value back;
    - opening an existing event never makes it dirty on its own. If the overlay would clear or change stored
      values, the form shows a notice ("2 values will be changed by program rules when you save") listing
      them, and the affected fields say why;
    - assigned fields say "Calculated by a program rule"; cleared fields are listed in that notice since the
      field itself is hidden;
    - on save, the **effective** values are sent (cleared values sent as cleared), so the server agrees with
      what the user was shown.

## 9. Program rules

### 9.1 Shape

```
effects = evaluate(ruleContext, input)   // pure, synchronous once the engine is loaded
```

- `ruleContext` is built once per program/stage from rules, actions, variables, constants, option sets and
  supplementary data (user roles, org unit groups).
- `input` is the current event (values, occurred date, org unit, status), the enrollment (attributes, dates)
  and the enrollment's other events. The tracker variable source types (`DATAELEMENT_NEWEST_EVENT_PROGRAM`,
  `…_PROGRAM_STAGE`, `…_PREVIOUS_EVENT`, `TEI_ATTRIBUTE`, `CALCULATED_VALUE`) need those other events and
  attributes, so the hook fetches them by enrollment id unless the host passes them in.
- Effects are normalised into a typed result: hidden fields, hidden sections, mandatory fields, assigned
  values, messages per field (error, warning, error-on-complete, warning-on-complete), option visibility
  (hide option, hide/show option group), display texts and key-value pairs. HIDEPROGRAMSTAGE is exposed for
  the host. Server-side actions (send/schedule message, create event) are ignored.
- There is no "rules running" state in the form. While the engine module is loading on first use, the hook
  reports `status: 'loading'` and the form shows the questions without effects applied as read-only, or a
  loading state (builder's call).

### 9.2 Ambitious parts

v1 scope: rule attribution and the dependency graph (with answer-level explanations) are **required**. The
inspector is **required as hook data**, with no polished UI. Pruned re-evaluation is **optional**: built only
if the spike (§16) shows full evaluation is too slow.

- **Dependency graph.** From each rule's condition and action expressions, find the variables and fields it
  reads and the fields it writes (ASSIGN chains included). Used for:
    - _explanations_: each effect records rule id, name, condition and action, and the graph says which
      answers fed it;
    - _pruned re-evaluation_: re-run only the rules affected by a change. This is only enabled once a
      differential test proves pruned results equal full evaluation over generated fixtures and real
      metadata (RMNCH and the Sierra Leone programs). Until then, full evaluation is memoised per input.
- **Rules inspector.** A dev-facing view or hook output that lists, for a field, which rules touched it and
  why. Helps app builders debug their own program configuration.

## 10. Saving and offline scaffolding

- The form builds a **plain, serialisable tracker payload** (event with values, status, notes, geometry) and
  hands it to a **writer**: `saveEvent(payload) → Result<{ outcome: 'saved' | 'queued' }, SaveError>`.
- The default writer is online: `POST /tracker` with create-and-update semantics. Server validation errors
  are mapped back onto fields where the report identifies one, otherwise shown on the form.
- **Client-generated event ids** (DHIS2 UIDs), so every save is safe to repeat.
- For edits, send changed values plus explicitly cleared ones. The builder confirms the importer's merge
  behaviour on each supported version.
- The save is a React Query mutation with a stable key registered through `setMutationDefaults`, so a
  persisted mutation can resume after reload. Metadata queries have stable keys and sensible stale times.
- The form's UI handles both `saved` and `queued` from day one, covered by tests with a fake writer that
  always queues.
- Not in v1: the outbox block (`tracker-outbox`) with its persister, IndexedDB, retries and status hook.

## 11. Event lifecycle and context fields

- **New**: report date (stage label, default today), org unit (defaulted from props, must be in the program's
  org units and the user's capture scope), point coordinate when the stage's feature type is Point.
- **Scheduled events**: an event with status SCHEDULE or OVERDUE opens for data entry; entering data sets it
  ACTIVE and fills the report date (defaulting to today). SKIPPED events open read-only with a notice.
- **Edit**: load the event by id. Values that no longer fit (a removed option, a value a rule now hides) are
  shown, not dropped silently.
- **Status**: Save and Complete are separate actions. Editing a completed event follows the stage's
  `blockEntryForm` and the user's authority to reopen. Expiry-period checks are left to the server in v1 and
  its error is shown.
- **Notes**: new notes are sent with the save. Existing notes are listed read-only (notes are immutable).

## 12. UI with standard shadcn components

| Need                                         | Component                                               |
| -------------------------------------------- | ------------------------------------------------------- |
| Question label, description, error           | `Field`, `FieldLabel`, `FieldDescription`, `FieldError` |
| Section                                      | `FieldSet` + `FieldLegend`                              |
| Text, numbers, phone, email, URL, percentage | `Input` / `InputGroup` (addon for `%`)                  |
| Long text, notes                             | `Textarea`                                              |
| Yes/No, small option sets (≤ 5)              | `RadioGroup` or `ToggleGroup`                           |
| Larger option sets, multi-select             | `Select` / `Combobox` (multi)                           |
| True-only                                    | `Checkbox`                                              |
| Date, date & time, age                       | `Popover` + a calendar on `@dhis2/multi-calendar-dates` |
| Org unit                                     | tree in a `Popover`                                     |
| Details card                                 | `Card`                                                  |
| Rule messages, display texts                 | `Alert` and field messages                              |
| Unsaved changes on cancel                    | `AlertDialog`                                           |

Component depth from `EventForm` to an input element should stay in single digits, measured in a test.
_Counted_ as components authored in this block and its primitives on the path from `EventForm` to the
element; Base UI internals and context providers don't count (my call).

## 13. Value types in v1

Supported: text, long text, letter, email, phone number, URL, number and all integer types, percentage, unit
interval, boolean, true-only, date, date & time, time, age, coordinate (as a data element, latitude/longitude
inputs, no map), organisation unit, option sets, multi-select option sets.

Unsupported types (file, image, username, polygon, ranges and anything else) render a read-only
"not supported" field showing the existing value. A mandatory unsupported field blocks completing. The block
also exports a capability check, so a host can decide in advance whether to use the block for a stage.

## 14. Testing and verification

- **Unit (vitest, node)**: value-type registry, model build and structural sharing, validation matrix
  (strategy × completing × rule messages × mandatory), effect normalisation, dependency graph, payload
  building, writer outcomes.
- **Rules**: fixtures from real metadata (RMNCH _First antenatal care visit_: HIDEFIELD chains, ASSIGN
  gestational age, SHOWERROR/SHOWWARNING, DISPLAYTEXT) with expected effects. The pruned-vs-full differential
  test in §9.2.
- **Browser (vitest browser project)**: fields per value type, keyboard use, re-render counts on a large
  form, depth measurement.
- **E2E (Playwright, real DHIS2 matrix)**: create and edit an event with rules effects visible; save and
  reload round trip; completion; server error mapping; axe accessibility checks. New seed metadata if the
  Sierra Leone database lacks what a scenario needs.
- **Install check**: `shadcn add` of `event-form` into a clean app pulls the primitives, lib and hook, and
  typechecks.

## 15. Demo

A route in `apps/web` that composes the blocks: pick context with Context Selector, open an enrollment's
events from Working List, and create or edit an event with `EventForm` (edit opens from a row click).

## 16. Risks and spikes to do first

1. **Rule engine in the browser**: bundle size (gzipped), load time and evaluation time on RMNCH (18 rules)
   and a large program. Decides lazy-loading strategy and whether pruning is needed for speed at all.
   Budget (my call): the engine is a lazily loaded chunk that is not in the initial app bundle; one full
   evaluation on RMNCH takes under 16 ms on a mid-range laptop. If the budget is missed, stop and report
   the measurements before building on it.
2. **Engine input mapping**: building the Kotlin engine's context and input from tracker API data without
   Capture's converters. Capture's `rules/RuleEngine/helpers/InputBuilder.ts` is a reference only.
3. **Importer semantics for edits** across 2.41–dev: partial data values, clearing values, notes.
4. **Calendar picker** built on shadcn styling and `@dhis2/multi-calendar-dates`.

## 17. Left to the builder

- Final item and export names, file layout inside each item, where the org unit tree lives (shared with
  Context Selector's selector if it fits cleanly).
- Store choice inside the root (zustand vs reducer), as long as fields subscribe narrowly.
- Loading and error states, empty states, exact copy.
- How field-level server errors are matched.
- Order of work after the primitives refactor and spikes.
