import type { Page } from '@playwright/test'
import type { Stamp } from './event-form-performance.instrument'
import { instrument } from './event-form-performance.instrument'
import { bundle } from './event-form-performance.profile'
import {
    ALWAYS,
    BUDGET_RATE,
    CHILD,
    clickAt,
    entriesSince,
    expectNext,
    field,
    focusOn,
    LONG,
    now,
    openPreset,
    RATES,
    record,
    sleep,
    statCells,
    stats,
    summary,
    table,
    throttle,
    timed,
    VIEWPORT,
    withinBudget,
    type Probe,
    type Row,
} from './event-form-performance.support'
import { test } from './fixtures'

/**
 * The event form's other controls (option fields, the date, Why?, Save and Complete), scrolling, memory, the bundle,
 * React renders per input and CPU profiles. See `event-form-performance.spec.ts` for how to run them.
 */

test.use({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    actionTimeout: 30_000,
})
test.describe.configure({ timeout: 60 * 60_000 })
test.beforeEach(async ({ page }) => page.addInitScript(instrument))

type Step = readonly [
    string,
    Probe,
    () => Promise<void>,
    ('keydown' | 'click')?,
]

/** Repeats the steps `rounds` times, each input measured to the paint where its probe holds; the first round warms up. */
const steps = async (
    page: Page,
    rate: number,
    rounds: number,
    list: readonly Step[]
) => {
    const out = new Map<string, Stamp[]>()
    for (let round = 0; round < rounds; round += 1) {
        for (const [name, probe, act, type] of list) {
            await expectNext(page, probe)
            const stamp = await timed(page, rate, act, type)
            if (round > 0) out.set(name, [...(out.get(name) ?? []), stamp])
        }
    }
    return out
}

const LISTBOX = '[role=listbox]'
const DIALOG = '[role=dialog], [role=alertdialog]'
const has = (selector: string): Probe => ({ name: 'present', arg: selector })
const lacks = (selector: string): Probe => ({ name: 'absent', arg: selector })
const expanded = (state: boolean): Probe => ({
    name: 'expanded',
    arg: String(state),
})

// Picks and commits are held to the commit budget; opening a popup is reported only.
const COMMITS = /pick|Tab out|Save|Complete →/

test('5–8 options, date, Why?, Save and Complete', async ({
    page,
}, testInfo) => {
    const results = new Map<string, object>()
    const rows: Row[] = []
    const add = async (
        prefix: string,
        rate: number,
        out: Map<string, Stamp[]>
    ) => {
        for (const [name, stamps] of out) {
            const result = await summary(page, stamps)
            results.set(`${prefix}: ${name} @${rate}x`, result)
            rows.push([
                `${prefix}: ${name}`,
                `${rate}x`,
                ...statCells(result.latency),
            ])
            if (rate === BUDGET_RATE && COMMITS.test(name)) {
                withinBudget(
                    testInfo,
                    `p95, ${prefix}: ${name} @${rate}x`,
                    result.latency.p95,
                    100
                )
            }
        }
    }
    const press = (key: string) => () => page.keyboard.press(key)
    for (const rate of RATES) {
        await openPreset(page, 'Every value type', rate)
        await clickAt(page, field(page, 'longOptions'))
        await page.keyboard.press('Escape')
        await add(
            '5 combobox, Occupation (8 options)',
            rate,
            await steps(page, rate, 16, [
                ['open (ArrowDown)', has(LISTBOX), press('ArrowDown')],
                ['close (Escape)', lacks(LISTBOX), press('Escape')],
                ['select all', ALWAYS, press('ControlOrMeta+a')],
                ['filter key 1', has(LISTBOX), press('t')],
                ['filter key 2', has(LISTBOX), press('e')],
                ['pick (Enter)', lacks(LISTBOX), press('Enter')],
            ])
        )
        await add(
            '5 multi-select, Danger signs (7 options)',
            rate,
            await steps(page, rate, 16, [
                [
                    'open (click)',
                    has(LISTBOX),
                    () => clickAt(page, field(page, 'longMultiText')),
                    'click',
                ],
                ['close (Escape)', lacks(LISTBOX), press('Escape')],
            ])
        )
        const radio = (name: string) => () =>
            clickAt(
                page,
                field(page, 'shortOptions').getByRole('radio', {
                    name,
                    exact: true,
                })
            )
        await add(
            '5 radio group, Test result',
            rate,
            await steps(page, rate, 16, [
                ['pick Positive', ALWAYS, radio('Positive'), 'click'],
                ['pick Negative', ALWAYS, radio('Negative'), 'click'],
            ])
        )
        await clickAt(page, field(page, 'DATE'))
        const dateKeys: Step[] = [
            ['select all', ALWAYS, press('ControlOrMeta+a')],
        ]
        for (const [at, key] of [...'2026-11-05'].entries())
            dateKeys.push([`key ${at + 1}`, ALWAYS, press(key)])
        const typedDate = await steps(page, rate, 4, dateKeys)
        typedDate.delete('select all')
        await add(
            '6 date',
            rate,
            new Map([['typing', [...typedDate.values()].flat()]])
        )
        const commits: Stamp[] = []
        for (let at = 0; at < 16; at += 1) {
            await clickAt(page, field(page, 'DATE'))
            await page.keyboard.press('ControlOrMeta+a')
            await page.keyboard.type(`2026-10-${10 + at}`)
            await expectNext(page, { name: 'focusLabel', arg: 'Choose date' })
            commits.push(await timed(page, rate, press('Tab')))
        }
        await add(
            '6 date',
            rate,
            new Map([['Tab out (to the picker button)', commits.slice(1)]])
        )
        const picker = page
            .locator('form [id$="-DATE"]')
            .locator('xpath=following::button[1]')
        await add(
            '6 date picker',
            rate,
            await steps(page, rate, 16, [
                [
                    'open (click)',
                    has('[role=grid]'),
                    () => clickAt(page, picker),
                    'click',
                ],
                ['close (Escape)', lacks('[role=grid]'), press('Escape')],
            ])
        )

        for (const [preset, first] of [
            [LONG, '150'],
            ['RMNCH First ANC', ''],
        ] as const) {
            await openPreset(page, preset, rate)
            if (first !== '') {
                await clickAt(page, field(page, 'f001'))
                await page.keyboard.type(first)
                await page.keyboard.press('Tab')
            }
            const why = page
                .locator('form button')
                .filter({ hasText: /^Why\?/, visible: true })
                .first()
            const toggle = page
                .locator('form button[aria-expanded]')
                .filter({ hasText: 'hidden by rules', visible: true })
                .first()
            await add(
                `7 ${preset}`,
                rate,
                await steps(page, rate, 16, [
                    // Opened first: most of RMNCH's Why? buttons are on its hidden questions.
                    [
                        'hidden questions open',
                        expanded(true),
                        () => clickAt(page, toggle),
                        'click',
                    ],
                    [
                        'Why? open',
                        has(DIALOG),
                        () => clickAt(page, why),
                        'click',
                    ],
                    ['Why? close (Escape)', lacks(DIALOG), press('Escape')],
                    [
                        'hidden questions close',
                        expanded(false),
                        () => clickAt(page, toggle),
                        'click',
                    ],
                ])
            )
        }

        await openPreset(page, CHILD, rate)
        const save = page.getByRole('button', { name: /^(Save|Saving…)$/ })
        const complete = page.getByRole('button', {
            name: /^(Complete|Completing…)$/,
        })
        const temperature = () => clickAt(page, field(page, 'labTempC001'))
        await add(
            '8 blocked Save',
            rate,
            await steps(page, rate, 16, [
                ['focus elsewhere', ALWAYS, temperature, 'click'],
                [
                    'Save → focus on Weight',
                    focusOn('labWeight01'),
                    () => clickAt(page, save),
                    'click',
                ],
            ])
        )
        await clickAt(page, field(page, 'labWeight01'))
        await page.keyboard.type('150')
        await page.keyboard.press('Tab')
        await add(
            '8 Complete anyway?',
            rate,
            await steps(page, rate, 16, [
                [
                    'Complete → dialog',
                    has(DIALOG),
                    () => clickAt(page, complete),
                    'click',
                ],
                ['Escape → closed', lacks(DIALOG), press('Escape')],
            ])
        )
        const saved = async () => {
            await page
                .getByRole('button', { name: 'Save', exact: true })
                .waitFor()
            await temperature()
        }
        await add(
            '8 Save',
            rate,
            await steps(page, rate, 16, [
                [
                    'Save → "Saving…"',
                    { name: 'buttonText', arg: 'Saving…' },
                    () => clickAt(page, save),
                    'click',
                ],
                ['saved', ALWAYS, saved, 'click'],
            ])
        )
    }
    table('5–8: input to the paint showing its result (ms)', rows, [
        'case',
        'rate',
        'n',
        'median',
        'p95',
        'max',
    ])
    record('5-8-controls', Object.fromEntries(results))
})

test('9 scroll the Long form top to bottom', async ({ page }) => {
    const results = new Map<string, object>()
    const rows: Row[] = []
    for (const rate of RATES) {
        await openPreset(page, LONG, rate)
        const box = await page.locator('.lab-graticule').boundingBox()
        await page.mouse.move(
            (box?.x ?? 0) + (box?.width ?? 0) / 2,
            (box?.y ?? 0) + (box?.height ?? 0) / 2
        )
        const frames = async (act: () => Promise<void>) => {
            await page.evaluate(() => {
                // Its own array: a loop from an earlier call stops once `frames` is another one.
                const mine: number[] = []
                window.__efp.frames = mine
                const tick = (t: number) => {
                    if (window.__efp.frames === mine) {
                        mine.push(t)
                        requestAnimationFrame(tick)
                    }
                }
                requestAnimationFrame(tick)
            })
            const from = await now(page)
            await act()
            const times = await page.evaluate(() => {
                const mine = window.__efp.frames ?? []
                window.__efp.frames = undefined
                return mine
            })
            const gaps = times.slice(1).map((t, at) => t - (times[at] ?? t))
            const interval = stats(gaps).median
            const { loafs } = await entriesSince(page, from)
            return {
                frames: times.length,
                gaps: stats(gaps),
                missed: gaps.reduce(
                    (sum, gap) =>
                        sum +
                        (gap > 1.5 * interval
                            ? Math.round(gap / interval) - 1
                            : 0),
                    0
                ),
                longFrames: loafs.length,
            }
        }
        const idle = await frames(() => sleep(1000))
        const scroll = await frames(async () => {
            for (let at = 0; at < 140; at += 1) {
                await page.mouse.wheel(0, 100)
                await sleep(16)
            }
            await sleep(500)
        })
        results.set(`@${rate}x`, { idle, scroll })
        rows.push([
            'idle 1 s',
            `${rate}x`,
            idle.frames,
            idle.gaps.median,
            idle.gaps.max,
            idle.missed,
            idle.longFrames,
        ])
        rows.push([
            'wheel 140×100 px',
            `${rate}x`,
            scroll.frames,
            scroll.gaps.median,
            scroll.gaps.max,
            scroll.missed,
            scroll.longFrames,
        ])
    }
    table('9 scroll: frame gaps', rows, [
        'case',
        'rate',
        'frames',
        'gap median',
        'gap max',
        'missed',
        'LoAF≥50',
    ])
    record('9-scroll', Object.fromEntries(results))
})

test('11 memory: after opening, 200 commits, 20 and 40 preset switches', async ({
    page,
}) => {
    const cdp = await throttle(page, 1)
    const heap = async () => {
        await cdp.send('HeapProfiler.collectGarbage')
        const { usedSize } = await cdp.send('Runtime.getHeapUsage')
        const { nodes, jsEventListeners } = await cdp.send(
            'Memory.getDOMCounters'
        )
        return {
            heapMb: Math.round(usedSize / 1e5) / 10,
            nodes,
            listeners: jsEventListeners,
        }
    }
    await openPreset(page, LONG, 1)
    const opened = await heap()
    for (let at = 0; at < 200; at += 1) {
        await clickAt(page, field(page, 'f010'))
        await page.keyboard.press('ControlOrMeta+a')
        await page.keyboard.type(String(at))
        await page.keyboard.press('Tab')
    }
    await sleep(500)
    const committed = await heap()
    const cycle = [
        [CHILD, 'labWeight01'],
        ['RMNCH First ANC', 'de0FEHSIoxh'],
        ['Every value type', 'TEXT'],
        [LONG, 'f001'],
    ] as const
    const switched = []
    for (let round = 0; round < 2; round += 1) {
        for (let at = 0; at < 20; at += 1) {
            const [preset, first] = cycle[at % cycle.length] ?? cycle[0]
            await clickAt(
                page,
                page.getByRole('button', { name: preset, exact: true })
            )
            await page.waitForFunction((id) => {
                const date = document.querySelector<HTMLInputElement>(
                    'form input[id$="-occurredAt"]'
                )
                return (
                    date?.readOnly === false &&
                    document.querySelector(`form [id$="-${id}"]`) !== null
                )
            }, first)
        }
        await sleep(500)
        switched.push(await heap())
    }
    const result = {
        opened,
        after200Commits: committed,
        after20Switches: switched[0],
        after40Switches: switched[1],
    }
    table(
        '11 memory (1×, after a forced GC)',
        Object.entries(result).map(([when, v]) => [
            when,
            v?.heapMb ?? '',
            v?.nodes ?? '',
            v?.listeners ?? '',
        ]),
        ['when', 'JS heap MB', 'DOM nodes', 'listeners']
    )
    record('11-memory', result)
})

test('12 bundle: what the block adds, gzipped', async ({
    page: _page,
}, testInfo) => {
    const result = bundle(`${testInfo.config.rootDir}/../../apps/docs/dist`)
    table(
        '12 bundle (gzip KB)',
        [
            ['docs shell', result.shellKb],
            ['event-form chunk', result.ownChunkKb],
            ['event-form chunks beyond the shell', result.blockKb],
            ['lab-only chunks', result.labOnlyKb],
            ['rule engine (dynamic import)', result.ruleEngineKb],
        ],
        ['what', 'KB']
    )
    record('12-bundle', result)
})
