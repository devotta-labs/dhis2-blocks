# Where the main thread's time goes: 160 columns, 50 rows, 20 rules, 10 options

Sampled with the processor slowed 1×. Sampling itself slows the page, so read the shares, not the times.

## load

The browser counted 1150 ms of main thread work: 684 ms running script, 200 ms on style and layout, 266 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 2548 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |    ms | Share |
| -------------------------------------------------- | ----: | ----: |
| (program)                                          | 603.9 |   24% |
| @dhis2/rule-engine                                 |   412 |   16% |
| react-dom                                          | 392.4 |   15% |
| @tanstack/virtual-core                             | 346.8 |   14% |
| (garbage collector)                                | 203.4 |    8% |
| blocks/tracker-data-entry/logic/summary.ts         |  91.1 |    4% |
| DOM calls from script                              |  56.5 |    2% |
| i18next                                            |  40.5 |    2% |
| zustand                                            |  31.9 |    1% |
| blocks/tracker-data-entry/provider/connectRules.ts |    30 |    1% |
| @dhis2/multi-calendar-dates                        |  24.9 |    1% |
| zod                                                |  24.6 |    1% |

| Function                                                     |    ms | Share |
| ------------------------------------------------------------ | ----: | ----: |
| `(program)`                                                  | 603.9 |   24% |
| `F9 (@tanstack/virtual-core index.js:131)`                   | 325.6 |   13% |
| `(garbage collector)`                                        | 203.4 |    8% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`         |  84.6 |    3% |
| `FA (react-dom react-dom.production.min.js:224)`             |  41.7 |    2% |
| `nv (react-dom react-dom.production.min.js:24)`              |  37.3 |    1% |
| `set (react-dom react-dom.production.min.js:35)`             |  34.6 |    1% |
| `Tv (react-dom react-dom.production.min.js:160)`             |  33.9 |    1% |
| `T (blocks/tracker-data-entry/provider/connectRules.ts:157)` |  27.1 |    1% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`      |  24.2 |    1% |
| ` (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:2)`           |  21.3 |    1% |
| `xz (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:4668)`      |    21 |    1% |

## edit

The browser counted 888 ms of main thread work: 223 ms running script, 90 ms on style and layout, 575 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 2311 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |     ms | Share |
| -------------------------------------------------- | -----: | ----: |
| (program)                                          | 1388.1 |   60% |
| DOM calls from script                              |  226.5 |   10% |
| blocks/tracker-data-entry/provider/connectRules.ts |  131.5 |    6% |
| (garbage collector)                                |  118.2 |    5% |
| blocks/tracker-data-entry/logic/summary.ts         |   81.6 |    4% |
| the benchmark itself                               |   79.1 |    3% |
| @dhis2/rule-engine                                 |   51.1 |    2% |
| react-dom                                          |   43.1 |    2% |
| blocks/tracker-data-entry/logic/ruleEffects.ts     |   42.6 |    2% |
| blocks/spreadsheet/store/store.ts                  |     40 |    2% |
| i18next                                            |   23.5 |    1% |
| zustand                                            |   23.5 |    1% |

| Function                                                    |     ms | Share |
| ----------------------------------------------------------- | -----: | ----: |
| `(program)`                                                 | 1388.1 |   60% |
| `(garbage collector)`                                       |  118.2 |    5% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`        |   81.6 |    4% |
| `elementFromPoint (DOM)`                                    |   74.1 |    3% |
| `query (benchmark)`                                         |   67.3 |    3% |
| `focus (DOM)`                                               |   66.7 |    3% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:504)` |   65.9 |    3% |
| `elementsFromPoint (DOM)`                                   |     64 |    3% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:505)` |   56.3 |    2% |
| `T (blocks/spreadsheet/store/store.ts:187)`                 |   32.7 |    1% |
| ` (blocks/tracker-data-entry/logic/ruleEffects.ts:282)`     |   20.9 |    1% |
| `i (blocks/tracker-data-entry/logic/ruleEffects.ts:289)`    |   20.8 |    1% |

## navigate

The browser counted 692 ms of main thread work: 123 ms running script, 123 ms on style and layout, 446 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 1470 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                  |    ms | Share |
| -------------------------------------- | ----: | ----: |
| (program)                              |  1006 |   68% |
| DOM calls from script                  | 313.4 |   21% |
| react-dom                              |  74.5 |    5% |
| (garbage collector)                    |  25.9 |    2% |
| the benchmark itself                   |   7.9 |    1% |
| @tanstack/virtual-core                 |   7.7 |    1% |
| i18next                                |     5 |    0% |
| blocks/spreadsheet/cells/TextCell.tsx  |   4.1 |    0% |
| react                                  |   3.4 |    0% |
| blocks/spreadsheet/cells/Cell.tsx      |   2.9 |    0% |
| @base-ui/utils                         |   2.9 |    0% |
| blocks/spreadsheet/provider/context.ts |   2.8 |    0% |

| Function                                         |    ms | Share |
| ------------------------------------------------ | ----: | ----: |
| `(program)`                                      |  1006 |   68% |
| `focus (DOM)`                                    | 261.5 |   18% |
| `(garbage collector)`                            |  25.9 |    2% |
| `set value (DOM)`                                |  12.7 |    1% |
| `aw (react-dom react-dom.production.min.js:39)`  |  12.5 |    1% |
| `FA (react-dom react-dom.production.min.js:224)` |  11.3 |    1% |
| `elementsFromPoint (DOM)`                        |    10 |    1% |
| `elementFromPoint (DOM)`                         |   9.3 |    1% |
| `setAttribute (DOM)`                             |   8.7 |    1% |
| ` (benchmark)`                                   |   7.9 |    1% |
| `Mv (react-dom react-dom.production.min.js:273)` |   5.5 |    0% |
| `Og (react-dom react-dom.production.min.js:37)`  |   5.1 |    0% |

## option

The browser counted 196 ms of main thread work: 58 ms running script, 23 ms on style and layout, 115 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 545 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |    ms | Share |
| -------------------------------------------------- | ----: | ----: |
| (program)                                          | 337.3 |   62% |
| DOM calls from script                              |  70.3 |   13% |
| blocks/tracker-data-entry/provider/connectRules.ts |  21.9 |    4% |
| react-dom                                          |  18.9 |    3% |
| the benchmark itself                               |  18.2 |    3% |
| blocks/tracker-data-entry/logic/summary.ts         |  11.9 |    2% |
| i18next                                            |  11.8 |    2% |
| @dhis2/rule-engine                                 |  11.8 |    2% |
| blocks/tracker-data-entry/logic/ruleEffects.ts     |   8.4 |    2% |
| blocks/spreadsheet/cells/OptionCell.tsx            |     7 |    1% |
| (garbage collector)                                |     7 |    1% |
| @floating-ui/utils                                 |   5.9 |    1% |

| Function                                                    |    ms | Share |
| ----------------------------------------------------------- | ----: | ----: |
| `(program)`                                                 | 337.3 |   62% |
| `elementsFromPoint (DOM)`                                   |  19.9 |    4% |
| ` (benchmark)`                                              |  17.9 |    3% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:505)` |  12.9 |    2% |
| `removeChild (DOM)`                                         |  11.6 |    2% |
| `X2 (react-dom react-dom.production.min.js:248)`            |  10.2 |    2% |
| `set value (DOM)`                                           |    10 |    2% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`        |    10 |    2% |
| ` (DOM)`                                                    |   8.7 |    2% |
| `select (DOM)`                                              |   8.2 |    2% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:504)` |     8 |    1% |
| `elementFromPoint (DOM)`                                    |   7.1 |    1% |

## paste

The browser counted 236 ms of main thread work: 102 ms running script, 27 ms on style and layout, 107 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 708 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                                   |    ms | Share |
| ------------------------------------------------------- | ----: | ----: |
| (program)                                               | 412.6 |   58% |
| react-dom                                               |  63.4 |    9% |
| @dhis2/rule-engine                                      |  49.2 |    7% |
| DOM calls from script                                   |  47.9 |    7% |
| (garbage collector)                                     |  19.7 |    3% |
| blocks/tracker-data-entry/provider/TrackerDataEntry.tsx |  15.4 |    2% |
| blocks/tracker-data-entry/logic/summary.ts              |  14.7 |    2% |
| i18next                                                 |  14.6 |    2% |
| blocks/tracker-data-entry/provider/connectRules.ts      |  12.8 |    2% |
| blocks/tracker-data-entry/logic/ruleEffects.ts          |   9.2 |    1% |
| the benchmark itself                                    |   8.5 |    1% |
| blocks/spreadsheet/provider/context.ts                  |   6.1 |    1% |

| Function                                                         |    ms | Share |
| ---------------------------------------------------------------- | ----: | ----: |
| `(program)`                                                      | 412.6 |   58% |
| `(garbage collector)`                                            |  19.7 |    3% |
| `elementsFromPoint (DOM)`                                        |  19.5 |    3% |
| `focus (DOM)`                                                    |  16.4 |    2% |
| ` (blocks/tracker-data-entry/provider/TrackerDataEntry.tsx:333)` |  14.7 |    2% |
| `G2 (react-dom react-dom.production.min.js:219)`                 |  13.8 |    2% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`             |  13.8 |    2% |
| `au (react-dom react-dom.production.min.js:93)`                  |  10.9 |    2% |
| `e.init (i18next Interpolator.js:22)`                            |  10.3 |    1% |
| `tx (react-dom react-dom.production.min.js:260)`                 |   8.8 |    1% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:505)`      |   8.5 |    1% |
| ` (benchmark)`                                                   |   8.2 |    1% |

## addRow

The browser counted 534 ms of main thread work: 343 ms running script, 80 ms on style and layout, 112 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 1449 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                          |    ms | Share |
| ---------------------------------------------- | ----: | ----: |
| (program)                                      | 623.1 |   43% |
| react-dom                                      | 312.4 |   22% |
| DOM calls from script                          | 204.4 |   14% |
| (garbage collector)                            | 103.8 |    7% |
| react                                          |  27.6 |    2% |
| @tanstack/virtual-core                         |  19.8 |    1% |
| blocks/spreadsheet/grid/navGrid.ts             |  14.3 |    1% |
| blocks/spreadsheet/cells/serverSearch.ts       |    13 |    1% |
| blocks/spreadsheet/provider/context.ts         |  12.8 |    1% |
| blocks/tracker-data-entry/logic/summary.ts     |  12.1 |    1% |
| blocks/tracker-data-entry/logic/ruleEffects.ts |  11.9 |    1% |
| blocks/spreadsheet/cells/Cell.tsx              |  10.5 |    1% |

| Function                                            |    ms | Share |
| --------------------------------------------------- | ----: | ----: |
| `(program)`                                         | 623.1 |   43% |
| `(garbage collector)`                               | 103.8 |    7% |
| `Og (react-dom react-dom.production.min.js:37)`     |  42.3 |    3% |
| `FA (react-dom react-dom.production.min.js:224)`    |  42.2 |    3% |
| `elementFromPoint (DOM)`                            |  29.1 |    2% |
| `set value (DOM)`                                   |  28.8 |    2% |
| `Hb (react react-jsx-runtime.production.min.js:11)` |  26.6 |    2% |
| `setAttribute (DOM)`                                |  26.6 |    2% |
| `focus (DOM)`                                       |  26.3 |    2% |
| `G2 (react-dom react-dom.production.min.js:219)`    |  20.7 |    1% |
| `appendChild (DOM)`                                 |  20.4 |    1% |
| `F9 (@tanstack/virtual-core index.js:131)`          |  18.2 |    1% |

## scrollDown

The browser counted 2058 ms of main thread work: 445 ms running script, 406 ms on style and layout, 1207 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 3070 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                   |     ms | Share |
| --------------------------------------- | -----: | ----: |
| (program)                               | 2015.4 |   66% |
| the benchmark itself                    |  432.5 |   14% |
| react-dom                               |  266.5 |    9% |
| DOM calls from script                   |  144.6 |    5% |
| (garbage collector)                     |   62.9 |    2% |
| react                                   |   30.8 |    1% |
| i18next                                 |   14.5 |    0% |
| blocks/spreadsheet/cells/CellStatus.tsx |   11.1 |    0% |
| blocks/spreadsheet/provider/context.ts  |     11 |    0% |
| @tanstack/virtual-core                  |   10.9 |    0% |
| blocks/spreadsheet/cells/OptionCell.tsx |    9.8 |    0% |
| blocks/spreadsheet/cells/TextCell.tsx   |    5.6 |    0% |

| Function                                            |     ms | Share |
| --------------------------------------------------- | -----: | ----: |
| `(program)`                                         | 2015.4 |   66% |
| `tick (benchmark)`                                  |  432.2 |   14% |
| `(garbage collector)`                               |   62.9 |    2% |
| `removeChild (DOM)`                                 |   42.5 |    1% |
| `FA (react-dom react-dom.production.min.js:224)`    |   42.3 |    1% |
| `setAttribute (DOM)`                                |   40.7 |    1% |
| `oS (react-dom react-dom.production.min.js:280)`    |   32.4 |    1% |
| `Hb (react react-jsx-runtime.production.min.js:11)` |   27.6 |    1% |
| `set value (DOM)`                                   |   25.3 |    1% |
| `Og (react-dom react-dom.production.min.js:37)`     |   22.6 |    1% |
| `appendChild (DOM)`                                 |   17.3 |    1% |
| `aw (react-dom react-dom.production.min.js:39)`     |   13.1 |    0% |

## scrollAcross

The browser counted 631 ms of main thread work: 125 ms running script, 71 ms on style and layout, 434 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 1354 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                   |     ms | Share |
| --------------------------------------- | -----: | ----: |
| (program)                               | 1104.6 |   82% |
| react-dom                               |   99.2 |    7% |
| DOM calls from script                   |   66.1 |    5% |
| (garbage collector)                     |     14 |    1% |
| the benchmark itself                    |   13.4 |    1% |
| i18next                                 |    8.3 |    1% |
| blocks/spreadsheet/cells/OptionCell.tsx |    7.8 |    1% |
| blocks/spreadsheet/provider/context.ts  |      7 |    1% |
| tailwind-merge                          |    5.7 |    0% |
| react                                   |    5.2 |    0% |
| blocks/spreadsheet/cells/Cell.tsx       |      5 |    0% |
| @tanstack/virtual-core                  |    3.5 |    0% |

| Function                                         |     ms | Share |
| ------------------------------------------------ | -----: | ----: |
| `(program)`                                      | 1104.6 |   82% |
| `removeChild (DOM)`                              |   25.4 |    2% |
| `Og (react-dom react-dom.production.min.js:37)`  |   22.4 |    2% |
| `FA (react-dom react-dom.production.min.js:224)` |   19.8 |    1% |
| `setAttribute (DOM)`                             |   17.2 |    1% |
| `(garbage collector)`                            |     14 |    1% |
| `tick (benchmark)`                               |   13.4 |    1% |
| `oS (react-dom react-dom.production.min.js:280)` |    8.3 |    1% |
| ` (blocks/spreadsheet/cells/OptionCell.tsx:85)`  |    7.8 |    1% |
| `appendChild (DOM)`                              |      7 |    1% |
| `set value (DOM)`                                |    5.2 |    0% |
| `get (tailwind-merge bundle-mjs.mjs:204)`        |      5 |    0% |

## showMore

The browser counted 505 ms of main thread work: 298 ms running script, 28 ms on style and layout, 179 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 884 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |    ms | Share |
| -------------------------------------------------- | ----: | ----: |
| (program)                                          |   289 |   33% |
| @dhis2/rule-engine                                 | 196.4 |   22% |
| the benchmark itself                               |  88.4 |   10% |
| react-dom                                          |  81.5 |    9% |
| (garbage collector)                                |    50 |    6% |
| DOM calls from script                              |  22.3 |    3% |
| @tanstack/virtual-core                             |  16.6 |    2% |
| blocks/tracker-data-entry/logic/ruleEffects.ts     |  13.9 |    2% |
| blocks/tracker-data-entry/logic/summary.ts         |  12.1 |    1% |
| blocks/spreadsheet/grid/BulkMenu.tsx               |  11.9 |    1% |
| blocks/tracker-data-entry/provider/connectRules.ts |  10.2 |    1% |
| i18next                                            |   9.1 |    1% |

| Function                                                                      |   ms | Share |
| ----------------------------------------------------------------------------- | ---: | ----: |
| `(program)`                                                                   |  289 |   33% |
| `(garbage collector)`                                                         |   50 |    6% |
| `getTextAlternativeInternal (benchmark)`                                      | 41.2 |    5% |
| `F9 (@tanstack/virtual-core index.js:131)`                                    | 16.6 |    2% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`                       | 16.2 |    2% |
| `Og (react-dom react-dom.production.min.js:37)`                               | 15.1 |    2% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`                          | 12.1 |    1% |
| `au (react-dom react-dom.production.min.js:93)`                               | 10.9 |    1% |
| ` (blocks/spreadsheet/grid/BulkMenu.tsx:69)`                                  | 10.6 |    1% |
| `s.mr (@dhis2/rule-engine Kotlin-DateTime-library-kotlinx-datetime.mjs:4149)` | 10.4 |    1% |
| `s.j (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3231)`                      |  9.6 |    1% |
| `U (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1762)`                        |  8.7 |    1% |
