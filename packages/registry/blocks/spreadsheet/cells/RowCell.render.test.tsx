import { Profiler } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { cellKey } from '../model/types'
import { RowCell } from './Cell'
import { cellDomId } from './cellProps'
import { CELL, HEADER, rig } from './__tests__/harness'

const INTEGER: Field = { valueType: 'INTEGER' }
const OTHER = cellKey('r2', 'c1')
const KEYS = [CELL, OTHER]

test('a value update and keyboard navigation render only the affected cell', async () => {
    const setup = rig(INTEGER)
    const cellCommits = new Map(KEYS.map((key) => [key, 0]))
    const onCellRender = new Map(
        KEYS.map((key) => [
            key,
            () => {
                cellCommits.set(key, cellCommits.get(key)! + 1)
            },
        ])
    )
    let rowRenders = 0

    const move = (key: Parameters<typeof setup.move>[0]) => {
        setup.move(key)
        if (key === 'right') {
            document.getElementById(cellDomId('data-entry', OTHER))?.focus()
        }
    }

    const Cells = () => {
        rowRenders += 1
        return (
            <>
                {KEYS.map((key) => (
                    <Profiler
                        key={key}
                        id={key}
                        onRender={onCellRender.get(key)!}
                    >
                        <RowCell
                            cellKey={key}
                            field={INTEGER}
                            labelledBy={HEADER}
                            move={move}
                        />
                    </Profiler>
                ))}
            </>
        )
    }

    await render(setup.ui(<Cells />))
    const initialCellCommits = new Map(cellCommits)

    setup.store.getState().commit(CELL, '7')
    await expect.element(page.getByRole('textbox').nth(0)).toHaveValue('7')

    expect(rowRenders).toBe(1)
    expect(cellCommits.get(CELL)).toBe(initialCellCommits.get(CELL)! + 1)
    expect(cellCommits.get(OTHER)).toBe(initialCellCommits.get(OTHER))

    const beforeNavigation = new Map(cellCommits)
    page.getByRole('textbox').nth(0).element().focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(setup.moves).toEqual(['right'])
    expect(document.activeElement?.id).toBe(cellDomId('data-entry', OTHER))
    expect(rowRenders).toBe(1)
    expect(cellCommits.get(CELL)).toBe(beforeNavigation.get(CELL)! + 1)
    expect(cellCommits.get(OTHER)).toBe(beforeNavigation.get(OTHER))
})
