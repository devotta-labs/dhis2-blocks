# Context Selector

Purely presentational, controlled context-selector primitives for React 18
DHIS2 applications. The visual structure follows the DHIS2 Capture selector
bar while leaving application policy to the host.

The block does not fetch data, read routes, provide context, or decide which
controls are relevant. The host renders children in workflow order and owns
committed values, popup state, URL synchronization, dirty-state guards and
progressive disclosure.

```tsx
const programControl: ContextControlMode = {
    mode: 'interactive',
    open: openControl === 'program',
    onOpenChange: (open) => setOpenControl(open ? 'program' : null),
    onSelect: setProgramId,
    onClear: clearProgram,
}

<ContextSelector
    ariaLabel="Registration context"
    clearAction={{ onClick: clearContext, disabled: !hasContext }}
>
    <ContextProgramSelector
        options={programOptions}
        selectedValue={programId}
        control={programControl}
    />
    {programId ? (
        <ContextOrganisationUnitSelector
            value={orgUnitName}
            control={orgUnitControl}
        >
            <HostOrganisationUnitTree onSelect={selectOrgUnit} />
        </ContextOrganisationUnitSelector>
    ) : null}
    {enrollmentOptions.length ? (
        <ContextEnrollmentSelector
            options={enrollmentOptions}
            selectedValue={enrollmentId}
            control={enrollmentControl}
        />
    ) : null}
</ContextSelector>
```

Use the `interactive`, `display`, `loading`, and `disabled` control modes rather
than combining flags. A `display` control may optionally expose `onClear`; it
never opens a menu. More than ten options automatically use Capture's sticky
filter input and clear-selection footer. Organisation-unit popup content is an
arbitrary host child inside Capture's `640px` by `96px` minimum popup shell.
Option selectors also render optional children after their option list, so the
host can compose Capture-style empty-state actions or program-filter notices
without putting organisation-unit policy into this block.
