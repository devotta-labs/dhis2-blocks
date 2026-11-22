# Where the main thread's time goes: 40 columns, 50 rows, 200 rules, 10 options

Sampled with the processor slowed 1×. Sampling itself slows the page, so read the shares, not the times.

## load

The browser counted 1298 ms of main thread work: 969 ms running script, 130 ms on style and layout, 198 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 2515 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                      |     ms | Share |
| ------------------------------------------ | -----: | ----: |
| @dhis2/rule-engine                         | 1251.6 |   50% |
| (program)                                  |  523.2 |   21% |
| (garbage collector)                        |  183.9 |    7% |
| react-dom                                  |  118.9 |    5% |
| @tanstack/virtual-core                     |    101 |    4% |
| i18next                                    |   45.5 |    2% |
| zod                                        |   33.8 |    1% |
| DOM calls from script                      |   32.8 |    1% |
| @dhis2/multi-calendar-dates                |   23.7 |    1% |
| blocks/tracker-data-entry/logic/summary.ts |   23.1 |    1% |
| tailwind-merge                             |   13.3 |    1% |
| blocks/program-rules/lib/buildContext.ts   |   12.8 |    1% |

| Function                                                  |    ms | Share |
| --------------------------------------------------------- | ----: | ----: |
| `(program)`                                               | 523.2 |   21% |
| `(garbage collector)`                                     | 183.9 |    7% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`   | 172.4 |    7% |
| `s.z1e (@dhis2/rule-engine expression-parser.mjs:3291)`   | 104.4 |    4% |
| `F9 (@tanstack/virtual-core index.js:131)`                |  87.5 |    3% |
| `s.j (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3231)`  |  51.3 |    2% |
| `s.z3 (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3282)` |  47.7 |    2% |
| `Tu (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:2790)`   |  44.6 |    2% |
| `J (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1795)`    |    44 |    2% |
| `SV (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:2484)`   |  33.6 |    1% |
| `Tn (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1926)`   |  32.3 |    1% |
| `ln (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1840)`   |  27.9 |    1% |

## edit

The browser counted 550 ms of main thread work: 222 ms running script, 44 ms on style and layout, 284 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 935 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                                  |    ms | Share |
| ------------------------------------------------------ | ----: | ----: |
| (program)                                              |   483 |   52% |
| @dhis2/rule-engine                                     | 165.7 |   18% |
| (garbage collector)                                    |  89.6 |   10% |
| react-dom                                              |  58.2 |    6% |
| DOM calls from script                                  |  43.2 |    5% |
| i18next                                                |  14.9 |    2% |
| the benchmark itself                                   |  13.7 |    1% |
| blocks/tracker-data-entry/provider/TrackerRowLabel.tsx |  10.8 |    1% |
| blocks/spreadsheet/store/store.ts                      |   7.9 |    1% |
| @base-ui/utils                                         |   6.8 |    1% |
| blocks/tracker-data-entry/provider/connectRules.ts     |   6.4 |    1% |
| blocks/tracker-data-entry/logic/summary.ts             |   4.4 |    0% |

| Function                                                       |   ms | Share |
| -------------------------------------------------------------- | ---: | ----: |
| `(program)`                                                    |  483 |   52% |
| `(garbage collector)`                                          | 89.6 |   10% |
| `s.z1e (@dhis2/rule-engine expression-parser.mjs:3291)`        | 26.5 |    3% |
| `focus (DOM)`                                                  | 18.5 |    2% |
| `s.z3 (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3282)`      | 11.6 |    1% |
| `query (benchmark)`                                            | 10.6 |    1% |
| `s.n (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3858)`       |   10 |    1% |
| `elementsFromPoint (DOM)`                                      |  7.2 |    1% |
| `iT (@base-ui/utils useMergedRefs.mjs:45)`                     |  6.8 |    1% |
| `b (react-dom react-dom.production.min.js:140)`                |  6.6 |    1% |
| ` (blocks/tracker-data-entry/provider/TrackerRowLabel.tsx:66)` |  6.4 |    1% |
| `S_ (react-dom react-dom.production.min.js:43)`                |  6.3 |    1% |

## navigate

The browser counted 276 ms of main thread work: 38 ms running script, 35 ms on style and layout, 203 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 755 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                   |    ms | Share |
| --------------------------------------- | ----: | ----: |
| (program)                               | 602.9 |   80% |
| DOM calls from script                   |  81.7 |   11% |
| react-dom                               |    48 |    6% |
| (garbage collector)                     |    10 |    1% |
| blocks/spreadsheet/grid/navGrid.ts      |   4.2 |    1% |
| @tanstack/virtual-core                  |   2.9 |    0% |
| @tanstack/react-virtual                 |     2 |    0% |
| the benchmark itself                    |     1 |    0% |
| blocks/spreadsheet/cells/CellStatus.tsx |   0.6 |    0% |
| react                                   |   0.3 |    0% |
| blocks/spreadsheet/store/store.ts       |   0.3 |    0% |
| i18next                                 |   0.3 |    0% |

| Function                                         |    ms | Share |
| ------------------------------------------------ | ----: | ----: |
| `(program)`                                      | 602.9 |   80% |
| `focus (DOM)`                                    |    63 |    8% |
| `nv (react-dom react-dom.production.min.js:24)`  |  13.4 |    2% |
| `(garbage collector)`                            |    10 |    1% |
| `elementsFromPoint (DOM)`                        |   9.8 |    1% |
| `FA (react-dom react-dom.production.min.js:224)` |   9.5 |    1% |
| `is (react-dom react-dom.production.min.js:123)` |   7.3 |    1% |
| `ql (react-dom react-dom.production.min.js:243)` |   5.6 |    1% |
| `isOpen (blocks/spreadsheet/grid/navGrid.ts:80)` |   4.2 |    1% |
| ` (DOM)`                                         |   3.3 |    0% |
| `I_ (react-dom react-dom.production.min.js:52)`  |   1.9 |    0% |
| `select (DOM)`                                   |   1.6 |    0% |

## option

The browser counted 103 ms of main thread work: 33 ms running script, 7 ms on style and layout, 64 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 404 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |   ms | Share |
| -------------------------------------------------- | ---: | ----: |
| (program)                                          |  297 |   74% |
| @dhis2/rule-engine                                 | 28.8 |    7% |
| react-dom                                          | 17.3 |    4% |
| DOM calls from script                              | 15.7 |    4% |
| the benchmark itself                               |   13 |    3% |
| (garbage collector)                                | 12.2 |    3% |
| blocks/spreadsheet/cells/OptionCell.tsx            |  9.9 |    2% |
| i18next                                            |    4 |    1% |
| blocks/tracker-data-entry/logic/summary.ts         |  1.2 |    0% |
| react                                              |  0.8 |    0% |
| zustand                                            |  0.6 |    0% |
| blocks/tracker-data-entry/provider/connectRules.ts |  0.6 |    0% |

| Function                                                      |   ms | Share |
| ------------------------------------------------------------- | ---: | ----: |
| `(program)`                                                   |  297 |   74% |
| ` (benchmark)`                                                |   13 |    3% |
| `(garbage collector)`                                         | 12.2 |    3% |
| `s.f13 (@dhis2/rule-engine KotlinBigInteger-bignum.mjs:4745)` | 10.2 |    3% |
| ` (blocks/spreadsheet/cells/OptionCell.tsx:102)`              |  9.6 |    2% |
| `X2 (react-dom react-dom.production.min.js:248)`              |  8.6 |    2% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`       |  5.7 |    1% |
| `Io (react-dom react-dom.production.min.js:299)`              |  5.5 |    1% |
| `elementsFromPoint (DOM)`                                     |  3.9 |    1% |
| `put (DOM)`                                                   |  3.1 |    1% |
| `t.extendTranslation (i18next Translator.js:208)`             |  2.9 |    1% |
| `s.z1e (@dhis2/rule-engine expression-parser.mjs:3291)`       |  2.8 |    1% |

## paste

The browser counted 286 ms of main thread work: 194 ms running script, 23 ms on style and layout, 69 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 680 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |    ms | Share |
| -------------------------------------------------- | ----: | ----: |
| (program)                                          | 266.5 |   39% |
| @dhis2/rule-engine                                 | 240.3 |   35% |
| DOM calls from script                              |  48.4 |    7% |
| (garbage collector)                                |  46.7 |    7% |
| react-dom                                          |  24.3 |    4% |
| blocks/tracker-data-entry/provider/openForm.ts     |    11 |    2% |
| i18next                                            |  10.7 |    2% |
| blocks/tracker-data-entry/provider/connectRules.ts |   6.8 |    1% |
| the benchmark itself                               |   4.8 |    1% |
| zustand                                            |   2.3 |    0% |
| blocks/tracker-data-entry/logic/summary.ts         |   2.2 |    0% |
| blocks/spreadsheet/cells/OptionCell.tsx            |     2 |    0% |

| Function                                                       |    ms | Share |
| -------------------------------------------------------------- | ----: | ----: |
| `(program)`                                                    | 266.5 |   39% |
| `(garbage collector)`                                          |  46.7 |    7% |
| `removeChild (DOM)`                                            |  35.4 |    5% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`        |  32.1 |    5% |
| `s.z1e (@dhis2/rule-engine expression-parser.mjs:3291)`        |  22.2 |    3% |
| `Rn (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:9542)`        |  12.3 |    2% |
| `Qo (@dhis2/rule-engine expression-parser.mjs:1176)`           |  11.2 |    2% |
| `HX (@dhis2/rule-engine expression-parser.mjs:939)`            |  11.1 |    2% |
| `tu (@dhis2/rule-engine rule-engine.mjs:1719)`                 |    11 |    2% |
| `enqueue (blocks/tracker-data-entry/provider/openForm.ts:189)` |  10.7 |    2% |
| `bQ (@dhis2/rule-engine expression-parser.mjs:2514)`           |   8.8 |    1% |
| `s.z3 (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3282)`      |   8.7 |    1% |

## addRow

The browser counted 250 ms of main thread work: 140 ms running script, 29 ms on style and layout, 80 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 477 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                        |    ms | Share |
| -------------------------------------------- | ----: | ----: |
| (program)                                    | 219.9 |   46% |
| react-dom                                    |  66.3 |   14% |
| (garbage collector)                          |  56.5 |   12% |
| DOM calls from script                        |  33.8 |    7% |
| class-variance-authority                     |  18.7 |    4% |
| i18next                                      |  14.9 |    3% |
| @dhis2/rule-engine                           |  13.3 |    3% |
| blocks/tracker-data-entry/provider/addRow.ts |   7.9 |    2% |
| blocks/spreadsheet/cells/Cell.tsx            |   6.3 |    1% |
| react                                        |     5 |    1% |
| blocks/spreadsheet/grid/navGrid.ts           |   4.2 |    1% |
| @tanstack/virtual-core                       |   3.1 |    1% |

| Function                                                |    ms | Share |
| ------------------------------------------------------- | ----: | ----: |
| `(program)`                                             | 219.9 |   46% |
| `(garbage collector)`                                   |  56.5 |   12% |
| ` (class-variance-authority index.mjs:18)`              |  18.7 |    4% |
| `FA (react-dom react-dom.production.min.js:224)`        |  12.5 |    3% |
| `set value (DOM)`                                       |  10.7 |    2% |
| `focus (DOM)`                                           |   8.5 |    2% |
| `Og (react-dom react-dom.production.min.js:37)`         |   8.1 |    2% |
| ` (blocks/tracker-data-entry/provider/addRow.ts:50)`    |   7.9 |    2% |
| `zw (react-dom react-dom.production.min.js:168)`        |   7.5 |    2% |
| `setAttribute (DOM)`                                    |   5.8 |    1% |
| `s.z1e (@dhis2/rule-engine expression-parser.mjs:3291)` |   5.6 |    1% |
| `e5 (i18next utils.js:98)`                              |     5 |    1% |

## scrollDown

The browser counted 719 ms of main thread work: 122 ms running script, 119 ms on style and layout, 478 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 1005 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                   |    ms | Share |
| --------------------------------------- | ----: | ----: |
| (program)                               | 700.7 |   70% |
| the benchmark itself                    | 171.2 |   17% |
| react-dom                               |  70.6 |    7% |
| DOM calls from script                   |  20.7 |    2% |
| blocks/spreadsheet/cells/CellStatus.tsx |   4.7 |    0% |
| react                                   |   4.4 |    0% |
| @tanstack/virtual-core                  |   4.3 |    0% |
| blocks/spreadsheet/store/store.ts       |   4.3 |    0% |
| blocks/spreadsheet/cells/Cell.tsx       |   3.9 |    0% |
| zustand                                 |   3.7 |    0% |
| blocks/spreadsheet/provider/context.ts  |   3.7 |    0% |
| i18next                                 |   3.2 |    0% |

| Function                                          |    ms | Share |
| ------------------------------------------------- | ----: | ----: |
| `(program)`                                       | 700.7 |   70% |
| `tick (benchmark)`                                | 171.2 |   17% |
| `FA (react-dom react-dom.production.min.js:224)`  |  10.2 |    1% |
| `Og (react-dom react-dom.production.min.js:37)`   |   6.2 |    1% |
| `li (react-dom react-dom.production.min.js:161)`  |   5.6 |    1% |
| `au (react-dom react-dom.production.min.js:93)`   |   5.2 |    1% |
| `K2 (react-dom react-dom.production.min.js:244)`  |   4.9 |    0% |
| `setAttribute (DOM)`                              |   4.5 |    0% |
| `removeChild (DOM)`                               |   4.2 |    0% |
| `a (blocks/spreadsheet/store/store.ts:141)`       |   3.9 |    0% |
| `pk (blocks/spreadsheet/cells/CellStatus.tsx:70)` |   3.8 |    0% |
| `X2 (react-dom react-dom.production.min.js:248)`  |   3.6 |    0% |

## scrollAcross

The browser counted 192 ms of main thread work: 36 ms running script, 17 ms on style and layout, 138 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 379 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                    |    ms | Share |
| ---------------------------------------- | ----: | ----: |
| (program)                                | 306.6 |   81% |
| react-dom                                |  24.1 |    6% |
| DOM calls from script                    |  16.6 |    4% |
| (garbage collector)                      |    14 |    4% |
| blocks/spreadsheet/cells/TextCell.tsx    |   7.1 |    2% |
| blocks/spreadsheet/cells/CellStatus.tsx  |   1.8 |    0% |
| react                                    |   1.8 |    0% |
| i18next                                  |   1.2 |    0% |
| blocks/spreadsheet/cells/PopupCell.tsx   |   0.6 |    0% |
| blocks/spreadsheet/cells/serverSearch.ts |   0.6 |    0% |
| tailwind-merge                           |   0.6 |    0% |
| blocks/spreadsheet/provider/context.ts   |   0.4 |    0% |

| Function                                            |    ms | Share |
| --------------------------------------------------- | ----: | ----: |
| `(program)`                                         | 306.6 |   81% |
| `(garbage collector)`                               |    14 |    4% |
| ` (blocks/spreadsheet/cells/TextCell.tsx:25)`       |   7.1 |    2% |
| `removeChild (DOM)`                                 |   5.7 |    2% |
| `nv (react-dom react-dom.production.min.js:24)`     |   5.5 |    1% |
| `FA (react-dom react-dom.production.min.js:224)`    |   4.8 |    1% |
| `setAttribute (DOM)`                                |   3.7 |    1% |
| `insertBefore (DOM)`                                |   3.6 |    1% |
| `xa (react-dom react-dom.production.min.js:283)`    |     3 |    1% |
| `Og (react-dom react-dom.production.min.js:37)`     |   2.9 |    1% |
| `Hb (react react-jsx-runtime.production.min.js:11)` |   1.8 |    0% |
| `set value (DOM)`                                   |   1.8 |    0% |

## showMore

The browser counted 751 ms of main thread work: 647 ms running script, 29 ms on style and layout, 75 ms on the rest (painting, parsing, its own bookkeeping).
The profiler sampled 1607 ms outside idle; `(program)` is the browser's own code, mostly that style, layout and painting.

| Where                                              |     ms | Share |
| -------------------------------------------------- | -----: | ----: |
| @dhis2/rule-engine                                 | 1072.6 |   67% |
| (program)                                          |  241.4 |   15% |
| react-dom                                          |   67.5 |    4% |
| (garbage collector)                                |   57.3 |    4% |
| the benchmark itself                               |   39.1 |    2% |
| i18next                                            |   28.8 |    2% |
| @tanstack/virtual-core                             |   14.3 |    1% |
| DOM calls from script                              |   12.7 |    1% |
| blocks/tracker-data-entry/provider/connectRules.ts |   12.3 |    1% |
| react                                              |    7.2 |    0% |
| blocks/tracker-data-entry/logic/summary.ts         |    5.8 |    0% |
| @tanstack/query-core                               |    5.7 |    0% |

| Function                                                      |    ms | Share |
| ------------------------------------------------------------- | ----: | ----: |
| `(program)`                                                   | 241.4 |   15% |
| `Nh (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3587)`       | 121.4 |    8% |
| `s.z1e (@dhis2/rule-engine expression-parser.mjs:3291)`       | 105.2 |    7% |
| `(garbage collector)`                                         |  57.3 |    4% |
| `ln (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1840)`       |  44.1 |    3% |
| `Tu (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:2790)`       |  37.1 |    2% |
| `J (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:1795)`        |  31.5 |    2% |
| `s.i12 (@dhis2/rule-engine KotlinBigInteger-bignum.mjs:4647)` |  28.5 |    2% |
| `cg (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3742)`       |  28.2 |    2% |
| `s.m (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3010)`      |    24 |    1% |
| `fz (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3799)`       |  23.7 |    1% |
| `s.j (@dhis2/rule-engine kotlin-kotlin-stdlib.mjs:3231)`      |    22 |    1% |
