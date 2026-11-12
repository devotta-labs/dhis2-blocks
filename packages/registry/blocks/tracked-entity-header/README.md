# Tracked Entity Header

A banner for one tracked entity in a DHIS2 tracker program, such as a person
or a shipment, for React 18 applications: what it is and the facts that
matter most, composed from attribute parts. Read-only. The parts load the
tracked entity and the program's attribute metadata through the DHIS2
app-runtime, once for every part inside the provider.

```tsx
<TrackedEntityHeaderProvider
    trackedEntity={trackedEntityId}
    program={programId}
>
    <TrackedEntityBanner />
</TrackedEntityHeaderProvider>
```

With no children the banner shows the program's list attributes, its state
tags (`Inactive`, `Possible duplicate`) and a details disclosure for every
other attribute. Without `program`, only the tracked entity type's attributes
show, and the owner and enrollment parts need one. To compose a banner, place
the parts yourself, here for a person:

```tsx
<ObservationsProvider trackedEntity={personId} program={programId}>
    <TrackedEntityHeaderProvider trackedEntity={personId} program={programId}>
        <TrackedEntityBanner className="sticky top-0">
            <TrackedEntityName attributes={[firstName, lastName]} />
            <TrackedEntityStatus />
            <TrackedEntityDate attribute={birthDate} label="Born" age />
            <TrackedEntityAttribute attribute={uniqueId} label="ID" />
            <TrackedEntityActions>
                <Button size="sm" onClick={recordVisit}>
                    Record visit
                </Button>
            </TrackedEntityActions>
            <TrackedEntityFacts>
                <TrackedEntityAttribute attribute={allergies} />
                <ObservationInline
                    dataElement={haemoglobin}
                    label="Haemoglobin"
                    unit="g/dL"
                />
            </TrackedEntityFacts>
            <TrackedEntityDetails />
        </TrackedEntityBanner>
    </TrackedEntityHeaderProvider>
</ObservationsProvider>
```

Place `TrackedEntityStatus` yourself when composing: without it an inactive
record is shown by the banner's muted surface alone. `ObservationInline` is
from the `observation-cards` block and needs an `ObservationsProvider`;
stickiness is the host's.

The banner draws its background and padding but no edge. Add one with
`className`: `border-b border-dhis2-border-strong px-6` for a bar across the
top of a page, or `rounded-dhis2-md border border-dhis2-border-strong` for a
card. Your padding replaces the banner's.

Parts: `TrackedEntityName`, `TrackedEntityDate`, `TrackedEntityAttribute`,
`TrackedEntityStatus`, `TrackedEntityOwner`, `TrackedEntityEnrollment`,
`TrackedEntityFacts`, `TrackedEntityActions`, `TrackedEntityDetails`,
`TrackedEntityRelationship` and `TrackedEntityRelationships`; each takes a
`className`. `TrackedEntityDate` shows a date attribute, or with
`enrollmentDate` the enrollment's incident or enrollment date under the
program's own label; `age` adds the time from that date to today, in the system's calendar. Every value part renders nothing until the record is
ready, so a restricted record never shows a value. `TrackedEntityActions`
renders in every state outside a banner; inside one it shows once the record
is ready, and when access is restricted, so a "Request access" button still
shows.

`TrackedEntityRelationship` shows one relationship type by uid, such as a
mother. `TrackedEntityRelationships` lists every link, one line per type with
its count and first names, as a disclosure in a banner. Names link through
`href` or `onSelect`; the block ships no peek, and labels can be overridden.

Parts also work outside the banner, anywhere under the provider.
`useTrackedEntityHeader()` returns `status` (`'loading'`, `'failed'`,
`'restricted'`, `'not-found'` or `'ready'`), `retry` and, once ready, the tracked entity and
attribute metadata, so a popover or a summary can draw its own states.

To list the attributes a program captures:

```
GET /api/programs/<program>?fields=programTrackedEntityAttributes[displayInList,sortOrder,trackedEntityAttribute[id,displayName,valueType]]
```

The block reads the literal `process.env.NODE_ENV`, which your bundler
replaces at build time, to choose between the full development setup
message for a part placed with an attribute the program doesn't capture and
a short production one (the full message is logged instead). Where nothing
replaces it, the full message shows.

See the docs page at `/blocks/tracked-entity-header` for the provider and
banner reference and a composed example.
