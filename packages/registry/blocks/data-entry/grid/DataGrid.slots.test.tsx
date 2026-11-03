/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import type { Field } from '@/components/dhis2-value-types'
import { cellDomId } from '../cells/cellProps'
import type { CellKey, GridColumn } from '../model/types'
import {
    cleanUp,
    KEY,
    memorySource,
    mount,
    notesOf,
    records,
} from '../provider/__tests__/rig'
import type { LoadedForm } from '../sources/types'
import { DataEntrySummary } from '../summary/DataEntrySummary'
import { control, focused, paste } from './__tests__/gridRig'
import { DataGrid } from './DataGrid'

afterEach(cleanUp)

const INTEGER: Field = { valueType: 'INTEGER' }
const FIRST: CellKey = 'e1.a'
const SECOND: CellKey = 'e2.a'
const COLUMNS: GridColumn[] = [
    {
        id: 'first:a',
        label: 'First',
        field: INTEGER,
        slot: 'first',
        fieldId: 'a',
    },
    {
        id: 'second:a',
        label: 'Second',
        field: INTEGER,
        slot: 'second',
        fieldId: 'a',
    },
]
const event = (id: string, programStageId: string) =>
    [
        id,
        {
            kind: 'event',
            id,
            programStageId,
            orgUnitId: 'o1',
            status: 'ACTIVE',
        },
    ] as const

/** One person, Amina, whose row shows field `a` of two events: `e1` of stage `s1` and `e2` of stage `s2`. */
const register = (values: Array<[CellKey, string]> = []): LoadedForm => ({
    tables: [
        {
            id: 't1',
            title: 'Register',
            rows: [
                {
                    id: 'p1',
                    label: 'Amina',
                    slots: { first: 'e1', second: 'e2' },
                },
            ],
            columns: COLUMNS,
            headerRows: [
                COLUMNS.map(({ id, label }) => ({ id, label, span: 1 })),
            ],
            closed: new Map(),
        },
    ],
    values: new Map(values),
    records: new Map([event('e1', 's1'), event('e2', 's2')]),
    fields: new Map([['a', INTEGER]]),
    fieldsByForm: new Map([
        ['s1', new Set(['a'])],
        ['s2', new Set(['a'])],
    ]),
    required: new Map(),
    strategy: new Map(),
    sections: new Map(),
    readOnlyRecords: new Map(),
    canReopen: new Set(),
    readOnlyWhenCompleted: new Map(),
    mayUncomplete: true,
    orgUnitNames: new Map(),
    fileNames: new Map(),
    hasMore: false,
    fieldNames: new Map(),
})

/** The register over a source that keeps its saves waiting, so the outbox holds every change. */
const mountHeld = async () => {
    const memory = memorySource(register())
    memory.hold()
    return mount(memory.source)
}

/** The outbox's changes as key, value and the record each saves to. */
const queued = async (server: string) =>
    (await records(server, KEY))
        .map(({ key, value, record }) => [key, value, record?.id])
        .sort()

test('typing in a slotted row saves each cell to its own record', async () => {
    const { server } = await mountHeld()
    control(FIRST).focus()
    await userEvent.keyboard('3{Tab}4{Enter}')
    await expect
        .poll(() => queued(server))
        .toEqual([
            [FIRST, '3', 'e1'],
            [SECOND, '4', 'e2'],
        ])
})

test('a block pasted across two records reaches both', async () => {
    const { server, context } = await mountHeld()
    control(FIRST).focus()
    expect(paste(control(FIRST), '5\t6')).toBe(true)
    const { cells } = context().store.getState()
    expect([cells[FIRST]?.value, cells[SECOND]?.value]).toEqual(['5', '6'])
    await expect
        .poll(() => queued(server))
        .toEqual([
            [FIRST, '5', 'e1'],
            [SECOND, '6', 'e2'],
        ])
})

test('undo returns to the record it changed', async () => {
    const { context } = await mount(
        memorySource(register([[SECOND, '2']])).source
    )
    control(SECOND).focus()
    await userEvent.keyboard('4{Enter}')
    control(FIRST).focus()
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(focused()).toBe(cellDomId(context().idScope, SECOND))
    expect(context().store.getState().cells[SECOND]?.value).toBe('2')
})

test('a message on a slot’s record names the row and shows in its header', async () => {
    const { context } = await mount(memorySource(register()).source, {
        children: (
            <>
                <DataGrid />
                <DataEntrySummary />
            </>
        ),
    })
    context().effects.setState({
        rowMessages: new Map([
            ['e2', [{ kind: 'error', text: 'Check the date', source: 'rule' }]],
        ]),
    })
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'Amina:' }))
        .toHaveTextContent('Amina: Check the date')
    await expect
        .element(page.getByRole('rowheader'))
        .toHaveTextContent('Check the date')
})

test('once someone else signs in, every slot’s cells are read-only with the reason', async () => {
    let user = 'userA'
    const { client } = await mount(memorySource(register()).source, {
        signedIn: () => user,
    })
    user = 'userB'
    await client.refetchQueries()
    const locked = 'Signed in as someone else. Reload to continue as that user.'
    await expect.poll(() => notesOf(FIRST)).toContain(locked)
    expect(notesOf(SECOND)).toContain(locked)
    expect(control(FIRST).hasAttribute('readonly')).toBe(true)
    expect(control(SECOND).hasAttribute('readonly')).toBe(true)
})
