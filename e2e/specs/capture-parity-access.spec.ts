import {
    AxeBuilder,
    OUTSIDER,
    PRIVATE_LIST,
    READER,
    SHARED_LIST,
    expect,
    openMoreActions,
    openWorkingList,
    test,
    uiButton,
} from './capture-parity.support'

test.describe('read-only shared-list permissions', () => {
    test.use({ e2eCredentials: READER })

    test('suppresses generated defaults and hides saved-view owner actions', async ({
        page,
    }) => {
        await openWorkingList(page, { template: SHARED_LIST })
        await expect(
            page.getByTestId(`working-list-view-${SHARED_LIST}`)
        ).toBeVisible()
        await expect(
            page.getByTestId(`working-list-view-${PRIVATE_LIST}`)
        ).toHaveCount(0)
        await expect(page.getByTestId('working-list-view-active')).toHaveCount(
            0
        )
        await expect(
            page.getByTestId(`working-list-view-${SHARED_LIST}-menu`)
        ).toHaveCount(0)
        await uiButton(page, 'save-working-list').click()
        await expect(
            page.locator('[data-test="save-as-working-list"]')
        ).toBeVisible()
        await expect(
            page
                .locator('[data-test="update-working-list"]')
                .getByRole('menuitem')
        ).toHaveAttribute('aria-disabled', 'true')
    })
})

test.describe('private-list isolation', () => {
    test.use({ e2eCredentials: OUTSIDER })

    test('hides inaccessible custom lists and restores generated defaults', async ({
        page,
    }) => {
        await openWorkingList(page, { template: 'active' })
        await expect(
            page.getByTestId(`working-list-view-${PRIVATE_LIST}`)
        ).toHaveCount(0)
        await expect(
            page.getByTestId(`working-list-view-${SHARED_LIST}`)
        ).toHaveCount(0)
        await expect(page.getByTestId('working-list-view-active')).toBeVisible()
        await expect(
            page.getByTestId('working-list-view-completed')
        ).toBeVisible()
        await expect(
            page.getByTestId('working-list-view-cancelled')
        ).toBeVisible()
    })
})

test.describe('accessibility and keyboard feedback', () => {
    test('keeps a narrow layout local, supports keyboard workflows, and has no serious WCAG violations', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await openWorkingList(page)

        const mainBounds = await page
            .getByTestId('working-list-main')
            .boundingBox()

        expect(mainBounds).not.toBeNull()
        expect(mainBounds!.x).toBeGreaterThanOrEqual(0)
        expect(mainBounds!.x + mainBounds!.width).toBeLessThanOrEqual(390)

        const overflowMetrics = await page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth

            const overflowingElements = [...document.body.querySelectorAll('*')]
                .map((element) => {
                    const rect = element.getBoundingClientRect()

                    return {
                        tag: element.tagName.toLowerCase(),
                        testId:
                            element.getAttribute('data-testid') ??
                            element.getAttribute('data-test'),
                        className: element.getAttribute('class') ?? undefined,
                        left: Math.round(rect.left * 100) / 100,
                        right: Math.round(rect.right * 100) / 100,
                        width: Math.round(rect.width * 100) / 100,
                        clientWidth: element.clientWidth,
                        scrollWidth: element.scrollWidth,
                        overflowX: getComputedStyle(element).overflowX,
                    }
                })
                .filter(
                    ({ left, right, overflowX }) =>
                        overflowX === 'visible' &&
                        (left < -1 || right > viewportWidth + 1)
                )
                .sort((left, right) => right.right - left.right)
                .slice(0, 10)

            return {
                viewportWidth,
                documentClientWidth: document.documentElement.clientWidth,
                documentScrollWidth: document.documentElement.scrollWidth,
                bodyClientWidth: document.body.clientWidth,
                bodyScrollWidth: document.body.scrollWidth,
                overflowingElements,
            }
        })

        expect(
            overflowMetrics.documentScrollWidth,
            JSON.stringify(overflowMetrics, null, 2)
        ).toBeLessThanOrEqual(overflowMetrics.documentClientWidth + 1)
        expect(
            await page
                .getByTestId('working-list-table-scroll')
                .evaluate(
                    (element) => element.scrollWidth > element.clientWidth
                )
        ).toBe(true)

        const moreFilters = page.getByTestId('more-filters-tracked-entity')
        await moreFilters.focus()
        await page.keyboard.press('Enter')

        const firstAvailableFilterItem = page
            .locator('[data-test^="add-filter-"]')
            .first()

        const firstAvailableFilterAction =
            firstAvailableFilterItem.getByRole('menuitem')

        await expect(firstAvailableFilterAction).toBeVisible()
        await expect(firstAvailableFilterAction).toHaveAccessibleName(/\S+/)
        await expect(firstAvailableFilterItem).toBeFocused()
        await expect(
            page.locator('[data-test="dhis2-uicore-popoverarrow"]')
        ).toHaveCount(0)
        await page.keyboard.press('Escape')
        await expect(moreFilters).toBeFocused()

        const statusFilterId = 'enrollmentStatus'

        const filterButton = page
            .getByTestId(`filter-${statusFilterId}`)
            .getByRole('combobox')

        await filterButton.focus()
        await page.keyboard.press('Enter')
        await expect(
            page.getByTestId(`filter-editor-${statusFilterId}`)
        ).toBeVisible()
        await expect(
            page.locator('[data-test="dhis2-uicore-popoverarrow"]')
        ).toHaveCount(0)

        const filterPopoverBounds = await page
            .getByTestId(`filter-editor-${statusFilterId}`)
            .boundingBox()

        expect(filterPopoverBounds).not.toBeNull()
        expect(filterPopoverBounds!.x).toBeGreaterThanOrEqual(0)
        expect(
            filterPopoverBounds!.x + filterPopoverBounds!.width
        ).toBeLessThanOrEqual(390)
        await page.keyboard.press('Escape')
        await expect(filterButton).toBeFocused()

        const row = page.getByTestId('working-list-row-WlE2eTei001')
        expect(await row.locator('td').count()).toBe(
            await page
                .getByTestId('working-list-table')
                .locator('thead th')
                .count()
        )

        const rowOpen = row
            .locator('td')
            .first()
            .getByTestId('row-open-WlE2eTei001')

        await expect(rowOpen).toHaveAttribute('type', 'button')
        await expect(rowOpen).toHaveCSS('position', 'absolute')
        await expect(rowOpen).toHaveAccessibleName(/^Open row \d+$/)

        await rowOpen.focus()
        await page.keyboard.press('Enter')
        await expect(
            page.getByRole('heading', { name: 'Tracked entity selected' })
        ).toHaveCount(1)
        const closeRecord = page.getByRole('button', { name: 'Close' }).last()
        await closeRecord.focus()
        await page.keyboard.press('Enter')
        await expect(
            page.getByRole('heading', { name: 'Tracked entity selected' })
        ).toHaveCount(0)

        await rowOpen.focus()
        await page.keyboard.press('Space')
        await expect(
            page.getByRole('heading', { name: 'Tracked entity selected' })
        ).toHaveCount(1)
        await page.getByRole('button', { name: 'Close' }).last().click()
        await expect(
            page.getByRole('heading', { name: 'Tracked entity selected' })
        ).toHaveCount(0)

        await row.click()
        await expect(
            page.getByRole('heading', { name: 'Tracked entity selected' })
        ).toHaveCount(1)
        await page.getByRole('button', { name: 'Close' }).last().click()

        const accessibility = await new AxeBuilder({ page })
            .include('[data-testid="working-list-main"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()

        expect(
            accessibility.violations.filter((violation) =>
                ['serious', 'critical'].includes(violation.impact ?? '')
            )
        ).toEqual([])
    })
})

test.describe('offline feedback', () => {
    test.use({ allowOfflineRequestFailures: true })

    test('announces browser offline state and only disables server-backed actions', async ({
        context,
        page,
    }) => {
        await openWorkingList(page)
        await context.setOffline(true)
        await expect(page.getByTestId('offline-notice')).toBeVisible()
        await expect(uiButton(page, 'save-working-list')).toBeDisabled()
        await expect(uiButton(page, 'configure-columns')).toBeEnabled()
        await expect(
            page.getByTestId('more-filters-tracked-entity')
        ).toBeEnabled()
        await expect(uiButton(page, 'working-list-options')).toBeEnabled()
        const download = await openMoreActions(page)
        await expect(download.getByRole('menuitem')).toBeEnabled()
        await page.keyboard.press('Escape')
        await context.setOffline(false)
        await expect(page.getByTestId('offline-notice')).toHaveCount(0)
        await expect(uiButton(page, 'save-working-list')).toBeEnabled()
    })
})
