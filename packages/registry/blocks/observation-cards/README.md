# Observation Cards

Composable cards for DHIS2 React 18 applications that show one person's
readings in one program: how measured values are trending and what each
important thing was last recorded as. Read-only, and coloured only from the
data element's legend set or option colours. The provider names the person
and the program; the cards under it share one request for the program's
metadata and one for the person's events.

```tsx
<ObservationsProvider trackedEntity={personId} program={programId}>
    <ObservationCard dataElement="vANAXwtLwcT" unit="g/dL" />
    <ObservationCard dataElement="sWoqcoByYmD" staleAfterDays={180} />
</ObservationsProvider>
```

Without children a card picks its arrangement from the value type: numbers
get the latest value, legend, change since the previous reading and a
sparkline; everything else gets the last recorded value, and yes or no
values and option sets say when it last changed. To build a
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

The cards fetch through the DHIS2 app-runtime's data engine and TanStack
Query, so they need the app's `QueryClientProvider` above them.

To list the data elements a program's stages capture:

```
GET /api/programs/<program>?fields=programStages[programStageDataElements[dataElement[id,displayName,valueType]]]
```

The block reads the literal `process.env.NODE_ENV`, which your bundler
replaces at build time, to choose between the full development setup
message for a data element the program doesn't capture and a short
production one (the full message is logged instead). Where nothing replaces
it, the full message shows.

See the docs page at `/blocks/observation-cards` for the provider and card
reference and a composed example.
