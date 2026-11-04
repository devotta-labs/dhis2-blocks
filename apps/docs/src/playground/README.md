# Playground

The playground is a page of the docs, `/playground/<block>`, where a block
runs against a fake DHIS2. You choose what the server answers, how slowly, and
whether it fails or never answers, and watch every request the block makes.
The picker at the top of the Settings sidebar switches blocks, and the header's
Playground link opens the first one. It runs with the docs:

```sh
pnpm dev:docs   # then open /playground
```

Each block's page is a **lab**: its own controls, presets and fake server on
the shared parts below. A lab is loaded only when its page opens. The working
list's page shows its records as a table or on a calendar, a block setting in
its own Display section (`?display=calendar`); each display is a lab of its own.

## Add a block

1. Copy `observation-cards/` to `src/playground/<block>/` (the smallest lab)
   and rename `ObservationsLab`.
2. Add the block to `PLAYGROUND_BLOCKS` in `blocks.ts`, with the slug of its
   docs page (`/blocks/<slug>`), and its lab to `LABS` in `PlaygroundPage.tsx`.
   The picker reads `PLAYGROUND_BLOCKS`.
3. Replace the canvas with the block's parts, `RESOURCES` with every resource
   the block asks for, and `answer` with the server.
4. Give it presets, shown as Examples: named settings for the handful of
   cases worth showing, grouped. Keep the sidebar small: the examples, a few
   plain options, the network and the canvas.
   `usePresetParam` keeps the chosen one in the URL (`?preset=`), so a link
   opens the same case.
5. Keep the lab's state in its own reducer, `labState.ts`, tested in
   `__tests__/labState.test.ts`: the mode, preset, settings, live ids, run
   count and logs, and which changes restart the block. The lab component only
   dispatches, so nothing about the state needs a browser to test. A reload
   opens on the URL's preset or the first; nothing else is kept.

Tests live in a `__tests__/` folder beside the code they test. Vitest already
runs `src/playground/**/*.test.ts`, so a new lab needs no other config.

## Shared parts

| Part                         | What it does                                                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LabLayout`                  | The page: a Settings sidebar of the block picker over the lab's controls, the block on its canvas, an optional panel below, folded until opened. On a phone the controls fold away above the block. |
| `LabServerScope`             | app-runtime and TanStack Query with every listed resource answered by `respond`, through the lab network. `systemInfo` sets `useConfig().systemInfo`; change its `key` for a fresh cache.           |
| `CanvasBoundary`             | Catches a crash in the block and shows it, so the lab's controls keep working. Give it the same `key` as the scope.                                                                                 |
| `NetworkControls`            | One choice for the network: normal, slow, or the block's record requests failing with a 500 or never answering.                                                                                     |
| `LogPanel`                   | The bottom panel: the block's callbacks when it has any, then each request and their `RequestWaterfall`. Feed it the log that `LabServerScope` writes.                                              |
| `usePresetParam`             | The lab's preset in the URL: read once to open on it, written whenever the preset changes.                                                                                                          |
| `throughNetwork` (`network`) | What `LabServerScope` uses: waits, fails or hangs as the endpoint says, then answers and logs. Use it directly only for requests outside app-runtime.                                               |
| `controls`                   | The sidebar's rows: `Section`, `Check`, `NumberRow`, `SelectRow`, `Segmented`, and `PresetControls` for a lab's examples.                                                                           |
| `lab.css`                    | The lab's own look (`--lab-*` tokens), dark with the docs' theme. `LabLayout` loads it; it never styles the block under test.                                                                       |

## Writing the server

- Answer with JSON shaped like DHIS2's response for that resource and API
  version. Blocks parse responses at their boundary, so a wrong shape shows up
  as the block's own error, which is worth seeing too.
- Keep the server a plain function of the lab's settings and the request, in
  its own file, so it can have a Vitest test (`<block>/__tests__/labServer.test.ts`).
- Generate data from settings (counts, spread, bad values, dates around
  today) rather than writing fixtures, and keep named presets of those
  settings for the cases worth showing; each lab's `labData.ts` and
  `presets.ts` do this.
- A block that writes gets the request's type (`create`, `update`, `replace`,
  `delete`) as `respond`'s second argument, and the log shows it. Keep what it
  writes until the next run, as `working-list/table/savedViews.ts` does for saved
  views, so the block's refresh after a write finds it.
- Read the requests in the waterfall: a lab is the cheapest place to see a
  waterfall, a duplicate request or a missing abort.

## Live DHIS2

A lab can also run the block against a real instance through
`LivePreviewHost`, the same sign-in proxy the live examples use, on the dev
server and on the published docs. Each lab switches between lab data and live
DHIS2 in its sidebar, with default ids that exist on the docs' instance.
