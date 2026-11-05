/// <reference types="@vitest/browser-playwright" />
import { page } from 'vitest/browser'
import { cellKey } from '../model/types'
import type { CellKey } from '../model/types'
import { control, makeTable, mount, paste } from './__tests__/gridRig'

test('a block paste that creates events asks first, then keeps refused text as a draft and says how many cells were pasted', async () => {
    const confirmBulk = vi.fn((_keys: ReadonlyArray<CellKey>) => ({
        title: 'Create events?',
        body: 'This creates 1 events on this page.',
        confirm: 'Create events',
    }))
    const first = cellKey('t1r0', 'c0')
    const second = cellKey('t1r0', 'c1')
    const { store, value, announced } = await mount(
        [makeTable({ columns: ['A', 'B'], rows: ['a'] })],
        { confirmBulk }
    )
    const cell = control(first)
    cell.focus()
    expect(paste(cell, '7\tabc')).toBe(true)
    expect(confirmBulk).toHaveBeenLastCalledWith([first, second])
    expect(value(first)).toBeUndefined()
    expect(announced).toEqual([])
    await page
        .getByRole('alertdialog', { name: 'Create events?' })
        .getByRole('button', { name: 'Create events' })
        .click()
    expect(value(first)).toBe('7')
    // Refused text stays as a draft.
    expect(store.getState().cells[second]?.draft).toBe('abc')
    expect(announced).toEqual(['Cells pasted: 1'])
})

test('a one-cell paste writes at once, without asking', async () => {
    const confirmBulk = vi.fn()
    const key = cellKey('t1r0', 'c0')
    const { value } = await mount([makeTable({ rows: ['a'] })], {
        confirmBulk,
    })
    const cell = control(key)
    cell.focus()
    paste(cell, '7')
    expect(confirmBulk).not.toHaveBeenCalled()
    expect(value(key)).toBe('7')
})

test('a two-row block pasted on the last row lands one cell and writes without asking', async () => {
    const confirmBulk = vi.fn()
    const key = cellKey('t1r1', 'c0')
    const { value, announced } = await mount(
        [makeTable({ rows: ['a', 'b'] })],
        { confirmBulk }
    )
    const cell = control(key)
    cell.focus()
    paste(cell, '7\n8')
    expect(confirmBulk).not.toHaveBeenCalled()
    expect(value(key)).toBe('7')
    expect(announced).toEqual(['Cells pasted: 1'])
})
