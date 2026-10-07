import {
    MutationResponseSchema,
    ORG_UNIT,
    OWNER,
    PRIVATE_LIST,
    PROGRAM,
    RepairedListSchema,
    type Request,
    STAGE,
    STALE_LIST,
    SavedStageListSchema,
    TEXT_ATTRIBUTE,
    chooseSaveViewOption,
    chooseSavedViewAction,
    createApi,
    deleteListIfPresent,
    enterStageMode,
    expect,
    isTrackerResource,
    openWorkingList,
    programHash,
    requestUrl,
    savedViewButton,
    test,
    uiButton,
    waitForTrackerResponse,
} from './capture-parity.support'

test.describe('owner pagination and saved-list lifecycle', () => {
    test.use({ e2eCredentials: OWNER })

    test('saves and deletes a programme-stage view in its dedicated metadata resource', async ({
        page,
        playwright,
    }) => {
        const ownerApi = await createApi(playwright, OWNER)
        let createdId: string | undefined

        try {
            await openWorkingList(page, { template: PRIVATE_LIST })
            await enterStageMode(page)
            await chooseSaveViewOption(page, 'save-as-working-list')
            await page
                .locator('[data-test="working-list-name-input"] input')
                .fill('E2E browser stage lifecycle')

            const createResponsePromise = page.waitForResponse(
                (response) =>
                    response.request().method() === 'POST' &&
                    requestUrl(response).pathname.endsWith(
                        '/programStageWorkingLists'
                    )
            )

            const selectionNavigation = page.waitForURL(
                (url) =>
                    url.hash.includes('selectedTemplateId=') &&
                    !url.hash.includes(`selectedTemplateId=${PRIVATE_LIST}`)
            )

            await page.locator('[data-test="working-list-name-submit"]').click()
            const createResponse = await createResponsePromise
            expect(createResponse.ok(), await createResponse.text()).toBe(true)

            const createBody = MutationResponseSchema.parse(
                await createResponse.json()
            )

            createdId = createBody.response?.uid
            expect(createdId).toBeTruthy()
            await selectionNavigation
            await expect(savedViewButton(page, createdId!)).toHaveAttribute(
                'aria-current',
                'true',
                { timeout: 30_000 }
            )
            await expect(
                page.getByTestId('working-list-selection-loading')
            ).toHaveCount(0, { timeout: 30_000 })
            await expect(page.getByTestId('working-list-table')).toBeVisible()
            await expect(
                page.locator('[data-testid="working-list-table"] tbody')
            ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
            await uiButton(page, 'save-working-list').click()
            await expect(
                page.locator('[data-test="save-as-working-list"]')
            ).toBeVisible()
            await page.keyboard.press('Escape')

            const saved = await ownerApi.get(
                `/api/programStageWorkingLists/${createdId}`,
                {
                    params: {
                        fields: 'id,publicAccess,sharing,programStage,programStageQueryCriteria',
                    },
                }
            )

            expect(saved.ok()).toBe(true)

            const savedStageList = SavedStageListSchema.parse(
                await saved.json()
            )

            expect(
                savedStageList.sharing?.public ?? savedStageList.publicAccess
            ).toBe('--------')
            expect(savedStageList.programStage?.id).toBe(STAGE)

            await chooseSavedViewAction(page, createdId!, 'delete-saved-view')

            const deleteResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'DELETE' &&
                    requestUrl(response).pathname.endsWith(
                        `/programStageWorkingLists/${createdId}`
                    )
            )

            await page
                .locator('[data-test="delete-saved-view-confirm"]')
                .click()
            expect((await deleteResponse).ok()).toBe(true)
            createdId = undefined
        } finally {
            await deleteListIfPresent(
                ownerApi,
                'programStageWorkingLists',
                createdId
            )
            await ownerApi.dispose()
        }
    })

    test('blocks a stale list, previews the repair, and persists the repaired definition', async ({
        page,
        playwright,
    }) => {
        const ownerApi = await createApi(playwright, OWNER)

        const staleDefinition = {
            id: STALE_LIST,
            name: 'E2E stale metadata list',
            program: { id: PROGRAM },
            publicAccess: '--------',
            externalAccess: false,
            sortOrder: 3,
            entityQueryCriteria: {
                displayColumnOrder: [TEXT_ATTRIBUTE, 'WlMissing01'],
                order: `${TEXT_ATTRIBUTE}:asc`,
                attributeValueFilters: [],
            },
        }

        const trackerRequests: URL[] = []

        const captureTrackerRequest = (request: Request) => {
            if (isTrackerResource(request, 'trackedEntities')) {
                trackerRequests.push(requestUrl(request))
            }
        }

        page.on('request', captureTrackerRequest)

        try {
            await page.goto(programHash({ template: STALE_LIST }))
            await expect(page.getByTestId('stale-list-panel')).toBeVisible({
                timeout: 30_000,
            })
            await expect(page.getByTestId('working-list-table')).toHaveCount(0)
            await expect(savedViewButton(page, STALE_LIST)).toHaveAttribute(
                'aria-current',
                'true'
            )
            await page.waitForTimeout(300)
            expect(trackerRequests).toHaveLength(0)

            await page.locator('[data-test="repair-working-list"]').click()

            const repairDialog = page.locator(
                '[data-test="repair-working-list-dialog"]'
            )

            await expect(repairDialog).toBeVisible()

            const missingColumnRepair = page
                .getByTestId('repair-working-list-preview')
                .getByRole('row')
                .filter({ hasText: 'WlMissing01' })

            await expect(missingColumnRepair).toContainText(
                'Replace with default'
            )

            const savedRepair = page.waitForResponse(
                (response) =>
                    response.request().method() === 'PUT' &&
                    requestUrl(response).pathname.endsWith(
                        `/trackedEntityInstanceFilters/${STALE_LIST}`
                    )
            )

            const repairedQuery = waitForTrackerResponse(
                page,
                'trackedEntities',
                () =>
                    page
                        .locator('[data-test="repair-working-list-confirm"]')
                        .click(),
                (url) =>
                    url.searchParams.get('orgUnitMode') === 'SELECTED' &&
                    url.searchParams.get('orgUnits') === ORG_UNIT
            )

            const [saveResponse, repairedUrl] = await Promise.all([
                savedRepair,
                repairedQuery,
            ])

            expect(saveResponse.ok(), await saveResponse.text()).toBe(true)
            expect(repairedUrl.searchParams.get('order')).toBe(
                `${TEXT_ATTRIBUTE}:asc`
            )
            await expect(page.getByTestId('stale-list-panel')).toHaveCount(0)
            await expect(page.getByTestId('working-list-table')).toBeVisible()
            await expect(
                page.locator('[data-testid="working-list-table"] tbody')
            ).toHaveAttribute('aria-busy', 'false')

            const repairedResponse = await ownerApi.get(
                `/api/trackedEntityInstanceFilters/${STALE_LIST}`,
                { params: { fields: 'id,entityQueryCriteria' } }
            )

            expect(repairedResponse.ok()).toBe(true)

            const repaired = RepairedListSchema.parse(
                await repairedResponse.json()
            )

            expect(repaired.entityQueryCriteria?.displayColumnOrder).toContain(
                TEXT_ATTRIBUTE
            )
            expect(
                repaired.entityQueryCriteria?.displayColumnOrder
            ).not.toContain('WlMissing01')
        } finally {
            page.off('request', captureTrackerRequest)

            const restoreResponse = await ownerApi.put(
                `/api/trackedEntityInstanceFilters/${STALE_LIST}`,
                { data: staleDefinition }
            )

            expect(restoreResponse.ok(), await restoreResponse.text()).toBe(
                true
            )
            await ownerApi.dispose()
        }
    })
})
