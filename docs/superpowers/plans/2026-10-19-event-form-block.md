# Event Form Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `event-form` registry block: create and edit a tracker event for one program stage, with program rules applied as an explainable overlay, standard shadcn UI on the shared DHIS2 primitives, and an online save path ready for an offline writer.

**Architecture:** A per-instance zustand store holds only what the user or the loaded event set (stored values, context fields, notes draft, attempts). Everything else is derived: `effects` from `useProgramRules`, `effective = overlay(stored, effects)`, field models with structural sharing, and validation. Rules re-run when a value is **committed** (blur for typed inputs, change for choices and dates), not on every keystroke. Save builds a plain tracker payload and hands it to an `EventWriter`; the default writer posts to `/tracker`.

**Tech Stack:** React 18, TypeScript, Tailwind v4 (`dhis2`-namespaced tokens), shared primitives `@/registry/dhis2/ui/*`, `@/registry/program-rules/*`, `@tanstack/react-query`, `zustand`, `zod`, `better-result`, `@dhis2/app-runtime`, `@dhis2/ui` (CalendarInput, OrganisationUnitTree only), `@dhis2/d2-i18n`, Vitest (node + browser), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-19-event-form-design.md`. Rule engine findings: `docs/superpowers/spikes/2026-10-19-rule-engine.md` (merged in with the program-rules branch).

## Preconditions

- Plan `2026-10-19-shared-ui-primitives.md` is complete: `@dhis2-blocks/ui`, per-primitive registry items, namespaced theme, and `pnpm registry:check` all exist.
- The program-rules branch is merged into `jc/feat/event-form` (**ask the user before merging**). It provides `@dhis2-blocks/program-rules`, with `@/registry/program-rules/index` (lib) and `@/registry/program-rules/use-program-rules` (hook). Read that package's README and `type-tests/public-surface.ts` for the exact types. This plan uses: `useProgramRules({ programId, programStageId, enrollmentId?, input, enabled? }) → { status, effects?, invalidRules, explain(fieldId), error? }`, `RuleEffects`, `Attribution`, `RuleMessage`, `EventRuleInput`.

## Global Constraints

- Commits: one per task, unsigned (`git -c commit.gpgsign=false commit`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push or merge without the user.
- Flat, root-prefixed public names: `EventForm`, `EventFormDetails`, `EventFormSectionNav`, `EventFormSections`, `EventFormSection`, `EventFormField`, `EventFormNotes`, `EventFormFeedback`, `EventFormActions`, `useEventFormState`, `useEventFormActions`, `useEventFormRules`.
- Values are held in tracker API format (strings). Empty values are absent from the map, never `''`.
- Rule changes are an overlay, never written into stored values. Opening an existing event never makes it dirty. Save sends the effective values, with cleared values sent as `null` on edit.
- The host owns navigation: `onSaved({ eventId, outcome: 'saved' | 'queued' })` and `onCancel()`. The block never routes.
- Client-generated event UIDs (11 chars, `[A-Za-z][A-Za-z0-9]{10}`); saves use `importStrategy=CREATE_AND_UPDATE`, `atomicMode=OBJECT`.
- Payloads are plain JSON: no Dates, functions or classes.
- Every user-facing string goes through the block's translate context (pattern: Working List `WorkingListText`), and is listed in `apps/web/src/eventFormTranslationCatalog.ts`.
- Component depth from `EventForm` to an input element stays under 10, counting only components from this block and `dhis2/ui`.
- No `@dhis2/ui` components except `CalendarInput` (dates, like Working List's `StrictCalendarInput`) and `OrganisationUnitTree`. Ruling for speed: spec §12 allowed a custom shadcn calendar; reusing the calendar Working List already uses keeps non-Gregorian calendars correct now.
- Supported value types (spec §13): TEXT, LONG_TEXT, LETTER, EMAIL, PHONE_NUMBER, URL, NUMBER, INTEGER, INTEGER_POSITIVE, INTEGER_NEGATIVE, INTEGER_ZERO_OR_POSITIVE, PERCENTAGE, UNIT_INTERVAL, BOOLEAN, TRUE_ONLY, DATE, DATETIME, TIME, AGE, COORDINATE, ORGANISATION_UNIT, option sets, MULTI_TEXT with an option set. Everything else renders read-only as "not supported".
- DHIS2 for e2e: version 43 only.

## Review Focus

1. **A rule hides a field the user already answered, then shows it again**: the answer comes back, and nothing is sent as cleared while the field is visible. Pinned in Task 3.
2. **Editing an event whose stored values a rule would change**: the form opens clean (not dirty), shows the "will be changed by program rules" notice, and saving sends the changes. Pinned in Tasks 3 and 7.
3. **Typing fast in a number field**: rules don't run per keystroke, and the value commits on blur. A mid-typing invalid value (`12.`) shows no error until blur. Pinned in Task 6.
4. **A non-Gregorian system calendar (Ethiopian)**: the date field displays and commits ISO dates correctly. Pinned in Task 6.
5. **Saving twice (double click, or a retry after a network error)**: same event UID, no duplicate event. Pinned in Task 4.

---

### Task 1: Package scaffold and API layer

**Files:**

- Create: `packages/blocks/event-form/{package.json,tsconfig.json,tsconfig.test.json,vitest.config.ts,registry.json,README.md}`, `test/{setup.ts,styles.css}`, `type-tests/public-surface.ts`
- Create: `src/api/client.ts` (follow `working-list/src/api/client.ts`: `DataEngineLike`, `createEventFormClient(engine): EventFormClient` with `query<T>(request, schema)` and `mutate(mutation)` returning `Result`)
- Create: `src/api/schemas.ts`, `src/api/queries.ts`, `src/api/__fixtures__/rmnch-stage.json`, `src/api/__fixtures__/event.json`
- Create: `src/api/schemas.test.ts`, `src/api/queries.test.ts`
- Modify: `knip.json`, root `registry.json` (`include`), and the `apps/web` and Working List alias configs if they need `@/registry/program-rules/*` (only apps/web does)

**Interfaces:**

- Produces `StageMetadata` (zod-parsed), from `GET /api/programs/{programId}?fields=id,displayName,programType,trackedEntityType[id],categoryCombo[id,isDefault],programStages[id,displayName,executionDateLabel,validationStrategy,blockEntryForm,featureType,repeatable,sortOrder,programStageSections[id,displayName,sortOrder,dataElements[id]],programStageDataElements[compulsory,sortOrder,allowFutureDate,renderType,dataElement[id,displayFormName,displayDescription,valueType,fieldMask,optionSetValue,optionSet[id,options[id,code,displayName,sortOrder]]]]]`, narrowed to the requested stage:
  `{ programId, programName, stage: { id, name, executionDateLabel?, validationStrategy: 'NONE' | 'ON_COMPLETE' | 'ON_UPDATE_AND_INSERT', blockEntryForm: boolean, featureType: 'NONE' | 'POINT' | 'POLYGON', sections: Section[] }, dataElements: Map<id, DataElementMeta>, hasCategoryCombo: boolean }`
    - `Section = { id, name, dataElementIds: string[] }`. A stage with no sections gets one implicit section, `{ id: '__default', name: stage.name }`.
    - `DataElementMeta = { id, label, description?, valueType, compulsory, allowFutureDate, fieldMask?, options?: { id, code, label }[], renderType? }`.
- Produces `TrackerEventSchema` / `TrackerEvent`: `{ event, program, programStage, enrollment?, orgUnit, status: 'ACTIVE' | 'COMPLETED' | 'SCHEDULE' | 'OVERDUE' | 'SKIPPED' | 'VISITED', occurredAt?, scheduledAt?, geometry?, dataValues: { dataElement, value }[], notes: { note, value, storedAt, createdBy? }[] }`, from `GET /api/tracker/events/{id}?fields=event,program,programStage,enrollment,orgUnit,status,occurredAt,scheduledAt,geometry,dataValues[dataElement,value],notes`.
- Produces `SystemCalendar = { calendar, dateFormat }` (reuse Working List's `systemInfo` fields).
- Produces query keys `eventFormKeys.stage(programId, stageId)`, `.event(eventId)`, `.systemInfo()`, and hooks `useStageMetadata(programId, stageId)`, `useTrackerEvent(eventId | undefined)`, `useSystemCalendar()`.

- [ ] **Step 1:** Fetch the fixtures from the e2e stack (`pnpm e2e:up 43`): the RMNCH program `WSGAb5XwJ3Y` stage `WZbXY0S00lP`, using the query above, and one existing event of that stage.
- [ ] **Step 2: Write the failing tests.**
    - `parses RMNCH stage metadata`: 4 sections; 49 data elements; data element `de0FEHSIoxh` has valueType `BOOLEAN`; `validationStrategy` is one of the three values.
    - `stage without sections gets an implicit section` holding all data elements in sortOrder.
    - `rejects metadata missing the stage` with a Result error, not a throw.
    - `parses a tracker event`, keeping notes and dataValues.
    - `queries use stable keys` (the keys deep-equal for the same arguments).
- [ ] **Step 3:** Run `pnpm --filter @dhis2-blocks/event-form exec vitest run --project node`. Expected: FAIL.
- [ ] **Step 4:** Implement the API layer.
- [ ] **Step 5:** Run the same command, then `pnpm typecheck && pnpm lint && pnpm dead-code:audit`. Expected: PASS.
- [ ] **Step 6:** Commit with message `feat(event-form): package scaffold and API layer`.

### Task 2: Value-type registry

**Files:**

- Create: `src/model/valueTypes.ts`, `src/model/valueTypes.test.ts`

**Interfaces:**

- Produces `type WidgetKind = 'text' | 'longText' | 'number' | 'choice' | 'select' | 'multiSelect' | 'trueOnly' | 'date' | 'dateTime' | 'time' | 'age' | 'coordinate' | 'orgUnit' | 'unsupported'`.
- Produces `getValueTypeSpec(meta: DataElementMeta): { kind: WidgetKind; inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url'; validate(value: string): ValueError | null }`, where `ValueError = { code: string; message: string /* untranslated key */ }`.
- Produces `answerChoices(meta): { value: string; label: string }[]`:
    - BOOLEAN gives `true` = "Yes" and `false` = "No".
    - An option set gives each option's code and label.
- Produces the choice rules:
    - BOOLEAN, and option sets with at most 5 options, use `kind: 'choice'`.
    - Option sets with more than 5 options use `'select'`.
    - MULTI_TEXT with an option set uses `'multiSelect'`.
    - Without an option set it is `'unsupported'`.
- Produces `isSupportedValueType(meta): boolean`.

- [ ] **Step 1: Write the failing tests**, as table-driven cases with these exact values:
    - INTEGER_POSITIVE: `'0'` ✗, `'1'` ✓, `'1.5'` ✗.
    - INTEGER_NEGATIVE: `'-1'` ✓, `'0'` ✗.
    - INTEGER_ZERO_OR_POSITIVE: `'0'` ✓, `'-1'` ✗.
    - NUMBER: `'1e3'` ✓, `'abc'` ✗.
    - PERCENTAGE: `'0'` ✓, `'100'` ✓, `'101'` ✗.
    - UNIT_INTERVAL: `'0.5'` ✓, `'1.01'` ✗.
    - LETTER: `'a'` ✓, `'ab'` ✗.
    - EMAIL: `'a@b.co'` ✓, `'a@'` ✗.
    - PHONE_NUMBER: `'+232 76 123456'` ✓, `'abc'` ✗.
    - URL: `'https://dhis2.org'` ✓, `'dhis2'` ✗.
    - DATE: `'2026-03-12'` ✓, `'2026-13-01'` ✗.
    - DATETIME: `'2026-03-12T10:30:00.000'` ✓.
    - TIME: `'10:30'` ✓, `'25:00'` ✗.
    - AGE: `'2020-01-01'` ✓.
    - COORDINATE: `'[-11.2,8.4]'` ✓, `'[200,8]'` ✗.
    - ORGANISATION_UNIT: `'DiszpKrYNg8'` ✓, `'x'` ✗.
    - BOOLEAN: `'true'`/`'false'` ✓, `'yes'` ✗.
    - TRUE_ONLY: `'true'` ✓, `'false'` ✗.
    - Field mask `'\\d{3}'` rejects `'12'`.
    - Kind cases: an option set with 5 options gives `'choice'`, one with 6 gives `'select'`, and FILE_RESOURCE gives `'unsupported'`.
- [ ] **Step 2:** Run `pnpm --filter @dhis2-blocks/event-form exec vitest run --project node src/model/valueTypes.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Port the field mask semantics from Capture's `fieldMask.ts` on the prototype branch (`git -C ~/Documents/github/capture-app show feat/event-workspace-prototype:src/core_modules/capture-core/utils/validation/validators/form/fieldMask.ts`).
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat(event-form): value-type registry`.

### Task 3: Form model — overlay, field models, validation

**Files:**

- Create: `src/model/overlay.ts`, `src/model/buildFormModel.ts`, `src/model/validate.ts`, `src/model/capability.ts`, and a test file for each

**Interfaces:**

- Consumes: `RuleEffects` from program-rules; `StageMetadata` and `getValueTypeSpec` from Tasks 1–2.
- Produces `overlay(stored: Values, effects: RuleEffects | undefined): { effective: Values; ruleChanges: RuleChange[] }`.
    - `Values = Readonly<Record<string, string>>`.
    - `RuleChange = { fieldId, kind: 'cleared' | 'assigned', from: string | undefined, to: string | undefined, by: Attribution }`.
    - A hidden field with a stored value gives `cleared`.
    - An assigned value that differs from the stored one gives `assigned`. An assigned `null` counts as cleared.
- Produces `buildFormModel(prev: FormModel | undefined, input: { metadata, effective, stored, effects, fieldErrors: Record<string, ValueError>, showAllErrors: boolean, isCompleting: boolean }): FormModel`.
    - `FormModel = { sections: SectionModel[]; fields: Map<id, FieldModel> }`.
    - `SectionModel = { id, name, hidden, fieldIds: string[] /* visible only */ }`.
    - `FieldModel = { id, label, description?, kind, inputMode?, value?: string, choices?, disabled: boolean, assignedBy?: Attribution, required: boolean, messages: { error?: string, warning?: string, errorOnComplete?: string, warningOnComplete?: string, ruleErrors: RuleMessage[] }, unsupported: boolean }`.
    - **Structural sharing:** a field whose inputs are deep-equal to the previous build returns the previous object (`===`). The same applies to sections.
    - `hiddenOptions` and `optionGroups` filter `choices`.
- Produces `validateForm(model, { strategy, isCompleting }): { isValid: boolean; failedFieldIds: string[] }`, with the prototype's semantics (spec §8):
    - NONE checks type errors only.
    - ON_COMPLETE does a full check only when completing.
    - ON_UPDATE_AND_INSERT always does a full check.
    - A full check covers validator errors, rule errors, errorOnComplete when completing, and required fields that are empty, whether required by metadata or by a rule.
    - Hidden fields are skipped.
    - A mandatory unsupported field blocks completing.
- Produces `canUseEventForm(metadata): { ok: true } | { ok: false; reason: 'polygon' | 'categoryCombo' }`. Unsupported value types don't block the form, because they render read-only.

- [ ] **Step 1: Write the failing tests.**
    - overlay:
        - `hidden answered field is cleared, then restored when shown again`: stored `{a:'x'}`. Effects hide `a`: `effective.a` is undefined and there is one `cleared` change. Effects empty: `effective.a === 'x'` and there are no changes.
        - `assign overrides stored and records from/to`.
        - `assign equal to stored records no change`.
        - `assign null clears`.
    - buildFormModel:
        - `unchanged field keeps identity across builds`: rebuild with one other value changed; every other `FieldModel` is `===` the previous one.
        - `rule message change only replaces that field`.
        - `assigned field is disabled with assignedBy`.
        - `hidden section is hidden and lists no fields`.
        - `hidden option is removed from choices`.
    - validate: the strategy × completing matrix (NONE, ON_COMPLETE, ON_UPDATE_AND_INSERT × save, complete), with fixtures for a type error, a rule error, errorOnComplete, a rule-mandatory empty field, a hidden field with an error (ignored) and a mandatory unsupported field. Assert the exact `failedFieldIds` for each cell.
    - capability: `POLYGON` gives polygon; `hasCategoryCombo` gives categoryCombo; RMNCH gives ok.
    - `500-field build stays under 5 ms`: median of 20 builds after warm-up.
- [ ] **Step 2:** Run `pnpm --filter @dhis2-blocks/event-form exec vitest run --project node src/model`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat(event-form): overlay, form model and validation`.

### Task 4: Store, payload, writer, save mutation

**Files:**

- Create: `src/state/store.ts`, `src/save/uid.ts`, `src/save/payload.ts`, `src/save/writer.ts`, `src/save/importReport.ts`, `src/save/useSaveEvent.ts`, and a test file for each

**Interfaces:**

- Produces `createEventFormStore(init: { eventId: string; isNew: boolean; stored: Values; context: EventContext; status: EventStatus })`. It is a zustand vanilla store:
    - State: `stored`, `initialStored`, `context: { occurredAt?: string; orgUnitId?: string; geometry?: { type: 'Point'; coordinates: [number, number] } }`, `noteDraft: string`, `status`, `attempt: 'none' | 'save' | 'complete'`, `fieldErrors`.
    - Actions:
        - `commitValue(id, value | undefined)`: `undefined` deletes the key.
        - `setContext(patch)`, `setNoteDraft(text)`, `markAttempt(kind)`, `reset()`.
    - Selector `selectDirty(state)`: compares `stored` with `initialStored`, the context and the note draft. Rule changes never count.
- Produces `generateUid(): string`, using `crypto.getRandomValues`.
- Produces `buildEventPayload(args: { eventId; programId; programStageId; enrollmentId; trackedEntityId?; status; context; effective: Values; initialStored: Values; noteDraft; isNew }): { events: [TrackerEventPayload] }`.
    - `dataValues` holds every effective value.
    - On edit it also holds `{ dataElement, value: null }` for each key in `initialStored` that is missing from `effective`.
    - A note is added only when `noteDraft.trim()` is not empty.
    - `occurredAt` is `yyyy-MM-dd`.
- Produces the writer:
    - `type EventWriter = (payload) => Promise<Result<{ outcome: 'saved' | 'queued' }, SaveError>>`.
    - `createOnlineEventWriter(client)` posts `POST /tracker?importStrategy=CREATE_AND_UPDATE&atomicMode=OBJECT&async=false`.
    - `SaveError = { kind: 'validation'; fieldErrors: Record<string, string>; formErrors: string[] } | { kind: 'network'; message } | { kind: 'unknown'; message }`.
- Produces `mapImportReport(report)`. It maps `validationReport.errorReports[]` to field errors when `message` or `args` names a data element UID that is in the stage, and to form errors otherwise.
- Produces the mutation:
    - `eventFormMutationKeys.save = ['event-form', 'save'] as const`.
    - `registerEventFormMutations(queryClient, writer)` calls `setMutationDefaults(eventFormMutationKeys.save, { mutationFn: writer })`.
    - `useSaveEvent()` returns `useMutation({ mutationKey: eventFormMutationKeys.save })`. It needs no inline `mutationFn`, so a persisted mutation can resume after a reload.

- [ ] **Step 1: Write the failing tests.**
    - store:
        - `commitValue undefined removes the key`.
        - `opening an event is not dirty`.
        - `changing then reverting a value is not dirty`.
        - `note draft makes it dirty`.
    - uid: 1000 generated ids all match `^[A-Za-z][A-Za-z0-9]{10}$` and are unique.
    - payload:
        - The exact JSON for a new event: RMNCH, two values, a note.
        - The exact JSON for an edit where a rule cleared `a`: it contains `{ dataElement:'a', value:null }`.
        - It survives a `JSON.parse(JSON.stringify(p))` deep-equality check.
    - writer, against a fake `DataEngineLike`:
        - A 200 response gives `saved`.
        - A 409 response with an `errorReports` entry naming `de0FEHSIoxh` gives a field error on `de0FEHSIoxh`.
        - A fetch rejection gives `network`.
    - `same payload saved twice uses the same event uid`: double submit through `useSaveEvent` with a fake writer records two calls with an identical `event`.
    - `queued outcome reaches onSaved`: with a fake writer returning `queued`, the form-level `onSaved` callback receives `outcome:'queued'`. This is wired in Task 7; here the test covers the mutation result only.
- [ ] **Step 2:** Run `pnpm --filter @dhis2-blocks/event-form exec vitest run --project node src/state src/save`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat(event-form): store, payload, writer and save mutation`.

### Task 5: New primitives — radio group and card

**Files:**

- Create: `packages/blocks/ui/src/radio-group.tsx` (shadcn Radio Group on `@base-ui/react/radio-group` and `@base-ui/react/radio`; DHIS2 look: 16px circle, `border-dhis2-input`, checked `bg-dhis2-primary`)
- Create: `packages/blocks/ui/src/card.tsx` (shadcn Card: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`; `bg-dhis2-card`, `shadow-dhis2-card`, `rounded-dhis2-md`)
- Create: `packages/blocks/ui/src/radio-group.test.tsx` (browser)
- Modify: `packages/blocks/ui/package.json` (exports), then regenerate `packages/blocks/ui/registry.json` with `pnpm --filter @dhis2-blocks/ui registry:write`

- [ ] **Step 1: Write the failing browser test** `radio group is keyboard operable`: render 3 items; ArrowDown moves the selection; `onValueChange` receives the value; there is a `role="radiogroup"` with an accessible name.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement both primitives and regenerate the registry. `pnpm --filter @dhis2-blocks/ui exec vitest run` must pass, including the registry equality test.
- [ ] **Step 4:** Commit with message `feat(ui): radio group and card primitives`.

### Task 6: Field widgets and `EventFormField`

**Files:**

- Create: `src/ui/EventFormText/EventFormText.tsx` (translate context, like `WorkingListText`)
- Create: `src/ui/fields/{TextField,LongTextField,NumberField,ChoiceField,SelectField,MultiSelectField,TrueOnlyField,DateField,DateTimeField,TimeField,AgeField,CoordinateField,OrgUnitField,UnsupportedField}.tsx`
- Create: `src/ui/fields/FieldShell.tsx`. It is `Field` + `FieldLabel` + `FieldDescription` (clamped to 2 lines with "Show more" only when clamped) + messages. Rule messages are tagged `Rule` and value errors `Value`. It shows "Calculated by a program rule" when `assignedBy` is set. The description is linked through `aria-describedby`.
- Create: `src/ui/EventFormField.tsx`. It is `memo`'d, reads `FieldModel` by id from context, and maps `kind` to a widget.
- Create: `src/ui/fields/fields.test.tsx` (browser)

**Interfaces:**

- Consumes: `FieldModel` (Task 3), primitives `field`, `input`, `input-group`, `textarea`, `radio-group`, `toggle-group`, `select`, `combobox`, `checkbox`, `popover`, `button`.
- Produces `EventFormField({ id }: { id: string })`. Each widget's props are `{ field: FieldModel; onCommit(value: string | undefined): void; disabled: boolean }`.
- Commit semantics:
    - Typed inputs keep a local draft and commit on blur or Enter.
    - Choice, select, multi-select, checkbox, date, time and org unit fields commit on change.
    - Clearing commits `undefined`.

Widget notes:

- **choice:** `ToggleGroup` with single selection. The selected item is filled. Selecting the selected item again clears it.
- **Option sets with vertical or horizontal radio `renderType`:** `RadioGroup` laid out by orientation.
- **date, age:** wrap `CalendarInput` as in Working List's `StrictCalendarInput`, converting between the system calendar and ISO with Working List's helpers (copy `canonicalDateToCalendarInput` and its inverse into `src/ui/fields/calendar.ts`).
- **dateTime:** a date field plus `Input type="time"`. It commits only once both parts are set; when one part is missing, the error names that part.
- **age:** a date field plus "years / months / days" readout.
- **coordinate:** latitude and longitude `InputGroup`s, committing `[lng,lat]`.
- **orgUnit:** a `Popover` with `OrganisationUnitTree` (as in `apps/web/src/app/OrganisationUnitSelectorContent`) showing the path above the name, committing the UID.
- **unsupported:** read-only text of the stored value plus "This value type is not supported here".

- [ ] **Step 1: Write the failing browser tests.**
    - One test per kind: render with a model and assert the commit value. For example, number `12.` then blur gives an error shown and no commit; `12` then blur commits `'12'`; choice "Yes" commits `'true'`, and clicking it again commits `undefined`.
    - `typing does not commit until blur`: `onCommit` is not called after keystrokes and is called once on blur.
    - `Ethiopian calendar date commits ISO`: with `calendar: 'ethiopian'`, picking the displayed 2018-07-04 commits `'2026-03-13'` (verify the exact pair with `@dhis2/multi-calendar-dates` while writing the test).
    - `assigned field is read-only and says why`.
    - `description is linked with aria-describedby`.
    - `depth from EventFormField to input is ≤ 5 own components`: walk the React fiber tree in the test and count components defined in `src/ui/**` and `dhis2/ui`.
- [ ] **Step 2:** Run `pnpm --filter @dhis2-blocks/event-form exec vitest run --project browser src/ui/fields`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat(event-form): field widgets`.

### Task 7: `EventForm` root and composition

**Files:**

- Create: `src/ui/EventForm/EventForm.tsx` (root: providers, data loading, store, rules, model)
- Create: `src/ui/EventForm/EventFormContext.tsx`: a public context (model, state) and a private one (store, commit, save)
- Create: `src/ui/{EventFormSections,EventFormSection,EventFormDetails,EventFormNotes,EventFormFeedback,EventFormActions,EventFormSectionNav,EventFormRuleNotice}.tsx`
- Create: `src/ui/hooks.ts` (`useEventFormState`, `useEventFormActions`, `useEventFormRules`)
- Create: `src/index.ts` (public surface only)
- Create: `src/ui/EventForm/EventForm.test.tsx` (browser), `src/ui/EventForm/renderCount.test.tsx` (browser)

**Interfaces:**

- Produces `EventForm` props: `{ programId, programStageId, enrollmentId, orgUnitId, eventId?, trackedEntityId?, writer?: EventWriter, onSaved(result: { eventId: string; outcome: 'saved' | 'queued' }): void, onCancel(): void, children, className? }`.
    - Without `eventId` it is a new event: it generates a UID, `occurredAt` defaults to today (ISO), and `orgUnitId` comes from the props.
- Rule input is rebuilt from the store's committed state only: `effective` values, context and status. It is passed to `useProgramRules`, which memoises on content.
- Lifecycle:
    - For SCHEDULE or OVERDUE, the first committed value sets status ACTIVE and fills `occurredAt` (today) if it is empty.
    - SKIPPED opens read-only with a notice.
    - COMPLETED with `blockEntryForm` opens read-only.
- `EventFormActions` renders Save, Complete (both shown only when the event is not read-only) and Cancel:
    - Save calls `markAttempt('save')`, validates with `isCompleting: false`, and either focuses and scrolls to the first failed field or builds the payload and calls `useSaveEvent`.
    - Complete does the same with `isCompleting: true` and status COMPLETED. Warnings-on-complete show an `AlertDialog` ("Complete anyway?").
    - Cancel when dirty shows an `AlertDialog` ("Discard changes?"), then `onCancel`.
    - Server `validation` errors attach to fields (`fieldErrors` in the store) or show as an `Alert`.
- `EventFormRuleNotice` lists `ruleChanges` when the event is opened for edit and any exist: "N values will be changed by program rules when you save", with field labels and the rule name for each.
- `EventFormDetails` is a `Card` titled "About this event". It holds the report date (label from `executionDateLabel`, else "Report date"), the org unit and, for Point stages, the coordinate. These are context fields with the same commit semantics.
- `EventFormNotes` shows existing notes read-only (newest first, with author and date) and a `Textarea` labelled "Notes about this event".
- `EventFormFeedback` lists `displayTexts` and `keyValuePairs`.
- `EventFormSectionNav` is a sticky list of visible sections. It only renders when at least 2 are visible. It scroll-spies the active section, and clicking one focuses its heading.

- [ ] **Step 1: Write the failing browser tests.** Use a fake `DataEngineLike` serving the Task 1 fixtures and the program-rules RMNCH fixtures, and the real `@dhis2/rule-engine`.
    - `answering Chronic conditions Yes shows its 6 follow-ups`.
    - `LMP date assigns gestational age and locks it`.
    - `LMP after visit date shows the rule error and blocks Save`.
    - `editing an event a rule would change opens clean and shows the notice`: the fixture event has a value on a field a rule hides; `useEventFormState().dirty === false`; the notice is visible; Save sends `value:null` for it.
    - `Save on a new event posts the payload and calls onSaved with saved`.
    - `queued writer calls onSaved with queued`.
    - `server field error appears on the field`.
    - `Cancel with changes asks to discard`.
    - `scheduled event becomes ACTIVE on first answer`.
    - `skipped event is read-only`.
    - `renderCount: answering one question re-renders one EventFormField`: profile with `React.Profiler` on a 200-field generated stage. Only the answered field renders after a commit that changes no rule outputs.
- [ ] **Step 2:** Run `pnpm --filter @dhis2-blocks/event-form exec vitest run --project browser src/ui/EventForm`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests, then `pnpm typecheck && pnpm lint && pnpm dead-code:audit && pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat(event-form): EventForm root and composition`.

### Task 8: Registry item, install check, docs

**Files:**

- Modify: `packages/blocks/event-form/registry.json`. Item `event-form`, `registry:block`:
    - every non-test `src` file, targeting `@components/event-form/<path>`;
    - `registryDependencies`: each `devotta-labs/dhis2-blocks/<primitive>` it imports, plus `devotta-labs/dhis2-blocks/use-program-rules`;
    - `dependencies` from its imports.
- Create: `packages/blocks/event-form/src/registry.manifest.test.ts`, the same three checks as Working List's.
- Modify: `tools/registry/installCheck.ts` and the consumer template to also install `event-form` and render `<EventForm>` in `main.tsx`.
- Modify: `README.md` with an Event Form section: install, minimal composition, the props table, the writer contract and its `saved` / `queued` outcomes, and the rules-overlay behaviour in two sentences.
- Create: `apps/web/src/eventFormTranslationCatalog.ts`, and add it to the knip entries like the Working List catalog.

- [ ] **Step 1: Write the failing manifest test.** Run it. Expected: FAIL.
- [ ] **Step 2:** Edit the registry, the install check and the docs.
- [ ] **Step 3:** Run `pnpm registry:check && pnpm typecheck && pnpm lint && pnpm dead-code:audit && pnpm test`. Expected: all PASS.
- [ ] **Step 4:** Commit with message `feat(event-form): registry item and docs`.

### Task 9: Demo route and e2e

**Files:**

- Create: `apps/web/src/app/EventFormDemo/EventFormDemo.tsx`, route `#/event-form`.
    - Pick a program, org unit and enrollment with the Context Selector.
    - List the enrollment's events with Working List; a row click edits that event, and "New event" (stage picker) creates one.
    - `onSaved` returns to the list and shows a "Saved" or "Saved on this device" `Alert`.
    - Add a "Focus mode" toggle that wraps the form in a full-screen `Dialog`, to show that the host owns layout.
- Modify: `apps/web/src/App.tsx` / the router, and the link at the bottom of the demo next to the Context Selector showcase link.
- Create: `e2e/specs/event-form.spec.ts`

- [ ] **Step 1: Write the e2e spec** against version 43, using the Sierra Leone RMNCH enrollment from the spike (`PE6abx7Zhn0`, or the e2e seed if missing):
    - `creates an ANC event with rules applied`: answer Chronic conditions Yes → the follow-ups appear; enter LMP → gestational age is filled and locked; Save → the API (`GET /api/tracker/events/<uid>`) has the values.
    - `edits the event and round-trips values`: reopen the event; values match; change one; Save; the API shows the change.
    - `completes the event`: Complete → status COMPLETED in the API.
    - `has no axe violations` on the open form.
- [ ] **Step 2:** Run `pnpm e2e:43`. Expected: the new spec FAILS (no route yet).
- [ ] **Step 3:** Implement the demo route.
- [ ] **Step 4:** Run `pnpm e2e:43 && pnpm build`. Expected: PASS.
- [ ] **Step 5:** Commit with message `feat(web): event form demo route and e2e`.
