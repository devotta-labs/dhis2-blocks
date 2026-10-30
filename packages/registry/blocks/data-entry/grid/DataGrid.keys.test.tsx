/// <reference types="@vitest/browser-playwright" />
import { userEvent } from 'vitest/browser'
import { withEditor } from '../cells/__tests__/harness'
import type { CellComponent } from '../cells/cellProps'
import { cellKey } from '../model/types'
import { useCellView } from '../provider/context'
import {
    control,
    focused,
    INTEGER,
    makeTable,
    mount,
    paste,
} from './__tests__/gridRig'

/** A notes field edited in the grid by a textarea of its own. */
const Notes: CellComponent = ({ id, cellKey: key, labelledBy, aria }) => {
    const { value, commit } = useCellView(key)
    return (
        <textarea
            id={id}
            aria-labelledby={labelledBy}
            {...aria}
            defaultValue={value}
            onBlur={(event) => commit(event.target.value)}
        />
    )
}

test('a replacement control keeps its own paste and undo; a block pasted across it fills it', async () => {
    const { value } = await mount(
        [
            makeTable({
                columns: ['Age (years)', 'Notes'],
                fields: [INTEGER, { valueType: 'LONG_TEXT' }],
            }),
        ],
        { overrides: { valueTypes: { LONG_TEXT: Notes } } }
    )
    const notes = control(cellKey('t1r0', 'c1'))
    notes.focus()
    // A multi-line paste and Ctrl+Z are the textarea's own: the grid leaves both to the browser.
    expect(paste(notes, 'Seen at home\nFollow up in a week')).toBe(false)
    const undo = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
    })
    notes.dispatchEvent(undo)
    expect(undo.defaultPrevented).toBe(false)
    // A block pasted from the cell before it lands in it, as in any cell that takes a value.
    const age = control(cellKey('t1r0', 'c0'))
    age.focus()
    expect(paste(age, '7\tSeen at home')).toBe(true)
    expect(value(cellKey('t1r0', 'c0'))).toBe('7')
    expect(value(cellKey('t1r0', 'c1'))).toBe('Seen at home')
})

test('a pasted block fills pop-up cells that read text and skips file cells', async () => {
    const editor = () => null
    withEditor('LONG_TEXT', editor)
    withEditor('FILE_RESOURCE', editor)
    const { value } = await mount([
        makeTable({
            columns: ['Age (years)', 'Notes', 'Scan', 'Visits'],
            fields: [
                INTEGER,
                { valueType: 'LONG_TEXT' },
                { valueType: 'FILE_RESOURCE' },
                INTEGER,
            ],
        }),
    ])
    const age = control(cellKey('t1r0', 'c0'))
    age.focus()
    expect(paste(age, '7\tSeen at home\tscan.png\t2')).toBe(true)
    expect(value(cellKey('t1r0', 'c0'))).toBe('7')
    expect(value(cellKey('t1r0', 'c1'))).toBe('Seen at home')
    // The file cell is skipped, and the block does not shift past it.
    expect(value(cellKey('t1r0', 'c2'))).toBeUndefined()
    expect(value(cellKey('t1r0', 'c3'))).toBe('2')
    // A pop-up cell in Ready takes a paste of its own, as a typed cell does.
    const notes = control(cellKey('t1r0', 'c1'))
    notes.focus()
    expect(paste(notes, 'Follow up')).toBe(true)
    expect(value(cellKey('t1r0', 'c1'))).toBe('Follow up')
})

test('a note pasted into a long-text cell stays in it; tab-separated text still fills a block', async () => {
    withEditor('LONG_TEXT', () => null)
    const { value, announced } = await mount([
        makeTable({
            columns: ['Notes', 'Visits'],
            fields: [{ valueType: 'LONG_TEXT' }, INTEGER],
            rows: ['a', 'b', 'c'],
        }),
    ])
    const notes = control(cellKey('t1r0', 'c0'))
    notes.focus()
    const note = 'Seen at home\nFollow up in a week\nCall back'
    expect(paste(notes, `${note}\n`)).toBe(true)
    expect(value(cellKey('t1r0', 'c0'))).toBe(note)
    // The rows below are other events: nothing reaches them.
    for (const row of ['t1r1', 't1r2']) {
        expect(value(cellKey(row, 'c0'))).toBeUndefined()
    }
    expect(announced).toEqual(['Cells pasted: 1'])
    // Quotes around its lines do not make it a spreadsheet's block either.
    const quoted = '"Patient refused treatment"\nWill return "next week"'
    expect(paste(notes, quoted)).toBe(true)
    expect(value(cellKey('t1r0', 'c0'))).toBe(quoted)
    for (const row of ['t1r1', 't1r2']) {
        expect(value(cellKey(row, 'c0'))).toBeUndefined()
    }

    expect(paste(notes, 'Seen\t3\nFollow up\t4')).toBe(true)
    expect(
        ['t1r0', 't1r1'].map((row) => [
            value(cellKey(row, 'c0')),
            value(cellKey(row, 'c1')),
        ])
    ).toEqual([
        ['Seen', '3'],
        ['Follow up', '4'],
    ])
})

test('a pasted block skips username cells, whose names are checked when typed', async () => {
    const editor = () => null
    withEditor('LONG_TEXT', editor)
    withEditor('USERNAME', editor)
    const { value } = await mount([
        makeTable({
            columns: ['Age (years)', 'Notes', 'Seen by', 'Visits'],
            fields: [
                INTEGER,
                { valueType: 'LONG_TEXT' },
                { valueType: 'USERNAME' },
                INTEGER,
            ],
        }),
    ])
    const age = control(cellKey('t1r0', 'c0'))
    age.focus()
    expect(paste(age, '7\tSeen at home\tadmin\t2')).toBe(true)
    // The username cell is skipped, and the block does not shift past it.
    expect(value(cellKey('t1r0', 'c2'))).toBeUndefined()
    expect(value(cellKey('t1r0', 'c3'))).toBe('2')
    // Pasted into the cell itself, nothing lands.
    const seenBy = control(cellKey('t1r0', 'c2'))
    seenBy.focus()
    paste(seenBy, 'admin')
    expect(value(cellKey('t1r0', 'c2'))).toBeUndefined()
})

test('a pasted value that starts with a quote keeps it unless it is one quoted field', async () => {
    const key = cellKey('t1r0', 'c0')
    const { value } = await mount([
        makeTable({ fields: [{ valueType: 'TEXT' }] }),
    ])
    const input = control(key)
    input.focus()
    expect(paste(input, '"Hi" she said')).toBe(true)
    expect(value(key)).toBe('"Hi" she said')
    expect(paste(input, '"a ""b"""')).toBe(true)
    expect(value(key)).toBe('a "b"')
})

test('in a right-to-left page, Left and Right move the way they point', async () => {
    document.documentElement.dir = 'rtl'
    try {
        await mount([makeTable({ columns: ['A', 'B', 'C'] })])
        control(cellKey('t1r0', 'c1')).focus()
        await userEvent.keyboard('{ArrowLeft}')
        expect(focused()).toBe(control(cellKey('t1r0', 'c2')).id)
        await userEvent.keyboard('{ArrowRight}{ArrowRight}')
        expect(focused()).toBe(control(cellKey('t1r0', 'c0')).id)
    } finally {
        document.documentElement.dir = ''
    }
})
