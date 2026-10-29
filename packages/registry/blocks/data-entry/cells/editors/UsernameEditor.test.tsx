/// <reference types="@vitest/browser-playwright" />
import { FetchError } from '@dhis2/app-runtime'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { Field } from '@/components/dhis2-value-types'
import lookup from '../../sources/__tests__/fixtures/user-lookup.json'
import { CELL, HEADER, inputOf, rig } from '../__tests__/harness'
import type { ServerRequest } from '../__tests__/harness'
import { Cell } from '../Cell'

const USERNAME: Field = { valueType: 'USERNAME' }

/**
 * The username cell over a fake server: a search for "adm…" finds two users, "offline" fails as a dropped connection,
 * "down" fails otherwise, and any other finds none.
 */
const mount = async (options: Parameters<typeof rig>[1] = {}) => {
    const searches: ServerRequest[] = []
    const setup = rig(USERNAME, {
        ...options,
        data: {
            userLookup: async (_type, request) => {
                searches.push(request)
                if (request.params?.query === 'offline') {
                    throw new FetchError({
                        type: 'network',
                        message: 'An unknown network error occurred',
                        details: {},
                    })
                }
                if (request.params?.query === 'down') {
                    throw new Error(
                        'Internal server error: NullPointerException'
                    )
                }
                return String(request.params?.query).startsWith('adm')
                    ? lookup
                    : { users: [] }
            },
        },
    })
    await render(
        setup.ui(
            <Cell
                cellKey={CELL}
                field={USERNAME}
                labelledBy={HEADER}
                move={setup.move}
            />
        )
    )
    return {
        ...setup,
        searches,
        cell: page.getByRole('textbox', { name: 'Age (years)' }),
    }
}

const dialog = page.getByRole('dialog', { name: 'Edit Age (years)' })
const box = dialog.getByRole('combobox', { name: 'Search users' })

test('searching users lists username and name; picking saves the username', async () => {
    const { cell, stored, searches, announced } = await mount({
        value: 'admin',
    })
    // The cell shows the username.
    await expect.element(cell).toHaveValue('admin')
    inputOf(cell).focus()
    await userEvent.keyboard('{Enter}')
    await expect.element(box).toHaveValue('admin')
    await userEvent.keyboard('admin')
    const options = dialog.getByRole('option')
    await expect.element(options.first()).toBeVisible()
    expect(searches).toEqual([
        { resource: 'userLookup', params: { query: 'admin' } },
    ])
    expect(announced).toEqual(['Results: 2'])
    await expect.element(options.first()).toHaveTextContent('John Traoreadmin')
    await expect
        .element(options.nth(1))
        .toHaveTextContent('John Traoredhis2-analytics-admin')

    await userEvent.click(options.nth(1))
    expect(stored()?.value).toBe('dhis2-analytics-admin')
    await expect.element(dialog).not.toBeInTheDocument()
    await expect.element(cell).toHaveValue('dhis2-analytics-admin')
    await expect.element(cell).toHaveFocus()
})

test('no match says "No users found"', async () => {
    const { cell, announced } = await mount()
    inputOf(cell).focus()
    await userEvent.keyboard('zz')
    await expect.element(dialog.getByText('No users found')).toBeVisible()
    expect(announced).toContain('No users found')
    await expect.element(dialog.getByRole('option')).not.toBeInTheDocument()
})

test('a search that fails says so: offline, or try again', async () => {
    const { cell, stored, announced } = await mount({ value: 'admin' })
    inputOf(cell).focus()
    await userEvent.keyboard('offline')
    await expect.element(dialog.getByText('You are offline')).toBeVisible()
    expect(announced).toEqual(['You are offline'])
    await userEvent.fill(box, 'down')
    const again = 'Could not search. Try again.'
    await expect.element(dialog.getByText(again)).toBeVisible()
    expect(announced).toEqual(['You are offline', again])
    // Nothing to pick: Save keeps the value.
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }))
    expect(stored()?.value).toBe('admin')
})
