/// <reference types="@vitest/browser-playwright" />
import { FetchError } from '@dhis2/app-runtime'
import { Profiler } from 'react'
import { onTestFinished } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import { nextFrame } from '../grid/test/gridRig'
import search from './test/fixtures/org-unit-search.json'
import lookup from './test/fixtures/user-lookup.json'
import { CELL, HEADER, inputOf, rig } from './test/harness'
import type { ServerRequest } from './test/harness'
import { Cell } from './Cell'

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
}

const mount = async (field: Field, options: Parameters<typeof rig>[1] = {}) => {
    const searches: Search[] = []
    const pendingSearches = new Map<string, PromiseWithResolvers<Search>>()
    let held = false
    const answer = async (
        params: ServerRequest['params'],
        signal: AbortSignal | undefined
    ) => {
        const query = String(params?.query)
        const request = { params, signal }
        searches.push(request)
        pendingSearches.get(query)?.resolve(request)
        pendingSearches.delete(query)
        if (held) {
            await new Promise(() => {})
        }
        return query
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
        nextSearch(query: string) {
            const pending = Promise.withResolvers<Search>()
            pendingSearches.set(query, pending)
            return pending.promise
        },
        hold() {
            held = true
        },
        cell: page.getByRole('combobox', { name: 'Age (years)' }),
    }
}

const option = (name: string) => page.getByRole('option', { name })
const options = page.getByRole('option')

test("typing in the cell lists org units within the user's search scope with their path; picking saves the id", async () => {
    const firstAnswer = Promise.withResolvers<void>()
    const secondAnswer = Promise.withResolvers<void>()
    const answers = [firstAnswer, secondAnswer]
    const { cell, stored, searches, announced, nextSearch } = await mount(
        PLACE,
        {
            value: MCHP,
            orgUnitNames: new Map([[MCHP, 'Ngelehun MCHP']]),
            onAnnouncement: () => answers.shift()?.resolve(),
        }
    )
    await expect.element(cell).toHaveValue('Ngelehun MCHP')
    inputOf(cell).focus()
    await userEvent.keyboard('ngel')
    await expect.element(cell).toHaveValue('ngel')
    await expect.element(option('Ngelehun CHC')).toBeVisible()
    expect(page.getByRole('dialog').elements()).toHaveLength(0)
    expect(searches.map(({ params }) => params)).toEqual([
        {
            query: 'ngel',
            withinUserSearchHierarchy: true,
            fields: 'id,displayName,ancestors[displayName]',
        },
    ])
    await expect
        .element(option('Ngelehun CHC'))
        .toHaveTextContent('Ngelehun CHCSierra Leone / Bo / Badjia')
    await expect
        .element(option('Ngelehun MCHP'))
        .toHaveTextContent('Ngelehun MCHPSierra Leone / Kenema / Nongowa')
    await expect
        .element(option('Ngelehun CHC'))
        .toHaveAttribute('aria-selected', 'true')
    await firstAnswer.promise
    expect(announced).toEqual(['Results: 2'])
    const secondSearch = nextSearch('ngele')
    await userEvent.keyboard('e')
    await secondSearch
    await secondAnswer.promise
    expect(searches).toHaveLength(2)
    expect(announced).toEqual(['Results: 2', 'Results: 2'])

    await userEvent.click(option('Ngelehun CHC'))
    expect(stored()?.value).toBe(CHC)
    await expect.element(cell).toHaveFocus()
    await expect.element(cell).toHaveValue('Ngelehun CHC')

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
    const { cell, searches, nextSearch, hold } = await mount(PLACE)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    onTestFinished(() => {
        vi.useRealTimers()
    })
    inputOf(cell).focus()
    await userEvent.keyboard('n')
    await vi.advanceTimersByTimeAsync(250)
    expect(searches).toEqual([])
    hold()
    const firstSearch = nextSearch('ng')
    await userEvent.keyboard('g')
    await vi.advanceTimersByTimeAsync(249)
    expect(searches).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    const first = await firstSearch
    expect(searches).toEqual([first])
    const next = nextSearch('nge')
    await userEvent.keyboard('e')
    await vi.advanceTimersByTimeAsync(250)
    const second = await next
    expect(searches).toEqual([first, second])
    expect(first.signal?.aborted).toBe(true)
    expect(second.signal?.aborted).toBe(false)
})

test('leaving saves no result that was not picked; Tab picks the highlighted one; emptied text clears the cell', async () => {
    const { cell, stored, moves } = await mount(PLACE, {
        value: MCHP,
        orgUnitNames: new Map([[MCHP, 'Ngelehun MCHP']]),
    })
    inputOf(cell).focus()
    await userEvent.keyboard('ngel')
    await expect.element(option('Ngelehun CHC')).toBeVisible()
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
    await userEvent.keyboard('{Enter}')
    expect(stored()?.value).toBe('admin')
})
