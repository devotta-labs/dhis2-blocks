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
page's alone. Run one profile at a time on an otherwise idle machine; the first run is a warm-up and is not counted.

#### Stolen processor time

On a virtual machine the hypervisor takes processor time away for its other guests, and every time measured
while it does is longer: on the machine behind the baseline a fixed loop took between 1.05 and 2.25 s. So on Linux
the benchmark keeps one processor for the page's main thread alone (`bench/processor.mts`), reads what was stolen
from that processor off `/proc/stat`, and takes it out:

- a time that spans waiting on the network (the load's milestones, "Show more") loses the milliseconds stolen in
  its own stretch;
- main thread time loses the share stolen during its part of the run;
- a time the display paces (a frame, or from a key to the frame after it) loses that share too, but does not go
  below one frame (16.7 ms), and one shorter than a frame is left as it is.

Each part records the share it lost (`load.stolenShare`, `edit.stolenShare`, …, and `run.stolenShare` for the
whole run). The fixed loop, corrected so, came to between 0.99 and 1.15 s. What is left shows in the report: the
base form is measured again on every axis, and its medians differ by up to a quarter (its first table), so a
smaller difference is not one. A run that lost more than `--stolen 0.35` is measured again, up to twice the runs asked for, and the runs
that lost least are kept. Elsewhere than Linux nothing is corrected and the shares are zero.

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

[`BASELINE.md`](./BASELINE.md) is the grid before any work on its performance. `baseline/` holds every run behind
it, and a `hotspots-*.md` for the base form, each axis' largest form and the large form. Run the benchmark on the
same machine before comparing with it: the numbers are only comparable with others from the same hardware.

What it shows, on the low-end profile:

- **The app's code is the floor.** 639 kB of compressed script puts first paint at 2.2 s and the grid's first
  request at 3.4 s whatever the form.
- **Rules are the largest cost of loading.** The rule engine is 31% of the base form's load, 50% with 200 rules.
  The rows on screen get their effects first (6–7 s whatever the row count), but the rest run in the background and
  keep the main thread busy: 2.4 s of work for 10 rows, 19.4 s for 500. "Show more" pays the same: 0.9 s for 10 rows, 5.8 s for 500,
  3.9 s with 200 rules.
- **Columns are not virtualised.** DOM nodes grow with them (2,171 at 10 columns, 21,470 at 160), and so do the
  longest task of the load (0.3 to 1.8 s), a scrolled frame (25 to 147 ms), adding a row (0.4 to 2.6 s) and the
  renderer's memory (191 to 251 MB). Moving the cursor and scrolling are mostly the browser's own style, layout
  and paint over that DOM.
- **An edit walks every loaded cell.** From Enter to the rules' effects takes 138 ms with 10 rows and 481 ms with
  500, though one row changed: `summarise` (`logic/summary.ts`), the rules' store subscriber
  (`provider/connectRules.ts`) and the copy of the cell map on write (`spreadsheet/store/store.ts`) each go over
  all of them.
- **Option sets cost nothing** up to 1,000 options.
- **Memory is the browser's more than the grid's.** The smallest form's renderer process is 191 MB (114 MB as
  PSS) and the large form's 265 MB, 337 MB after use; the JS heap is 13–40 MB.

Not measured: a real DHIS2 server's response times, a real low-end device (the profile slows the processor but
has the host's memory and GPU), and the enrolment and register sources.
