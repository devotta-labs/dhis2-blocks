import {
    AxeBuilder,
    BOOLEAN_ATTRIBUTE,
    CORRUPTED_DATE_VALUE,
    EMAIL_ATTRIBUTE,
    GEOJSON_ATTRIBUTE,
    INTEGER_ATTRIBUTE,
    MULTI_TEXT_ATTRIBUTE,
    NUMBER_ATTRIBUTE,
    PHONE_ATTRIBUTE,
    TEXT_ATTRIBUTE,
    addFilter,
    expect,
    openWorkingList,
    test,
    typedRegistryTest,
    typedRegistryTestTitle,
    uiButton,
    waitForTrackerResponse,
} from './capture-parity.support'

test.describe('Capture context and generated tracker views', () => {
    typedRegistryTest(typedRegistryTestTitle, async ({ page }) => {
        await openWorkingList(page)

        await addFilter(page, 'tracked-entity', NUMBER_ATTRIBUTE)

        const numberEditor = page.getByTestId(
            `filter-editor-${NUMBER_ATTRIBUTE}`
        )

        await numberEditor.getByLabel('Minimum').fill('2.5')
        await numberEditor.getByLabel('Maximum').fill('4.5')

        const numberRequest = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () =>
                page
                    .locator(`[data-test="filter-update-${NUMBER_ATTRIBUTE}"]`)
                    .click(),
            (url) =>
                url.searchParams
                    .getAll('filter')
                    .includes(`${NUMBER_ATTRIBUTE}:ge:2.5:le:4.5`)
        )

        expect(numberRequest.searchParams.getAll('filter')).toContain(
            `${NUMBER_ATTRIBUTE}:ge:2.5:le:4.5`
        )

        await addFilter(page, 'tracked-entity', BOOLEAN_ATTRIBUTE)

        const booleanEditor = page.getByTestId(
            `filter-editor-${BOOLEAN_ATTRIBUTE}`
        )

        await expect(booleanEditor.getByLabel('Yes')).not.toBeChecked()
        await expect(booleanEditor.getByLabel('No')).not.toBeChecked()
        await booleanEditor.getByLabel('Yes').check()

        const booleanRequest = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () =>
                page
                    .locator(`[data-test="filter-update-${BOOLEAN_ATTRIBUTE}"]`)
                    .click(),
            (url) =>
                url.searchParams
                    .getAll('filter')
                    .includes(`${BOOLEAN_ATTRIBUTE}:eq:true`)
        )

        expect(booleanRequest.searchParams.getAll('filter')).toEqual(
            expect.arrayContaining([
                `${NUMBER_ATTRIBUTE}:ge:2.5:le:4.5`,
                `${BOOLEAN_ATTRIBUTE}:eq:true`,
            ])
        )

        await addFilter(page, 'tracked-entity', MULTI_TEXT_ATTRIBUTE)

        const optionEditor = page.getByTestId(
            `filter-editor-${MULTI_TEXT_ATTRIBUTE}`
        )

        await optionEditor
            .getByTestId(`filter-value-${MULTI_TEXT_ATTRIBUTE}`)
            .locator('[data-test="dhis2-uicore-multiselect"]')
            .click()
        await page
            .locator('[data-test="dhis2-uicore-multiselectoption"]')
            .filter({ hasText: 'Alpha' })
            .click()
        await page.keyboard.press('Escape')

        const optionRequest = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () =>
                page
                    .locator(
                        `[data-test="filter-update-${MULTI_TEXT_ATTRIBUTE}"]`
                    )
                    .click(),
            (url) =>
                url.searchParams
                    .getAll('filter')
                    .includes(`${MULTI_TEXT_ATTRIBUTE}:in:ALPHA`)
        )

        expect(optionRequest.searchParams.getAll('filter')).toEqual(
            expect.arrayContaining([
                `${NUMBER_ATTRIBUTE}:ge:2.5:le:4.5`,
                `${BOOLEAN_ATTRIBUTE}:eq:true`,
                `${MULTI_TEXT_ATTRIBUTE}:in:ALPHA`,
            ])
        )

        const matchingRow = page.getByTestId('working-list-row-WlE2eTei003')
        await expect(matchingRow).toBeVisible()
        await expect(matchingRow).toContainText('3.5')
        await expect(matchingRow).toContainText('Yes')
        await expect(matchingRow).toContainText('Alpha, Beta')

        for (const { fieldId, value } of [
            { fieldId: EMAIL_ATTRIBUTE, value: 'person03@example.org' },
            { fieldId: PHONE_ATTRIBUTE, value: '+23276123456' },
        ]) {
            const header = page
                .getByTestId(`sort-${fieldId}`)
                .locator('xpath=ancestor::th')

            const columnIndex = await header.evaluate((element) =>
                Array.from(element.parentElement?.children ?? []).indexOf(
                    element
                )
            )

            expect(columnIndex).toBeGreaterThanOrEqual(0)
            const cell = matchingRow.locator('td').nth(columnIndex)
            await expect(cell).toHaveText(value)
            await expect(cell.locator('a')).toHaveCount(0)
        }

        await page.getByTestId('more-filters-tracked-entity').click()
        await expect(
            page.locator(`[data-test="add-filter-${GEOJSON_ATTRIBUTE}"]`)
        ).toHaveCount(0)
        await page.keyboard.press('Escape')
        await expect(
            page.getByTestId(`sort-${GEOJSON_ATTRIBUTE}`)
        ).toContainText('E2E GeoJSON attribute')

        const geoJsonHeader = page
            .getByTestId(`sort-${GEOJSON_ATTRIBUTE}`)
            .locator('xpath=ancestor::th')

        const geoJsonColumnIndex = await geoJsonHeader.evaluate((header) =>
            Array.from(header.parentElement?.children ?? []).indexOf(header)
        )

        expect(geoJsonColumnIndex).toBeGreaterThanOrEqual(0)
        await expect(
            matchingRow.locator('td').nth(geoJsonColumnIndex)
        ).toHaveText('{"type":"Point","coordinates":[-11.78,8.61]}')
    })

    test('renders the SQL-corrupted value best-effort and highlights it only in data-quality mode', async ({
        page,
    }) => {
        const dataQualityWarnings: string[] = []
        page.on('console', (message) => {
            if (
                message.type() === 'warning' &&
                message.text().includes('[working-list]')
            ) {
                dataQualityWarnings.push(message.text())
            }
        })

        await openWorkingList(page)

        // The seed script corrupts WlE2eTei002's date attribute behind the
        // tracker importer's back; field users still see the row, raw value
        // included, with no data-quality visuals.
        const dirtyRow = page.getByTestId('working-list-row-WlE2eTei002')
        await expect(dirtyRow).toBeVisible()
        await expect(dirtyRow).not.toHaveAttribute('data-invalid')
        await expect(dirtyRow).toContainText(CORRUPTED_DATE_VALUE)
        await expect(
            page.locator('[data-testid^="working-list-issues-cell-"]')
        ).toHaveCount(0)
        await expect(page.getByTestId('row-issues-WlE2eTei002')).toHaveCount(0)
        expect(dataQualityWarnings.length).toBeGreaterThan(0)

        await page.locator('[data-test="data-quality-mode-toggle"]').click()

        await expect(dirtyRow).toHaveAttribute('data-invalid', 'true')
        await expect(dirtyRow).toContainText(CORRUPTED_DATE_VALUE)
        const rowIssuesMarker = page.getByTestId('row-issues-WlE2eTei002')
        await expect(rowIssuesMarker).toHaveAccessibleName(
            'Row has 1 data quality issues'
        )
        await expect(
            rowIssuesMarker.locator('xpath=ancestor::td')
        ).toHaveAttribute('data-testid', 'working-list-issues-cell-WlE2eTei002')
        await expect(
            dirtyRow.locator(
                '[data-testid="working-list-issues-cell-WlE2eTei002"]'
            )
        ).toHaveCount(1)
        await expect(
            page.getByTestId('working-list-row-WlE2eTei001')
        ).not.toHaveAttribute('data-invalid')

        const accessibility = await new AxeBuilder({ page })
            .include('[data-testid="working-list-main"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()

        expect(
            accessibility.violations.filter((violation) =>
                ['serious', 'critical'].includes(violation.impact ?? '')
            )
        ).toEqual([])

        await page.locator('[data-test="data-quality-mode-toggle"]').click()
        await expect(dirtyRow).not.toHaveAttribute('data-invalid')
        await expect(dirtyRow).toContainText(CORRUPTED_DATE_VALUE)
    })

    test('replaces the single active sort and configures visible column order without changing filters', async ({
        page,
    }) => {
        await openWorkingList(page)

        const firstSort = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => page.getByTestId(`sort-${TEXT_ATTRIBUTE}`).click(),
            (url) => url.searchParams.get('order') === `${TEXT_ATTRIBUTE}:asc`
        )

        expect(firstSort.searchParams.getAll('order')).toEqual([
            `${TEXT_ATTRIBUTE}:asc`,
        ])

        const replacementSort = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => page.getByTestId(`sort-${INTEGER_ATTRIBUTE}`).click(),
            (url) =>
                url.searchParams
                    .get('order')
                    ?.startsWith(`${INTEGER_ATTRIBUTE}:`) === true
        )

        const replacementOrder = replacementSort.searchParams.getAll('order')
        expect(replacementOrder).toHaveLength(1)
        expect(replacementOrder[0]).toMatch(
            new RegExp(`^${INTEGER_ATTRIBUTE}:(asc|desc)$`)
        )
        await expect(
            page.locator(
                'th[aria-sort="ascending"], th[aria-sort="descending"]'
            )
        ).toHaveCount(1)

        await uiButton(page, 'configure-columns').click()
        const settings = page.getByTestId('column-settings')
        await expect(settings).toBeVisible()

        const pickedColumns = settings.locator(
            '[data-test="column-settings-transfer-pickedoptions"]'
        )

        const booleanColumn = pickedColumns.locator(
            `[data-value="${BOOLEAN_ATTRIBUTE}"]`
        )

        await booleanColumn.click()
        await settings
            .locator(
                '[data-test="column-settings-transfer-actions-removeindividual"]'
            )
            .click()
        await expect(booleanColumn).toHaveCount(0)

        const initialPickedIds = await pickedColumns
            .locator('[data-value]')
            .evaluateAll((options) =>
                options.map((option) => option.getAttribute('data-value'))
            )

        const initialIntegerIndex = initialPickedIds.indexOf(INTEGER_ATTRIBUTE)
        const initialTextIndex = initialPickedIds.indexOf(TEXT_ATTRIBUTE)
        const moveCount = initialIntegerIndex - initialTextIndex
        expect(moveCount).toBeGreaterThan(0)
        await pickedColumns
            .locator(`[data-value="${INTEGER_ATTRIBUTE}"]`)
            .click()

        const moveUp = settings.locator(
            '[data-test="column-settings-transfer-reorderingactions-buttonmoveup"]'
        )

        for (let move = 0; move < moveCount; move += 1) {
            await moveUp.click()
        }

        await expect
            .poll(async () => {
                const orderedIds = await pickedColumns
                    .locator('[data-value]')
                    .evaluateAll((options) =>
                        options.map((option) =>
                            option.getAttribute('data-value')
                        )
                    )

                return (
                    orderedIds.indexOf(INTEGER_ATTRIBUTE) <
                    orderedIds.indexOf(TEXT_ATTRIBUTE)
                )
            })
            .toBe(true)
        await page.locator('[data-test="column-settings-done"]').click()

        await expect(page.getByTestId(`sort-${BOOLEAN_ATTRIBUTE}`)).toHaveCount(
            0
        )

        const headers = await page
            .getByTestId('working-list-table')
            .locator('thead th')
            .allTextContents()

        expect(headers[0]).toContain('E2E integer attribute')
        await expect(page.getByTestId('filter-enrollmentStatus')).toContainText(
            'Active'
        )
    })
})
