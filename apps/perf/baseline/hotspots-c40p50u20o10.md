# Where the main thread's time goes: 40 columns, 50 rows, 20 rules, 10 options

Sampled with the processor slowed 1×. Sampling itself slows the page, so read the shares, not the times.

## load

The browser counted 623 ms of main thread work: 402 ms running script, 82 ms on style and layout, 140 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 966 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                  |    ms | Share |
| -------------------------------------- | ----: | ----: |
| @dhis2/rule-engine                     | 295.4 |   31% |
| (program)                              | 232.9 |   24% |
| react-dom                              |  84.3 |    9% |
| @tanstack/virtual-core                 |  67.1 |    7% |
| (garbage collector)                    |  43.8 |    5% |
| i18next                                |  23.4 |    2% |
| DOM calls from script                  |  19.1 |    2% |
| lodash                                 |  16.9 |    2% |
| @dhis2/multi-calendar-dates            |    15 |    2% |
| blocks/dhis2-value-types/valueTypes.ts |  13.1 |    1% |
| tailwind-merge                         |    13 |    1% |
| zustand                                |    13 |    1% |

| Function                                                                      |    ms | Share |
| ----------------------------------------------------------------------------- | ----: | ----: |
| `(program)`                                                                   | 232.9 |   24% |
| `F9 (@tanstack/virtual-core index.js:131)`                                    |  63.9 |    7% |
| `(garbage collector)`                                                         |  43.8 |    5% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`                       |    33 |    3% |
| `J (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1795)`                        |  13.2 |    1% |
| `Cy (lodash lodash.js:3451)`                                                  |  13.1 |    1% |
| `s.tq (@dhis2/rule-engine Kotlin-DateTime-library-kotlinx-datetime.mjs:3372)` |  12.3 |    1% |
| `Ln (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1654)`                       |  12.2 |    1% |
| `s.z1e (@dhis2/rule-engine expression-parser.mjs:3291)`                       |  12.1 |    1% |
| `s3 (blocks/dhis2-value-types/valueTypes.ts:299)`                             |  11.9 |    1% |
| `s.q3 (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3465)`                     |  11.2 |    1% |
| `sz (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3635)`                       |  10.5 |    1% |

## edit

The browser counted 361 ms of main thread work: 92 ms running script, 32 ms on style and layout, 237 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 701 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |   ms | Share |
| -------------------------------------------------- | ---: | ----: |
| (program)                                          |  439 |   63% |
| DOM calls from script                              | 62.6 |    9% |
| (garbage collector)                                | 50.8 |    7% |
| @dhis2/rule-engine                                 | 41.3 |    6% |
| react-dom                                          | 14.4 |    2% |
| the benchmark itself                               | 14.2 |    2% |
| blocks/tracker-data-entry/provider/connectRules.ts | 13.9 |    2% |
| i18next                                            | 11.7 |    2% |
| zustand                                            |  7.9 |    1% |
| blocks/tracker-data-entry/logic/summary.ts         |    7 |    1% |
| blocks/spreadsheet/cells/Cell.tsx                  |  5.3 |    1% |
| blocks/tracker-data-entry/logic/ruleEffects.ts     |  5.3 |    1% |

| Function                                                    |   ms | Share |
| ----------------------------------------------------------- | ---: | ----: |
| `(program)`                                                 |  439 |   63% |
| `(garbage collector)`                                       | 50.8 |    7% |
| `focus (DOM)`                                               |   37 |    5% |
| `Ks (i18next utils.js:82)`                                  |  9.3 |    1% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:504)` |  7.7 |    1% |
| `transaction (DOM)`                                         |    7 |    1% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`        |    7 |    1% |
| `DS (blocks/spreadsheet/cells/Cell.tsx:53)`                 |  5.3 |    1% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`     |  5.2 |    1% |
| `query (benchmark)`                                         |  5.2 |    1% |
| ` (zustand shallow.mjs:6)`                                  |  5.1 |    1% |
| `s.g21 (@dhis2/rule-engine rule-engine.mjs:2801)`           |    5 |    1% |

## navigate

The browser counted 303 ms of main thread work: 38 ms running script, 43 ms on style and layout, 222 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 824 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                   |    ms | Share |
| --------------------------------------- | ----: | ----: |
| (program)                               | 627.7 |   76% |
| DOM calls from script                   | 126.6 |   15% |
| react-dom                               |  26.6 |    3% |
| (garbage collector)                     |  13.7 |    2% |
| @tanstack/virtual-core                  |   8.7 |    1% |
| blocks/spreadsheet/grid/TableRow.tsx    |   5.9 |    1% |
| tailwind-merge                          |   3.1 |    0% |
| blocks/spreadsheet/cells/useCellMode.ts |   2.7 |    0% |
| @tanstack/react-virtual                 |   2.2 |    0% |
| react                                   |   1.8 |    0% |
| blocks/spreadsheet/cells/CellStatus.tsx |   0.8 |    0% |
| zustand                                 |   0.6 |    0% |

| Function                                                        |    ms | Share |
| --------------------------------------------------------------- | ----: | ----: |
| `(program)`                                                     | 627.7 |   76% |
| `focus (DOM)`                                                   | 112.9 |   14% |
| `(garbage collector)`                                           |  13.7 |    2% |
| `Tv (react-dom react-dom.production.min.js:160)`                |   5.6 |    1% |
| ` (blocks/spreadsheet/grid/TableRow.tsx:61)`                    |   5.6 |    1% |
| `set value (DOM)`                                               |   4.3 |    1% |
| `i (@tanstack/virtual-core utils.js:5)`                         |   4.3 |    1% |
| `createElement (DOM)`                                           |   3.9 |    0% |
| `U9._classifyScrollEvent (@tanstack/virtual-core index.js:607)` |   3.8 |    0% |
| ` (react-dom react-dom.production.min.js:109)`                  |   3.2 |    0% |
| `get (tailwind-merge bundle-mjs.mjs:204)`                       |   3.1 |    0% |
| ` (blocks/spreadsheet/cells/useCellMode.ts:72)`                 |   2.7 |    0% |

## option

The browser counted 92 ms of main thread work: 25 ms running script, 8 ms on style and layout, 59 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 365 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |    ms | Share |
| -------------------------------------------------- | ----: | ----: |
| (program)                                          | 275.5 |   75% |
| DOM calls from script                              |  44.2 |   12% |
| the benchmark itself                               |  13.5 |    4% |
| (garbage collector)                                |   7.4 |    2% |
| zustand                                            |   6.6 |    2% |
| blocks/tracker-data-entry/provider/connectRules.ts |   6.6 |    2% |
| react-dom                                          |   4.8 |    1% |
| blocks/spreadsheet/provider/context.ts             |   0.9 |    0% |
| @dhis2/rule-engine                                 |   0.7 |    0% |
| blocks/tracker-data-entry/sources/trackerSave.ts   |   0.6 |    0% |
| blocks/tracker-data-entry/logic/ruleEffects.ts     |   0.6 |    0% |
| blocks/tracker-data-entry/logic/summary.ts         |   0.6 |    0% |

| Function                                                    |    ms | Share |
| ----------------------------------------------------------- | ----: | ----: |
| `(program)`                                                 | 275.5 |   75% |
| ` (benchmark)`                                              |  13.5 |    4% |
| `elementsFromPoint (DOM)`                                   |  13.1 |    4% |
| `URL (DOM)`                                                 |  10.1 |    3% |
| `removeChild (DOM)`                                         |   8.1 |    2% |
| `elementFromPoint (DOM)`                                    |   7.6 |    2% |
| `(garbage collector)`                                       |   7.4 |    2% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:504)` |   6.6 |    2% |
| `By (zustand shallow.mjs:6)`                                |     6 |    2% |
| `set value (DOM)`                                           |   1.6 |    0% |
| `focus (DOM)`                                               |   1.5 |    0% |
| `select (DOM)`                                              |   1.2 |    0% |

## paste

The browser counted 156 ms of main thread work: 79 ms running script, 13 ms on style and layout, 64 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 549 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |    ms | Share |
| -------------------------------------------------- | ----: | ----: |
| (program)                                          | 326.1 |   59% |
| @dhis2/rule-engine                                 |  86.7 |   16% |
| DOM calls from script                              |  36.8 |    7% |
| react-dom                                          |  31.9 |    6% |
| (garbage collector)                                |  17.2 |    3% |
| blocks/tracker-data-entry/provider/connectRules.ts |   7.9 |    1% |
| blocks/dhis2-value-types/valueTypes.ts             |     6 |    1% |
| zod                                                |   5.9 |    1% |
| tailwind-merge                                     |   5.1 |    1% |
| i18next                                            |   4.5 |    1% |
| blocks/tracker-data-entry/logic/summary.ts         |   4.4 |    1% |
| react                                              |   3.2 |    1% |

| Function                                                |    ms | Share |
| ------------------------------------------------------- | ----: | ----: |
| `(program)`                                             | 326.1 |   59% |
| `focus (DOM)`                                           |    20 |    4% |
| `(garbage collector)`                                   |  17.2 |    3% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)` |  14.7 |    3% |
| `P (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:2367)`  |    13 |    2% |
| `lg (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3689)` |  12.2 |    2% |
| `Tv (react-dom react-dom.production.min.js:160)`        |  11.5 |    2% |
| `xm (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3194)` |     6 |    1% |
| ` (blocks/dhis2-value-types/valueTypes.ts:420)`         |   5.7 |    1% |
| `N1 (zod errors.js:4)`                                  |   5.3 |    1% |
| `get (tailwind-merge bundle-mjs.mjs:204)`               |   5.1 |    1% |
| `Wr (react-dom react-dom.production.min.js:251)`        |   4.7 |    1% |

## addRow

The browser counted 195 ms of main thread work: 91 ms running script, 28 ms on style and layout, 76 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 533 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                      |    ms | Share |
| ------------------------------------------ | ----: | ----: |
| (program)                                  | 289.6 |   54% |
| react-dom                                  |  86.4 |   16% |
| (garbage collector)                        |  43.4 |    8% |
| DOM calls from script                      |  42.2 |    8% |
| react                                      |  14.2 |    3% |
| i18next                                    |   9.5 |    2% |
| blocks/spreadsheet/cells/Cell.tsx          |   8.6 |    2% |
| @tanstack/virtual-core                     |     7 |    1% |
| blocks/spreadsheet/cells/TextCell.tsx      |   3.6 |    1% |
| blocks/spreadsheet/grid/BulkMenu.tsx       |   3.5 |    1% |
| @dhis2/rule-engine                         |   2.3 |    0% |
| blocks/tracker-data-entry/logic/summary.ts |   2.2 |    0% |

| Function                                              |    ms | Share |
| ----------------------------------------------------- | ----: | ----: |
| `(program)`                                           | 289.6 |   54% |
| `(garbage collector)`                                 |  43.4 |    8% |
| `Hb (react react-jsx-runtime.production.min.js:11)`   |  14.2 |    3% |
| `G2 (react-dom react-dom.production.min.js:219)`      |  12.3 |    2% |
| `focus (DOM)`                                         |  11.8 |    2% |
| `FA (react-dom react-dom.production.min.js:224)`      |   8.9 |    2% |
| `removeChild (DOM)`                                   |   8.3 |    2% |
| `t.getResource (i18next ResourceStore.js:42)`         |     7 |    1% |
| `F9 (@tanstack/virtual-core index.js:131)`            |   6.4 |    1% |
| `useMemo (react-dom react-dom.production.min.js:177)` |   6.1 |    1% |
| `Og (react-dom react-dom.production.min.js:37)`       |     6 |    1% |
| `ql (react-dom react-dom.production.min.js:243)`      |   5.7 |    1% |

## scrollDown

The browser counted 850 ms of main thread work: 157 ms running script, 125 ms on style and layout, 568 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 1546 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                                  |     ms | Share |
| ------------------------------------------------------ | -----: | ----: |
| (program)                                              | 1067.6 |   69% |
| the benchmark itself                                   |  207.5 |   13% |
| react-dom                                              |  144.8 |    9% |
| DOM calls from script                                  |   47.1 |    3% |
| (garbage collector)                                    |   15.4 |    1% |
| react                                                  |     11 |    1% |
| @tanstack/virtual-core                                 |    8.9 |    1% |
| blocks/spreadsheet/cells/useCellMode.ts                |    5.8 |    0% |
| tailwind-merge                                         |    5.1 |    0% |
| blocks/tracker-data-entry/provider/TrackerRowLabel.tsx |    4.2 |    0% |
| i18next                                                |    3.2 |    0% |
| blocks/spreadsheet/grid/TableBody.tsx                  |    2.8 |    0% |

| Function                                            |     ms | Share |
| --------------------------------------------------- | -----: | ----: |
| `(program)`                                         | 1067.6 |   69% |
| `tick (benchmark)`                                  |    204 |   13% |
| `FA (react-dom react-dom.production.min.js:224)`    |   32.5 |    2% |
| `(garbage collector)`                               |   15.4 |    1% |
| `Og (react-dom react-dom.production.min.js:37)`     |   13.8 |    1% |
| `Hb (react react-jsx-runtime.production.min.js:11)` |   10.7 |    1% |
| `set value (DOM)`                                   |   10.6 |    1% |
| `ql (react-dom react-dom.production.min.js:243)`    |   10.4 |    1% |
| `setAttribute (DOM)`                                |    9.7 |    1% |
| `oS (react-dom react-dom.production.min.js:280)`    |    9.4 |    1% |
| `appendChild (DOM)`                                 |    8.4 |    1% |
| `q2 (react-dom react-dom.production.min.js:218)`    |    7.9 |    1% |

## scrollAcross

The browser counted 197 ms of main thread work: 40 ms running script, 21 ms on style and layout, 137 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 698 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                    |    ms | Share |
| ---------------------------------------- | ----: | ----: |
| (program)                                | 581.8 |   83% |
| react-dom                                |  75.6 |   11% |
| DOM calls from script                    |  25.8 |    4% |
| tailwind-merge                           |   3.2 |    0% |
| react                                    |   2.6 |    0% |
| blocks/spreadsheet/cells/Cell.tsx        |   1.6 |    0% |
| the benchmark itself                     |   1.5 |    0% |
| blocks/spreadsheet/cells/OptionCell.tsx  |   0.9 |    0% |
| @tanstack/virtual-core                   |   0.9 |    0% |
| blocks/spreadsheet/cells/serverSearch.ts |   0.6 |    0% |
| blocks/spreadsheet/cells/CellStatus.tsx  |   0.6 |    0% |
| blocks/spreadsheet/cells/TextCell.tsx    |   0.6 |    0% |

| Function                                         |    ms | Share |
| ------------------------------------------------ | ----: | ----: |
| `(program)`                                      | 581.8 |   83% |
| `J2 (react-dom react-dom.production.min.js:252)` |  13.4 |    2% |
| `oS (react-dom react-dom.production.min.js:280)` |  10.5 |    2% |
| `nv (react-dom react-dom.production.min.js:24)`  |   9.9 |    1% |
| `set value (DOM)`                                |   8.8 |    1% |
| `FA (react-dom react-dom.production.min.js:224)` |   4.9 |    1% |
| `t (react-dom react-dom.production.min.js:79)`   |   4.3 |    1% |
| `setAttribute (DOM)`                             |   4.3 |    1% |
| `Gw (react-dom react-dom.production.min.js:193)` |   3.9 |    1% |
| `Ss (react-dom react-dom.production.min.js:55)`  |   3.3 |    0% |
| `Rd (react-dom react-dom.production.min.js:243)` |   3.3 |    0% |
| `get (tailwind-merge bundle-mjs.mjs:204)`        |   3.2 |    0% |

## showMore

The browser counted 314 ms of main thread work: 205 ms running script, 13 ms on style and layout, 96 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 1140 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                      |    ms | Share |
| ------------------------------------------ | ----: | ----: |
| @dhis2/rule-engine                         | 374.6 |   33% |
| (program)                                  | 356.5 |   31% |
| (garbage collector)                        |  93.6 |    8% |
| react-dom                                  |    90 |    8% |
| the benchmark itself                       |  39.5 |    3% |
| i18next                                    |  28.5 |    3% |
| @tanstack/virtual-core                     |  23.9 |    2% |
| blocks/tracker-data-entry/model/types.ts   |  14.8 |    1% |
| blocks/tracker-data-entry/logic/summary.ts |  14.6 |    1% |
| DOM calls from script                      |  13.2 |    1% |
| react                                      |  13.1 |    1% |
| zustand                                    |  12.3 |    1% |

| Function                                                |    ms | Share |
| ------------------------------------------------------- | ----: | ----: |
| `(program)`                                             | 356.5 |   31% |
| `(garbage collector)`                                   |  93.6 |    8% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)` |  38.9 |    3% |
| `Og (react-dom react-dom.production.min.js:37)`         |  28.2 |    2% |
| `F9 (@tanstack/virtual-core index.js:131)`              |  23.6 |    2% |
| ` (@dhis2/rule-engine expression-parser.mjs:2584)`      |  21.6 |    2% |
| `cg (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3742)` |  16.1 |    1% |
| `FA (react-dom react-dom.production.min.js:224)`        |  14.3 |    1% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`    |  14.3 |    1% |
| `ct (blocks/tracker-data-entry/model/types.ts:6)`       |  13.2 |    1% |
| `aS (react-dom react-dom.production.min.js:289)`        |  13.1 |    1% |
| `Hb (react react-jsx-runtime.production.min.js:11)`     |  12.8 |    1% |
