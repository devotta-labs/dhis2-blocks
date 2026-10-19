# Event Form

Create and edit a tracker event for one program stage, with program rules applied.

Install it with `pnpm dlx shadcn@latest add devotta-labs/dhis2-blocks/event-form`. Usage, props and the writer
contract are in the [root README](../../../README.md#event-form-block). The block is split into `src/api` (loading),
`src/model` (form model, rule overlay and validation), `src/state` (the store), `src/save` (payload, writers and the
save mutation) and `src/ui` (the parts).

The typed data-loading layer in `src/api`:

- `createEventFormClient(engine)` runs a query or a mutation and returns a `Result`, so a failed request or a malformed response is a value, not a throw.
- `StageMetadata` (`toStageMetadata`) is one stage of a program: sections (a stage without sections gets one implicit section), data elements, validation strategy and whether the program has a non-default category combo.
- `TrackerEvent` (`TrackerEventSchema`) is an existing event with its data values and notes.
- `SystemCalendar` is the calendar and date format of the DHIS2 instance.
- `eventFormKeys` and the hooks `useStageMetadata`, `useTrackerEvent` and `useSystemCalendar` fetch them with React Query.

The fixtures in `src/api/__fixtures__` were fetched from the version 43 e2e stack (`pnpm e2e:up 43`): the WHO RMNCH Tracker program `WSGAb5XwJ3Y`, stage `WZbXY0S00lP`, and event `Evahwp3zrQ4`.
