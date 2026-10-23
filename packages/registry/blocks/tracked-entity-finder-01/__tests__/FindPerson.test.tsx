import { CustomDataProvider } from '@dhis2/app-runtime'
import React, { type ComponentProps } from 'react'
import { page, userEvent } from 'vitest/browser'
// Test support only: neither block's __tests__ directory is shipped.
import { renderWithQueries } from '../../tracked-entity-finder/__tests__/finderTestSupport'
import { FindPerson } from '../FindPerson'

// The Sierra Leone demo uids FindPerson uses.
const PROGRAM = 'WSGAb5XwJ3Y'
const ID_ATTRIBUTE = 'lZGmxYbs97q'
const FIRST_NAME = 'w75KJ2mc4zz'
const DATE_OF_BIRTH = 'gHGyrwKPzej'

const attribute = (id: string, displayName: string, valueType: string) => ({
    searchable: true,
    displayInList: true,
    trackedEntityAttribute: {
        id,
        displayName,
        valueType,
        unique: id === ID_ATTRIBUTE,
    },
})

/** The `GET programs/WSGAb5XwJ3Y` answer, trimmed to the attributes used. */
const program = {
    displayName: 'WHO RMNCH Tracker',
    minAttributesRequiredToSearch: 1,
    maxTeiCountToReturn: 0,
    trackedEntityType: { id: 'nEenWmSyUEp' },
    programTrackedEntityAttributes: [
        attribute(ID_ATTRIBUTE, 'Unique ID', 'TEXT'),
        attribute(FIRST_NAME, 'First name', 'TEXT'),
        attribute(DATE_OF_BIRTH, 'Birth date', 'DATE'),
    ],
}

const mariama = {
    trackedEntity: 'te1',
    trackedEntityType: 'nEenWmSyUEp',
    orgUnit: 'DiszpKrYNg8',
    programOwners: [{ orgUnit: 'DiszpKrYNg8', program: PROGRAM }],
    attributes: [
        { attribute: ID_ATTRIBUTE, value: 'RMNCH-0042' },
        { attribute: FIRST_NAME, value: 'Mariama' },
        { attribute: DATE_OF_BIRTH, value: '1994-05-12' },
    ],
}

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const renderFindPerson = () => {
    const onSelect = vi.fn()
    // The `filter` of each search the finder sends.
    const searches: unknown[] = []
    const data: CustomData = {
        programs: program,
        'system/info': { calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' },
        'tracker/trackedEntities': async (_type, query) => {
            searches.push(query.params?.filter)
            return {
                trackedEntities: [mariama],
                pager: { page: 1, pageSize: 10, total: 1 },
            }
        },
    }
    renderWithQueries(
        <CustomDataProvider data={data}>
            <FindPerson onSelect={onSelect} />
        </CustomDataProvider>
    )
    return { onSelect, searches }
}

const typeDate = async (label: string, text: string) => {
    await userEvent.fill(page.getByLabelText(label), text)
    // CalendarInput reports a typed date when the input loses focus.
    await userEvent.tab()
}

describe('FindPerson', () => {
    it('finds by ID', async () => {
        const { onSelect, searches } = renderFindPerson()

        await userEvent.fill(page.getByLabelText('Unique ID'), 'RMNCH-0042')
        await page.getByRole('button', { name: 'Search', exact: true }).click()

        const row = page.getByRole('button', { name: /Mariama/ })
        await row.click()
        expect(searches).toEqual([[`${ID_ATTRIBUTE}:eq:RMNCH-0042`]])
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ trackedEntity: 'te1' })
        )
    })

    it('swaps to first name and date of birth with No ID?', async () => {
        const { searches } = renderFindPerson()
        await expect.element(page.getByLabelText('Unique ID')).toBeVisible()

        await page.getByRole('button', { name: 'No ID?' }).click()

        await expect
            .element(page.getByLabelText('Unique ID'))
            .not.toBeInTheDocument()
        await userEvent.fill(page.getByLabelText('First name'), 'Mariama')
        await typeDate('Birth date', '1994-05-12')
        await page.getByRole('button', { name: 'Search', exact: true }).click()

        await expect
            .element(page.getByRole('button', { name: /Mariama/ }))
            .toBeVisible()
        expect(searches).toHaveLength(1)
        expect(searches[0]).toEqual([
            `${FIRST_NAME}:like:Mariama`,
            `${DATE_OF_BIRTH}:eq:1994-05-12`,
        ])
    })

    it('swaps back with Search by ID instead', async () => {
        const { searches } = renderFindPerson()

        await page.getByRole('button', { name: 'No ID?' }).click()
        await userEvent.fill(page.getByLabelText('First name'), 'Mariama')
        await page.getByRole('button', { name: 'Search', exact: true }).click()
        const row = page.getByRole('button', { name: /Mariama/ })
        await expect.element(row).toBeVisible()

        await page.getByRole('button', { name: 'Search by ID instead' }).click()

        await expect
            .element(page.getByLabelText('First name'))
            .not.toBeInTheDocument()
        await expect
            .element(page.getByRole('button', { name: 'No ID?' }))
            .toBeVisible()
        // The details search's results stay until the next Search.
        await expect.element(row).toBeVisible()

        await userEvent.fill(page.getByLabelText('Unique ID'), 'RMNCH-0042')
        await page.getByRole('button', { name: 'Search', exact: true }).click()

        await expect.poll(() => searches).toHaveLength(2)
        expect(searches[1]).toEqual([`${ID_ATTRIBUTE}:eq:RMNCH-0042`])
    })
})
