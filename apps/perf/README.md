# Blocks performance

A DHIS2 app that renders the tracker data entry grid (`tracker-data-entry` on `spreadsheet`, with `program-rules`),
and a benchmark that measures it in a real browser against a generated DHIS2. It exists to answer how the grid
behaves on slow machines and how that changes with the size of the form.

## The app

`src/App.tsx` opens one program's events at one organisation unit:

```
/?program=<program id>&orgUnit=<organisation unit id>&pageSize=50
```

It is an ordinary DHIS2 app, so `pnpm --filter @dhis2-blocks/perf start` runs it against any DHIS2 instance.

## The generated DHIS2

`bench/serve.mts` serves the built app and the DHIS2 endpoints it reads. Nothing is recorded: the program id names
the form, and the server makes its metadata and events from that name, the same every time.

```
c40r100u20o10   40 data elements, 100 events, 20 program rules, 10 options in each option set
```

The data elements cycle through the value types (integer, text, option, boolean, date, number, true only, long
text, positive integer), and the rules through warning, hide field, assign, mandatory and error.

```sh
pnpm --filter @dhis2-blocks/perf build
pnpm --filter @dhis2-blocks/perf serve
# http://localhost:8787/apps/blocks-perf/?program=c40r100u20o10&orgUnit=PerfOrgUnit
```

## The benchmark

```sh
pnpm exec playwright install chromium
pnpm --filter @dhis2-blocks/perf build
pnpm --filter @dhis2-blocks/perf bench --profile desktop
pnpm --filter @dhis2-blocks/perf bench --profile low-end
pnpm --filter @dhis2-blocks/perf report results BASELINE.md
```

`bench` takes `--runs 3`, `--axis columns,rows,rules,options,large` and `--out results`. It measures the
production build, and starts a browser for every run so that nothing is cached and the renderer's memory is that
page's alone. Run one profile at a time on an otherwise idle machine.

On a virtual machine the hypervisor takes processor time away for its other guests, and every time measured
while it does is longer. Each run records the share it lost (`run.stolenShare`, from `/proc/stat`), a run that
lost more than `--stolen 0.15` is measured again, up to three times the runs asked for, and the runs that lost
least are kept. The report shows the share beside the numbers: compare only runs that lost about as little.

| Profile   | Processor | Network                                             |
| --------- | --------- | --------------------------------------------------- |
| `desktop` | as it is  | as it is (localhost)                                |
| `low-end` | 6× slower | 1.6 Mbit/s down, 750 kbit/s up, 150 ms each request |

Each axis changes one size and keeps the others at the base form: 40 columns, 50 rows on a page, 20 rules,
10 options. `large` is 120 columns, 200 rows, 100 rules and 500 options together.

### What a run does

It loads the grid, then uses it as a person entering data does. Every time is in milliseconds.

| Number                                | What it is                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `load.firstPaintMs`                   | First contentful paint                                                                                      |
| `load.gridMountedMs`                  | The DHIS2 shell is up and the grid starts loading (start of the block's `data-entry:ready` measure)         |
| `load.gridReadyMs`                    | Metadata and events are in and the grid can be drawn (end of `data-entry:ready`)                            |
| `load.rulesFirstSliceMs`              | The rules' first run, over the rows on screen (`data-entry:rules`)                                          |
| `load.rulesVisibleMs`                 | The rules' effects are on screen (end of `data-entry:rules-visible`)                                        |
| `load.settledMs`                      | Nothing is on its way and the main thread has gone idle                                                     |
| `load.blockedMs`, `longestTaskMs`     | Total blocking time (the part of each task over 50 ms) and the longest task                                 |
| `load.taskMs`, `scriptMs`, `layoutMs` | Main thread time in all, in script, and in style and layout, as the browser counts it. This is the CPU cost |
| `load.*Kb`, `requests`, `apiRequests` | What was sent, compressed                                                                                   |
| `memoryLoaded.*`, `memoryUsed.*`      | After a forced collection: JS heap, the renderer process' RSS and PSS (Linux), DOM nodes, event listeners   |
| `edit.selectMs`, `keyMs`, `commitMs`  | Click a cell, type a character, press Enter: from the event to the next frame drawn                         |
| `edit.rulesMs`, `rulesShownMs`        | The rules' run after an edit (`data-entry:rules-edit`), and from Enter to the frame showing what they did   |
| `edit.taskMs`                         | Main thread time of one whole edit                                                                          |
| `navigate.*`                          | Arrow keys: median and worst, down 20 rows and right 8 columns                                              |
| `option.*`                            | Open an option cell's list, move in it, pick                                                                |
| `paste.*`                             | Paste 10 rows × 10 columns: to the next frame, the rules' time, and to the frame showing what they did      |
| `addRow.paintMs`                      | Ctrl+Enter to the new row drawn                                                                             |
| `scrollDown.*`, `scrollAcross.*`      | 90 frames of scrolling: median and 95th percentile frame, and the share of frames over 20 ms                |
| `showMore.*`                          | "Show more events": to the new rows drawn, and to idle                                                      |

The times the page reports about itself come from a script added before the page's own (`bench/page.mts`); it
only observes. Processor time, heap and DOM counts are read from the browser over the DevTools protocol, so
reading them costs the page nothing.

### Where the time goes

```sh
pnpm --filter @dhis2-blocks/perf hotspots --columns 40 --pageSize 200 --rules 100
```

runs one grid with the browser's sampling profiler on and writes, for each part of the run, the packages,
registry files and functions the main thread spent longest in (through the build's source maps), and a
`.cpuprofile` for the browser's Performance panel. Sampling slows the page: use it for where, not for how long.

## The baseline

[`BASELINE.md`](./BASELINE.md) is the grid before any work on its performance, and `baseline/` holds every run
behind it. Run the benchmark on the same machine before comparing with it: the numbers are only comparable with
others from the same hardware.
