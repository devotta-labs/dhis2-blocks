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
