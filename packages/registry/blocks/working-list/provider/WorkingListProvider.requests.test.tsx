import { act } from 'react'
import { attributeId, setup } from './__tests__/providerTestSupport'

describe('WorkingList request boundaries', () => {
    it('does not request draft filter edits until Update commits them', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        await h.settle()
        expect(h.requests('tracker/trackedEntities')).toBe(1)
        await h.screen
            .getByRole('button', { name: 'Filter', exact: true })
            .click()
        await h.screen
            .getByRole('menuitem', { name: 'Name', exact: true })
            .click()
        await h.screen
            .getByRole('textbox', { name: 'Value', exact: true })
            .fill('Ada')
        await h.settle()
        expect(h.current().state?.configuration.filters).toEqual([])
        expect(h.current().meta.dirty).toBe(false)
        expect(h.requests('tracker/trackedEntities')).toBe(1)

        const gate = h.pauseRecords()
        await h.screen
            .getByRole('button', { name: 'Update', exact: true })
            .click()
        await vi.waitFor(() =>
            expect(h.requests('tracker/trackedEntities')).toBe(2)
        )
        expect(h.current().state?.configuration.filters).toEqual([
            expect.objectContaining({
                fieldId: attributeId,
                value: { kind: 'text', value: 'Ada' },
            }),
        ])
        expect(h.current().meta.dirty).toBe(true)
        const request = h.query.mock.calls.findLast(
            ([query]) =>
                query.workingListResource.resource === 'tracker/trackedEntities'
        )?.[0].workingListResource
        expect(request?.params?.filter).toEqual([`${attributeId}:like:Ada`])
        gate.resolve()
        await h.settle()
        await expect
            .element(h.screen.getByRole('cell', { name: 'Ada', exact: true }))
            .toBeVisible()
        expect(h.requests('tracker/trackedEntities')).toBe(2)
        await h.dispose()
    })

    it('ignores a late page result after the org unit changes', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        const oldPage = h.pauseRecords()
        expect(h.current().actions.setPage(2).isOk()).toBe(true)
        await vi.waitFor(() =>
            expect(h.requests('tracker/trackedEntities')).toBe(2)
        )
        const pendingIndex = h.query.mock.calls.findLastIndex(
            ([query]) =>
                query.workingListResource.resource ===
                    'tracker/trackedEntities' &&
                query.workingListResource.params?.page === 2
        )
        const pending = h.query.mock.results[pendingIndex]?.value
        expect(pending).toBeInstanceOf(Promise)
        const nextOrgUnit = h.pauseRecords()
        await h.setOrgUnit('OrgUnit0002')
        await vi.waitFor(() =>
            expect(h.requests('tracker/trackedEntities')).toBe(3)
        )
        nextOrgUnit.resolve()
        await expect
            .element(h.screen.getByRole('cell', { name: 'Grace', exact: true }))
            .toBeVisible()
        expect(h.current().meta.pagination.page).toBe(1)

        await act(async () => {
            oldPage.resolve()
            await pending
        })
        await h.settle()
        await expect
            .element(h.screen.getByRole('cell', { name: 'Grace', exact: true }))
            .toBeVisible()
        await expect
            .element(h.screen.getByRole('cell', { name: 'Ada', exact: true }))
            .not.toBeInTheDocument()
        expect(h.current().meta.pagination.page).toBe(1)
        expect(h.requests('tracker/trackedEntities')).toBe(3)
        await h.dispose()
    })
})
