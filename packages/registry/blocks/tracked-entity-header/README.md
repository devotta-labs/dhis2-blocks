# Tracked Entity Header

A banner for one person in a DHIS2 tracker program, for React 18
applications: who they are and what could hurt them, composed from attribute
parts. Read-only. The provider loads the person and the program's attribute
metadata once for every part inside it.

```tsx
<TrackedEntityHeaderProvider trackedEntity={personId} program={programId}>
    <TrackedEntityBanner />
</TrackedEntityHeaderProvider>
```

With no children the banner shows the program's list attributes, the
person's state tags (`Inactive`, `Possible duplicate`) and a details
disclosure for every other attribute. Without `program`, only the person
type's attributes show, and the owner and enrollment parts need one. To
compose a banner, place the parts yourself:

```tsx
<ObservationsProvider trackedEntity={personId} program={programId}>
    <TrackedEntityHeaderProvider trackedEntity={personId} program={programId}>
        <TrackedEntityBanner className="sticky top-0">
            <TrackedEntityName attributes={[firstName, lastName]} />
            <TrackedEntityStatus />
            <TrackedEntityBorn attribute={birthDate} />
            <TrackedEntityAttribute attribute={uniqueId} />
            <TrackedEntityActions>
                <Button onClick={recordVisit}>Record visit</Button>
            </TrackedEntityActions>
            <TrackedEntityFacts>
                <TrackedEntityAttribute attribute={allergies} />
                <ObservationInline dataElement={haemoglobin} unit="g/dL" />
            </TrackedEntityFacts>
            <TrackedEntityDetails />
        </TrackedEntityBanner>
    </TrackedEntityHeaderProvider>
</ObservationsProvider>
```

Place `TrackedEntityStatus` yourself when composing: without it an inactive
person is shown by the banner's muted surface alone. `ObservationInline` is
from the `observation-cards` block and needs an `ObservationsProvider`;
stickiness is the host's.

Parts: `TrackedEntityName`, `TrackedEntityBorn`, `TrackedEntityAttribute`,
`TrackedEntityStatus`, `TrackedEntityOwner`, `TrackedEntityEnrollment`,
`TrackedEntityFacts`, `TrackedEntityActions` and `TrackedEntityDetails`; each
takes a `className`. Every value part renders nothing until the person is
ready, so a restricted person never shows a value. `TrackedEntityActions`
always renders.

Parts also work outside the banner, anywhere under the provider.
`useTrackedEntityHeader()` returns `status` (`'loading'`, `'failed'`,
`'restricted'` or `'ready'`), `retry` and, once ready, the person and
attribute metadata, so a popover or a summary can draw its own states.
`createTrackedEntityHeaderClient` wraps a custom data engine; by default the
block uses the DHIS2 app-runtime.

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
