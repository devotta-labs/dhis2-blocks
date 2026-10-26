/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import type { CellComponent } from '../cells/cellProps'
import { control } from '../grid/__tests__/gridRig'
import { useCell } from '../index'
import { cellKey } from '../model/types'
import type { CellKey, CommitResult } from '../model/types'
import { DataEntrySummary } from '../summary/DataEntrySummary'
import { DataGrid } from '../grid/DataGrid'
import {
    cleanUp,
    KEY,
    memorySource,
    mount,
    records,
    visitForm,
} from './__tests__/rig'

afterEach(cleanUp)

const CHILDREN = cellKey('r1', 'c1')
const NOTES = cellKey('r1', 'c3')

/** A replacement control that saves what was typed when it loses focus, and keeps each cell's `commit`. */
const typist = () => {
    const results: CommitResult[] = []
    const commits = new Map<CellKey, (text: string) => CommitResult>()
    const Typist: CellComponent = ({ cellKey: key, id, labelledBy }) => {
        const { value, commit } = useCell(key)
        commits.set(key, commit)
        return (
            <input
                id={id}
                aria-labelledby={labelledBy}
                defaultValue={value}
                onBlur={(event) => results.push(commit(event.target.value))}
            />
        )
    }
    const commitTo = (key: CellKey, text: string) => {
        const commit = commits.get(key)
        if (commit === undefined) {
            throw new Error(`No control rendered for ${key}`)
        }
        return commit(text)
    }
    return { Typist, results, commitTo }
}

test('a replacement control saves through useCell as the built-in controls do', async () => {
    const memory = memorySource(visitForm())
    memory.hold()
    const { Typist, results } = typist()
    const { server, context } = await mount(memory.source, {
        cells: { fields: { c3: Typist } },
    })
    control(NOTES).focus()
    await userEvent.keyboard('Seen at home')
    control(CHILDREN).focus()

    expect(results).toEqual(['queued'])
    expect(context().store.getState().cells[NOTES]).toMatchObject({
        value: 'Seen at home',
        sync: 'queued',
    })
    await expect
        .poll(() => records(server, KEY))
        .toMatchObject([
            {
                key: NOTES,
                value: 'Seen at home',
                base: null,
                row: { programStageId: 's1', orgUnitId: 'o1', isNew: false },
                state: 'queued',
            },
        ])

    memory.release()
    await expect
        .poll(() => context().store.getState().cells[NOTES])
        .toMatchObject({
            value: 'Seen at home',
            base: 'Seen at home',
            sync: 'saved',
        })
    await expect.poll(() => records(server, KEY)).toEqual([])
})

test('commit checks the value as the built-in controls do', async () => {
    const memory = memorySource(visitForm())
    const { Typist, commitTo } = typist()
    const { server, context } = await mount(memory.source, {
        cells: { fields: { c1: Typist, c2: Typist } },
    })

    expect(commitTo(CHILDREN, 'abc')).toBe('invalid')
    expect(context().store.getState().cells[CHILDREN]).toEqual({
        sync: 'idle',
        source: 'person',
        draft: 'abc',
        error: 'Enter a whole number',
    })
    expect(commitTo(CHILDREN, '4')).toBe('queued')
    expect(commitTo(CHILDREN, '4')).toBe('unchanged')

    // An option a rule hid is not an option.
    context().effects.setState((state) => ({
        cells: {
            ...state.cells,
            'r1.c2': {
                required: false,
                messages: [],
                hiddenOptions: new Set(['B']),
            },
        },
    }))
    expect(commitTo('r1.c2', 'B')).toBe('invalid')
    expect(context().store.getState().cells['r1.c2']).toMatchObject({
        draft: 'B',
        error: 'Choose one of the options',
    })
    await expect
        .poll(async () => (await records(server, KEY)).map(({ key }) => key))
        .toEqual([CHILDREN])
})

test('commit writes nothing to a cell that is locked', async () => {
    const memory = memorySource(
        visitForm({
            readOnlyRows: [['r2', 'Completed events cannot be edited']],
        })
    )
    const { Typist, commitTo } = typist()
    const { server, context } = await mount(memory.source, {
        cells: { fields: { c1: Typist, c2: Typist } },
    })
    const locked = (readOnly: string) => ({
        required: false,
        messages: [],
        readOnly,
    })
    context().effects.setState((state) => ({
        cells: {
            ...state.cells,
            [CHILDREN]: locked('Assigned by rule: Count'),
            'r1.c2': {
                required: false,
                messages: [],
                hiddenBy: 'Hidden by rule: Referral',
            },
            // Hidden by a rule in a row that is read-only: the lock wins.
            'r2.c2': {
                ...locked('Completed events cannot be edited'),
                hiddenBy: 'Hidden by rule: Referral',
            },
        },
    }))

    // A rule locked the cell, and the row is read-only.
    expect(commitTo(CHILDREN, '3')).toBe('unchanged')
    expect(commitTo('r2.c1', '3')).toBe('unchanged')
    // A rule hid it: only text a person typed into it is kept, then cleared by the rule.
    expect(commitTo('r1.c2', '')).toBe('unchanged')
    expect(commitTo('r2.c2', 'A')).toBe('unchanged')
    expect(context().store.getState().cells[CHILDREN]).toBeUndefined()
    expect(context().store.getState().cells['r2.c1']).toBeUndefined()
    expect(context().store.getState().cells['r2.c2']).toBeUndefined()
    expect(context().store.getState().cells['r1.c2']).toBeUndefined()
    expect(await records(server, KEY)).toEqual([])

    expect(commitTo('r1.c2', 'A')).toBe('queued')
    await expect
        .poll(async () => (await records(server, KEY)).map(({ key }) => key))
        .toEqual(['r1.c2'])
})

test('a summary link moves focus into a replacement control through its id', async () => {
    const { Typist, commitTo } = typist()
    await mount(memorySource(visitForm()).source, {
        cells: { fields: { c1: Typist } },
        children: (
            <>
                <DataGrid />
                <DataEntrySummary />
            </>
        ),
    })
    expect(commitTo(CHILDREN, 'abc')).toBe('invalid')
    await userEvent.click(
        page.getByRole('link', {
            name: 'Visit 1, Children: Enter a whole number',
        })
    )
    expect(document.activeElement).toBe(control(CHILDREN))
})
