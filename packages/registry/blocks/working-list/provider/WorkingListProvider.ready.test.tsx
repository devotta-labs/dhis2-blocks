import { attributeId, setup } from './__tests__/providerTestSupport'

describe('ready WorkingList provider boundaries', () => {
    it('stages controlled pagination, resets it on stage change and rejects cross-resource writes', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        expect(h.current().actions.setPage(2).isOk()).toBe(true)
        await vi.waitFor(() =>
            expect(h.current().meta.results).toMatchObject({
                status: 'ready',
                pagination: { page: 2 },
            })
        )
        expect(
            h.query.mock.calls.some(
                ([definitions]) =>
                    definitions.workingListResource.params?.page === 2
            )
        ).toBe(true)
        expect(h.current().actions.setProgramStage('Stage000001').isOk()).toBe(
            true
        )
        await vi.waitFor(() =>
            expect(h.current().state?.configuration.mode).toBe('event')
        )
        expect(h.current().meta.pagination.page).toBe(1)
        const result = await h.current().actions.updateSelectedView()
        expect(result.isErr() && result.error._tag).toBe(
            'InvalidConfigurationError'
        )
        expect(h.mutate).not.toHaveBeenCalled()
        await h.dispose()
    })

    it('retains cached rows offline and rejects mutations before reaching the engine', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        await h.setOnline(false)
        await vi.waitFor(() => expect(h.current().meta.online).toBe(false))
        h.failed.add('tracker/trackedEntities')
        await h.client.invalidateQueries({
            predicate: ({ queryKey }) => queryKey.includes('records'),
        })
        expect(h.current().meta.results.status).toBe('ready')
        await expect
            .element(h.screen.getByRole('cell', { name: 'Ada', exact: true }))
            .toBeVisible()
        const result = await h.current().actions.updateSelectedView()
        expect(result.isErr() && result.error._tag).toBe('OfflineMutationError')
        expect(
            (await h.current().actions.deleteView('SavedList01')).isErr()
        ).toBe(true)
        expect(h.mutate).not.toHaveBeenCalled()
        await h.dispose()
    })

    it('loads results, retains stable actions, and keeps column order/dirty/save behind canonical confirmation', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        await expect
            .element(h.screen.getByRole('cell', { name: 'Ada', exact: true }))
            .toBeVisible()
        expect(h.current().actions.setColumns([]).isErr()).toBe(true)
        expect(h.current().actions.setColumns(['__dataQuality']).isErr()).toBe(
            true
        )
        expect(
            h
                .current()
                .actions.setColumns(['programOwnerId', attributeId])
                .isOk()
        ).toBe(true)
        await vi.waitFor(() => expect(h.current().meta.dirty).toBe(true))
        const result = await h.current().actions.updateSelectedView()
        expect(result.isOk()).toBe(true)
        await vi.waitFor(() => expect(h.current().meta.dirty).toBe(false))
        expect(h.current().state?.configuration.columns).toEqual([
            'programOwnerId',
            attributeId,
        ])
        expect(h.mutate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    entityQueryCriteria: expect.objectContaining({
                        displayColumnOrder: ['programOwner', attributeId],
                    }),
                }),
            })
        )
        expect(new Set(h.observedActions).size).toBe(1)
        await h.dispose()
    })

    it('result retry reloads both the page and failed OU labels', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        h.failed.add('organisationUnits')
        await h.client.resetQueries({
            predicate: ({ queryKey }) =>
                queryKey.includes('organisation-units'),
        })
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('error')
        )
        const pages = h.requests('tracker/trackedEntities')
        const labels = h.requests('organisationUnits')
        h.failed.clear()
        await h.screen
            .getByTestId('results-error')
            .getByRole('button', { name: 'Try again' })
            .click()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        expect(h.requests('tracker/trackedEntities')).toBeGreaterThan(pages)
        expect(h.requests('organisationUnits')).toBeGreaterThan(labels)
        await h.dispose()
    })

    it('keeps cached views usable beside error/retry and refreshes canonical sharing', async () => {
        const h = await setup()
        h.failed.add('trackedEntityInstanceFilters')
        await h.client.invalidateQueries({
            predicate: ({ queryKey }) => queryKey.includes('saved-lists'),
        })
        await vi.waitFor(() =>
            expect(h.current().meta.savedViews.status).toBe('error')
        )
        await expect
            .element(h.screen.getByTestId('saved-list-bar'))
            .toBeVisible()
        await expect
            .element(h.screen.getByTestId('saved-working-lists-error'))
            .toBeVisible()
        await h.screen
            .getByRole('button', { name: 'SavedList02', exact: true })
            .click()
        await vi.waitFor(() =>
            expect(h.current().state?.selectedSavedListId).toBe('SavedList02')
        )
        h.failed.clear()
        await h.screen
            .getByTestId('saved-working-lists-error')
            .getByRole('button', { name: 'Try again' })
            .click()
        await vi.waitFor(() =>
            expect(h.current().meta.savedViews.status).toBe('ready')
        )
        h.changeSharing()
        const before = h.requests('trackedEntityInstanceFilters')
        await h.screen.getByTestId('working-list-view-SavedList02-menu').click()
        await h.screen.getByRole('menuitem', { name: 'Manage sharing' }).click()
        await h.screen.getByRole('button', { name: 'Save sharing' }).click()
        await vi.waitFor(() =>
            expect(
                h
                    .current()
                    .meta.savedViews.views.find(
                        ({ id }) => id === 'SavedList02'
                    )?.canUpdate
            ).toBe(false)
        )
        expect(h.requests('trackedEntityInstanceFilters')).toBeGreaterThan(
            before
        )
        expect((await h.current().actions.updateSelectedView()).isErr()).toBe(
            true
        )
        expect(h.mutate).not.toHaveBeenCalled()
        await h.dispose()
    })

    it('never marks edited configuration clean after a delayed update', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        h.current().actions.setColumns(['programOwnerId', attributeId])
        await vi.waitFor(() => expect(h.current().meta.dirty).toBe(true))
        const gate = h.pauseMutation()
        const updating = h.current().actions.updateSelectedView()
        await vi.waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1))
        h.current().actions.setColumns(['createdAt', attributeId])
        gate.resolve()
        expect((await updating).isOk()).toBe(true)
        await vi.waitFor(() =>
            expect(h.current().meta.mutations.update.status).toBe('idle')
        )
        expect(h.current().state?.configuration.columns).toEqual([
            'createdAt',
            attributeId,
        ])
        expect(h.current().meta.dirty).toBe(true)
        await h.dispose()
    })

    it.each(['update', 'delete'] as const)(
        'does not change selection after delayed %s of another view',
        async (operation) => {
            const h = await setup()
            await vi.waitFor(() =>
                expect(h.current().meta.results.status).toBe('ready')
            )
            const gate = h.pauseMutation()
            const mutation =
                operation === 'update'
                    ? h.current().actions.updateSelectedView()
                    : h.current().actions.deleteView('SavedList01')
            await vi.waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1))
            h.current().actions.selectView('SavedList02')
            await vi.waitFor(() =>
                expect(h.current().state?.selectedSavedListId).toBe(
                    'SavedList02'
                )
            )
            h.current().actions.setColumns(['createdAt', attributeId])
            gate.resolve()
            expect((await mutation).isOk()).toBe(true)
            expect(h.current().state?.selectedSavedListId).toBe('SavedList02')
            expect(h.current().state?.configuration.columns).toEqual([
                'createdAt',
                attributeId,
            ])
            expect(h.current().meta.dirty).toBe(true)
            await h.dispose()
        }
    )

    it('confirms a current repair through canonical refresh before making it ready', async () => {
        const h = await setup('SavedList01', true)
        await vi.waitFor(() =>
            expect(h.current().meta.selection.status).toBe('error')
        )
        const gate = h.pauseMutation()
        await h.screen
            .getByRole('button', { name: 'Repair', exact: true })
            .click()
        await h.screen
            .getByRole('dialog')
            .getByRole('button', { name: 'Repair', exact: true })
            .click()
        await vi.waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1))
        expect(h.current().meta.selection.status).toBe('error')
        gate.resolve()
        await vi.waitFor(() =>
            expect(h.current().meta.selection).toEqual({
                status: 'ready',
                selectedSavedListId: 'SavedList01',
            })
        )
        expect(h.current().state?.configuration.columns).toEqual([attributeId])
        expect(h.current().meta.dirty).toBe(false)
        await h.dispose()
    })

    it('repairs through the rendered dialog without stealing a later selection', async () => {
        const h = await setup('SavedList01', true)
        await vi.waitFor(() =>
            expect(h.current().meta.selection.status).toBe('error')
        )
        const gate = h.pauseMutation()
        await h.screen
            .getByRole('button', { name: 'Repair', exact: true })
            .click()
        await expect
            .element(
                h.screen.getByRole('cell', {
                    name: 'MissingFld1 (Unknown)',
                    exact: true,
                })
            )
            .toBeVisible()
        await expect
            .element(
                h.screen.getByRole('cell', {
                    name: 'Replace with default',
                    exact: true,
                })
            )
            .toBeVisible()
        await h.screen
            .getByRole('dialog')
            .getByRole('button', { name: 'Repair', exact: true })
            .click()
        await vi.waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1))
        h.current().actions.selectView('SavedList02')
        await vi.waitFor(() =>
            expect(h.current().state?.selectedSavedListId).toBe('SavedList02')
        )
        h.current().actions.setColumns(['createdAt', attributeId])
        gate.resolve()
        await vi.waitFor(() =>
            expect(
                h
                    .current()
                    .meta.savedViews.views.find(
                        ({ id }) => id === 'SavedList01'
                    )?.compatible
            ).toBe(true)
        )
        expect(h.current().state?.selectedSavedListId).toBe('SavedList02')
        expect(h.current().meta.dirty).toBe(true)
        await h.dispose()
    })

    it('rejects HTTP success without a matching canonical saved configuration', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        h.current().actions.setColumns(['createdAt', attributeId])
        await vi.waitFor(() => expect(h.current().meta.dirty).toBe(true))
        h.ignoreWrites()
        const result = await h.current().actions.updateSelectedView()
        expect(result.isErr() && result.error._tag).toBe(
            'WorkingListInvalidResponseError'
        )
        expect(h.current().meta.dirty).toBe(true)
        await h.dispose()
    })
})
