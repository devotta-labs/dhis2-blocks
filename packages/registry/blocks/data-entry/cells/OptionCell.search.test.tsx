/// <reference types="@vitest/browser-playwright" />
import { FetchError } from '@dhis2/app-runtime'
import { Profiler } from 'react'
import { onTestFinished } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { control, nextFrame } from '../grid/__tests__/gridRig'
import { cellKey } from '../model/types'
import type { GridColumn } from '../model/types'
import {
    cleanUp,
    later,
    memorySource,
    mount as mountForm,
    visitForm,
} from '../provider/__tests__/rig'
import search from '../sources/__tests__/fixtures/org-unit-search.json'
import lookup from '../sources/__tests__/fixtures/user-lookup.json'
import { CELL, HEADER, inputOf, rig } from './__tests__/harness'
import type { ServerRequest } from './__tests__/harness'
import { Cell } from './Cell'

afterEach(cleanUp)

const PLACE: Field = { valueType: 'ORGANISATION_UNIT' }
const USERNAME: Field = { valueType: 'USERNAME' }
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
 * A search cell over a fake server. Org units: "ngel…" finds the two Ngelehun org units, "many" finds them as 2 of
 * 120 matches, any other none. Users: "adm…" finds two, "offline" fails as a dropped connection, "down" fails
 * otherwise, any other finds none. `hold` keeps answers waiting.
 */
const mount = async (field: Field, options: Parameters<typeof rig>[1] = {}) => {
    const searches: Search[] = []
    let held = false
    const answer = async (
        params: ServerRequest['params'],
        signal: AbortSignal | undefined
    ) => {
        searches.push({ params, signal, at: performance.now() })
        if (held) {
            await new Promise(() => {})
        }
        return String(params?.query)
    }
    const setup = rig(field, {
        ...options,
        data: {
            organisationUnits: async (_type, { params }, execute) => {
                const query = await answer(params, execute?.signal)
                if (query.startsWith('ngel')) {
                    return search
                }
                return query === 'many'
                    ? { ...search, pager: { ...search.pager, total: 120 } }
                    : NONE
            },
            userLookup: async (_type, { params }, execute) => {
                const query = await answer(params, execute?.signal)
                if (query === 'offline') {
                    throw new FetchError({
                        type: 'network',
                        message: 'An unknown network error occurred',
                        details: {},
                    })
                }
                if (query === 'down') {
                    throw new Error(
                        'Internal server error: NullPointerException'
                    )
                }
                return query.startsWith('adm') ? lookup : { users: [] }
            },
        },
    })
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
    return {
        ...setup,
        searches,
        hold() {
            held = true
        },
        cell: page.getByRole('combobox', { name: 'Age (years)' }),
    }
}

const option = (name: string) => page.getByRole('option', { name })
const options = page.getByRole('option')

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

test("typing in the cell lists org units within the user's search scope with their path; picking saves the id", async () => {
    const { cell, stored, searches, announced } = await mount(PLACE, {
        value: MCHP,
        orgUnitNames: new Map([[MCHP, 'Ngelehun MCHP']]),
    })
    await expect.element(cell).toHaveValue('Ngelehun MCHP')
    inputOf(cell).focus()
    // Typing replaces the name and searches; no dialog opens.
    await userEvent.keyboard('ngel')
    await expect.element(cell).toHaveValue('ngel')
    await expect.element(option('Ngelehun CHC')).toBeVisible()
    expect(page.getByRole('dialog').elements()).toHaveLength(0)
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
    await expect.element(cell).toHaveFocus()
    // The pick's name is the cell's.
    await expect.element(cell).toHaveValue('Ngelehun CHC')

    // From the keyboard: ↓ and Enter pick, and the cell stays.
    await userEvent.keyboard('ngel')
    await expect.element(option('Ngelehun MCHP')).toBeVisible()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(stored()?.value).toBe(MCHP)
    await expect.element(cell).toHaveValue('Ngelehun MCHP')
})

test('no match says "No organisation units found" under the cell', async () => {
    const { cell, stored, announced } = await mount(PLACE)
    inputOf(cell).focus()
    await userEvent.keyboard('ngel')
    await expect.element(option('Ngelehun CHC')).toBeVisible()
    // While the next search waits, the results for the text before are gone, and Enter picks none of them.
    await userEvent.keyboard('{Backspace}{Backspace}zz{Enter}')
    expect(options.elements()).toHaveLength(0)
    expect(stored()?.value).toBeUndefined()
    await expect
        .element(page.getByText('No organisation units found'))
        .toBeVisible()
    expect(announced).toContain('No organisation units found')
    await expect.element(options.first()).not.toBeInTheDocument()
})

test('a search starts at two characters, 250 ms after typing stops, and aborts the one before', async () => {
    const { cell, searches, hold } = await mount(PLACE)
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

test('leaving saves no result that was not picked; Tab picks the highlighted one; emptied text clears the cell', async () => {
    const { cell, stored, moves } = await mount(PLACE, {
        value: MCHP,
        orgUnitNames: new Map([[MCHP, 'Ngelehun MCHP']]),
    })
    inputOf(cell).focus()
    await userEvent.keyboard('ngel')
    await expect.element(option('Ngelehun CHC')).toBeVisible()
    // A press outside keeps the value: the typing was a search, not a value.
    await userEvent.click(page.getByText('Age (years)'))
    expect(stored()?.value).toBe(MCHP)
    await expect.element(cell).toHaveValue('Ngelehun MCHP')

    inputOf(cell).focus()
    await userEvent.keyboard('ngel')
    await expect
        .element(option('Ngelehun CHC'))
        .toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Tab}')
    expect(stored()?.value).toBe(CHC)
    expect(moves).toEqual(['tab'])

    inputOf(cell).focus()
    await userEvent.keyboard('{Backspace}{Enter}')
    expect(stored()?.value).toBeUndefined()
})

test('more matches than listed are counted; Enter and Tab do nothing while a search waits', async () => {
    const { cell, stored, enqueued, announced, moves, hold } = await mount(
        PLACE,
        { value: MCHP }
    )
    inputOf(cell).focus()
    await userEvent.keyboard('many')
    const count = 'Showing 2 of 120 matches'
    await expect.element(page.getByText(count)).toBeVisible()
    expect(announced).toEqual([count])

    // Nothing to pick yet: the search for what the cell holds has not answered.
    hold()
    await userEvent.keyboard('x{Enter}{Tab}')
    await expect.element(cell).toHaveFocus()
    await expect.element(cell).toHaveValue('manyx')
    expect(moves).toEqual([])
    expect(enqueued).toEqual([])
    expect(stored()?.value).toBe(MCHP)
})

test('an org unit cell renders again only for its own name', async () => {
    let commits = 0
    const setup = rig(PLACE, { value: 'ou1' })
    await render(
        setup.ui(
            <Profiler
                id="cell"
                onRender={() => {
                    commits += 1
                }}
            >
                <Cell
                    cellKey={CELL}
                    field={PLACE}
                    labelledBy={HEADER}
                    move={setup.move}
                />
            </Profiler>
        )
    )
    const cell = page.getByRole('combobox', { name: 'Age (years)' })
    await expect.element(cell).toHaveValue('ou1')
    const before = commits
    setup.orgUnitNames.setState({ names: new Map([['ou2', 'Bo']]) })
    await nextFrame()
    expect(commits).toBe(before)
    setup.orgUnitNames.setState({
        names: new Map([
            ['ou1', 'Ngelehun'],
            ['ou2', 'Bo'],
        ]),
    })
    await expect.element(cell).toHaveValue('Ngelehun')
})

test('typing in a username cell lists users by name and username; picking saves the username', async () => {
    const { cell, stored, searches, announced } = await mount(USERNAME, {
        value: 'admin',
    })
    // The cell shows the username.
    await expect.element(cell).toHaveValue('admin')
    inputOf(cell).focus()
    await userEvent.keyboard('admin')
    await expect.element(options.first()).toBeVisible()
    expect(searches.map(({ params }) => params)).toEqual([{ query: 'admin' }])
    expect(announced).toEqual(['Results: 2'])
    await expect.element(options.first()).toHaveTextContent('John Traoreadmin')
    await expect
        .element(options.nth(1))
        .toHaveTextContent('John Traoredhis2-analytics-admin')

    await userEvent.click(options.nth(1))
    expect(stored()?.value).toBe('dhis2-analytics-admin')
    await expect.element(cell).toHaveValue('dhis2-analytics-admin')
    await expect.element(cell).toHaveFocus()
})

test('a search that finds nothing or fails says so under the cell', async () => {
    const { cell, stored, announced } = await mount(USERNAME, {
        value: 'admin',
    })
    inputOf(cell).focus()
    await userEvent.keyboard('zz')
    await expect.element(page.getByText('No users found')).toBeVisible()
    await userEvent.fill(cell, 'offline')
    await expect.element(page.getByText('You are offline')).toBeVisible()
    await userEvent.fill(cell, 'down')
    const again = 'Could not search. Try again.'
    await expect.element(page.getByText(again)).toBeVisible()
    expect(announced).toEqual(['No users found', 'You are offline', again])
    // Nothing to pick: Enter keeps the value.
    await userEvent.keyboard('{Enter}')
    expect(stored()?.value).toBe('admin')
})
