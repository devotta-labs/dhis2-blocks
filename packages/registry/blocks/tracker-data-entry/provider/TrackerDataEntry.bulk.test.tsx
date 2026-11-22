/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { cellKey } from '@/components/spreadsheet'
import { nextFrame } from '@/components/spreadsheet/grid/__tests__/gridRig'
import type { CellKey } from '@/components/spreadsheet'
import type { TrackerRow } from '../model/types'
import type { OutboxRecord } from '../outbox/outbox'
import {
    BCG,
    BIRTH_DATE,
    ENROLLED_AT,
    enrolledAs,
    engineFor,
    FIRST_NAME,
    immunisationRegister,
} from '../register/__tests__/registerRig'
import { EVENT_DATE_COLUMN } from '../sources/eventSchemas'
import { cleanUp, memorySource, mount, visitForm } from './__tests__/rig'

afterEach(cleanUp)

const DIALOG = 'Create events?'

/** The column's value popover, named by its header. */
const popover = (column: string) => page.getByRole('dialog', { name: column })

/** Opens the column's popover, types `text` into its control, ticks Overwrite and presses Apply. */
const applyToColumn = async (column: string, text: string) => {
    await page.getByRole('button', { name: `Column actions ${column}` }).click()
    await page
        .getByRole('menuitem', { name: 'Apply value to all column cells' })
        .click()
    await userEvent.keyboard(`${text}{Enter}`)
    await popover(column)
        .getByRole('checkbox', { name: 'Overwrite existing values' })
        .click()
    await popover(column).getByRole('button', { name: 'Apply' }).click()
}

/**
 * The immunisation register whose BCG slot of the last `missing` of its three children holds no event, saving through
 * the register's own saver to a DHIS2 that imports everything; `sent` holds what each save was handed. `ruleless`
 * leaves its program rules out, so completing waits for none.
 */
const mountRegister = async (missing = 2, ruleless = false) => {
    const rig = engineFor({
        enrollments: enrolledAs((enrollment, at) => ({
            ...enrollment,
            events: enrollment.events.filter(
                ({ dataValues }) =>
                    at < 3 - missing ||
                    !dataValues.some(({ value }) => value === 'BCG')
            ),
        })),
    })
    const immunisation = immunisationRegister()
    const loaded = await immunisation.load(rig.engine)
    const form = ruleless ? { ...loaded, rules: undefined } : loaded
    const sent: OutboxRecord[][] = []
    const mounted = await mount({
        ...memorySource(form, immunisation.key).source,
        save: (_engine, records, loaded) => {
            sent.push([...records])
            return immunisation.save(rig.engine, records, loaded)
        },
    })
    const rows: TrackerRow[] = mounted.context().tables[0].rows
    const bcg = rows.map(({ slots }) =>
        cellKey(slots?.[BCG] ?? '', EVENT_DATE_COLUMN)
    )
    return { ...mounted, rig, sent, rows, bcg }
}

const valuesOf = (
    { context }: Awaited<ReturnType<typeof mount>>,
    keys: ReadonlyArray<CellKey>
) => keys.map((key) => context().store.getState().cells[key]?.value)

test('person and enrolment columns have no column button and are left alone by a row’s actions', async () => {
    const mounted = await mountRegister()
    const buttons = page.getByRole('button', { name: /^Column actions/ })
    await expect.poll(() => buttons.elements().length).toBeGreaterThan(0)
    // Only the columns near the view are drawn: the buttons are counted as the table scrolls past them.
    const seen = new Set<string>()
    const region = page.getByRole('region').element()
    for (
        let left = 0;
        left <= region.scrollWidth;
        left += region.clientWidth / 2
    ) {
        region.scrollLeft = left
        await nextFrame()
        await nextFrame()
        for (const button of buttons.elements()) {
            seen.add(button.getAttribute('aria-labelledby') ?? '')
        }
        expect(
            page
                .getByRole('button', { name: 'Column actions Registered' })
                .query()
        ).toBeNull()
    }
    expect(seen.size).toBe(4)
    region.scrollLeft = 0
    await nextFrame()

    const [first] = mounted.rows
    const person = first?.slots?.person ?? ''
    const kept = [
        cellKey(person, FIRST_NAME),
        cellKey(person, BIRTH_DATE),
        cellKey(first?.id ?? '', ENROLLED_AT),
    ]
    const before = valuesOf(mounted, kept)
    expect(before.every((value) => value !== undefined)).toBe(true)
    await page.getByRole('button', { name: /^Row actions Amara/ }).click()
    await page.getByRole('menuitem', { name: 'Clear row' }).click()
    expect(valuesOf(mounted, [mounted.bcg[0] ?? ''])).toEqual([undefined])
    expect(valuesOf(mounted, kept)).toEqual(before)
})

test('a column apply that creates events asks first; Cancel writes nothing, and once created it asks no more', async () => {
    const mounted = await mountRegister()
    const { bcg, rig, sent } = mounted
    const before = valuesOf(mounted, bcg)
    expect(before.map((value) => value !== undefined)).toEqual([
        true,
        false,
        false,
    ])

    await applyToColumn('BCG 0', '2026-10-20')
    const dialog = page.getByRole('alertdialog', { name: DIALOG })
    await expect
        .element(dialog)
        .toHaveAccessibleDescription('This creates 2 events on this page.')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    expect(valuesOf(mounted, bcg)).toEqual(before)
    expect(sent).toEqual([])

    await applyToColumn('BCG 0', '2026-10-20')
    await dialog.getByRole('button', { name: 'Create events' }).click()
    await expect.element(dialog).not.toBeInTheDocument()
    expect(valuesOf(mounted, bcg)).toEqual([
        '2026-10-20',
        '2026-10-20',
        '2026-10-20',
    ])
    await expect
        .poll(() =>
            sent
                .flat()
                .filter(({ key }) => bcg.includes(key))
                .map(({ key, value }) => [key, value])
                .sort()
        )
        .toEqual(bcg.map((key) => [key, '2026-10-20']).sort())
    const created = bcg.slice(1).map((key) => key.slice(0, key.indexOf('.')))
    // Each new event is in an import, by its id.
    await expect
        .poll(() =>
            created.filter((event) =>
                JSON.stringify(rig.mutations).includes(`"event":"${event}"`)
            )
        )
        .toEqual(created)
    // The rig's DHIS2 returns no event before an import, so only the created ones are saved.
    await expect
        .poll(() =>
            bcg
                .slice(1)
                .map(
                    (key) => mounted.context().store.getState().cells[key]?.sync
                )
        )
        .toEqual(['saved', 'saved'])

    await applyToColumn('BCG 0', '2026-10-21')
    expect(dialog.query()).toBeNull()
    expect(valuesOf(mounted, bcg)).toEqual([
        '2026-10-21',
        '2026-10-21',
        '2026-10-21',
    ])
})

test('a column apply that creates one event says so in the singular', async () => {
    const mounted = await mountRegister(1)
    await applyToColumn('BCG 0', '2026-10-20')
    const dialog = page.getByRole('alertdialog', { name: DIALOG })
    await expect
        .element(dialog)
        .toHaveAccessibleDescription('This creates 1 event on this page.')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(mounted.sent).toEqual([])
})

test('a column apply in an event grid asks nothing', async () => {
    const mounted = await mount(memorySource(visitForm()).source)
    await applyToColumn('Children', '4')
    expect(page.getByRole('alertdialog').query()).toBeNull()
    expect(valuesOf(mounted, ['r1.c1', 'r2.c1'])).toEqual(['4', '4'])
})

test('completing an event leaves the grid’s context alone, and a column apply after it still counts the events it creates', async () => {
    const mounted = await mountRegister(2, true)
    const { bcg, context, view } = mounted
    const before = context()
    const event = bcg[0]?.slice(0, bcg[0].indexOf('.')) ?? ''
    expect(await view().complete(event)).toMatchObject([{ result: 'saved' }])
    await expect
        .poll(() => view().records.get(event))
        .toMatchObject({ status: 'COMPLETED' })
    // A new context would render every cell again.
    expect(context().confirmBulk).toBe(before.confirmBulk)

    await applyToColumn('BCG 0', '2026-10-20')
    await expect
        .element(page.getByRole('alertdialog', { name: DIALOG }))
        .toHaveAccessibleDescription('This creates 2 events on this page.')
})
