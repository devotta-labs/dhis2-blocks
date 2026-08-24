import type { Locator, Page } from '@playwright/test'
import {
    INTEGER_ATTRIBUTE,
    MutationResponseSchema,
    OWNER,
    PRIVATE_LIST,
    PROGRAM,
    READER,
    SavedListCollectionSchema,
    SavedTrackedEntityListSchema,
    SharingResponseSchema,
    TEXT_ATTRIBUTE,
    chooseDhis2Option,
    chooseSaveViewOption,
    chooseSavedViewAction,
    createApi,
    deleteListIfPresent,
    expect,
    openSavedViewActions,
    openWorkingList,
    requestUrl,
    resultRows,
    savedViewButton,
    test,
    uiButton,
    waitForTrackerResponse,
} from './capture-parity.support'

const openTrackerSharingDialog = async (
    page: Page,
    listId: string,
    dialog: Locator
) => {
    const originalConsoleError = await page.evaluateHandle(
        () => globalThis.console.error
    )
    await page.evaluate(() => {
        const originalError = globalThis.console.error
        globalThis.console.error = (...args) => {
            const message = args.map(String).join(' ')
            const isKnownUiTypeWarning =
                message.includes(
                    'Invalid prop `type` of value `trackedEntityInstanceFilter`'
                ) &&
                (message.includes('supplied to `SharingDialog`') ||
                    message.includes('supplied to `TabbedContent`'))

            if (!isKnownUiTypeWarning) {
                originalError.apply(globalThis.console, args)
            }
        }
    })

    try {
        await chooseSavedViewAction(page, listId, 'share-saved-view')
        await expect(dialog).toBeVisible()
    } finally {
        await page.evaluate((originalError) => {
            globalThis.console.error = originalError
        }, originalConsoleError)
        await originalConsoleError.dispose()
    }
}

test.describe('owner pagination and saved-list lifecycle', () => {
    test.use({ e2eCredentials: OWNER })

    test('paginates without a total, changes page size as preference, and does not save pagination', async ({
        page,
    }) => {
        await openWorkingList(page, {
            template: PRIVATE_LIST,
            pageSize: 10,
        })
        await expect(resultRows(page)).toHaveCount(10)

        await page
            .locator('[data-test="working-list-pagination-page-next"]')
            .click()
        await expect
            .poll(() => {
                const hashQuery = new URL(page.url()).hash.split('?')[1]
                return new URLSearchParams(hashQuery).get('page')
            })
            .toBe('2')
        await expect(
            page.getByTestId('working-list-row-WlE2eTei013')
        ).toBeVisible()

        await page
            .locator('[data-test="working-list-pagination-page-previous"]')
            .click()
        await expect
            .poll(() => {
                const hashQuery = new URL(page.url()).hash.split('?')[1]
                return new URLSearchParams(hashQuery).get('page')
            })
            .toBe('1')
        await expect(
            page.getByTestId('working-list-row-WlE2eTei001')
        ).toBeVisible()
        const resized = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () =>
                chooseDhis2Option(
                    page,
                    '[data-test="working-list-pagination-pagesize-select"]',
                    '15'
                ),
            (url) =>
                url.searchParams.get('page') === '1' &&
                url.searchParams.get('pageSize') === '15'
        )
        expect(resized.searchParams.has('totalPages')).toBe(false)
        await expect(resultRows(page)).toHaveCount(15)
    })

    test('saves, reloads, updates, shares, and deletes a private tracker list', async ({
        page,
        playwright,
    }) => {
        const ownerApi = await createApi(playwright, OWNER)
        const readerApi = await createApi(playwright, READER)
        let createdId: string | undefined
        try {
            await openWorkingList(page, { template: PRIVATE_LIST })
            await waitForTrackerResponse(
                page,
                'trackedEntities',
                () => page.getByTestId(`sort-${INTEGER_ATTRIBUTE}`).click(),
                (url) =>
                    url.searchParams
                        .get('order')
                        ?.startsWith(`${INTEGER_ATTRIBUTE}:`) === true
            )

            await chooseSaveViewOption(page, 'save-as-working-list')
            await page
                .locator('[data-test="working-list-name-input"] input')
                .fill('E2E browser tracker lifecycle')
            const createResponsePromise = page.waitForResponse(
                (response) =>
                    response.request().method() === 'POST' &&
                    requestUrl(response).pathname.endsWith(
                        '/trackedEntityInstanceFilters'
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
            await expect(
                page.getByTestId(`working-list-view-${createdId}`)
            ).toBeVisible()

            const savedResponse = await ownerApi.get(
                `/api/trackedEntityInstanceFilters/${createdId}`,
                {
                    params: {
                        fields: 'id,displayName,publicAccess,sharing,access,entityQueryCriteria',
                    },
                }
            )
            expect(savedResponse.ok()).toBe(true)
            const saved = SavedTrackedEntityListSchema.parse(
                await savedResponse.json()
            )
            expect(saved.sharing?.public ?? saved.publicAccess).toBe('--------')
            expect(saved.access).toMatchObject({ write: true, update: true })
            expect(saved.entityQueryCriteria).not.toHaveProperty('page')
            expect(saved.entityQueryCriteria).not.toHaveProperty('pageSize')
            await expect(savedViewButton(page, createdId!)).toHaveAttribute(
                'aria-current',
                'true'
            )
            await expect(page).toHaveURL(
                new RegExp(`selectedTemplateId=${createdId}`)
            )
            await expect(
                page.getByTestId('working-list-dirty-indicator')
            ).toHaveCount(0)
            const cleanUpdateRequests: string[] = []
            page.on('request', (request) => {
                if (request.method() === 'PUT') {
                    cleanUpdateRequests.push(request.url())
                }
            })
            await uiButton(page, 'save-working-list').click()
            await expect(
                page.locator('[data-test="save-as-working-list"]')
            ).toBeVisible()
            const cleanUpdateAction = page
                .locator('[data-test="update-working-list"]')
                .getByRole('menuitem')
            await expect(cleanUpdateAction).toBeDisabled()
            expect(cleanUpdateRequests).toEqual([])
            await page.keyboard.press('Escape')
            await expect(cleanUpdateAction).toHaveCount(0)
            expect(cleanUpdateRequests).toEqual([])

            const settledActions = await openSavedViewActions(page, createdId!)
            await expect(
                settledActions.locator('[data-test="update-saved-view"]')
            ).toHaveCount(0)
            await expect(
                settledActions.locator('[data-test="share-saved-view"]')
            ).toBeVisible()
            await expect(
                settledActions.locator('[data-test="delete-saved-view"]')
            ).toBeVisible()
            await page.keyboard.press('Escape')

            // This query was loaded before Save As, so React Query may satisfy
            // the restored text sort from cache without another HTTP request.
            await page.getByTestId(`sort-${TEXT_ATTRIBUTE}`).click()
            await expect(
                page.getByTestId('working-list-dirty-indicator')
            ).toBeVisible()
            const dirtyOptions = await openSavedViewActions(page, createdId!)
            await expect(
                dirtyOptions.locator('[data-test="update-saved-view"]')
            ).toBeVisible()
            const updateResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'PUT' &&
                    requestUrl(response).pathname.endsWith(
                        `/trackedEntityInstanceFilters/${createdId}`
                    )
            )
            await dirtyOptions
                .locator('[data-test="update-saved-view"]')
                .getByRole('menuitem')
                .click()
            expect((await updateResponse).ok()).toBe(true)
            await expect(
                page.getByTestId('working-list-dirty-indicator')
            ).toHaveCount(0)

            const sharingDialog = page.getByRole('dialog').filter({
                has: page.getByRole('heading', {
                    name: 'Sharing and access: E2E browser tracker lifecycle',
                    exact: true,
                }),
            })
            await openTrackerSharingDialog(page, createdId!, sharingDialog)
            await sharingDialog.getByPlaceholder('Search').fill(READER.username)
            await page
                .locator('[data-test="dhis2-uicore-menuitem"]')
                .filter({ hasText: 'Working list Reader' })
                .click()
            const addAccessForm = sharingDialog.locator('form')
            const accessLevelField = page
                .locator('[data-test="dhis2-uiwidgets-singleselectfield"]')
                .filter({
                    has: page.getByText('Access level', { exact: true }),
                })
            await accessLevelField
                .locator('[data-test="dhis2-uicore-select-input"]')
                .click()
            await page
                .locator('[data-test="dhis2-uicore-singleselectoption"]')
                .filter({ hasText: 'View only' })
                .click()

            const grantResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'PUT' &&
                    requestUrl(response).pathname.endsWith('/sharing') &&
                    requestUrl(response).searchParams.get('type') ===
                        'trackedEntityInstanceFilter' &&
                    requestUrl(response).searchParams.get('id') === createdId
            )
            await addAccessForm
                .getByRole('button', { name: 'Give access' })
                .click()
            expect((await grantResponse).ok()).toBe(true)
            await expect(sharingDialog).toHaveCount(0)

            const sharingAfterGrant = await ownerApi.get('/api/sharing', {
                params: {
                    type: 'trackedEntityInstanceFilter',
                    id: createdId!,
                },
            })
            expect(sharingAfterGrant.ok()).toBe(true)
            const grantedObject = SharingResponseSchema.parse(
                await sharingAfterGrant.json()
            )
            expect(grantedObject.object?.userAccesses).toContainEqual(
                expect.objectContaining({
                    id: 'WlE2eUsr002',
                    access: 'r-------',
                })
            )
            await expect
                .poll(async () => {
                    const response = await readerApi.get(
                        '/api/trackedEntityInstanceFilters',
                        {
                            params: {
                                filter: `program.id:eq:${PROGRAM}`,
                                fields: 'id',
                                paging: 'false',
                            },
                        }
                    )
                    if (!response.ok()) {
                        return false
                    }
                    const body = SavedListCollectionSchema.parse(
                        await response.json()
                    )
                    return body.trackedEntityInstanceFilters?.some(
                        (list) => list.id === createdId
                    )
                })
                .toBe(true)

            await openTrackerSharingDialog(page, createdId!, sharingDialog)
            const readerAccessRow = sharingDialog.locator('.wrapper').filter({
                has: page.getByText('Working list Reader', {
                    exact: true,
                }),
            })
            await expect(readerAccessRow).toBeVisible()
            const readerAccessSelect = readerAccessRow.locator(
                '[data-test="dhis2-uicore-select-input"]'
            )
            await expect(readerAccessSelect).not.toHaveClass(/disabled/)
            await readerAccessSelect.click()
            const revokeResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'PUT' &&
                    requestUrl(response).pathname.endsWith('/sharing') &&
                    requestUrl(response).searchParams.get('type') ===
                        'trackedEntityInstanceFilter' &&
                    requestUrl(response).searchParams.get('id') === createdId
            )
            await page.getByText('Remove access', { exact: true }).click()
            expect((await revokeResponse).ok()).toBe(true)
            await expect(sharingDialog).toHaveCount(0)

            const sharingAfterRevoke = await ownerApi.get('/api/sharing', {
                params: {
                    type: 'trackedEntityInstanceFilter',
                    id: createdId!,
                },
            })
            expect(sharingAfterRevoke.ok()).toBe(true)
            const revokedObject = SharingResponseSchema.parse(
                await sharingAfterRevoke.json()
            )
            expect(
                revokedObject.object?.userAccesses?.some(
                    (entry) => entry.id === 'WlE2eUsr002'
                )
            ).toBe(false)
            await expect
                .poll(async () => {
                    const response = await readerApi.get(
                        '/api/trackedEntityInstanceFilters',
                        {
                            params: {
                                filter: `program.id:eq:${PROGRAM}`,
                                fields: 'id',
                                paging: 'false',
                            },
                        }
                    )
                    if (!response.ok()) {
                        return false
                    }
                    const body = SavedListCollectionSchema.parse(
                        await response.json()
                    )
                    return body.trackedEntityInstanceFilters?.some(
                        (list) => list.id === createdId
                    )
                })
                .toBe(false)

            await chooseSavedViewAction(page, createdId!, 'delete-saved-view')
            const deleteResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'DELETE' &&
                    requestUrl(response).pathname.endsWith(
                        `/trackedEntityInstanceFilters/${createdId}`
                    )
            )
            await page
                .locator('[data-test="delete-saved-view-confirm"]')
                .click()
            expect((await deleteResponse).ok()).toBe(true)
            await expect(
                page.getByTestId(`working-list-view-${createdId}`)
            ).toHaveCount(0)
            createdId = undefined
        } finally {
            await deleteListIfPresent(
                ownerApi,
                'trackedEntityInstanceFilters',
                createdId
            )
            await readerApi.dispose()
            await ownerApi.dispose()
        }
    })
})
