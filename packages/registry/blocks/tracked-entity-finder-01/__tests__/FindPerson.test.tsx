import { page, userEvent } from 'vitest/browser'
import {
    DATE_OF_BIRTH,
    FIRST_NAME,
    ID_ATTRIBUTE,
    renderFindPerson,
    typeDate,
} from './findPersonSupport'

describe('FindPerson', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

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
