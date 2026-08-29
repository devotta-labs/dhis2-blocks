# Context Selector

Purely presentational, controlled context-selector primitives for React 18
DHIS2 applications. The visual structure follows the DHIS2 Capture selector
bar while leaving data and workflow policy to the host. The row fills its
containing width by default; constrain the parent only when embedding it in a
narrower surface.

The block does not fetch metadata, read routes, provide context, or decide
which controls are relevant. The host resolves labels and options, renders
children in workflow order, and owns committed values, popup state, URL
synchronization, dirty-state guards, and progressive disclosure.

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

    {programId ? (
        <OrganisationUnitSelector
            value={organisationUnit?.displayName}
            open={organisationUnitOpen}
            onOpenChange={setOrganisationUnitOpen}
            onClear={clearOrganisationUnit}
        >
            <HostOrganisationUnitTree onSelect={selectOrganisationUnit} />
        </OrganisationUnitSelector>
    ) : null}

    {eventIsRelevant ? (
        <EventSelector
            label={eventDateLabel}
            options={eventOptions}
            value={eventId}
            readOnly={eventIsDisplayOnly}
            onChange={selectEvent}
        />
    ) : null}
</ContextSelector>
```

`ProgramSelector`, `EnrollmentSelector`, and `StageSelector` provide generic
translated fallback labels and accept a host override. `EventSelector.label`
and `OptionSelector.label` are required because those terms are normally
metadata-derived. `OrganisationUnitSelector` provides Capture's `640px` by
`96px` minimum popup shell around arbitrary host-owned picker children.

More than ten options automatically use Capture's sticky filter input and
clear-selection footer. Option selectors accept children after their options,
allowing the host to compose program-filter notices and actions without moving
workflow policy into this block. Set `excludeFromMenu` when an option must
resolve a committed value in the closed selector but should not be offered in
the open menu.

State precedence is deterministic: `loading > disabled > readOnly >
interactive`. Loading and disabled selectors suppress opening, selection, and
clearing. Read-only option selectors cannot open or change, but remain clearable
when `onClear` is supplied. Capture's read-only organisation-unit selector is
fully locked and does not expose clear. In the ordinary interactive state, `open`,
`onOpenChange`, `value`, `onChange`, and `onClear` are controlled independently
by the host.

The host must resolve option display names, icons, tracked-entity type names,
category terms, enrollment and incident-date labels, event and due-date labels,
and all other metadata terminology. No DHIS2 metadata object belongs in this UI
package.
