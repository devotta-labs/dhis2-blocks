/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { SpreadsheetGrid, cellKey } from '@/components/spreadsheet'
import { control, paste } from '@/components/spreadsheet/grid/__tests__/gridRig'
import type { TrackerColumn } from '../model/types'
import { outboxName } from '../outbox/outbox'
import type { LoadedForm } from '../sources/types'
import { TrackerDataEntrySummary } from '../summary/TrackerDataEntrySummary'
import {
    BLOCKED,
    cleanUp,
    freshServer,
    KEY,
    later,
    leaving,
    memorySource,
    mount,
    notesOf,
    records,
    USER,
    visit,
    visitForm,
} from './__tests__/rig'
import { liveRegion } from '../../../test/liveRegion'

afterEach(cleanUp)

const CHILDREN = cellKey('r1', 'c1')

test('the app re-rendering above the data provider neither reloads the form nor loses an edit', async () => {
    const memory = memorySource(visitForm())
    const { rerender } = await mount(memory.source)
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.element(control(CHILDREN)).toHaveValue('5')
    await rerender()
    await later(100)
    expect(memory.loads()).toBe(1)
    expect(control(CHILDREN)).toHaveValue('5')
})

test('the app moving to another server loads the form again, for that server', async () => {
    const memory = memorySource(visitForm())
    const { rerender, view } = await mount(memory.source)
    await rerender(freshServer())
    await expect.poll(() => memory.loads()).toBe(2)
    await expect.poll(() => view().status).toBe('ready')
})

test('a typed value is saved on this device, then saved', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const { server, context } = await mount(memory.source)
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(() => notesOf(CHILDREN)).toContain('Saved on this device')
    // On the device, with what the save needs to know of its row.
    await expect
        .poll(() => records(server, KEY))
        .toMatchObject([
            {
                key: CHILDREN,
                value: '5',
                base: null,
                record: { id: 'r1', programStageId: 's1', orgUnitId: 'o1' },
                state: 'queued',
            },
        ])
    expect((await records(server, KEY))[0].record?.isNew).toBeFalsy()

    memory.release()
    await expect
        .poll(() => notesOf(CHILDREN))
        .not.toContain('Saved on this device')
    expect(context().store.getState().cells[CHILDREN]).toMatchObject({
        value: '5',
        base: '5',
        sync: 'saved',
    })
    await expect.poll(() => records(server, KEY)).toEqual([])
})

test('unsent changes come back after the provider remounts', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const first = await mount(memory.source)
    await userEvent.click(page.getByRole('button', { name: 'Add event' }))
    // The new row's first open cell has focus.
    await userEvent.keyboard('3{Enter}')
    const added = first.context().tables[0].rows.at(-1)?.id ?? ''
    await expect
        .poll(() => records(first.server, KEY))
        .toMatchObject([
            {
                key: cellKey(added, 'c1'),
                value: '3',
                record: {
                    id: added,
                    programStageId: 's1',
                    orgUnitId: 'o1',
                    isNew: true,
                },
            },
        ])
    await first.screen.unmount()

    const second = await mount(memory.source, { server: first.server })
    expect(second.context().tables[0].rows.map(({ id }) => id)).toEqual([
        'r1',
        'r2',
        added,
    ])
    expect(notesOf(cellKey(added, 'c1'))).toContain('Saved on this device')
    expect(control(cellKey(added, 'c1'))).toHaveValue('3')
    // The restored row is closed where new rows are.
    expect(() => control(cellKey(added, 'c3'))).toThrow()
})

test('the form loads once per mount: an app-wide invalidation never loads it again under the person', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const first = await mount(memory.source)
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await first.client.invalidateQueries()
    await later(200)
    expect(memory.loads()).toBe(1)
    expect(control(CHILDREN)).toHaveValue('5')
    await first.screen.unmount()

    // A remount loads the form, and asks who is signed in, again.
    const second = await mount(memory.source, {
        server: first.server,
        client: first.client,
    })
    expect(memory.loads()).toBe(2)
    expect(second.meSignals.length).toBeGreaterThan(0)
})

test('the leave-page prompt is armed while anything is unsent', async () => {
    const leave = leaving
    const memory = memorySource(visitForm())
    memory.hold()
    await mount(memory.source)
    expect(leave()).toBe(false)
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}')
    await expect.poll(leave).toBe(true)
    memory.release()
    await expect.poll(leave).toBe(false)
})

test('announces outcomes once, politely', async () => {
    const memory = memorySource(visitForm())
    await mount(memory.source)
    const region = liveRegion()
    const said: string[] = []
    new MutationObserver(() => said.push(region.textContent ?? '')).observe(
        region,
        { childList: true, characterData: true, subtree: true }
    )
    control(CHILDREN).focus()
    await userEvent.keyboard('5{Enter}6{Enter}')
    await expect
        .poll(() => said.filter(Boolean), { timeout: 3000 })
        .toEqual(['All changes saved'])
    await later(1000)
    expect(said.filter(Boolean)).toEqual(['All changes saved'])
})

test('complete is refused while a required field is empty', async () => {
    const memory = memorySource(visitForm())
    const { view } = await mount(memory.source)
    expect(await view().complete('r1')).toEqual([
        {
            sourceKey: KEY,
            key: CHILDREN,
            result: 'failed',
            reason: 'Children is required',
        },
    ])
    expect(memory.statuses).toEqual([])

    control(CHILDREN).focus()
    await userEvent.keyboard('2{Enter}')
    expect(await view().complete('r1')).toEqual([
        { sourceKey: KEY, key: 'r1.status', result: 'saved' },
    ])
    expect(memory.statuses).toEqual([['r1', 'COMPLETED']])
    await expect
        .element(page.getByRole('rowheader', { name: 'Visit 1' }))
        .toHaveTextContent('Completed')
})

test('complete checks only the row it completes', async () => {
    const memory = memorySource(
        visitForm({
            rows: [visit('r1', 'Visit 1'), visit('r10', 'Visit 10')],
            values: [
                ['r1.c1', '1'],
                ['r10.c1', '1'],
            ],
        })
    )
    const { view } = await mount(memory.source)
    control(cellKey('r10', 'c1')).focus()
    await userEvent.keyboard('abc{Enter}')
    // `r10.` starts with `r1`: its error is not `r1`'s.
    expect(await view().complete('r1')).toMatchObject([{ result: 'saved' }])
    expect(await view().complete('r10')).toEqual([
        {
            sourceKey: KEY,
            key: 'r10.c1',
            result: 'failed',
            reason: 'Enter a whole number',
        },
    ])
    expect(memory.statuses).toEqual([['r1', 'COMPLETED']])
})

test('completing a row sends its unsent values first', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const { view } = await mount(memory.source)
    control(CHILDREN).focus()
    await userEvent.keyboard('2{Enter}')
    const completing = view().complete('r1')
    await expect.poll(() => memory.sent).toHaveLength(1)
    await later(100)
    expect(memory.statuses).toEqual([])
    memory.release()
    expect(await completing).toEqual([
        { sourceKey: KEY, key: 'r1.status', result: 'saved' },
    ])
    expect(memory.statuses).toEqual([['r1', 'COMPLETED']])
})

test('a status saved in this session changes what the row allows', async () => {
    const memory = memorySource(
        visitForm({
            rows: [visit('r1', 'Visit 1'), visit('r2', 'Visit 2', 'COMPLETED')],
            values: [
                ['r1.c1', '1'],
                ['r2.c1', '1'],
            ],
            readOnlyRecords: [['r2', BLOCKED]],
            canReopen: ['r2'],
            blockedWhenCompleted: BLOCKED,
        })
    )
    const { view } = await mount(memory.source)
    const locked = (row: string) =>
        control(cellKey(row, 'c1')).hasAttribute('readonly')
    expect([locked('r1'), locked('r2')]).toEqual([false, true])

    // Completed here, in a stage that blocks entry: read-only, and the user may reopen it.
    expect(await view().complete('r1')).toMatchObject([{ result: 'saved' }])
    await expect.poll(() => locked('r1')).toBe(true)
    expect(notesOf(CHILDREN)).toContain(BLOCKED)
    expect(await view().reopen('r1')).toMatchObject([{ result: 'saved' }])
    await expect.poll(() => locked('r1')).toBe(false)
    // Completed when loaded: editable again once reopened.
    expect(await view().reopen('r2')).toMatchObject([{ result: 'saved' }])
    await expect.poll(() => locked('r2')).toBe(false)
    expect(memory.statuses).toEqual([
        ['r1', 'COMPLETED'],
        ['r1', 'ACTIVE'],
        ['r2', 'ACTIVE'],
    ])
})

test('measures how long the form took to be ready', async () => {
    performance.clearMeasures('data-entry:ready')
    await mount(memorySource(visitForm()).source)
    await expect
        .poll(() => performance.getEntriesByName('data-entry:ready', 'measure'))
        .toHaveLength(1)
})

test('completing asks again who is signed in once the row’s changes are sent', async () => {
    let user = 'userA'
    const memory = memorySource(visitForm())
    memory.hold()
    const { view } = await mount(memory.source, { signedIn: () => user })
    control(CHILDREN).focus()
    await userEvent.keyboard('2{Enter}')
    const completing = view().complete('r1')
    await expect.poll(() => memory.sent).toHaveLength(1)
    // Someone else signs in while the row's changes are on their way.
    user = 'userB'
    memory.release()
    expect(await completing).toMatchObject([
        {
            key: 'r1.status',
            result: 'failed',
            reason: 'Signed in as someone else. Reload to continue as that user.',
        },
    ])
    expect(memory.statuses).toEqual([])
})

test('a new row names its stage when the form gives one', async () => {
    const form = visitForm()
    const memory = memorySource({
        ...form,
        newRows: {
            tableId: 't1',
            programStageId: 's1',
            orgUnitId: 'o1',
            stage: 'Antenatal visit',
        },
    })
    const { context, tracker } = await mount(memory.source)
    await userEvent.click(page.getByRole('button', { name: 'Add event' }))
    const added = context().tables[0].rows.at(-1)
    expect(added).toMatchObject({ stage: 'Antenatal visit' })
    expect(tracker().records.get(added?.id ?? '')).toMatchObject({
        isNew: true,
    })
})

test('complete and reopen send nothing while someone else is signed in', async () => {
    let user = 'userA'
    const memory = memorySource(
        visitForm({
            rows: [visit('r1', 'Visit 1'), visit('r2', 'Visit 2', 'COMPLETED')],
            values: [['r1.c1', '1']],
            canReopen: ['r2'],
        })
    )
    const { view } = await mount(memory.source, { signedIn: () => user })
    user = 'userB'
    const locked = (row: string) => [
        {
            sourceKey: KEY,
            key: `${row}.status`,
            result: 'failed',
            reason: 'Signed in as someone else. Reload to continue as that user.',
        },
    ]
    expect(await view().complete('r1')).toEqual(locked('r1'))
    expect(await view().reopen('r2')).toEqual(locked('r2'))
    expect(memory.statuses).toEqual([])
})

test('completing is refused at once offline, and going offline ends the wait for the row’s changes', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const { view } = await mount(memory.source)
    const offline = [
        {
            sourceKey: KEY,
            key: 'r1.status',
            result: 'failed',
            reason: 'You are offline',
        },
    ]
    const online = vi.spyOn(Navigator.prototype, 'onLine', 'get')
    online.mockReturnValue(false)
    expect(await view().complete('r1')).toEqual(offline)

    online.mockReturnValue(true)
    control(CHILDREN).focus()
    await userEvent.keyboard('2{Enter}')
    await expect.poll(() => memory.sent).toHaveLength(1)
    const completing = view().complete('r1')
    await later(200)
    online.mockReturnValue(false)
    window.dispatchEvent(new Event('offline'))
    expect(
        await Promise.race([
            completing,
            later(2000).then(() => 'still waiting'),
        ])
    ).toEqual(offline)
    expect(memory.statuses).toEqual([])
})

test('reopen is offered only for rows in canReopen', async () => {
    const memory = memorySource(
        visitForm({
            rows: [
                visit('r1', 'Visit 1', 'COMPLETED'),
                visit('r2', 'Visit 2', 'COMPLETED'),
            ],
            canReopen: ['r1'],
        })
    )
    const { view } = await mount(memory.source)
    expect(await view().reopen('r2')).toEqual([
        {
            sourceKey: KEY,
            key: 'r2.status',
            result: 'failed',
            reason: 'This row cannot be reopened',
        },
    ])
    expect(memory.statuses).toEqual([])
    expect(await view().reopen('r1')).toMatchObject([{ result: 'saved' }])
    expect(memory.statuses).toEqual([['r1', 'ACTIVE']])
    await expect
        .element(page.getByRole('rowheader', { name: 'Visit 1' }))
        .not.toHaveTextContent('Completed')
    await expect
        .element(page.getByRole('rowheader', { name: 'Visit 2' }))
        .toHaveTextContent('Completed')
})

test('complete refuses a read-only row with its reason, and a row the form does not have', async () => {
    const SKIPPED = 'Skipped events cannot be edited'
    const memory = memorySource(
        visitForm({
            rows: [visit('r1', 'Visit 1'), visit('r2', 'Visit 2', 'SKIPPED')],
            values: [['r2.c1', '1']],
            readOnlyRecords: [['r2', SKIPPED]],
        })
    )
    const { view } = await mount(memory.source)
    const refused = (row: string, reason: string) => [
        { sourceKey: KEY, key: `${row}.status`, result: 'failed', reason },
    ]
    expect(await view().complete('r2')).toEqual(refused('r2', SKIPPED))
    expect(await view().complete('r9')).toEqual(
        refused('r9', 'This row cannot be completed')
    )
    expect(memory.statuses).toEqual([])
})

test('a status waits while any tab holds the sync lock, so no save read before it reopens the row', async () => {
    const memory = memorySource(
        visitForm({
            rows: [visit('r1', 'Visit 1'), visit('r2', 'Visit 2', 'COMPLETED')],
            values: [['r1.c1', '1']],
            canReopen: ['r2'],
        })
    )
    const { server, view } = await mount(memory.source)
    // Another tab's loop, sending.
    const holder = Promise.withResolvers<void>()
    await new Promise<void>((granted) => {
        void navigator.locks.request(
            `dhis2-data-entry-sync:${outboxName(server, USER)}`,
            () => {
                granted()
                return holder.promise
            }
        )
    })
    const completing = view().complete('r1')
    const reopening = view().reopen('r2')
    await later(300)
    expect(memory.statuses).toEqual([])
    holder.resolve()
    expect(await completing).toMatchObject([{ result: 'saved' }])
    expect(await reopening).toMatchObject([{ result: 'saved' }])
    expect(memory.statuses.toSorted()).toEqual([
        ['r1', 'COMPLETED'],
        ['r2', 'ACTIVE'],
    ])
})

test('an option a rule hid is refused when typed or pasted', async () => {
    const memory = memorySource(visitForm())
    const { server, context } = await mount(memory.source)
    const hidden = {
        required: false,
        messages: [],
        hiddenOptions: new Set(['B']),
    }
    context().effects.setState((state) => ({
        cells: { ...state.cells, 'r1.c2': hidden, 'r2.c2': hidden },
    }))
    const error = 'Choose one of the options'

    control(cellKey('r1', 'c2')).focus()
    await userEvent.keyboard('Bravo{Enter}')
    expect(context().store.getState().cells['r1.c2']).toEqual({
        sync: 'idle',
        source: 'person',
        draft: 'Bravo',
        error,
    })

    control(cellKey('r2', 'c2')).focus()
    expect(paste(control(cellKey('r2', 'c2')), 'B')).toBe(true)
    expect(context().store.getState().cells['r2.c2']).toEqual({
        sync: 'idle',
        source: 'person',
        draft: 'B',
        error,
    })
    expect(await records(server)).toEqual([])
})

const SYMPTOMS: TrackerColumn = {
    id: 'c4',
    label: 'Symptoms',
    field: {
        valueType: 'MULTI_TEXT',
        options: [
            { code: 'A', name: 'Alpha' },
            { code: 'B', name: 'Bravo' },
            { code: 'C', name: 'Charlie' },
        ],
    },
}

/** The form with a multi-select column first, where its editor fits the narrow test page. */
const withSymptoms = (form: LoadedForm): LoadedForm => {
    const [table] = form.tables
    return {
        ...form,
        fields: new Map([...form.fields, [SYMPTOMS.id, SYMPTOMS.field]]),
        tables: [
            {
                ...table,
                columns: [SYMPTOMS, ...table.columns],
                headerRows: [
                    [
                        { id: SYMPTOMS.id, label: SYMPTOMS.label, span: 1 },
                        ...table.headerRows[0],
                    ],
                ],
            },
        ],
    }
}

test('a multi-select keeps a hidden option it holds when another is unchecked', async () => {
    const key = cellKey('r1', 'c4')
    const memory = memorySource(
        withSymptoms(visitForm({ values: [[key, 'A,C']] }))
    )
    memory.hold()
    const { server, context } = await mount(memory.source)
    context().effects.setState((state) => ({
        cells: {
            ...state.cells,
            [key]: {
                required: false,
                messages: [],
                hiddenOptions: new Set(['C']),
            },
        },
    }))
    control(key).focus()
    await userEvent.keyboard('{Enter}')
    // The hidden option stays listed, checked; unchecking the other leaves it alone.
    await expect
        .element(page.getByRole('checkbox', { name: 'Charlie' }))
        .toBeChecked()
    await userEvent.click(page.getByRole('checkbox', { name: 'Alpha' }))
    await userEvent.click(page.getByRole('button', { name: 'Save' }))
    expect(context().store.getState().cells[key]).toMatchObject({
        value: 'C',
        base: 'A,C',
    })
    expect(context().store.getState().cells[key]?.error).toBeUndefined()
    await expect
        .poll(() => records(server, KEY))
        .toMatchObject([{ key, value: 'C', base: 'A,C', state: 'queued' }])
})

test('two forms of one program on one page share no DOM id', async () => {
    await mount(memorySource(visitForm()).source, {
        copies: 2,
        children: (
            <>
                <SpreadsheetGrid />
                <TrackerDataEntrySummary />
            </>
        ),
    })
    expect(document.querySelectorAll('table')).toHaveLength(2)
    const ids = [...document.querySelectorAll('[id]')].map(({ id }) => id)
    expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([])
})

test('two forms on one page keep their own ids and share the live regions', async () => {
    const { context } = await mount(
        memorySource(visitForm(), 'memory:a').source,
        {
            after: [memorySource(visitForm(), 'memory:b').source],
        }
    )
    await expect.poll(() => document.querySelectorAll('table').length).toBe(2)
    // Both forms show the cell, each under an id of its own.
    const cells = document.querySelectorAll(`[id$="-cell-${CHILDREN}"]`)
    expect(new Set([...cells].map(({ id }) => id)).size).toBe(2)
    const ids = [...document.querySelectorAll('[id]')].map(({ id }) => id)
    expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([])
    // A refused value is an error, said in the one assertive region the page shares.
    const region = liveRegion('assertive')
    control(CHILDREN).focus()
    await userEvent.keyboard('abc{Enter}')
    const error = context().store.getState().cells[CHILDREN]?.error ?? ''
    expect(error).not.toBe('')
    await expect.poll(() => region.textContent).toBe(error)
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(2)
})
