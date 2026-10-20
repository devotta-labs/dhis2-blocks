# Observation Cards block: design

Date: 2026-10-20 · Status: approved

## 1. Intent

The blocks so far (Context Selector, Working List, Event Form, program rules) are large and centred on Capture.
This is a deliberately **small, read-only** block, whose job is to practise and prove the shadcn method end to end:
a source-installed registry item that an external developer adds with one `shadcn add`, owns, and edits.

The use case is a **lightweight EMR**: a clinician opens one person's record and sees, at a glance, how
the things measured over time are trending and what the last recorded status of the important things is. It should also
fit a future tracked-entity dashboard in this repo, or a tracker dashboard someone else builds.

"Analytics" here means **one person**, not a program or an area. Values come live from that person's tracker
events, not from DHIS2's analytics tables, so there's no wait for an analytics run and it works on a fresh
instance. A program-level version (program indicators, aggregated events by org unit and period) is a later,
separate hook that feeds the same cards (§8).

## 2. Goals

1. A `registry:block` of presentational cards for one person's data:
    - **Trend card**: one numeric data element: latest value, date recorded, change since the previous
      reading, a sparkline across visits.
    - **Last recorded card**: one data element of any supported type: latest value, date recorded, the
      program stage it came from, and a "stale" look when it is older than a threshold the host sets.
2. A `registry:hook` that fetches a person's events and the metadata for the requested data elements, and
   returns one series per data element, ready for the cards.
3. **DHIS2-native colouring**: numeric values coloured by the data element's **legend set**; option-set
   values coloured by the option's own **style colour**. Nobody hardcodes thresholds.
4. Shared primitives added to `packages/blocks/ui`: shadcn `chart` (Recharts), `badge`, and `skeleton` if the
   loading state needs it, themed with the DHIS2 tokens.
5. **The finish line**: (a) in the demo app, open a real person on the test instance and see their cards filled
   and coloured correctly; (b) install the block into a clean app with one `shadcn add` and have it
   typecheck and render.

## 3. Non-goals (v1)

- **Any writing.** No adding a reading from a card. Strictly read-only.
- Program-level or area-level analytics (the analytics API, program indicators). Later, separate hook.
- Several series in one card. Blood pressure is **two cards** (systolic, diastolic), decided with the user.
  One card is always one data element.
- Tracked entity attributes (profile data). Cards read event data values only.
- Reference ranges beyond the legend set (age- or sex-dependent ranges, computed values like BMI).
- A provider or context that lets cards fetch for themselves. Can be added on top later (§7).
- An in-app configuration screen. The developer chooses cards in code.
- Offline support.
- Value types beyond §9.

## 4. Anti-goals: failure even if it technically works

- Cards that fetch. The block layer only renders what it is given.
- Clinical thresholds in code. Colour comes from DHIS2 metadata or not at all.
- Colour as the only signal. A coloured value always carries its legend or option name as text.
- An old value shown as if it were current. The recorded date is always visible; staleness is visible when
  the host sets a threshold.
- Silently wrong values: an option code shown instead of its name, a value from a scheduled or skipped event,
  readings out of order.
- A heavy install. The consumer should get cards, one hook, and the primitives they need, nothing else.

## 5. Constraints

- Same conventions as the other blocks: React 18, TypeScript, Tailwind v4, shadcn on Base UI,
  `@tanstack/react-query`, `@dhis2/app-runtime`, `zod` at the API boundary, `better-result` for fallible
  operations, `@dhis2/d2-i18n` for strings, oxlint/oxfmt, knip, vitest (node and browser projects).
- DHIS2 versions: the e2e matrix (2.41, 2.42, 2.43, dev) against the Sierra Leone database. The tracker events
  response shape differs across these (`instances` vs `events`); follow how Working List handles it
  (`packages/blocks/working-list/src/api/schemas.ts`). Event Form only fetches single events and doesn't.
- Calendars: dates display in the system calendar via `@dhis2/multi-calendar-dates`, as in Working List.
- Registry addressing and install layout as Event Form §6: cross-item dependencies use
  `devotta-labs/dhis2-blocks/<item>`, primitives install into their own folder, the theme stays scoped to the
  blocks.
- **Branch base**: `jc/feat/shared-ui` (master + the working-list shadcn swap + the shared `ui` package, cherry-picked
  from `jc/feat/event-form`). This block builds on it so it can land on master without Event Form. The user
  integrates branches; no PRs or merges from the builder.

## 6. Registry items

| Item                              | Type             | Contents                                                                         | Depends on               |
| --------------------------------- | ---------------- | -------------------------------------------------------------------------------- | ------------------------ |
| `chart`, `badge`, (`skeleton`)    | `registry:ui`    | Stock shadcn components, DHIS2-themed, in `packages/blocks/ui`                   | none                     |
| `use-tracked-entity-observations` | `registry:hook`  | Fetching, validation, and pure conversion from events to series (internal files) | none                     |
| `observation-cards`               | `registry:block` | `TrendCard`, `LatestValueCard`, `LegendBadge`, `Sparkline`                       | the hook, the primitives |

**No separate `registry:lib`.** Unlike program rules (heavy engine, React-free users), nothing here needs
a lib on its own. The conversion lives in plain internal files of the hook (for example `buildSeries.ts`) with
their own unit tests. Split it into a lib when a second user appears, most likely the program-level hook.

Installing `observation-cards` pulls the hook and the primitives. Working names; final names are the
builder's (§13).

## 7. Public surface

Cards take data as props. The host calls the hook once and hands each card its series (decided as best
practice: explicit, works with any data source, renders with fixture data and no DHIS2):

```tsx
const observations = useTrackedEntityObservations({
    trackedEntityId,
    programId,
    dataElementIds: [systolicId, diastolicId, haemoglobinId, smokingId],
})

<TrendCard series={observations.get(systolicId)} unit="mmHg" />
<TrendCard series={observations.get(diastolicId)} unit="mmHg" />
<TrendCard series={observations.get(haemoglobinId)} unit="g/dL" />
<LatestValueCard series={observations.get(smokingId)} staleAfterDays={180} />
```

- The hook result exposes loading and error state; cards render their own **loading, empty ("never
  recorded") and error** states from what they are given (a series, or a status in its place).
- `label` defaults to the data element's display form name, overridable by prop. `unit` is a prop only:
  DHIS2 data elements have no unit field.
- `staleAfterDays` is off unless set.
- `LegendBadge` and `Sparkline` are exported for hosts building their own card layouts.

## 8. The series shape

The series type is **neutral**, so a later analytics hook can produce it and the cards don't change:

- identity and label, value type
- points: value, date, and where it came from (event, program stage, stage name)
- latest, previous, change (numeric only)
- optional legend set (ranges with name and colour), optional option set (code → name, colour)

The exact type is the builder's. Nothing about tracker (enrollments, event status) leaks into what the cards
read beyond "where it came from" for display.

## 9. Data rules

- **Which person**: one tracked entity in one program, **across all its enrollments in that program**, so a
  re-enrolled person keeps their history.
- **Which events**: those with values that were actually recorded (ACTIVE, COMPLETED). Scheduled, skipped,
  overdue and deleted events are excluded.
- **Any stage**: a data element is read from whichever stages capture it (on RMNCH, haemoglobin appears in four).
- **Order**: by occurred date; ties broken by a stable second key (the builder picks one, such as created date).
- **Blank at a later visit** (decided with the user):
    - **TRUE_ONLY**: DHIS2 only stores a tick, so a later ACTIVE or COMPLETED event in a stage that captures the
      field, with no tick, counts as **"No"** at that event's date. A person never ticked in any such event shows
      "No" from their latest such event, not "never recorded".
    - **Every other type**: blanks are skipped. The card shows the last real value with its date, and the stale look
      when the host sets a threshold.

    So for TRUE_ONLY the hook needs to know which events came from stages that capture the field, not only
    which events have a value.

- **Legend lookup**: the data element's first legend set; DHIS2 convention of start inclusive, end exclusive.
  A value outside every legend has no colour, not an error.
- **Options**: values are option codes; show the option name and use its style colour if set.
- **Value types in v1**: numeric (NUMBER, INTEGER, INTEGER_POSITIVE, INTEGER_NEGATIVE,
  INTEGER_ZERO_OR_POSITIVE, PERCENTAGE) for trend cards. For last recorded: any of those, option set, BOOLEAN,
  TRUE_ONLY, TEXT, LONG_TEXT, DATE. Anything else is unsupported, and the card says so instead of showing a raw value.
- **Access**: if the user can't read the program or person (ownership, sharing), the hook reports an error the
  card can show plainly. It never shows an empty card as if nothing had been recorded.
- **Unreadable stages** (my call): the tracker API silently omits events from stages the user can't read, which
  could make an older reading look like the latest. The hook reads each capturing stage's data-read access
  from the metadata it already fetches; if any is unreadable, the series is marked **partial** and the card
  shows a short note ("Some visits are hidden by your access"). This is a note on a normal card, not a separate
  error state.
- Fetch every relevant event, not just the first page.

## 10. UI

Standard shadcn `card`, `badge` and `chart` with DHIS2 tokens. The mockup from the session is the reference for
content, not pixels: label and legend badge on top, large value and unit, a line for change and date,
sparkline below. The sparkline has a tooltip (value and date per point) and a text alternative summarising
the readings (count, date range, latest), so it isn't only visual.

## 11. Demo and happy path

A route in `apps/web` showing a person dashboard built from the cards, with **presets**:

1. **Real data (any Sierra Leone database)**: _WHO RMNCH Tracker_ (`WSGAb5XwJ3Y`).
    - Trend: _WHOMCH Hemoglobin value_ (`vANAXwtLwcT`), recorded across four stages.
    - Last recorded: _WHOMCH Smoking_ (`sWoqcoByYmD`, boolean) and _WHOMCH Extreme pallor_ (`EyfTU3ibMmJ`).
    - On the public dev demo (2.44-SNAPSHOT), person `Y8aEiTpHSSQ` has 8 events with 7 haemoglobin readings.
      The builder confirms a good person on each matrix version rather than hardcoding one UID everywhere.
    - What this database **lacks**, checked on 2026-10-20: blood pressure is defined in the RMNCH stages but has no
      values recorded; no tracker data element has a legend set; the HIV rapid test option set has no colours.
      The generated haemoglobin values are random (6–23), so expect a jumpy line.
2. **Full features (seeded)**: a small dedicated program seeded by the e2e scripts, alongside the existing
   Working List seed. It has systolic and diastolic blood pressure, weight and haemoglobin with **legend sets**, a
   status data element on a **colour-styled option set**, and one person with about six visits across two stages and
   two enrollments, one visit old enough to look stale. It is a dedicated program (my call) so it never disturbs the Sierra
   Leone data other suites read, and so the e2e is deterministic.

The demo also takes a pasted tracked entity ID for trying other people.

## 12. Testing and verification

- **Unit (node)**: event → series conversion: order and ties, all stages, several enrollments, excluded
  event statuses, missing values, legend boundaries (start inclusive, end exclusive, outside), option code →
  name and colour, boolean, true-only (a later untick reads as "No"; never ticked reads as "No"), blanks
  skipped for other types, partial access, change calculation, staleness, unsupported types.
- **API**: zod schemas against recorded responses from 2.41 and dev (both response shapes).
- **Browser (vitest browser)**: each card in loading, empty, error, normal, legend-coloured, stale and
  single-point states; tooltip and text alternative; axe checks.
- **E2E (Playwright, real DHIS2 matrix)**: the seeded person's cards show the expected values, colours and
  stale state; the RMNCH preset renders haemoglobin.
- **Install check**: `shadcn add devotta-labs/dhis2-blocks/observation-cards` into a clean app pulls the hook
  and primitives and typechecks, as for Event Form.
- **README** for the block: install command, the §7 snippet, what each card needs.

## 13. Left to the builder

- Final item, component, prop and type names; file layout inside each item.
- Whether the hook fetches metadata for the requested data elements only or for the whole program.
- The Recharts version (whichever shadcn's `chart` currently targets), and sparkline details (point cap,
  dots, axis-free styling).
- Copy, date formatting ("14 Oct" or relative), skeleton design.
- Seed metadata details and UIDs for the full-features program.
- The demo route's layout and how a preset or person is picked.
- Order of work.
