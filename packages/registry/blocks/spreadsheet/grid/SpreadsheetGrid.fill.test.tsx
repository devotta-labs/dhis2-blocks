/// <reference types="@vitest/browser-playwright" />
import { userEvent } from 'vitest/browser'
import { cellKey } from '../model/types'
import { control, makeTable, mount } from './__tests__/gridRig'

const ROWS = ['a', 'b', 'c']

const at = (table: string, row: number, column = 0) =>
    cellKey(`${table}r${row}`, `c${column}`)

test('Ctrl+D copies the value above, overwriting, and Ctrl+Z restores', async () => {
    const { value } = await mount([makeTable({ rows: ROWS })], {
        values: [
            [at('t1', 0), '5'],
            [at('t1', 1), '9'],
        ],
    })
    control(at('t1', 1)).focus()
    const down = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
    })
    control(at('t1', 1)).dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    expect(value(at('t1', 1))).toBe('5')
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(value(at('t1', 1))).toBe('9')
})

test('Ctrl+D with nothing above, in the first row of any table, says so and takes the key', async () => {
    const { announced } = await mount([
        makeTable({ rows: ROWS, id: 't1' }),
        makeTable({ rows: ROWS, id: 't2' }),
    ])
    for (const table of ['t1', 't2']) {
        control(at(table, 0)).focus()
        const down = new KeyboardEvent('keydown', {
            key: 'd',
            metaKey: true,
            bubbles: true,
            cancelable: true,
        })
        control(at(table, 0)).dispatchEvent(down)
        // The grid took the key and said why.
        expect(down.defaultPrevented).toBe(true)
    }
    expect(announced).toEqual([
        'Nothing above to copy.',
        'Nothing above to copy.',
    ])
})

test('Ctrl+D onto an empty value above says so; onto a locked cell it gives the cell’s reason', async () => {
    const { announced, value } = await mount([makeTable({ rows: ROWS })], {
        values: [[at('t1', 1), '4']],
        effects: { [at('t1', 2)]: { readOnly: 'Completed' } },
    })
    control(at('t1', 1)).focus()
    await userEvent.keyboard('{Control>}d{/Control}')
    control(at('t1', 2)).focus()
    await userEvent.keyboard('{Control>}d{/Control}')
    expect(announced).toEqual(['Nothing above to copy.', 'Completed'])
    expect(value(at('t1', 1))).toBe('4')
    expect(value(at('t1', 2))).toBeUndefined()
})

test('Ctrl+D copies a date as the same day under the system’s date format', async () => {
    const { value } = await mount(
        [makeTable({ fields: [{ valueType: 'DATE' }], rows: ROWS })],
        {
            settings: { calendar: 'iso8601', dateFormat: 'DD-MM-YYYY' },
            values: [[at('t1', 0), '2026-03-04']],
        }
    )
    control(at('t1', 1)).focus()
    await userEvent.keyboard('{Control>}d{/Control}')
    expect(value(at('t1', 1))).toBe('2026-03-04')
})

test('Ctrl+D under a hidden or closed cell says there is nothing above to copy', async () => {
    const { announced, value } = await mount(
        [
            makeTable({ rows: ROWS, id: 't1', closed: [at('t1', 0)] }),
            makeTable({ rows: ROWS, id: 't2' }),
        ],
        {
            values: [
                [at('t1', 0), '5'],
                [at('t2', 0), '6'],
            ],
            effects: { [at('t2', 0)]: { hiddenBy: 'Hidden by a rule' } },
        }
    )
    for (const table of ['t1', 't2']) {
        control(at(table, 1)).focus()
        await userEvent.keyboard('{Control>}d{/Control}')
        expect(value(at(table, 1))).toBeUndefined()
    }
    expect(announced).toEqual([
        'Nothing above to copy.',
        'Nothing above to copy.',
    ])
})
