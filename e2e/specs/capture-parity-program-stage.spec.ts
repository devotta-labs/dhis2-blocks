import {
    INTEGER_DATA_ELEMENT,
    ORG_UNIT,
    STAGE,
    STAGE_NAME,
    TEXT_ATTRIBUTE,
    TEXT_DATA_ELEMENT,
    addFilter,
    applyTextFilter,
    enterStageMode,
    expect,
    openFilterEditor,
    openWorkingList,
    resultRows,
    test,
    waitForTrackerResponse,
} from './capture-parity.support'

test.describe('Capture programme-stage joint data strategy', () => {
    test('morphs to events, combines attribute and data-element filters, and replaces event sort', async ({
        page,
    }) => {
        await openWorkingList(page)
        await addFilter(page, 'tracked-entity', TEXT_ATTRIBUTE)
        await applyTextFilter(
            page,
            TEXT_ATTRIBUTE,
            'Alpha person 01',
            'trackedEntities',
            'filter'
        )

        const stageRequest = await enterStageMode(page)
        expect(stageRequest.searchParams.get('programStage')).toBe(STAGE)
        expect(stageRequest.searchParams.get('orgUnit')).toBe(ORG_UNIT)
        expect(stageRequest.searchParams.getAll('filterAttributes')).toEqual([
            `${TEXT_ATTRIBUTE}:like:Alpha person 01`,
        ])
        await expect(page.getByTestId('working-list-toolbar')).toContainText(
            `${STAGE_NAME} / Report date`
        )

        await addFilter(page, 'event', TEXT_DATA_ELEMENT)

        const combined = await applyTextFilter(
            page,
            TEXT_DATA_ELEMENT,
            'Alpha event 01',
            'events',
            'filter'
        )

        expect(combined.searchParams.getAll('filterAttributes')).toEqual([
            `${TEXT_ATTRIBUTE}:like:Alpha person 01`,
        ])
        expect(combined.searchParams.getAll('filter')).toEqual([
            `${TEXT_DATA_ELEMENT}:like:Alpha event 01`,
        ])
        await expect(
            page.getByTestId('working-list-row-WlE2eEvt001')
        ).toBeVisible()

        const attributeSort = await waitForTrackerResponse(
            page,
            'events',
            () => page.getByTestId(`sort-${TEXT_ATTRIBUTE}`).click(),
            (url) => url.searchParams.get('order') === `${TEXT_ATTRIBUTE}:asc`
        )

        expect(attributeSort.searchParams.getAll('order')).toHaveLength(1)

        const dataSort = await waitForTrackerResponse(
            page,
            'events',
            () => page.getByTestId(`sort-${INTEGER_DATA_ELEMENT}`).click(),
            (url) =>
                url.searchParams
                    .get('order')
                    ?.startsWith(`${INTEGER_DATA_ELEMENT}:`) === true
        )

        const dataOrder = dataSort.searchParams.getAll('order')
        expect(dataOrder).toHaveLength(1)
        expect(dataOrder[0]).toMatch(
            new RegExp(`^${INTEGER_DATA_ELEMENT}:(asc|desc)$`)
        )

        await openFilterEditor(page, 'eventOccurredAt')
        const dateEditor = page.getByTestId('filter-editor-eventOccurredAt')

        const startDate = dateEditor
            .locator('[data-test="date-range-start"]')
            .locator('input')

        const endDate = dateEditor
            .locator('[data-test="date-range-end"]')
            .locator('input')

        await startDate.click()
        await expect(page.locator('[data-test="calendar"]')).toBeVisible()
        await startDate.fill('2025-02-01')
        await endDate.click()
        await expect(page.locator('[data-test="calendar"]')).toBeVisible()
        await endDate.fill('2025-02-01')

        const dateRequest = await waitForTrackerResponse(
            page,
            'events',
            () =>
                page
                    .locator('[data-test="filter-update-eventOccurredAt"]')
                    .click(),
            (url) => url.searchParams.get('occurredAfter') === '2025-02-01'
        )

        expect(dateRequest.searchParams.get('occurredBefore')).toBe(
            '2025-02-01'
        )
        await expect(
            page.locator('[data-testid="working-list-table"] tbody')
        ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })

        await waitForTrackerResponse(
            page,
            'events',
            () =>
                page
                    .locator(
                        `[data-test="filter-${TEXT_DATA_ELEMENT}-select-clear"]`
                    )
                    .click(),
            (url) =>
                url.searchParams.get('programStage') === STAGE &&
                !url.searchParams
                    .getAll('filter')
                    .some((entry) => entry.startsWith(`${TEXT_DATA_ELEMENT}:`))
        )
        await waitForTrackerResponse(
            page,
            'events',
            () =>
                page
                    .locator(
                        '[data-test="filter-eventOccurredAt-select-clear"]'
                    )
                    .click(),
            (url) =>
                url.searchParams.get('programStage') === STAGE &&
                !url.searchParams.has('occurredAfter') &&
                !url.searchParams.has('occurredBefore')
        )
        await page
            .locator('[data-test="filter-programStage-select-clear"]')
            .click()
        await expect(
            page.getByTestId('working-list-row-WlE2eTei001')
        ).toBeVisible()
        await expect(page.getByTestId(`sort-${TEXT_DATA_ELEMENT}`)).toHaveCount(
            0
        )
        await expect(page.getByTestId('filter-eventOccurredAt')).toHaveCount(0)
        await expect(page.getByTestId('working-list-toolbar')).toBeVisible()
    })

    test('shows a genuine empty event state from a valid real-server query', async ({
        page,
    }) => {
        await openWorkingList(page)
        await enterStageMode(page)
        await addFilter(page, 'event', TEXT_DATA_ELEMENT)
        await applyTextFilter(
            page,
            TEXT_DATA_ELEMENT,
            'No such E2E event value',
            'events',
            'filter'
        )
        await expect(
            page.getByText('No items to display', { exact: true })
        ).toBeVisible()
        await expect(resultRows(page)).toHaveCount(0)
    })
})
