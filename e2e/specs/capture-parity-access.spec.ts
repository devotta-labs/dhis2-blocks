import {
    AxeBuilder,
    OUTSIDER,
    PRIVATE_LIST,
    READER,
    SHARED_LIST,
    expect,
    menuItem,
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
        await expect(menuItem(page, 'save-as-working-list')).toBeVisible()
        await expect(menuItem(page, 'update-working-list')).toHaveAttribute(
            'aria-disabled',
            'true'
        )
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
    test('supports keyboard workflows on a narrow viewport and has no serious WCAG violations', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await openWorkingList(page)

        const moreFilters = page.getByTestId('more-filters-tracked-entity')
        await moreFilters.focus()
        await page.keyboard.press('Enter')
        const firstAvailableFilterItem = page
            .locator('[role="menuitem"][data-test^="add-filter-"]')
            .first()
        await expect(firstAvailableFilterItem).toBeVisible()
        await expect(firstAvailableFilterItem).toHaveAccessibleName(/\S+/)
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
        await expect(download).toBeEnabled()
        await page.keyboard.press('Escape')
        await context.setOffline(false)
        await expect(page.getByTestId('offline-notice')).toHaveCount(0)
        await expect(uiButton(page, 'save-working-list')).toBeEnabled()
    })
})
