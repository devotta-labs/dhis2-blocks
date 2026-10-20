# Observation Cards

Read-only cards for a tracked entity's observations: the latest reading of a
data element, its trend over time, and the legend or option colour that
reading falls in. One hook loads the data once; each card receives one data
element's result and renders it.

The block never writes to DHIS2. The host decides which data elements to show,
where the cards sit, and how they are laid out.

## Install

Install it from the GitHub registry in a project with Tailwind CSS enabled and
a valid shadcn `components.json` configuration:

```sh
pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/observation-cards
```

The install also copies the `useTrackedEntityObservations` hook, the shared UI
primitives the cards use (to `components/dhis2/ui/`), and the namespaced
`dhis2-theme` item. It does not restyle the rest of the application.

## Requirements

Render the cards and the component that calls the hook beneath both providers:

- a TanStack `QueryClientProvider` from `@tanstack/react-query`
- the DHIS2 app-runtime `Provider` from `@dhis2/app-runtime`

The hook reads through the app-runtime data engine and caches with React
Query. The cards also read the instance's calendar from the app-runtime config.

## Usage

Call the hook once, then pass each data element's result to a card:

```tsx
import {
    LatestValueCard,
    TrendCard,
    useTrackedEntityObservations,
} from '@/components/observation-cards'

const SYSTOLIC = 'dataElementUid1'
const DIASTOLIC = 'dataElementUid2'
const NEXT_STEP = 'dataElementUid3'

function Observations({ trackedEntityId, programId }) {
    const observations = useTrackedEntityObservations({
        trackedEntityId,
        programId,
        dataElementIds: [SYSTOLIC, DIASTOLIC, NEXT_STEP],
    })

    return (
        <div className="grid gap-4 sm:grid-cols-3">
            <TrendCard observation={observations.get(SYSTOLIC)} unit="mmHg" />
            <TrendCard observation={observations.get(DIASTOLIC)} unit="mmHg" />
            <LatestValueCard
                observation={observations.get(NEXT_STEP)}
                staleAfterDays={90}
            />
        </div>
    )
}
```

`observations.get(id)` always returns a result. While data loads or a request
fails it carries `status: 'pending'` or `status: 'error'`, and each card shows
a skeleton or an error state, so the host needs no loading branches. The hook's
own `status` and `error` summarise all requests.

## Cards

`TrendCard` shows a numeric data element: its latest value, the legend badge,
the change since the previous reading, and a sparkline.

| Prop        | Type                | Notes                                             |
| ----------- | ------------------- | ------------------------------------------------- |
| observation | `ObservationResult` | Required. From `observations.get(id)`.            |
| unit        | `string`            | Shown after the value, such as `kg`.              |
| label       | `string`            | Overrides the data element's own label.           |
| maxPoints   | `number`            | How many of the most recent readings are plotted. |
| className   | `string`            | Merged onto the card.                             |

`LatestValueCard` shows the last recorded value of a data element: a number,
option, yes/no, date or text.

| Prop           | Type                | Notes                                                               |
| -------------- | ------------------- | ------------------------------------------------------------------- |
| observation    | `ObservationResult` | Required. From `observations.get(id)`.                              |
| label          | `string`            | Overrides the data element's own label.                             |
| unit           | `string`            | Shown after a numeric value.                                        |
| staleAfterDays | `number`            | Mutes the card and adds a note once the reading is older than this. |
| className      | `string`            | Merged onto the card.                                               |

`LegendBadge` and `Sparkline` are exported for hosts that compose their own
card. `LegendBadge` takes a `legend` or `option` from a series; `Sparkline`
takes a `series` and an optional `maxPoints`.

Value types: `TrendCard` supports `NUMBER`, `INTEGER`, `INTEGER_POSITIVE`,
`INTEGER_NEGATIVE`, `INTEGER_ZERO_OR_POSITIVE` and `PERCENTAGE`.
`LatestValueCard` supports those plus option sets, `BOOLEAN`, `TRUE_ONLY`,
`TEXT`, `LONG_TEXT` and `DATE`. Any other value type renders an unsupported
state.

## Data rules

- The latest value is the most recent across all of the person's enrollments in
  the program, not just the current one.
- Only events in `ACTIVE` or `COMPLETED` status count. Events in any other
  status are ignored.
- A `TRUE_ONLY` data element that has been unticked reads as "No".
- Legend colours come from the data element's legend set, and option colours
  from its option set. A value on a legend's `endValue` falls in the next
  legend; a value in a gap or outside every legend has no colour and no badge.
  An option code missing from its option set shows the raw code.
- Numeric values that do not parse are left out of the trend rather than
  plotted as zero.
- When a program stage that captures the data element is not data-readable by
  the current user, some visits may be missing, and the card says "Some visits are hidden by your access".
- Dates display in the instance's calendar.

All user-facing text goes through `@dhis2/d2-i18n`.
