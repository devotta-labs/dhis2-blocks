# Observation Cards

Composable cards for DHIS2 React 18 applications that show one person's
readings in one program: how measured values are trending and what each
important thing was last recorded as. Read-only, and coloured only from the
data element's legend set or option colours. The provider loads the program's
metadata and the person's events once for every card inside it.

```tsx
<ObservationsProvider trackedEntity={personId} program={programId}>
    <ObservationCard dataElement="vANAXwtLwcT" unit="g/dL" />
    <ObservationCard dataElement="sWoqcoByYmD" staleAfterDays={180} />
</ObservationsProvider>
```

Without children a card picks its arrangement from the value type: numbers
get the latest value, legend, change since the previous reading and a
sparkline; everything else gets the last recorded value. To build a
different card, place the parts yourself:

```tsx
<ObservationCard dataElement="vANAXwtLwcT">
    <ObservationLabel />
    <ObservationValue unit="g/dL" />
    <ObservationSparkline points={6} />
    <ObservationRecorded />
</ObservationCard>
```

Parts: `ObservationLabel`, `ObservationLegend`, `ObservationValue`,
`ObservationChange`, `ObservationSparkline` and `ObservationRecorded`; each
takes a `className`. The card shows the loading, error, never recorded and
unsupported states itself, and adds the recorded date, stale and partial
access notes when a composed card leaves `ObservationRecorded` out.

`useObservation(dataElement)` returns a card's state and series, for custom
layouts. `createObservationsClient` wraps a custom data engine; by default
the block uses the DHIS2 app-runtime.

To list the data elements a program's stages capture:

```
GET /api/programs/<program>?fields=programStages[programStageDataElements[dataElement[id,displayName,valueType]]]
```

The block reads the literal `process.env.NODE_ENV`, which your bundler
replaces at build time, to choose between the full development setup
message for a data element the program doesn't capture and a short
production one (the full message is logged instead). Where nothing replaces
it, the full message shows.

See the docs page at `/blocks/observation-cards` for every part and example.
