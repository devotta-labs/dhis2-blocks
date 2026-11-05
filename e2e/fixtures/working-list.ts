import {
    expect,
    type Locator,
    type Page,
    type Request,
    type Response,
} from '@playwright/test'

export const tableBody = (page: Page) =>
    page.locator('[data-testid="working-list-table"] tbody')

export const workingListReady = async (page: Page) => {
    await expect(page.getByTestId('working-list-main')).toBeVisible({
        timeout: 30_000,
    })
    await expect(
        page.getByTestId('working-list-selection-loading')
    ).toHaveCount(0)
    await expect(tableBody(page)).toHaveAttribute('aria-busy', 'false', {
        timeout: 30_000,
    })
}

export const holdWorkingListResponse = async (
    page: Page,
    resource: `programs/${string}` | 'tracker/trackedEntities'
) => {
    let release!: () => void
    let received!: () => void
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    const responseReceived = new Promise<void>((resolve) => {
        received = resolve
    })
    await page.route(
        (url) =>
            url.pathname
                .replace(/\/api\/\d+\//, '/api/')
                .endsWith(`/api/${resource}`),
        async (route) => {
            const response = await route.fetch()
            received()
            await gate
            await route.fulfill({ response })
        },
        { times: 1 }
    )
    return { received: responseReceived, release }
}

export const requestUrl = (request: Request | Response) =>
    new URL(request.url())
export const isTrackerResource = (
    request: Request | Response,
    resource: 'trackedEntities' | 'events'
) => requestUrl(request).pathname.endsWith(`/tracker/${resource}`)

/* eslint-disable max-params -- test DSL helpers trade a compact call site for explicit network assertions */
export const waitForTrackerResponse = async (
    page: Page,
    resource: 'trackedEntities' | 'events',
    action: () => Promise<void | Response | null>,
    matches: (url: URL) => boolean = () => true
) => {
    const pending = page.waitForResponse(
        (response) =>
            response.request().method() === 'GET' &&
            isTrackerResource(response, resource) &&
            matches(requestUrl(response))
    )
    await action()
    const response = await pending
    if (!response.ok()) {
        const details = await response
            .text()
            .catch(() => `${response.status()} ${response.statusText()}`)
        throw new Error(
            `Tracker request failed (${response.status()}): ${details}`
        )
    }
    return requestUrl(response)
}

export const savedViewButton = (page: Page, listId: string) =>
    page
        .getByTestId(`working-list-view-${listId}`)
        .locator('button:not([data-saved-view-menu])')

export const uiButton = (page: Page, dataTest: string) =>
    page.locator(
        `button[data-test="${dataTest}"], [data-test="${dataTest}"] button`
    )

export const resultRows = (page: Page) =>
    page.locator('[data-testid^="working-list-row-"]')

export const menuItem = (scope: Page | Locator, dataTest: string) =>
    scope.locator(`[role="menuitem"][data-test="${dataTest}"]`)

const selectTriggers =
    '[data-slot="select-trigger"], [data-slot="combobox-trigger"]'

export const selectTrigger = (page: Page, rootSelector: string) =>
    page
        .locator(
            `:is(${selectTriggers}):is(${rootSelector}), ${rootSelector} :is(${selectTriggers})`
        )
        .first()

export const chooseSelectOption = async (
    page: Page,
    rootSelector: string,
    label: string
) => {
    await selectTrigger(page, rootSelector).click()
    await page.getByRole('option', { name: label, exact: true }).click()
}

export const openMoreActions = async (page: Page) => {
    const trigger = uiButton(page, 'working-list-options')
    await trigger.click()
    const download = menuItem(page, 'download-working-list')
    await expect(download).toBeVisible()
    return download
}

export const chooseSaveViewOption = async (page: Page, dataTest: string) => {
    await uiButton(page, 'save-working-list').click()
    const item = menuItem(page, dataTest)
    await expect(item).toBeVisible()
    await expect(item).toBeEnabled()
    await item.click()
}

export const openSavedViewActions = async (page: Page, listId: string) => {
    await page.getByTestId(`working-list-view-${listId}-menu`).click()
    const menu = page.locator('[data-test="saved-view-actions-menu"]')
    await expect(menu).toBeVisible()
    return menu
}

export const chooseSavedViewAction = async (
    page: Page,
    listId: string,
    dataTest: string
) => {
    const menu = await openSavedViewActions(page, listId)
    const item = menuItem(menu, dataTest)
    await expect(item).toBeVisible()
    await expect(item).toBeEnabled()
    await item.click()
}

export const addTrackedEntityFilter = async (page: Page, fieldId: string) => {
    await page.getByTestId('more-filters-tracked-entity').click()
    await menuItem(page, `add-filter-${fieldId}`).click()
    await expect(page.getByTestId(`filter-${fieldId}`)).toBeVisible()
    await expect(page.getByTestId(`filter-editor-${fieldId}`)).toBeVisible()
}

export const selectStage = async (page: Page, stageId: string) => {
    await page.getByTestId('more-filters-tracked-entity').click()
    await menuItem(page, 'program-stage-filter-menu').hover()
    await menuItem(page, `select-filter-stage-${stageId}`).click()
    await expect(page.getByTestId('filter-programStage')).toBeVisible()
}

export const addStageFilter = async (
    page: Page,
    stageId: string,
    fieldId: string
) => {
    await page.getByTestId('more-filters-tracked-entity').click()
    await menuItem(page, `stage-filter-fields-${stageId}`).hover()
    await menuItem(page, `add-stage-filter-${stageId}-${fieldId}`).click()
    await expect(page.getByTestId(`filter-${fieldId}`)).toBeVisible()
    await expect(page.getByTestId(`filter-editor-${fieldId}`)).toBeVisible()
}

export const openFilterEditor = async (page: Page, fieldId: string) => {
    const editor = page.getByTestId(`filter-editor-${fieldId}`)
    if (!(await editor.isVisible())) {
        await page
            .getByTestId(`filter-${fieldId}`)
            .getByRole('combobox')
            .click()
    }
    await expect(editor).toBeVisible()
}

export const applyTextFilter = async (
    page: Page,
    fieldId: string,
    value: string,
    resource: 'trackedEntities' | 'events',
    parameter: 'filter' | 'filterAttributes'
) => {
    await openFilterEditor(page, fieldId)
    const editor = page.getByTestId(`filter-editor-${fieldId}`)
    await editor.getByLabel('Value').fill(value)
    return waitForTrackerResponse(
        page,
        resource,
        () => page.locator(`[data-test="filter-update-${fieldId}"]`).click(),
        (url) =>
            url.searchParams
                .getAll(parameter)
                .some(
                    (entry) =>
                        entry.includes(`${fieldId}:`) && entry.includes(value)
                )
    )
}
/* eslint-enable max-params */
