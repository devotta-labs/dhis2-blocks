import type { Renders } from './event-form-performance.instrument'
import { instrument } from './event-form-performance.instrument'
import { profiled } from './event-form-performance.profile'
import {
    BUDGET_RATE,
    CHILD,
    clickAt,
    expectNext,
    field,
    focusOn,
    LONG,
    openPreset,
    RATES,
    record,
    sleep,
    startCounting,
    stopCounting,
    table,
    timed,
    VIEWPORT,
} from './event-form-performance.support'
import { test } from './fixtures'

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

test('renders: components rendered per keystroke and per commit', async ({
    page,
}) => {
    const results = new Map<string, object>()
    const count = async (
        name: string,
        reps: number,
        setup: (at: number) => Promise<void>,
        act: (at: number) => Promise<void>
    ) => {
        const each: Renders[] = []
        for (let at = 0; at < reps; at += 1) {
            await setup(at)
            await sleep(200)
            await startCounting(page)
            await act(at)
            await sleep(400)
            each.push(await stopCounting(page))
        }
        const rest = each.slice(1)
        const mean = (pick: (r: (typeof each)[number]) => number) =>
            Math.round(
                (rest.reduce((sum, r) => sum + pick(r), 0) / rest.length) * 10
            ) / 10
        results.set(name, {
            first: each[0],
            commits: mean((r) => r.commits),
            components: mean((r) => r.total),
            FormField: mean((r) => r.byName.FormField ?? 0),
            ValueInput: mean((r) => r.byName.ValueInput ?? 0),
        })
    }
    const nothing = async () => {}
    await openPreset(page, LONG, 1, true)
    const load = await stopCounting(page)
    results.set('open Long form (whole load)', {
        commits: load.commits,
        components: load.total,
        ...load.byName,
    })
    await clickAt(page, field(page, 'f075'))
    await count('Long: keystroke in f075', 11, nothing, (at) =>
        page.keyboard.press(String(at % 10))
    )
    const typeIn =
        (id: string, of: (at: number) => string) => async (at: number) => {
            await clickAt(page, field(page, id))
            await page.keyboard.press('ControlOrMeta+a')
            await page.keyboard.type(of(at))
        }
    const tab = () => page.keyboard.press('Tab')
    await count(
        'Long: Tab out of f010',
        6,
        typeIn('f010', (at) => String(20 + at)),
        tab
    )
    await count(
        'Long: Tab out of f001 (chain)',
        6,
        typeIn('f001', (at) => String(at % 2 === 0 ? 150 + at : 50 + at)),
        tab
    )
    await openPreset(page, CHILD, 1)
    await count(
        'Child: Tab out of Weight',
        6,
        typeIn('labWeight01', (at) => String(10 + at)),
        tab
    )
    await count('Child: Sex pick', 6, nothing, (at) =>
        clickAt(
            page,
            field(page, 'labSexCode1').getByRole('radio', {
                name: at % 2 ? 'Female' : 'Male',
                exact: true,
            })
        )
    )
    table(
        'React renders per input (1×; mean after the first)',
        [...results].map(([name, r]) => [name, JSON.stringify(r)]),
        ['input', 'counts']
    )
    record('renders', Object.fromEntries(results))
})

test('profile: where a keystroke and a commit spend their time', async ({
    page,
    browser,
}) => {
    const results = new Map<string, Awaited<ReturnType<typeof profiled>>>()
    const commit =
        (rate: number, id: string, next: string, of: (at: number) => string) =>
        async () => {
            for (let at = 0; at < 15; at += 1) {
                await clickAt(page, field(page, id))
                await page.keyboard.press('ControlOrMeta+a')
                await page.keyboard.type(of(at))
                await expectNext(page, focusOn(next))
                await timed(page, rate, () => page.keyboard.press('Tab'))
            }
        }
    for (const rate of RATES.filter((r) => r <= BUDGET_RATE)) {
        let cdp = await openPreset(page, LONG, rate)
        await clickAt(page, field(page, 'f075'))
        results.set(
            `keystroke f075 @${rate}x`,
            await profiled(
                page,
                browser,
                cdp,
                `keystroke-${rate}x`,
                30,
                async () => {
                    for (let at = 0; at < 30; at += 1)
                        await timed(page, rate, () =>
                            page.keyboard.press(String(at % 10))
                        )
                }
            )
        )
        results.set(
            `commit f010 @${rate}x`,
            await profiled(
                page,
                browser,
                cdp,
                `commit-f010-${rate}x`,
                15,
                commit(rate, 'f010', 'f011', (at) => String(30 + at))
            )
        )
        results.set(
            `commit f001 chain @${rate}x`,
            await profiled(
                page,
                browser,
                cdp,
                `commit-f001-${rate}x`,
                15,
                commit(rate, 'f001', 'f002', (at) =>
                    String(at % 2 ? 150 + at : 50 + at)
                )
            )
        )
        cdp = await openPreset(page, CHILD, rate)
        results.set(
            `commit Weight @${rate}x`,
            await profiled(
                page,
                browser,
                cdp,
                `commit-weight-${rate}x`,
                15,
                commit(rate, 'labWeight01', 'labTempC001', (at) =>
                    String(10 + at)
                )
            )
        )
    }
    for (const [name, { cpu, trace }] of results) {
        table(
            `profile ${name}: ms per input (the typing and clicks between commits included)`,
            [
                ...cpu.perInput,
                ...trace.map(([k, v]) => [`trace: ${k}`, v] as const),
            ].map(([k, v]) => [k, v]),
            ['where', 'ms']
        )
    }
    record('profile', Object.fromEntries(results))
})
