import {
    ORG_UNIT,
    ORG_UNIT_NAME,
    OrganisationUnitSchema,
    PROGRAM,
    PROGRAM_NAME,
    type Request,
    TEXT_ATTRIBUTE,
    addFilter,
    chooseDhis2Option,
    expect,
    isTrackerResource,
    openFilterEditor,
    openMoreActions,
    openWorkingList,
    programHash,
    requestUrl,
    resultRows,
    savedViewButton,
    selectOrganisationUnitFromTree,
    targetMajor,
    test,
    uiButton,
    waitForTrackerResponse,
} from './capture-parity.support'

test.describe('Capture context and generated tracker views', () => {
    test('requires a valid organisation unit and only queries SELECTED scope', async ({
        dhis2,
        page,
    }) => {
        const organisationUnitResponse = await dhis2.get(
            `/api/organisationUnits/${ORG_UNIT}`,
            {
                params: {
                    fields: 'id,displayName,ancestors[id,displayName]',
                },
            }
        )
        expect(organisationUnitResponse.ok()).toBe(true)
        const organisationUnit = OrganisationUnitSchema.parse(
            await organisationUnitResponse.json()
        )
        expect(organisationUnit).toMatchObject({
            id: ORG_UNIT,
            displayName: ORG_UNIT_NAME,
        })
        expect(organisationUnit.ancestors.length).toBeGreaterThan(0)

        await expect(page.getByTestId('program-empty-state')).toBeVisible({
            timeout: 30_000,
        })

        const trackerRequests: URL[] = []
        const countTrackerRequest = (request: Request) => {
            if (isTrackerResource(request, 'trackedEntities')) {
                trackerRequests.push(requestUrl(request))
            }
        }
        page.on('request', countTrackerRequest)
        await page.locator('[data-test="program-selector-container"]').click()
        await chooseDhis2Option(
            page,
            '[data-test="program-selector-input"]',
            PROGRAM_NAME
        )
        await expect(page.getByTestId('org-unit-empty-state')).toBeVisible({
            timeout: 30_000,
        })
        await expect(
            page.locator('[data-test="org-unit-selector-container"]')
        ).toContainText('Choose an organisation unit')
        await page.waitForTimeout(300)
        expect(trackerRequests).toHaveLength(0)

        const selectedRequest = waitForTrackerResponse(
            page,
            'trackedEntities',
            async () => {
                await page.locator('[data-test="choose-org-unit"]').click()
                await expect(page.getByTestId('org-unit-tree')).toBeVisible()
                await selectOrganisationUnitFromTree(
                    page,
                    organisationUnit.ancestors,
                    organisationUnit
                )
            },
            (url) =>
                url.searchParams.get('orgUnitMode') === 'SELECTED' &&
                url.searchParams.get('orgUnits') === ORG_UNIT
        )
        await selectedRequest
        page.off('request', countTrackerRequest)
        expect(trackerRequests.length).toBeGreaterThan(0)
        expect(
            trackerRequests.every(
                (url) =>
                    url.searchParams.get('orgUnitMode') === 'SELECTED' &&
                    url.searchParams.get('orgUnits') === ORG_UNIT
            )
        ).toBe(true)
        await expect(
            page.locator('[data-test="org-unit-selector-container"]')
        ).toContainText(ORG_UNIT_NAME)
        await expect(page).toHaveURL(new RegExp(`orgUnitId=${ORG_UNIT}`))
        await expect(page.getByTestId('working-list-table')).toBeVisible({
            timeout: 30_000,
        })
        const contextBounds = await page.evaluate(() => {
            const app = document.querySelector<HTMLElement>(
                '[data-testid="working-list-app"]'
            )
            const bar = document.querySelector<HTMLElement>(
                '[data-testid="context-selector-bar"]'
            )
            if (!app || !bar) {
                return undefined
            }
            const appRect = app.getBoundingClientRect()
            const barRect = bar.getBoundingClientRect()
            return {
                appLeft: appRect.left,
                appRight: appRect.right,
                barLeft: barRect.left,
                barRight: barRect.right,
            }
        })
        expect(contextBounds).toBeDefined()
        expect(contextBounds!.barLeft).toBeCloseTo(contextBounds!.appLeft, 0)
        expect(contextBounds!.barRight).toBeCloseTo(contextBounds!.appRight, 0)
        const documentHeading = page.getByRole('heading', {
            level: 1,
            name: 'Working lists',
        })
        await expect(documentHeading).toBeAttached()
        await expect(documentHeading).toHaveCSS('position', 'absolute')
    })

    test('loads generated defaults and reinstates active, completed, and cancelled filters', async ({
        page,
    }) => {
        await openWorkingList(page)
        await expect(savedViewButton(page, 'active')).toHaveAttribute(
            'aria-current',
            'true'
        )
        await expect(resultRows(page)).toHaveCount(8)
        await expect(uiButton(page, 'configure-columns')).toHaveText('Columns')
        await expect(
            page.getByTestId('more-filters-tracked-entity')
        ).toHaveText('Filter')
        await expect(uiButton(page, 'save-working-list')).toHaveText(
            'Save view'
        )
        await expect(uiButton(page, 'working-list-options')).toHaveText('More')
        await openMoreActions(page)
        await page.keyboard.press('Escape')

        const statusParameter =
            targetMajor === 41 ? 'programStatus' : 'enrollmentStatus'
        const completed = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => savedViewButton(page, 'completed').click(),
            (url) => url.searchParams.get(statusParameter) === 'COMPLETED'
        )
        expect(completed.searchParams.get('page')).toBe('1')
        await expect(resultRows(page)).toHaveCount(6)

        await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => savedViewButton(page, 'cancelled').click(),
            (url) => url.searchParams.get(statusParameter) === 'CANCELLED'
        )
        await expect(resultRows(page)).toHaveCount(6)
    })

    test('keeps the unfiltered generated default across reloads when no list is requested', async ({
        page,
    }) => {
        const statusParameter =
            targetMajor === 41 ? 'programStatus' : 'enrollmentStatus'
        const parameters = new URLSearchParams({
            programId: PROGRAM,
            orgUnitId: ORG_UNIT,
        })
        const initialQuery = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => page.goto(`/#/?${parameters.toString()}`),
            (url) => !url.searchParams.has(statusParameter)
        )
        expect(initialQuery.searchParams.has('filter')).toBe(false)
        // An absent URL selection is controlled null. The provider resolves
        // it to the generated default without echoing an external selection
        // through the persistence callback.
        await expect(page).not.toHaveURL(/selectedTemplateId=/)
        await expect(
            page.locator(
                '[data-testid^="working-list-view-"] button[aria-current="true"]'
            )
        ).toHaveCount(0)
        await expect(
            page.locator('[data-testid="working-list-table"] tbody')
        ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })

        // Reloading the controlled null state must keep the unfiltered default
        // instead of falling back to the first visible saved list.
        const reloadedQuery = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => page.reload(),
            (url) => !url.searchParams.has(statusParameter)
        )
        expect(reloadedQuery.searchParams.has('filter')).toBe(false)
        await expect(page).not.toHaveURL(/selectedTemplateId=/)
        await expect(
            page.locator(
                '[data-testid^="working-list-view-"] button[aria-current="true"]'
            )
        ).toHaveCount(0)
        await expect(page.getByTestId('working-list-table')).toBeVisible({
            timeout: 30_000,
        })
    })

    test('preserves an unavailable URL selection until the user explicitly chooses the default', async ({
        page,
    }) => {
        const missingTemplateId = 'WlMissing01'
        const trackerRequests: URL[] = []
        const captureTrackerRequest = (request: Request) => {
            if (isTrackerResource(request, 'trackedEntities')) {
                trackerRequests.push(requestUrl(request))
            }
        }
        page.on('request', captureTrackerRequest)

        try {
            await page.goto(programHash({ template: missingTemplateId }))
            await expect(
                page.getByTestId('unavailable-working-list-error')
            ).toBeVisible({ timeout: 30_000 })
            await expect(
                page.getByTestId('unavailable-working-list-error')
            ).toContainText(
                'may no longer exist, or you may no longer have access'
            )
            expect(
                new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get(
                    'selectedTemplateId'
                )
            ).toBe(missingTemplateId)
            await expect(page.getByTestId('working-list-table')).toHaveCount(0)
            expect(trackerRequests).toHaveLength(0)

            const defaultQuery = await waitForTrackerResponse(
                page,
                'trackedEntities',
                () =>
                    page
                        .locator('[data-test="use-default-working-list"]')
                        .click(),
                (url) =>
                    url.searchParams.get('orgUnits') === ORG_UNIT &&
                    !url.searchParams.has('filter')
            )
            expect(defaultQuery.searchParams.get('page')).toBe('1')
            await expect(page).toHaveURL(
                new RegExp(`selectedTemplateId=${PROGRAM}-default`)
            )
            await expect(
                page.getByTestId('unavailable-working-list-error')
            ).toHaveCount(0)
            await expect(page.getByTestId('working-list-table')).toBeVisible()
        } finally {
            page.off('request', captureTrackerRequest)
        }
    })

    test('deselects the active list and falls back to the unfiltered default view', async ({
        page,
    }) => {
        await openWorkingList(page)
        const activeView = savedViewButton(page, 'active')
        await expect(activeView).toHaveAttribute('aria-current', 'true')
        const statusParameter =
            targetMajor === 41 ? 'programStatus' : 'enrollmentStatus'

        const deselectedQuery = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => activeView.click(),
            (url) => !url.searchParams.has(statusParameter)
        )
        expect(deselectedQuery.searchParams.get('page')).toBe('1')
        await expect(activeView).not.toHaveAttribute('aria-current', 'true')
        // Deselection selects the synthetic default template so the
        // preference survives a reload.
        await expect(page).toHaveURL(
            new RegExp(`selectedTemplateId=${PROGRAM}-default`)
        )

        // React Query can satisfy this recently loaded query from cache.
        await activeView.click()
        await expect(activeView).toHaveAttribute('aria-current', 'true')
        await expect(page).toHaveURL(/selectedTemplateId=active/)

        await activeView.click()
        await expect(activeView).not.toHaveAttribute('aria-current', 'true')
        await expect(page).toHaveURL(
            new RegExp(`selectedTemplateId=${PROGRAM}-default`)
        )
        const reloadedQuery = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => page.reload(),
            (url) => !url.searchParams.has(statusParameter)
        )
        expect(reloadedQuery.searchParams.has('filter')).toBe(false)
        await expect(page).toHaveURL(
            new RegExp(`selectedTemplateId=${PROGRAM}-default`)
        )
        await expect(savedViewButton(page, 'active')).not.toHaveAttribute(
            'aria-current',
            'true'
        )
    })

    test('keeps text edits draft-only until Update and supports real null gates when available', async ({
        page,
    }) => {
        await openWorkingList(page)
        await addFilter(page, 'tracked-entity', TEXT_ATTRIBUTE)
        await openFilterEditor(page, TEXT_ATTRIBUTE)
        const editor = page.getByTestId(`filter-editor-${TEXT_ATTRIBUTE}`)

        let trackerRequests = 0
        const countTrackerRequest = (request: Request) => {
            if (isTrackerResource(request, 'trackedEntities')) {
                trackerRequests += 1
            }
        }
        page.on('request', countTrackerRequest)
        await editor.getByLabel('Value').fill('Alpha person 01')
        await page.waitForTimeout(400)
        expect(trackerRequests).toBe(0)
        expect(page.url()).not.toContain('Alpha')

        const filtered = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () =>
                page
                    .locator(`[data-test="filter-update-${TEXT_ATTRIBUTE}"]`)
                    .click(),
            (url) =>
                url.searchParams
                    .getAll('filter')
                    .includes(`${TEXT_ATTRIBUTE}:like:Alpha person 01`)
        )
        page.off('request', countTrackerRequest)
        expect(filtered.searchParams.get('page')).toBe('1')
        await expect(
            page.getByTestId('working-list-row-WlE2eTei001')
        ).toBeVisible()

        await openFilterEditor(page, TEXT_ATTRIBUTE)
        const operator = page.locator(
            `[data-test="filter-operator-${TEXT_ATTRIBUTE}"]`
        )
        await operator
            .locator('[data-test="dhis2-uicore-select-input"]')
            .click()
        if (targetMajor === 41) {
            await expect(
                page.getByText('Is empty', { exact: true })
            ).toHaveCount(0)
            await page.keyboard.press('Escape')
            return
        }
        await page.getByText('Is empty', { exact: true }).click()
        await waitForTrackerResponse(
            page,
            'trackedEntities',
            () =>
                page
                    .locator(`[data-test="filter-update-${TEXT_ATTRIBUTE}"]`)
                    .click(),
            (url) =>
                url.searchParams
                    .getAll('filter')
                    .includes(`${TEXT_ATTRIBUTE}:null`)
        )
        await expect(resultRows(page)).toHaveCount(1)

        await openFilterEditor(page, TEXT_ATTRIBUTE)
        await chooseDhis2Option(
            page,
            `[data-test="filter-operator-${TEXT_ATTRIBUTE}"]`,
            'Is not empty'
        )
        await waitForTrackerResponse(
            page,
            'trackedEntities',
            () =>
                page
                    .locator(`[data-test="filter-update-${TEXT_ATTRIBUTE}"]`)
                    .click(),
            (url) =>
                url.searchParams
                    .getAll('filter')
                    .includes(`${TEXT_ATTRIBUTE}:!null`)
        )
        await expect(resultRows(page)).toHaveCount(7)
    })
})
