# Where the main thread's time goes: 40 columns, 500 rows, 20 rules, 10 options

Sampled with the processor slowed 1×. Sampling itself slows the page, so read the shares, not the times.

## load

The browser counted 2069 ms of main thread work: 1636 ms running script, 156 ms on style and layout, 277 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 2812 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |    ms | Share |
| -------------------------------------------------- | ----: | ----: |
| @dhis2/rule-engine                                 | 954.6 |   34% |
| blocks/tracker-data-entry/logic/summary.ts         | 397.7 |   14% |
| (program)                                          | 395.4 |   14% |
| i18next                                            | 191.6 |    7% |
| react-dom                                          | 160.8 |    6% |
| (garbage collector)                                | 125.7 |    4% |
| @tanstack/virtual-core                             |  83.6 |    3% |
| blocks/tracker-data-entry/provider/connectRules.ts |    78 |    3% |
| zustand                                            |  35.7 |    1% |
| @dhis2/multi-calendar-dates                        |  31.4 |    1% |
| react                                              |  28.8 |    1% |
| blocks/tracker-data-entry/logic/ruleEffects.ts     |  28.5 |    1% |

| Function                                                     |    ms | Share |
| ------------------------------------------------------------ | ----: | ----: |
| `(program)`                                                  | 395.4 |   14% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`         | 390.6 |   14% |
| `(garbage collector)`                                        | 125.7 |    4% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`      |  91.9 |    3% |
| `F9 (@tanstack/virtual-core index.js:131)`                   |  78.9 |    3% |
| `s.z1e (@dhis2/rule-engine expression-parser.mjs:3291)`      |  68.5 |    2% |
| `Ks (i18next utils.js:82)`                                   |  57.8 |    2% |
| `T (blocks/tracker-data-entry/provider/connectRules.ts:157)` |  54.1 |    2% |
| `ln (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1840)`      |  26.7 |    1% |
| `e.resetRegExp (i18next Interpolator.js:60)`                 |  26.4 |    1% |
| `Hb (react react-jsx-runtime.production.min.js:11)`          |  25.5 |    1% |
| `By (zustand shallow.mjs:6)`                                 |  23.7 |    1% |

## edit

The browser counted 753 ms of main thread work: 355 ms running script, 54 ms on style and layout, 344 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 1576 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |    ms | Share |
| -------------------------------------------------- | ----: | ----: |
| (program)                                          | 651.2 |   41% |
| blocks/tracker-data-entry/provider/connectRules.ts | 155.1 |   10% |
| blocks/tracker-data-entry/logic/summary.ts         |   154 |   10% |
| DOM calls from script                              |  92.9 |    6% |
| blocks/spreadsheet/store/store.ts                  |  87.4 |    6% |
| (garbage collector)                                |  86.8 |    6% |
| blocks/tracker-data-entry/logic/ruleEffects.ts     |  53.2 |    3% |
| i18next                                            |  48.5 |    3% |
| react-dom                                          |  46.7 |    3% |
| @dhis2/rule-engine                                 |  32.8 |    2% |
| zustand                                            |    32 |    2% |
| the benchmark itself                               |    29 |    2% |

| Function                                                       |    ms | Share |
| -------------------------------------------------------------- | ----: | ----: |
| `(program)`                                                    | 651.2 |   41% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`           | 150.9 |   10% |
| `(garbage collector)`                                          |  86.8 |    6% |
| `T (blocks/spreadsheet/store/store.ts:187)`                    |  85.8 |    5% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:504)`    |  84.6 |    5% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:505)`    |  63.6 |    4% |
| `focus (DOM)`                                                  |  37.5 |    2% |
| `i (blocks/tracker-data-entry/logic/ruleEffects.ts:289)`       |  33.1 |    2% |
| `removeChild (DOM)`                                            |  25.6 |    2% |
| `query (benchmark)`                                            |  22.6 |    1% |
| ` (blocks/tracker-data-entry/provider/TrackerRowLabel.tsx:66)` |  21.5 |    1% |
| ` (blocks/tracker-data-entry/logic/ruleEffects.ts:282)`        |  16.4 |    1% |

## navigate

The browser counted 242 ms of main thread work: 30 ms running script, 38 ms on style and layout, 174 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 445 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                   |    ms | Share |
| --------------------------------------- | ----: | ----: |
| (program)                               | 383.9 |   86% |
| DOM calls from script                   |  28.3 |    6% |
| react-dom                               |  19.9 |    4% |
| (garbage collector)                     |   4.4 |    1% |
| the benchmark itself                    |   3.2 |    1% |
| react                                   |   0.9 |    0% |
| @tanstack/virtual-core                  |   0.9 |    0% |
| tailwind-merge                          |   0.9 |    0% |
| blocks/spreadsheet/cells/TextCell.tsx   |   0.6 |    0% |
| blocks/spreadsheet/cells/CellStatus.tsx |   0.6 |    0% |
| blocks/spreadsheet/cells/Cell.tsx       |   0.3 |    0% |
| zustand                                 |   0.3 |    0% |

| Function                                         |    ms | Share |
| ------------------------------------------------ | ----: | ----: |
| `(program)`                                      | 383.9 |   86% |
| `focus (DOM)`                                    |  22.2 |    5% |
| `oS (react-dom react-dom.production.min.js:280)` |   5.3 |    1% |
| `(garbage collector)`                            |   4.4 |    1% |
| `b2 (react-dom react-dom.production.min.js:166)` |   3.3 |    1% |
| ` (benchmark)`                                   |   3.2 |    1% |
| `MessageChannel (DOM)`                           |   3.2 |    1% |
| `FA (react-dom react-dom.production.min.js:224)` |   1.9 |    0% |
| `I_ (react-dom react-dom.production.min.js:52)`  |   1.9 |    0% |
| `Tv (react-dom react-dom.production.min.js:160)` |   1.7 |    0% |
| `setAttribute (DOM)`                             |   1.6 |    0% |
| `querySelectorAll (DOM)`                         |   0.7 |    0% |

## option

The browser counted 119 ms of main thread work: 52 ms running script, 10 ms on style and layout, 57 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 301 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |    ms | Share |
| -------------------------------------------------- | ----: | ----: |
| (program)                                          | 173.5 |   58% |
| blocks/tracker-data-entry/logic/summary.ts         |  27.2 |    9% |
| blocks/tracker-data-entry/provider/connectRules.ts |  23.3 |    8% |
| i18next                                            |  14.8 |    5% |
| DOM calls from script                              |  14.7 |    5% |
| blocks/spreadsheet/store/store.ts                  |  13.1 |    4% |
| react-dom                                          |   9.4 |    3% |
| blocks/tracker-data-entry/logic/ruleEffects.ts     |   5.8 |    2% |
| zustand                                            |   3.5 |    1% |
| (garbage collector)                                |   3.4 |    1% |
| @dhis2/rule-engine                                 |   3.2 |    1% |
| the benchmark itself                               |   2.7 |    1% |

| Function                                                    |    ms | Share |
| ----------------------------------------------------------- | ----: | ----: |
| `(program)`                                                 | 173.5 |   58% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`        |  27.2 |    9% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:504)` |  22.7 |    8% |
| `T (blocks/spreadsheet/store/store.ts:187)`                 |  13.1 |    4% |
| `e.resetRegExp (i18next Interpolator.js:60)`                |   9.9 |    3% |
| `_4 (blocks/tracker-data-entry/logic/ruleEffects.ts:260)`   |   5.8 |    2% |
| `querySelectorAll (DOM)`                                    |   4.9 |    2% |
| `GA (react-dom react-dom.production.min.js:281)`            |   3.8 |    1% |
| `(garbage collector)`                                       |   3.4 |    1% |
| ` (benchmark)`                                              |   2.4 |    1% |
| `removeChild (DOM)`                                         |   2.2 |    1% |
| `elementsFromPoint (DOM)`                                   |   2.1 |    1% |

## paste

The browser counted 266 ms of main thread work: 142 ms running script, 45 ms on style and layout, 79 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 533 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                                   |    ms | Share |
| ------------------------------------------------------- | ----: | ----: |
| (program)                                               | 280.3 |   53% |
| blocks/tracker-data-entry/provider/connectRules.ts      |  47.2 |    9% |
| react-dom                                               |  38.1 |    7% |
| blocks/tracker-data-entry/logic/summary.ts              |  28.7 |    5% |
| @dhis2/rule-engine                                      |  25.6 |    5% |
| i18next                                                 |  19.3 |    4% |
| DOM calls from script                                   |  18.7 |    4% |
| blocks/spreadsheet/store/store.ts                       |  14.2 |    3% |
| blocks/tracker-data-entry/provider/TrackerDataEntry.tsx |  14.2 |    3% |
| blocks/tracker-data-entry/logic/ruleEffects.ts          |  12.3 |    2% |
| (garbage collector)                                     |   5.1 |    1% |
| blocks/spreadsheet/provider/context.ts                  |   4.5 |    1% |

| Function                                                         |    ms | Share |
| ---------------------------------------------------------------- | ----: | ----: |
| `(program)`                                                      | 280.3 |   53% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:504)`      |  28.6 |    5% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`             |  27.9 |    5% |
| ` (blocks/tracker-data-entry/provider/connectRules.ts:505)`      |  17.6 |    3% |
| ` (blocks/tracker-data-entry/provider/TrackerDataEntry.tsx:333)` |  13.8 |    3% |
| `T (blocks/spreadsheet/store/store.ts:187)`                      |  13.6 |    3% |
| `removeChild (DOM)`                                              |   7.4 |    1% |
| `G2 (react-dom react-dom.production.min.js:219)`                 |   6.7 |    1% |
| `l (blocks/tracker-data-entry/logic/ruleEffects.ts:130)`         |   6.4 |    1% |
| `Ks (i18next utils.js:82)`                                       |   6.2 |    1% |
| `Jw (react-dom react-dom.production.min.js:245)`                 |   5.7 |    1% |
| `J2 (react-dom react-dom.production.min.js:252)`                 |   5.3 |    1% |

## addRow

The browser counted 294 ms of main thread work: 169 ms running script, 28 ms on style and layout, 97 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 752 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                          |    ms | Share |
| ---------------------------------------------- | ----: | ----: |
| (program)                                      | 358.1 |   48% |
| react-dom                                      |   100 |   13% |
| (garbage collector)                            |  79.3 |   11% |
| DOM calls from script                          |    33 |    4% |
| i18next                                        |  21.8 |    3% |
| blocks/tracker-data-entry/logic/ruleEffects.ts |  21.7 |    3% |
| blocks/tracker-data-entry/logic/summary.ts     |  12.6 |    2% |
| blocks/spreadsheet/grid/navGrid.ts             |  11.9 |    2% |
| react                                          |  11.4 |    2% |
| @tanstack/virtual-core                         |  10.5 |    1% |
| @dhis2/rule-engine                             |  10.1 |    1% |
| blocks/spreadsheet/model/types.ts              |   8.9 |    1% |

| Function                                                  |    ms | Share |
| --------------------------------------------------------- | ----: | ----: |
| `(program)`                                               | 358.1 |   48% |
| `(garbage collector)`                                     |  79.3 |   11% |
| `_4 (blocks/tracker-data-entry/logic/ruleEffects.ts:260)` |  15.5 |    2% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`      |  12.2 |    2% |
| `Hb (react react-jsx-runtime.production.min.js:11)`       |  11.1 |    1% |
| `focus (DOM)`                                             |    11 |    1% |
| `BU (blocks/spreadsheet/grid/navGrid.ts:88)`              |    10 |    1% |
| ` (blocks/spreadsheet/model/types.ts:82)`                 |   8.9 |    1% |
| `Tv (react-dom react-dom.production.min.js:160)`          |   8.9 |    1% |
| `vm (@dhis2/rule-engine expression-parser.mjs:14000)`     |   6.7 |    1% |
| `oS (react-dom react-dom.production.min.js:280)`          |   6.7 |    1% |
| `Og (react-dom react-dom.production.min.js:37)`           |   6.6 |    1% |

## scrollDown

The browser counted 1228 ms of main thread work: 234 ms running script, 186 ms on style and layout, 808 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 2168 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                   |     ms | Share |
| --------------------------------------- | -----: | ----: |
| (program)                               | 1507.7 |   70% |
| the benchmark itself                    |  293.8 |   14% |
| react-dom                               |  199.5 |    9% |
| DOM calls from script                   |   83.4 |    4% |
| react                                   |   21.2 |    1% |
| @tanstack/virtual-core                  |    9.8 |    0% |
| (garbage collector)                     |    8.5 |    0% |
| blocks/spreadsheet/cells/OptionCell.tsx |    6.6 |    0% |
| @base-ui/react                          |    6.4 |    0% |
| blocks/spreadsheet/grid/TableBody.tsx   |    4.6 |    0% |
| blocks/spreadsheet/grid/BulkMenu.tsx    |    3.7 |    0% |
| @tanstack/react-virtual                 |    3.7 |    0% |

| Function                                            |     ms | Share |
| --------------------------------------------------- | -----: | ----: |
| `(program)`                                         | 1507.7 |   70% |
| `tick (benchmark)`                                  |  293.8 |   14% |
| `FA (react-dom react-dom.production.min.js:224)`    |   32.4 |    1% |
| `set value (DOM)`                                   |   22.7 |    1% |
| `oS (react-dom react-dom.production.min.js:280)`    |   21.9 |    1% |
| `Og (react-dom react-dom.production.min.js:37)`     |   20.6 |    1% |
| `removeChild (DOM)`                                 |   20.3 |    1% |
| `WA (react-dom react-dom.production.min.js:240)`    |   18.7 |    1% |
| `setAttribute (DOM)`                                |   16.2 |    1% |
| `Hb (react react-jsx-runtime.production.min.js:11)` |   11.8 |    1% |
| `addEventListener (DOM)`                            |   10.3 |    0% |
| `We.useEffect (react react.production.min.js:25)`   |    9.4 |    0% |

## scrollAcross

The browser counted 196 ms of main thread work: 42 ms running script, 26 ms on style and layout, 128 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 335 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                  |    ms | Share |
| -------------------------------------- | ----: | ----: |
| (program)                              | 275.1 |   82% |
| react-dom                              |  32.5 |   10% |
| DOM calls from script                  |  13.2 |    4% |
| blocks/spreadsheet/cells/TextCell.tsx  |   3.2 |    1% |
| clsx                                   |   2.2 |    1% |
| react                                  |   1.7 |    1% |
| blocks/spreadsheet/provider/context.ts |   1.3 |    0% |
| @base-ui/react                         |   1.1 |    0% |
| tailwind-merge                         |   0.7 |    0% |
| blocks/spreadsheet/cells/Cell.tsx      |   0.6 |    0% |
| (garbage collector)                    |   0.6 |    0% |
| i18next                                |   0.6 |    0% |

| Function                                            |    ms | Share |
| --------------------------------------------------- | ----: | ----: |
| `(program)`                                         | 275.1 |   82% |
| `K2 (react-dom react-dom.production.min.js:244)`    |   9.9 |    3% |
| `removeChild (DOM)`                                 |   4.4 |    1% |
| ` (react-dom react-dom.production.min.js:109)`      |     4 |    1% |
| ` (blocks/spreadsheet/cells/TextCell.tsx:25)`       |   3.2 |    1% |
| `setAttribute (DOM)`                                |   2.7 |    1% |
| `oS (react-dom react-dom.production.min.js:280)`    |   2.4 |    1% |
| `FA (react-dom react-dom.production.min.js:224)`    |   2.4 |    1% |
| `ZE (clsx clsx.mjs:1)`                              |   2.2 |    1% |
| `appendChild (DOM)`                                 |   1.9 |    1% |
| `Hb (react react-jsx-runtime.production.min.js:11)` |   1.7 |    1% |
| `set value (DOM)`                                   |   1.6 |    0% |

## showMore

The browser counted 1160 ms of main thread work: 896 ms running script, 22 ms on style and layout, 243 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 1884 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |     ms | Share |
| -------------------------------------------------- | -----: | ----: |
| @dhis2/rule-engine                                 | 1017.6 |   54% |
| (program)                                          |  289.9 |   15% |
| (garbage collector)                                |  128.5 |    7% |
| the benchmark itself                               |   58.3 |    3% |
| i18next                                            |   48.6 |    3% |
| react-dom                                          |   48.5 |    3% |
| blocks/tracker-data-entry/logic/ruleEffects.ts     |   43.2 |    2% |
| blocks/tracker-data-entry/provider/connectRules.ts |   37.5 |    2% |
| blocks/tracker-data-entry/logic/summary.ts         |   30.7 |    2% |
| blocks/spreadsheet/grid/navGrid.ts                 |   25.8 |    1% |
| blocks/spreadsheet/model/types.ts                  |   22.9 |    1% |
| blocks/tracker-data-entry/provider/appendPage.ts   |   22.8 |    1% |

| Function                                                  |    ms | Share |
| --------------------------------------------------------- | ----: | ----: |
| `(program)`                                               | 289.9 |   15% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`   | 139.3 |    7% |
| `(garbage collector)`                                     | 128.5 |    7% |
| `s.z1e (@dhis2/rule-engine expression-parser.mjs:3291)`   |  82.4 |    4% |
| `cg (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3742)`   |  25.7 |    1% |
| `eO (blocks/tracker-data-entry/logic/summary.ts:88)`      |  24.1 |    1% |
| `b (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1748)`    |  20.7 |    1% |
| `s.z3 (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3282)` |  20.5 |    1% |
| `BU (blocks/spreadsheet/grid/navGrid.ts:88)`              |    20 |    1% |
| `pV (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:2370)`   |  19.7 |    1% |
| `ln (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1840)`   |  19.4 |    1% |
| `s.r (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3215)`  |  18.8 |    1% |
