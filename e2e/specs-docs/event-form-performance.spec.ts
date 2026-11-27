import type { Page } from '@playwright/test'
import type { Stamp } from './event-form-performance.instrument'
import { instrument } from './event-form-performance.instrument'
import {
    ALWAYS,
    BUDGET_RATE,
    CHILD,
    clickAt,
    during,
    expectNext,
    field,
    focusOn,
    LONG,
    openPreset,
    RATES,
    record,
    statCells,
    stats,
    summary,
    table,
    timed,
    typeOnSchedule,
    VIEWPORT,
    withinBudget,
    latency,
    type Probe,
    type Row,
} from './event-form-performance.support'
import { expect, test } from './fixtures'

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

const HEADER = ['case', 'rate', 'n', 'median', 'p95', 'max']

interface Load {
    skeleton: number
    form: number
    editable: number
    engineRequested: number
    longFrames: number[]
    shift: number
}

test('1 open: navigation to the first editable field, and a slow network', async ({
    page,
    browser,
}, testInfo) => {
    const presets = [CHILD, 'RMNCH First ANC', LONG, 'Every value type']
    const results = new Map<string, object>()
    const rows: Row[] = []
    const keys = ['skeleton', 'form', 'engineRequested', 'editable'] as const
    for (const rate of RATES) {
        for (const preset of presets) {
            const loads: Load[] = []
            for (let load = 0; load < 5; load += 1) {
                const context = await browser.newContext({
                    baseURL: testInfo.project.use.baseURL,
                    viewport: VIEWPORT,
                    deviceScaleFactor: 1,
                })
                await context.addInitScript(instrument)
                const fresh = await context.newPage()
                await openPreset(fresh, preset, rate)
                loads.push(
                    await fresh.evaluate(() => {
                        const { milestones, loafs, shifts } = window.__efp
                        const engine = performance
                            .getEntriesByType('resource')
                            .find((r) => r.name.includes('/rule-engine-'))
                        return {
                            skeleton: milestones.skeleton ?? NaN,
                            form: milestones.form ?? NaN,
                            editable: milestones.editable ?? NaN,
                            engineRequested: engine?.startTime ?? NaN,
                            longFrames: loafs
                                .filter((l) => l.duration >= 50)
                                .map((l) => Math.round(l.duration)),
                            shift: shifts
                                .filter((s) => !s.recent)
                                .reduce((sum, s) => sum + s.value, 0),
                        }
                    })
                )
                await context.close()
            }
            const median = (key: (typeof keys)[number] | 'shift') =>
                stats(loads.map((l) => l[key])).median
            results.set(`${preset} @${rate}x`, loads)
            rows.push([
                preset,
                `${rate}x`,
                ...keys.map(median),
                Math.round(median('shift') * 1000) / 1000,
            ])
        }
        await openPreset(page, CHILD, rate)
        await clickAt(
            page,
            page.getByRole('button', { name: 'Slow', exact: true })
        )
        await page.evaluate(() =>
            addEventListener('click', (e) => window.__efp.track(e.timeStamp), {
                capture: true,
                once: true,
            })
        )
        await clickAt(
            page,
            page.getByRole('button', { name: 'Restart', exact: true })
        )
        await page.waitForFunction(
            () => window.__efp.milestones.editable !== undefined,
            null,
            { timeout: 60_000 }
        )
        const slow = await page.evaluate(() => window.__efp.milestones)
        results.set(`slow network @${rate}x`, slow)
        rows.push([
            `${CHILD}, slow network (from Restart)`,
            `${rate}x`,
            Math.round(slow.skeleton ?? NaN),
            Math.round(slow.form ?? NaN),
            '',
            Math.round(slow.editable ?? NaN),
            '',
        ])
    }
    table('1 open (median of 5 fresh loads, ms from navigation)', rows, [
        'preset',
        'rate',
        ...keys,
        'shift (no input)',
    ])
    record('1-open', Object.fromEntries(results))
})

const TYPING: ReadonlyArray<readonly [string, string, string]> = [
    [LONG, 'f001', 'number, top'],
    [LONG, 'f002', 'text, top'],
    [LONG, 'f075', 'number, middle'],
    [LONG, 'f076', 'text, middle'],
    [LONG, 'f149', 'number, end'],
    [LONG, 'f150', 'text, end'],
    [CHILD, 'labWeight01', 'Weight (rules read it)'],
]

test('2 typing: per-keystroke latency', async ({ page }, testInfo) => {
    const results = new Map<string, object>()
    const rows: Row[] = []
    const keystrokes = async (name: string, rate: number, keys: string) => {
        await expectNext(page, ALWAYS)
        const stamps = []
        for (let at = 0; at < 30; at += 1) {
            const key = keys[at % keys.length] ?? 'x'
            stamps.push(await timed(page, rate, () => page.keyboard.press(key)))
        }
        const result = {
            ...(await summary(page, stamps)),
            ...(await during(page, stamps)),
        }
        results.set(`${name} @${rate}x`, result)
        rows.push([
            name,
            `${rate}x`,
            ...statCells(result.latency),
            result.longestFrame,
        ])
        return result
    }
    for (const rate of RATES) {
        await openPreset(page, CHILD, rate)
        await page.evaluate(() => {
            const input = Object.assign(document.createElement('input'), {
                id: 'plain-floor',
            })
            input.style.cssText = 'position:fixed;top:0;left:0;z-index:99'
            document.body.append(input)
        })
        await clickAt(page, page.locator('#plain-floor'))
        await keystrokes('floor: a plain <input>, no React', rate, 'x')
        let open = ''
        for (const [preset, id, name] of TYPING) {
            if (open !== preset) {
                await openPreset(page, preset, rate)
                open = preset
            }
            await clickAt(page, field(page, id))
            const keys = name.startsWith('text') ? 'abcdefghij' : '1234567890'
            const result = await keystrokes(`${preset}: ${name}`, rate, keys)
            if (rate === BUDGET_RATE) {
                withinBudget(
                    testInfo,
                    `keystroke p95, ${name} @${rate}x`,
                    result.latency.p95,
                    50
                )
            }
        }
    }
    table('2 typing: keydown to the painted frame (ms)', rows, [
        ...HEADER,
        'longest frame',
    ])
    record('2-typing', Object.fromEntries(results))
})

const tabCommits = async (
    page: Page,
    rate: number,
    id: string,
    values: readonly string[],
    probe: Probe
) => {
    const stamps: Stamp[] = []
    for (const value of values) {
        await clickAt(page, field(page, id))
        await page.keyboard.press('ControlOrMeta+a')
        await page.keyboard.type(value)
        await expectNext(page, probe)
        stamps.push(await timed(page, rate, () => page.keyboard.press('Tab')))
    }
    return stamps
}

const picks = async (
    page: Page,
    rate: number,
    targets: ReadonlyArray<readonly [() => ReturnType<Page['locator']>, Probe]>,
    rounds: number
) => {
    const stamps: Stamp[][] = targets.map(() => [])
    for (let round = 0; round < rounds; round += 1) {
        for (const [at, [target, probe]] of targets.entries()) {
            await expectNext(page, probe)
            const locator = target()
            stamps[at]?.push(
                await timed(page, rate, () => clickAt(page, locator), 'click')
            )
        }
    }
    return stamps
}

const values = (count: number, of: (at: number) => string) =>
    Array.from({ length: count }, (_, at) => of(at))
const absent = (id: string) =>
    ({
        name: 'absent',
        arg: `form [id$="-${id}"]`,
    }) satisfies Probe
const present = (id: string) =>
    ({
        name: 'present',
        arg: `form [id$="-${id}"]`,
    }) satisfies Probe

test('3 commit: Tab out, picks, and the layout shifts they cause', async ({
    page,
}, testInfo) => {
    const results = new Map<string, object>()
    const rows: Row[] = []
    const add = async (name: string, rate: number, all: readonly Stamp[]) => {
        const stamps = all.slice(1)
        const result = {
            ...(await summary(page, stamps)),
            ...(await during(page, stamps)),
        }
        results.set(`${name} @${rate}x`, result)
        rows.push([
            name,
            `${rate}x`,
            ...statCells(result.latency),
            result.focusedMoved.max,
            result.focusLost.length,
        ])
        expect(result.focusLost, `${name} @${rate}x: focus lost`).toEqual([])
        if (rate === BUDGET_RATE) {
            withinBudget(
                testInfo,
                `p95, ${name} @${rate}x`,
                result.latency.p95,
                100
            )
        }
    }
    for (const rate of RATES) {
        await openPreset(page, LONG, rate)
        await add(
            'Long: Tab out of f010 (no rule reads it)',
            rate,
            await tabCommits(
                page,
                rate,
                'f010',
                values(16, (at) => String(10 + at)),
                focusOn('f011')
            )
        )
        await add(
            'Long: Tab out of f001 (3 ASSIGNs, hides f007 every other)',
            rate,
            await tabCommits(
                page,
                rate,
                'f001',
                values(16, (at) => String(at % 2 === 0 ? 150 + at : 50 + at)),
                focusOn('f002')
            )
        )
        await openPreset(page, CHILD, rate)
        await add(
            'Child: Tab out of Weight (ASSIGN chain)',
            rate,
            await tabCommits(
                page,
                rate,
                'labWeight01',
                values(16, (at) => String(10 + at)),
                focusOn('labTempC001')
            )
        )
        await add(
            'Child: Tab out of Temperature (warning on/off)',
            rate,
            await tabCommits(
                page,
                rate,
                'labTempC001',
                values(16, (at) => (at % 2 === 0 ? `39.${at}` : `37.${at}`)),
                focusOn('labDoseMg01')
            )
        )
        const radio = (id: string, name: string) => () =>
            field(page, id).getByRole('radio', { name, exact: true })
        const [male = [], female = []] = await picks(
            page,
            rate,
            [
                [radio('labSexCode1', 'Male'), absent('labPregnant')],
                [radio('labSexCode1', 'Female'), present('labPregnant')],
            ],
            16
        )
        await add('Child: Sex → Male (hides Pregnant)', rate, male)
        await add('Child: Sex → Female (shows Pregnant)', rate, female)
        const [clinic = [], home = []] = await picks(
            page,
            rate,
            [
                [
                    radio('labOutcome1', 'Referred to clinic'),
                    present('labFollowUp'),
                ],
                [radio('labOutcome1', 'Sent home'), absent('labFollowUp')],
            ],
            16
        )
        await add('Child: Outcome → clinic (shows a section)', rate, clinic)
        await add('Child: Outcome → home (hides a section)', rate, home)
        const danger = () =>
            field(page, 'labDanger01').getByRole('checkbox', {
                name: 'Convulsions',
            })
        const [checks = []] = await picks(page, rate, [[danger, ALWAYS]], 16)
        await add('Child: Danger signs checkbox', rate, checks)
    }
    table(
        '3 commit: input to the paint showing its result (ms), and 10 layout',
        rows,
        [...HEADER, 'focused moved px', 'focus lost']
    )
    record('3-commit', Object.fromEntries(results))
})

test('4 fast entry: type-Tab through 20 fields at 80 ms per key', async ({
    page,
}) => {
    const results = new Map<string, object>()
    const rows: Row[] = []
    const ids = values(20, (at) => `f${String(11 + at).padStart(3, '0')}`)
    const typed = ids.map((id, at) =>
        Number(id.slice(1)) % 2 === 1 ? String(100 + at) : `n${at}x`
    )
    const keys = typed.flatMap((text) => [...text, 'Tab'])
    for (const rate of RATES) {
        await openPreset(page, LONG, rate)
        await clickAt(page, field(page, ids[0] ?? 'f011'))
        await expectNext(page, ALWAYS)
        const stamps = await typeOnSchedule(page, keys, 80)
        const focusAtEnd = await page.evaluate(() =>
            document.activeElement?.id.replace(/^.*?-/, '')
        )
        const got = await Promise.all(
            ids.map((id) => field(page, id).inputValue())
        )
        const wrong = ids.flatMap((id, at) =>
            got[at] === typed[at]
                ? []
                : [`${id}: "${got[at]}" for "${typed[at]}"`]
        )
        const total =
            Math.max(...stamps.map((s) => s.shown ?? 0)) - (stamps[0]?.t ?? 0)
        const extra = await during(page, stamps)
        const perKey = stats(stamps.map(latency))
        results.set(`@${rate}x`, {
            keys: keys.length,
            stamps: stamps.length,
            total,
            wrong,
            focusAtEnd,
            perKey,
            ...extra,
        })
        rows.push([
            'f011–f030',
            `${rate}x`,
            keys.length,
            (keys.length - 1) * 80,
            Math.round(total),
            perKey.median,
            perKey.max,
            wrong.length,
            focusAtEnd ?? '',
            extra.longTasksOver50,
        ])
        expect(stamps, `@${rate}x: every key arrived`).toHaveLength(keys.length)
        expect(wrong, `@${rate}x: dropped or reordered keys`).toEqual([])
        expect(focusAtEnd, `@${rate}x: focus after the last Tab`).toBe('f031')
    }
    table('4 fast entry', rows, [
        'case',
        'rate',
        'keys',
        'ideal ms',
        'first key to last paint',
        'key median',
        'key max',
        'wrong fields',
        'focus at end',
        'long tasks',
    ])
    record('4-fast-entry', Object.fromEntries(results))
})
