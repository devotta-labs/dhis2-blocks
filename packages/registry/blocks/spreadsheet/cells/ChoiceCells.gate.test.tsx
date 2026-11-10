import { page, userEvent } from 'vitest/browser'
import { cleanup, render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { CELL, HEADER, rig } from './__tests__/harness'
import { Cell } from './Cell'

const mount = async (field: Field, options: Parameters<typeof rig>[1]) => {
    const setup = rig(field, options)
    await render(
        setup.ui(
            <Cell
                cellKey={CELL}
                field={field}
                labelledBy={HEADER}
                move={setup.move}
            />
        )
    )
    return setup
}

const HIDDEN = { hiddenBy: 'Hidden by rule: Not pregnant' }

test('y in a hidden Yes/No cell saves nothing', async () => {
    const { enqueued, stored } = await mount(
        { valueType: 'BOOLEAN' },
        { effects: HIDDEN }
    )
    page.getByRole('combobox', { name: 'Age (years)' }).element().focus()
    await userEvent.keyboard('y')
    expect(enqueued).toEqual([])
    expect(stored()?.value).toBeUndefined()
})

const press = async (effects?: Parameters<typeof rig>[1]) => {
    const setup = await mount({ valueType: 'TRUE_ONLY' }, effects)
    page.getByRole('checkbox', { name: 'Age (years)' }).element().focus()
    await userEvent.keyboard(' ')
    return setup
}

test('a Yes-only box saves true when shown, and nothing when hidden', async () => {
    const shown = await press()
    expect(shown.stored()?.value).toBe('true')
    cleanup()
    const hidden = await press({ effects: HIDDEN })
    expect(hidden.enqueued).toEqual([])
    expect(hidden.stored()?.value).toBeUndefined()
})
