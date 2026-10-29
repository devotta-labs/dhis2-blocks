/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { RMNCH } from '@/components/program-rules/__tests__/rmnch'
import { control } from '../grid/__tests__/gridRig'
import { cellKey } from '../model/types'
import meAdmin from '../sources/__tests__/fixtures/me-admin.json'
import rmnchProgram from '../sources/__tests__/fixtures/rmnch-program.json'
import type { CellKey } from '../model/types'
import type { DataEntrySource, FormPage, LoadedForm } from '../sources/types'
import {
    BLOCKED,
    change,
    cleanUp,
    freshServer,
    KEY,
    later,
    memorySource,
    mount,
    USER,
    visit,
    visitForm,
    withOutbox,
} from './__tests__/rig'
import {
    answering,
    antenatalOf,
    eventId,
    eventsOf,
    fixturePerson,
    personId,
    rmnchForm,
    rmnchSource,
    rulesFor,
} from './__tests__/rmnchRig'
import type { FixtureEvent } from './__tests__/rmnchRig'
import { signedInAsOther } from './signedIn'

afterEach(cleanUp)
beforeEach(() => performance.clearMeasures('data-entry:rules'))

const visits = (from: number, count: number) =>
    Array.from({ length: count }, (_, at) =>
        visit(`r${from + at}`, `Visit ${from + at}`)
    )

/** The source of `form`, whose pages 2, 3, … are `pages` in turn; every page asked for is in `asked`. */
const paged = (
    form: LoadedForm,
    pages: Array<() => Promise<FormPage>>,
    server = freshServer()
) => {
    const memory = memorySource(form)
    const asked: number[] = []
    const source: DataEntrySource = {
        ...memory.source,
        loadPage: async (_engine, number) => {
            asked.push(number)
            const next = pages.shift()
            if (next === undefined) {
                throw new Error(`No page ${number}`)
            }
            return next()
        },
    }
    return { memory, source, asked, server }
}

const ASSIGNED = 'Assigned by rule: Calculate gestational age from LMP'

/** The event with an LMP: the rules give its person's visits a gestational age, and say it under each row's label. */
const withLmp = (event: FixtureEvent, lmp = '2026-01-01'): FixtureEvent => ({
    ...event,
    dataValues: [...event.dataValues, { dataElement: RMNCH.lmp, value: lmp }],
})

const daysAgo = (days: number) =>
    new Date(Date.now() - days * 86_400_000).toLocaleDateString('sv')

const showMore = () => page.getByRole('button', { name: 'Show more events' })

test('"Show more events" appends the page, keeps focus on the button and announces "Events shown: 100"', async () => {
    let answer = () => {}
    const { source, asked } = paged(
        visitForm({ rows: visits(1, 50), hasMore: true }),
        [
            () =>
                new Promise((resolve) => {
                    answer = () =>
                        resolve({
                            ...visitForm({
                                rows: visits(51, 50),
                                values: [[cellKey('r51', 'c3'), 'Late']],
                            }),
                            orgUnitNames: new Map([['ou2', 'Bo']]),
                            hasMore: true,
                        })
                }),
        ]
    )
    const { context } = await mount(source)
    await userEvent.click(showMore())
    // Busy, and still focused: a second press asks for nothing.
    await expect.element(showMore()).toHaveAttribute('aria-busy', 'true')
    await expect.element(showMore()).toHaveAttribute('aria-disabled', 'true')
    await expect.element(showMore()).toHaveFocus()
    await userEvent.click(showMore(), { force: true })
    expect(asked).toEqual([2])

    answer()
    await expect.poll(() => context().tables[0].rows).toHaveLength(100)
    await expect
        .element(page.getByRole('status'))
        .toHaveTextContent('Events shown: 100')
    await expect.element(showMore()).toHaveAttribute('aria-busy', 'false')
    await expect.element(showMore()).toHaveAttribute('aria-disabled', 'false')
    await expect.element(showMore()).toHaveFocus()
    expect(control(cellKey('r100', 'c1'))).toBeInstanceOf(HTMLElement)
    // "Skip past the grid" lands before the button.
    const end = document.getElementById(
        page
            .getByRole('link', { name: 'Skip past the grid' })
            .element()
            .getAttribute('href')
            ?.slice(1) ?? ''
    )
    expect(
        (end?.compareDocumentPosition(showMore().element()) ?? 0) &
            Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(context().store.getState().cells[cellKey('r51', 'c3')]?.value).toBe(
        'Late'
    )
    // A page's names join the form's, so its cells show them.
    expect(context().orgUnitNames.getState().names.get('ou2')).toBe('Bo')
})

test('the button is gone when there is nothing more', async () => {
    const none = paged(visitForm(), [])
    const { screen } = await mount(none.source)
    await later(100)
    await expect.element(showMore()).not.toBeInTheDocument()
    await screen.unmount()

    const { source, asked } = paged(visitForm({ hasMore: true }), [
        async () => ({ ...visitForm({ rows: visits(3, 1) }), hasMore: false }),
    ])
    const { context } = await mount(source)
    await userEvent.click(showMore())
    await expect.element(showMore()).not.toBeInTheDocument()
    expect(context().tables[0].rows).toHaveLength(3)
    // Focus the button held goes past the grid, where the skip link leads.
    const skip = page.getByRole('link', { name: 'Skip past the grid' })
    expect(`#${document.activeElement?.id}`).toBe(
        skip.element().getAttribute('href')
    )
    expect(asked).toEqual([2])
})

test('a page that cannot be loaded is said, and the button stays to try again', async () => {
    const { source, asked } = paged(visitForm({ hasMore: true }), [
        async () => {
            throw new Error('The connection dropped')
        },
        async () => ({ ...visitForm({ rows: visits(3, 1) }), hasMore: true }),
    ])
    const { context } = await mount(source)
    await userEvent.click(showMore())
    await expect
        .element(page.getByRole('status'))
        .toHaveTextContent('The connection dropped')
    await expect.element(showMore()).toHaveAttribute('aria-disabled', 'false')
    await expect.element(showMore()).toHaveFocus()
    expect(context().tables[0].rows).toHaveLength(2)

    await userEvent.click(showMore())
    await expect.poll(() => context().tables[0].rows).toHaveLength(3)
    // The page that failed is asked for again.
    expect(asked).toEqual([2, 2])
})

test('rows already shown are not added twice', async () => {
    const memory = memorySource(visitForm({ hasMore: true }))
    let added = ''
    const source: DataEntrySource = {
        ...memory.source,
        loadPage: async () => ({
            ...visitForm({
                rows: [visit(added, 'Visit 3'), visit('r4', 'Visit 4')],
                values: [
                    [cellKey(added, 'c1'), '1'],
                    [cellKey('r4', 'c1'), '2'],
                ],
            }),
            hasMore: false,
        }),
    }
    const { view, context } = await mount(source)
    view().addRow('t1')
    await expect.poll(() => context().tables[0].rows).toHaveLength(3)
    added = context().tables[0].rows[2].id
    control(cellKey(added, 'c1')).focus()
    await userEvent.keyboard('7{Enter}')
    // Saved this session, the new event comes back on the next page.
    await expect.poll(() => memory.sent).toHaveLength(1)

    await view().loadMore()
    expect(context().tables[0].rows.map(({ id }) => id)).toEqual([
        'r1',
        'r2',
        added,
        'r4',
    ])
    expect(context().store.getState().cells[cellKey(added, 'c1')]?.value).toBe(
        '7'
    )
    expect(context().store.getState().cells[cellKey('r4', 'c1')]?.value).toBe(
        '2'
    )
})

test('a page restores unsent changes for its rows', async () => {
    const server = freshServer()
    const later3 = cellKey('r3', 'c1')
    await withOutbox(server, async (outbox) => {
        await outbox.put(change(later3, '9'))
        await outbox.mark(
            [{ sourceKey: KEY, key: later3 }],
            'failed',
            'Too high'
        )
    })
    const { source } = paged(visitForm({ hasMore: true }), [
        async () => ({
            ...visitForm({ rows: visits(3, 1), values: [[later3, '1']] }),
            hasMore: false,
        }),
    ])
    const { view, context } = await mount(source, { server })
    // Not in the form yet, it is counted as another grid's.
    expect(view().summary.failed).toBe(1)

    await view().loadMore()
    expect(context().store.getState().cells[later3]).toMatchObject({
        value: '9',
        sync: 'failed',
        reason: 'Too high',
    })
    // Now the form's own: counted once.
    await later(100)
    expect(view().summary.failed).toBe(1)
})

test('a row already shown keeps what the form knows of it when a page brings it back completed', async () => {
    const back = visitForm({
        rows: [visit('r1', 'Visit 1', 'COMPLETED'), ...visits(3, 1)],
        readOnlyRows: [
            ['r1', BLOCKED],
            ['r3', BLOCKED],
        ],
    })
    const { source, memory } = paged(
        visitForm({ hasMore: true, values: [[cellKey('r1', 'c1'), '1']] }),
        [
            async () => ({
                ...back,
                tables: back.tables.map((table) => ({
                    ...table,
                    closed: new Map([
                        [cellKey('r1', 'c2'), 'Not used'],
                        [cellKey('r3', 'c2'), 'Not used'],
                    ]),
                })),
                hasMore: false,
            }),
        ]
    )
    const { view, context } = await mount(source)
    await view().loadMore()
    const [table] = context().tables
    expect(table.rows.map(({ id, status }) => [id, status])).toEqual([
        ['r1', 'ACTIVE'],
        ['r2', 'ACTIVE'],
        ['r3', 'ACTIVE'],
    ])
    // The page's facts hold for its new row only.
    expect(table.closed.has(cellKey('r1', 'c2'))).toBe(false)
    expect(table.closed.get(cellKey('r3', 'c2'))).toBe('Not used')
    const readOnly = (key: CellKey) =>
        context().effects.getState().cells[key]?.readOnly
    expect(readOnly(cellKey('r1', 'c1'))).toBe(undefined)
    expect(readOnly(cellKey('r3', 'c1'))).toBe(BLOCKED)
    // Completed here, it may be reopened, as the form knew it: not read-only.
    expect(await view().complete('r1')).toMatchObject([{ result: 'saved' }])
    expect(await view().reopen('r1')).toMatchObject([{ result: 'saved' }])
    expect(memory.statuses).toEqual([
        ['r1', 'COMPLETED'],
        ['r1', 'ACTIVE'],
    ])
})

test('a form that locks keeps the rows of every page loaded', async () => {
    let user = USER
    const { source } = paged(visitForm({ hasMore: true }), [
        async () => ({
            ...visitForm({
                rows: visits(3, 1),
                values: [[cellKey('r3', 'c1'), '4']],
            }),
            hasMore: true,
        }),
    ])
    const { view, context, client } = await mount(source, {
        signedIn: () => user,
    })
    await view().loadMore()
    user = 'userB'
    await client.invalidateQueries({ queryKey: ['data-entry', 'account'] })
    await expect
        .poll(() => view().summary.items.map(({ text }) => text))
        .toEqual([signedInAsOther()])
    expect(context().tables[0].rows.map(({ id }) => id)).toEqual([
        'r1',
        'r2',
        'r3',
    ])
    expect(control(cellKey('r3', 'c1'))).toHaveValue('4')
    await expect.element(showMore()).not.toBeInTheDocument()
})

const rulesRan = () =>
    expect
        .poll(
            () => performance.getEntriesByName('data-entry:rules', 'measure'),
            { timeout: 10_000 }
        )
        .toHaveLength(1)

/** The RMNCH form of `events`, whose next page `loadPage` reads from `next`. */
const rmnchPaged = async (
    events: ReadonlyArray<FixtureEvent>,
    next: ReadonlyArray<FixtureEvent>
) => {
    const memory = memorySource({ ...(await rmnchForm(events)), hasMore: true })
    const source: DataEntrySource = {
        ...memory.source,
        loadPage: (_engine, number) =>
            rmnchSource.loadPage?.(
                answering({
                    program: rmnchProgram,
                    events: { events: next },
                    me: meAdmin,
                }),
                number
            ) ?? Promise.reject(new Error('eventSource pages')),
    }
    return { memory, source }
}

test('a page with a stage the table has no columns for adds those columns', async () => {
    const first = eventsOf(0).filter(
        ({ programStage }) => programStage === RMNCH.stageId
    )
    const secondVisit = 'H693QbyyYhi'
    const second = eventsOf(0)
        .filter(({ programStage }) => programStage === 'edqlbukwRfQ')
        .map((event) => (event.event === secondVisit ? withLmp(event) : event))
    const { source } = await rmnchPaged(first, second)
    const { view, context } = await mount(source, { data: rulesFor() })
    await rulesRan()
    const before = context().tables[0].columns.map(({ id }) => id)

    await view().loadMore()
    const [table] = context().tables
    // The second visit's own fields join at the end.
    const added = ['QM5d0hfSbKk', 'DCUDZxqOxUo', 'SeXllT5ypsh', 'yTDoF5b1OhI']
    expect(table.columns.map(({ id }) => id)).toEqual([...before, ...added])
    await expect
        .element(page.getByRole('columnheader', { name: 'PROM Management' }))
        .toBeInTheDocument()
    expect(table.closed.get(cellKey(RMNCH.eventId, 'SeXllT5ypsh'))).toBe(
        'Not in this stage'
    )
    expect(table.closed.get(cellKey(secondVisit, RMNCH.chronic))).toBe(
        'Not in this stage'
    )
    expect(table.closed.has(cellKey(secondVisit, 'SeXllT5ypsh'))).toBe(false)

    // A cell of a new column takes a value.
    control(cellKey(secondVisit, 'yTDoF5b1OhI')).focus()
    await userEvent.keyboard('Not checked{Enter}')
    expect(
        context().store.getState().cells[cellKey(secondVisit, 'yTDoF5b1OhI')]
            ?.value
    ).toBe('notchecked')
    // The new stage's rows are evaluated too.
    await expect
        .poll(
            () =>
                context().effects.getState().cells[
                    cellKey(secondVisit, RMNCH.gestationalAge)
                ]?.readOnly
        )
        .toBe(ASSIGNED)
})

test('a page row whose unsent change is put back is changed: its rules save there', async () => {
    const [changed, other] = ['H693QbyyYhi', 'LCam2n68lD4']
    const server = freshServer()
    await withOutbox(server, (outbox) =>
        outbox.put(change(cellKey(changed, RMNCH.lmp), '2026-01-01'))
    )
    // Both pages hold both antenatal stages, so the rules stay as they are and learn of the change from the cell.
    const onPage2 = new Set([changed, other])
    const { memory, source } = await rmnchPaged(
        antenatalOf(0).filter(({ event }) => !onPage2.has(event)),
        antenatalOf(0).filter(({ event }) => onPage2.has(event))
    )
    // The change is on its way when the page loads.
    memory.hold()
    const { view, context } = await mount(source, { data: rulesFor(), server })
    await rulesRan()
    await view().loadMore()
    expect(
        context().store.getState().cells[cellKey(changed, RMNCH.lmp)]
    ).toMatchObject({ value: '2026-01-01', sync: 'queued' })

    memory.release()
    const sentKeys = () => memory.sent.flat().map(({ key }) => key)
    await expect
        .poll(sentKeys)
        .toContain(cellKey(changed, RMNCH.gestationalAge))
    // Shown in the other rows, saved only in the changed one.
    expect(
        context().effects.getState().cells[cellKey(other, RMNCH.gestationalAge)]
            ?.readOnly
    ).toBe(ASSIGNED)
    await later(200)
    expect(sentKeys()).not.toContain(cellKey(other, RMNCH.gestationalAge))
})

test('rows of a new person on a page are evaluated with that person', async () => {
    let answer = () => {}
    const answered = new Promise<void>((resolve) => {
        answer = resolve
    })
    const NEW = personId(1)
    // The person's newest visit is only on their record, with an LMP ten weeks and two days ago.
    const newest = eventId('LCam2n68lD4', 1)
    const rules = rulesFor(async (id) => {
        const person = fixturePerson(id)
        if (id !== NEW) {
            return person
        }
        await answered
        return {
            ...person,
            events: person.events.map((event) =>
                event.event === newest ? withLmp(event, daysAgo(72)) : event
            ),
        }
    })
    // The page has their other later visits; the oldest says the LMP was twenty weeks ago.
    const oldest = eventId('yDPqyTvcRpA', 1)
    const laterVisits = antenatalOf(1)
        .filter(
            ({ event, programStage }) =>
                programStage !== RMNCH.stageId && event !== newest
        )
        .map((event) =>
            event.event === oldest ? withLmp(event, daysAgo(142)) : event
        )
    const { memory, source } = await rmnchPaged(antenatalOf(0), laterVisits)
    const { view, context } = await mount(source, { data: rules })
    await rulesRan()

    await view().loadMore()
    const rows = laterVisits.map(({ event }) => event)
    expect(context().tables[0].rows.map(({ id }) => id)).toEqual(
        expect.arrayContaining(rows)
    )
    const notesOf = (row: string) =>
        context().effects.getState().rowNotes.get(row)
    // Until the person loads, their rows are not evaluated: never with the page's LMP alone.
    await later(300)
    for (const row of rows) {
        expect(notesOf(row)).toBe(undefined)
        expect(
            context().effects.getState().cells[
                cellKey(row, RMNCH.gestationalAge)
            ]?.readOnly
        ).toBe(undefined)
    }

    answer()
    // Around midnight the rules' today may be a day off the test's.
    for (const row of rows) {
        await expect
            .poll(() => notesOf(row))
            .toEqual([expect.stringMatching(/^Gest\. age 10\+[1-3]$/)])
    }
    // Loading a page writes nothing: no one changed these rows.
    await later(200)
    expect(memory.sent).toEqual([])
})
