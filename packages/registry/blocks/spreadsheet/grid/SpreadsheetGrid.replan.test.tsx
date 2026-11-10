/// <reference types="@vitest/browser-playwright" />
import { page, userEvent } from 'vitest/browser'
import { cellKey } from '../model/types'
import type { CellKey } from '../model/types'
import { makeTable, mount } from './__tests__/gridRig'

const keys = [0, 1, 2].map((i) => cellKey(`t1r${i}`, 'c0'))

test('a confirmed fill leaves a cell filled while it was asked', async () => {
    const { store, value } = await mount(
        [makeTable({ columns: ['A'], rows: ['a', 'b', 'c'] })],
        {
            confirmBulk: (_keys: ReadonlyArray<CellKey>) => ({
                title: 'Create events?',
                body: 'This creates 1 events on this page.',
                confirm: 'Create events',
            }),
        }
    )
    await page.getByRole('button', { name: 'Column actions A' }).click()
    await page
        .getByRole('menuitem', { name: 'Apply value to all column cells' })
        .click()
    await userEvent.keyboard('5{Enter}')
    await page
        .getByRole('dialog', { name: 'A' })
        .getByRole('button', { name: 'Apply' })
        .click()
    store.getState().commitMany([{ key: keys[1], text: '9' }])
    await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Create events' })
        .click()
    expect(keys.map(value)).toEqual(['5', '9', '5'])
})
