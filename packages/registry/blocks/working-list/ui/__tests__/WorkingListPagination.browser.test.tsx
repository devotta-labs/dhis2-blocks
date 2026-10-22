import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { WorkingListPageSize } from '../../provider/contracts'
import { WorkingListPagination } from '../WorkingListTable/WorkingListPagination'
import { WorkingListTextProvider } from '../WorkingListText'

const renderPagination = async (props: {
    page: number
    pageSize?: WorkingListPageSize
    hasNextPage: boolean
    disabled?: boolean
}) => {
    const onPageChange = vi.fn<(page: number) => void>()
    const onPageSizeChange = vi.fn<(pageSize: WorkingListPageSize) => void>()
    const screen = await render(
        <WorkingListTextProvider translate={(message) => message}>
            <WorkingListPagination
                pageSize={15}
                {...props}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
            />
        </WorkingListTextProvider>
    )
    return { screen, onPageChange, onPageSizeChange }
}

describe('WorkingListPagination', () => {
    it('only offers the pages that exist', async () => {
        const { screen, onPageChange } = await renderPagination({
            page: 1,
            hasNextPage: true,
        })
        const navigation = screen.getByRole('navigation', {
            name: 'Pagination',
        })

        await expect
            .element(navigation.getByRole('button', { name: 'Previous' }))
            .toBeDisabled()
        await navigation.getByRole('button', { name: 'Next' }).click()
        expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('steps back from a later page and stops on the last one', async () => {
        const { screen, onPageChange } = await renderPagination({
            page: 3,
            hasNextPage: false,
        })

        await expect
            .element(screen.getByRole('button', { name: 'Next' }))
            .toBeDisabled()
        await screen.getByRole('button', { name: 'Previous' }).click()
        expect(onPageChange).toHaveBeenCalledWith(2)
    })

    it('changes the page size to one of the supported sizes', async () => {
        const { screen, onPageSizeChange } = await renderPagination({
            page: 2,
            hasNextPage: true,
        })
        const pageSize = screen.getByRole('combobox', {
            name: 'Items per page',
        })
        await expect.element(pageSize).toHaveTextContent('15')

        await pageSize.click()
        await page.getByRole('option', { name: '25' }).click()
        expect(onPageSizeChange).toHaveBeenCalledWith(25)
    })

    it('disables every control while the first page loads', async () => {
        const { screen } = await renderPagination({
            page: 2,
            hasNextPage: true,
            disabled: true,
        })

        await expect
            .element(screen.getByRole('button', { name: 'Previous' }))
            .toBeDisabled()
        await expect
            .element(screen.getByRole('button', { name: 'Next' }))
            .toBeDisabled()
        await expect
            .element(screen.getByRole('combobox', { name: 'Items per page' }))
            .toBeDisabled()
    })
})
