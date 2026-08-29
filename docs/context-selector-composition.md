# Context Selector composition

## Consumer contract

The Context Selector is a source-installed React 18 block. Install it into a
Tailwind-enabled project with a valid shadcn `components.json`, then import it
through the configured components alias. Its components own Capture-compatible
layout, styling, semantics, and generic interface language. No separate
stylesheet is required. The row fills its containing width by default; a host
can opt into a narrower presentation by constraining the parent surface.

The block is deliberately presentational. It has no provider, query client,
metadata client, store, router adapter, URL synchronization, application state,
or progressive-disclosure policy. The host owns:

- option and picker data, loading and availability;
- committed values, popup state, and transition callbacks;
- dirty-state confirmation and dependent-selection resets;
- URL or router synchronization and persistence;
- child visibility, order, and progressive disclosure;
- every metadata-derived label, display name, and icon.

```tsx
import {
    ContextSelector,
    ContextValue,
    EnrollmentSelector,
    EventSelector,
    OptionSelector,
    OrganisationUnitSelector,
    ProgramSelector,
    StageSelector,
} from '@/components/context-selector'
```

## Direct controlled composition

Selector props use ordinary controlled React values and callbacks. The generic
option-backed contract is:

```ts
interface SelectorProps {
    options: readonly Option[]
    value?: string
    onChange?(value: string): void
    onClear?(): void

    open?: boolean
    onOpenChange?(open: boolean): void

    loading?: boolean
    loadingLabel?: string
    disabled?: boolean
    readOnly?: boolean

    label?: string
    placeholder?: string
    searchPlaceholder?: string
    children?: ReactNode
}
```

`OrganisationUnitSelector` uses the smaller equivalent contract without
`options` or `onChange`; its `children` are the host-owned picker. Supplying
`onClear` enables Capture's per-item clear affordance when a value is present.
The root row similarly accepts `onClear` and `clearDisabled` directly.

```tsx
<ContextSelector
    ariaLabel="Registration context"
    onClear={clearContext}
    clearDisabled={!programId}
>
    <ProgramSelector
        options={programOptions}
        value={programId}
        open={programOpen}
        onOpenChange={setProgramOpen}
        onChange={selectProgram}
        onClear={clearProgram}
        loading={programsQuery.isPending}
    />

    {programId && (
        <OrganisationUnitSelector
            value={organisationUnit?.displayName}
            open={organisationUnitOpen}
            onOpenChange={setOrganisationUnitOpen}
            onClear={clearOrganisationUnit}
        >
            <OrganisationUnitPicker onSelect={selectOrganisationUnit} />
        </OrganisationUnitSelector>
    )}

    {enrollmentIsRelevant && (
        <EnrollmentSelector
            options={enrollmentOptions}
            value={enrollmentId}
            open={enrollmentOpen}
            onOpenChange={setEnrollmentOpen}
            onChange={selectEnrollment}
        />
    )}

    {stageIsRelevant && (
        <StageSelector
            options={stageOptions}
            value={stageId}
            open={stageOpen}
            onOpenChange={setStageOpen}
            onChange={selectStage}
        />
    )}

    {eventIsRelevant && (
        <EventSelector
            label={eventDateLabel}
            options={eventOptions}
            value={eventId}
            open={eventOpen}
            onOpenChange={setEventOpen}
            readOnly={eventIsDisplayOnly}
            onChange={selectEvent}
            onClear={clearEvent}
        />
    )}
</ContextSelector>
```

The callbacks are independent and optional. The component never infers a state
machine from which callbacks exist: it renders the controlled `open` value,
calls `onOpenChange` when supplied, emits option intent through `onChange`, and
shows the clear affordance when a selected value and `onClear` are present.

## State precedence

Conflicting state flags resolve predictably in this order:

1. `loading` preserves Capture's centered loading presentation and suppresses
   opening, selection, and clearing.
2. `disabled` renders Capture's disabled selector and suppresses all
   interaction, even when `readOnly`, `open`, or callbacks are also supplied.
3. `readOnly` displays the committed value and prevents opening or selection.
   Option-backed selectors remain clearable when the host supplies `onClear`.
   Capture's read-only organisation-unit selector is fully locked and does not
   expose clear.
4. Otherwise the selector is interactive. `open` remains controlled by the
   host, and callbacks emit intent without committing hidden state.

This precedence applies equally to the specialized option selectors and the
organisation-unit popup shell. `ContextValue` is always non-selectable and can
optionally be clearable.

## Progressive disclosure and data boundaries

Progressive disclosure is ordinary conditional rendering. A program-first
workflow might reveal organisation unit after program, enrollment after the
required scope is known, stage after enrollment, and an event context value
after stage. An event program may omit enrollment; a route-fixed workflow may
omit program. The row never decides.

Keep server-state queries near the host workflow that knows their dependencies.
Map query results to `{ value, label, icon?, disabled?, excludeFromMenu? }`
before passing them to
the block. Keep pending transitions in the host when dirty work requires
confirmation, and only update committed selector props after confirmation.
Decode and validate URL state in the host and encode confirmed callbacks there.

## Metadata ownership

`ProgramSelector`, `OrganisationUnitSelector`, `EnrollmentSelector`, and
`StageSelector` provide translated generic fallback labels; each accepts a
`label` override. `EventSelector.label` is required because Capture normally
uses the selected stage's configured event-date label. `OptionSelector.label`
is also required because the generic component cannot know the host's term.

The host resolves option display names, program and stage icons,
tracked-entity type names, category labels, enrollment and incident-date labels,
event-date and due-date labels, and every other metadata term. Passing DHIS2
metadata objects into the UI package would cross this boundary and is not part
of the API.

## Capture parity boundary

Capture remains the reference for selector-bar structure, labels and values,
clear affordances, program menus, filtered-program notices, organisation-unit
popup geometry and search presentation, icons, loading/read-only/disabled
states, responsive layout, keyboard interaction, and dirty-confirmation user
flows. Parity does not include Capture's Redux, routing, metadata loading, or
workflow orchestration; the host supplies those responsibilities.

The public component surface is `ContextSelector`, `ProgramSelector`,
`OrganisationUnitSelector`, `EnrollmentSelector`, `StageSelector`,
`EventSelector`, `OptionSelector`, and `ContextValue`. The package also exports
their prop types plus `Option`, `OptionIcon`, and `SelectorProps` for typed host
composition.
