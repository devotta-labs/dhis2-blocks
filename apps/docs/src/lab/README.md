# Labs

A lab is a page of its own on the docs dev server where a block runs against
a fake DHIS2. You choose what the server answers, how slowly, and whether it
fails or never answers, and watch every request the block makes. Labs are
linked from nowhere and left out of the docs build.

```sh
pnpm lab:example    # the smallest lab, to copy
pnpm lab:calendar   # the working list calendar, every prop and kind of data
pnpm lab:observations # observation cards, every card state one click away
```

## Start a lab

1. Copy `example/` to `src/lab/<block>/` and rename `ExampleLab`.
2. Copy `example-lab.html` (next to the docs `index.html`) to
   `<block>-lab.html`, and point its script at `/src/lab/<block>/main.tsx`.
3. Add a root script: `"lab:<block>": "pnpm --filter @dhis2-blocks/docs run dev --open /<block>-lab.html"`.
4. Replace `Subject` with the block's parts, `RESOURCES` with every resource
   the block asks for, and `answer` with the server.

Knip already treats `src/lab/*/main.tsx` as an entry and Vitest already runs
`src/lab/**/*.test.ts`, so a new lab needs no other config.

## Shared parts

| Part                         | What it does                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LabLayout`                  | The page: a sidebar of the lab's controls, the block on its scope, a status line above it, an optional panel below.                                                                       |
| `LabServerScope`             | app-runtime and TanStack Query with every listed resource answered by `respond`, through the lab network. `systemInfo` sets `useConfig().systemInfo`; change its `key` for a fresh cache. |
| `CanvasBoundary`             | Catches a crash in the block and shows it, so the lab's controls keep working. Give it the same `key` as the scope.                                                                       |
| `NetworkControls`            | A default delay, then each resource's delay and whether it answers, fails with a 500 or hangs.                                                                                            |
| `RequestWaterfall`           | Every request on a timeline, with its outcome. Feed it the log that `LabServerScope` writes.                                                                                              |
| `throughNetwork` (`network`) | What `LabServerScope` uses: waits, fails or hangs as the endpoint says, then answers and logs. Use it directly only for requests outside app-runtime.                                     |
| `controls`                   | The sidebar's rows: `Section`, `Check`, `NumberRow`, `SelectRow`, `Segmented`, and `PresetControls` for a lab's named presets.                                                            |
| `lab.css`                    | The lab's own look (`--lab-*` tokens). `LabLayout` loads it; it never styles the block under test.                                                                                        |

## Writing the server

- Answer with JSON shaped like DHIS2's response for that resource and API
  version. Blocks parse responses at their boundary, so a wrong shape shows up
  as the block's own error, which is worth seeing too.
- Keep the server a plain function of the lab's settings and the request, in
  its own file, so it can have a Vitest test (`<block>/labServer.test.ts`).
- Generate data from settings (counts, spread, bad values) rather than writing
  fixtures by hand, and keep named presets of those settings for the cases
  worth showing; the calendar lab's `labData.ts` and `presets.ts` do this.
- Read the requests in the waterfall: a lab is the cheapest place to see a
  waterfall, a duplicate request or a missing abort.

## Live DHIS2

A lab can also run the block against a real instance through
`LivePreviewHost`, the same sign-in proxy the live examples use. The calendar
lab switches between lab data and live DHIS2 in its sidebar.
