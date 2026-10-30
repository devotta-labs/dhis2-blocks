/// <reference types="@vitest/browser-playwright" />
import { onTestFinished } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { control } from '../../grid/__tests__/gridRig'
import { cellKey } from '../../model/types'
import type { GridColumn } from '../../model/types'
import {
    cleanUp,
    later,
    memorySource,
    mount as mountForm,
    visitForm,
} from '../../provider/__tests__/rig'
import search from '../../sources/__tests__/fixtures/org-unit-search.json'
import { CELL, HEADER, inputOf, rig } from '../__tests__/harness'
import type { ServerRequest } from '../__tests__/harness'
import { Cell } from '../Cell'

afterEach(cleanUp)

const PLACE: Field = { valueType: 'ORGANISATION_UNIT' }
const CHC = 'DiszpKrYNg8'
const MCHP = 'FwKJ7gYEv8U'
const NONE = {
    pager: { page: 1, total: 0, pageSize: 50, pageCount: 0 },
    organisationUnits: [],
}

interface Search {
    params: ServerRequest['params']
    signal?: AbortSignal
    /** When the request was made (`performance.now()`). */
    at: number
}

/**
 * The org unit cell over a fake server: a search for "ngel…" finds the two Ngelehun org units, "many" finds them as 2
 * of 120 matches, any other none, and `hold` keeps answers waiting.
 */
const mount = async (options: Parameters<typeof rig>[1] = {}) => {
    const searches: Search[] = []
    let held = false
    const setup = rig(PLACE, {
        ...options,
        data: {
            organisationUnits: async (_type, { params }, execute) => {
                searches.push({
                    params,
                    signal: execute?.signal,
                    at: performance.now(),
                })
                if (held) {
                    await new Promise(() => {})
                }
                const query = String(params?.query)
                if (query.startsWith('ngel')) {
                    return search
                }
                return query === 'many'
                    ? { ...search, pager: { ...search.pager, total: 120 } }
                    : NONE
            },
        },
    })
    await render(
        setup.ui(
            <Cell
                cellKey={CELL}
                field={PLACE}
                labelledBy={HEADER}
                move={setup.move}
            />
        )
    )
    return {
        ...setup,
        searches,
        hold() {
            held = true
        },
        cell: page.getByRole('textbox', { name: 'Age (years)' }),
    }
}

const dialog = page.getByRole('dialog', { name: 'Edit Age (years)' })
const box = dialog.getByRole('combobox', { name: 'Search organisation units' })
const option = (name: string) => dialog.getByRole('option', { name })

const PLACE_COLUMN: GridColumn = { id: 'c4', label: 'Place', field: PLACE }

test('a cell shows the org unit name, not its id', async () => {
    const named = cellKey('r1', 'c4')
    const unnamed = cellKey('r2', 'c4')
    const form = visitForm({
        values: [
            [named, CHC],
            [unnamed, MCHP],
        ],
    })
    const [table] = form.tables
    await mountForm(
        memorySource({
            ...form,
            tables: [
                {
                    ...table,
                    columns: [PLACE_COLUMN, ...table.columns],
                    headerRows: [
                        [
                            { id: 'c4', label: 'Place', span: 1 },
                            ...table.headerRows[0],
                        ],
                    ],
                },
            ],
            orgUnitNames: new Map([[CHC, 'Ngelehun CHC']]),
        }).source
    )
    expect(control(named)).toHaveValue('Ngelehun CHC')
    // An org unit the form has no name for shows its id.
    expect(control(unnamed)).toHaveValue(MCHP)
})

test("searching lists org units within the user's search scope with their path; picking saves the id", async () => {
    const { cell, stored, searches, announced } = await mount({
        value: MCHP,
        orgUnitNames: new Map([[MCHP, 'Ngelehun MCHP']]),
    })
    await expect.element(cell).toHaveValue('Ngelehun MCHP')
    inputOf(cell).focus()
    await userEvent.keyboard('ngel')
    await expect.element(box).toHaveValue('ngel')
    await expect.element(option('Ngelehun CHC')).toBeVisible()
    // Typed in one go: one search, once typing stops.
    expect(searches.map(({ params }) => params)).toEqual([
        {
            query: 'ngel',
            withinUserSearchHierarchy: true,
            fields: 'id,displayName,ancestors[displayName]',
        },
    ])
    // Each with its path, from the top of the hierarchy; the first is highlighted.
    await expect
        .element(option('Ngelehun CHC'))
        .toHaveTextContent('Ngelehun CHCSierra Leone / Bo / Badjia')
    await expect
        .element(option('Ngelehun MCHP'))
        .toHaveTextContent('Ngelehun MCHPSierra Leone / Kenema / Nongowa')
    await expect
        .element(option('Ngelehun CHC'))
        .toHaveAttribute('aria-selected', 'true')
    expect(announced).toEqual(['Results: 2'])
    // Each answer is said as it arrives, even when it says what the one before did.
    await userEvent.keyboard('e')
    await expect.poll(() => searches.length).toBe(2)
    await expect.poll(() => announced).toEqual(['Results: 2', 'Results: 2'])

    await userEvent.click(option('Ngelehun CHC'))
    expect(stored()?.value).toBe(CHC)
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveFocus()
    // The pick's name is the cell's.
    await expect.element(cell).toHaveValue('Ngelehun CHC')

    // From the keyboard: the editor opens on the name, which typing replaces; ↓ and Enter pick.
    await userEvent.keyboard('{F2}')
    await expect.element(box).toHaveValue('Ngelehun CHC')
    await userEvent.keyboard('ngel')
    await expect.element(option('Ngelehun MCHP')).toBeVisible()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(stored()?.value).toBe(MCHP)
    await expect.element(cell).toHaveValue('Ngelehun MCHP')
})

test('no match says "No organisation units found"', async () => {
    const { cell, stored, announced } = await mount()
    inputOf(cell).focus()
    await userEvent.keyboard('ngel')
    await expect.element(option('Ngelehun CHC')).toBeVisible()
    // While the next search waits, the results for the text before are gone, and Enter picks none of them.
    await userEvent.keyboard('{Backspace}{Backspace}zz{Enter}')
    expect(dialog.getByRole('option').elements()).toHaveLength(0)
    expect(stored()?.value).toBeUndefined()
    await expect
        .element(dialog.getByText('No organisation units found'))
        .toBeVisible()
    expect(announced).toContain('No organisation units found')
    await expect.element(dialog.getByRole('option')).not.toBeInTheDocument()
})

test('a search starts at two characters, 250 ms after typing stops, and aborts the one before', async () => {
    const { cell, searches, hold } = await mount()
    inputOf(cell).focus()
    await userEvent.keyboard('n')
    await later(400)
    expect(searches).toEqual([])
    hold()
    const typed: number[] = []
    const onInput = () => typed.push(performance.now())
    document.addEventListener('input', onInput, true)
    onTestFinished(() => document.removeEventListener('input', onInput, true))
    await userEvent.keyboard('g')
    await expect.poll(() => searches.length).toBe(1)
    expect(searches[0].params?.query).toBe('ng')
    // Not before 250 ms after the key: the search waits for typing to stop.
    expect(searches[0].at - typed[0]).toBeGreaterThanOrEqual(250)
    await userEvent.keyboard('e')
    await expect.poll(() => searches.length).toBe(2)
    expect(searches[1].params?.query).toBe('nge')
    expect(searches[0].signal?.aborted).toBe(true)
    expect(searches[1].signal?.aborted).toBe(false)
})

test('Save picks the highlighted org unit, leaving does not; an emptied search saves no value', async () => {
    const { cell, stored } = await mount()
    inputOf(cell).focus()
    await userEvent.keyboard('ngel')
    await expect.element(option('Ngelehun CHC')).toBeVisible()
    // A press outside saves no result that was not picked.
    await userEvent.click(page.getByText('Age (years)'))
    await expect.element(dialog).not.toBeInTheDocument()
    expect(stored()?.value).toBeUndefined()

    inputOf(cell).focus()
    await userEvent.keyboard('ngel')
    await expect
        .element(option('Ngelehun CHC'))
        .toHaveAttribute('aria-selected', 'true')
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    expect(stored()?.value).toBe(CHC)

    // Opened on the name: Save keeps the value. (Enter right after a save would move on.)
    await userEvent.keyboard('{F2}')
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    expect(stored()?.value).toBe(CHC)
    await expect.element(dialog).not.toBeInTheDocument()

    await userEvent.keyboard('{F2}')
    await userEvent.fill(box, '')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(stored()?.value).toBeUndefined()
    await expect.element(dialog).not.toBeInTheDocument()
})

test('more matches than listed are counted; Save does nothing while a search waits', async () => {
    const { cell, stored, enqueued, announced, hold } = await mount({
        value: MCHP,
    })
    inputOf(cell).focus()
    await userEvent.keyboard('many')
    const count = 'Showing 2 of 120 matches. Keep typing to narrow them.'
    await expect.element(dialog.getByText(count)).toBeVisible()
    expect(announced).toEqual([count])

    // Nothing to save yet: the search for what the field holds has not answered.
    hold()
    await userEvent.keyboard('x')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    await expect.element(dialog).toBeVisible()
    expect(enqueued).toEqual([])
    expect(stored()?.value).toBe(MCHP)
})
