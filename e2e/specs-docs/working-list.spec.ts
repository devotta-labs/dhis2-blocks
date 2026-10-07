import { request as playwrightRequest, type Page } from '@playwright/test'
import { z } from 'zod'
import {
    expect,
    openLivePreview,
    resultRows,
    signInToDocsPreview,
    test,
} from './fixtures'

/**
 * Live Working List preview coverage. Everything below runs against real
 * DHIS2 metadata and records through the docs app's same-origin `/dhis2`
 * proxy — no fixture handlers.
 */
const PROGRAM = 'IpHINAT79UW'

const ProgramMetadataSchema = z.object({
    programTrackedEntityAttributes: z.array(
        z.object({
            trackedEntityAttribute: z.object({
                id: z.string(),
                valueType: z.string(),
                searchable: z.boolean().optional(),
            }),
        })
    ),
    programStages: z.array(z.object({ id: z.string() })),
})

const getProgramMetadata = async () => {
    // A standalone request context keeps its own cookie jar: page.request
    // shares the browser context's cookies, and DHIS2 answers Basic auth
    // with a session cookie that would sign the UI in before the adapter's
    // sign-in dialog is exercised.
    const api = await playwrightRequest.newContext({
        baseURL: process.env.DOCS_APP_URL ?? 'http://localhost:3002',
    })

    const response = await api.get(
        `/dhis2/api/programs/${PROGRAM}` +
            `?fields=programTrackedEntityAttributes[trackedEntityAttribute[id,displayName,valueType,searchable]],programStages[id]`,
        {
            headers: {
                Authorization: `Basic ${globalThis.btoa('admin:district')}`,
            },
        }
    )

    expect(response.ok()).toBe(true)

    const payload = ProgramMetadataSchema.parse(await response.json())

    await api.dispose()

    return payload
}

const textAttributeIds = (metadata: z.infer<typeof ProgramMetadataSchema>) =>
    metadata.programTrackedEntityAttributes
        .flatMap(({ trackedEntityAttribute }) =>
            trackedEntityAttribute.valueType === 'TEXT' &&
            trackedEntityAttribute.searchable !== false
                ? [trackedEntityAttribute.id]
                : []
        )
        .slice(0, 2)

const trackerRequest = (
    page: Page,
    resource: 'trackedEntities' | 'events',
    action: () => Promise<void>
) => {
    const requestPromise = page.waitForRequest(
        (request) =>
            request.url().includes(`/tracker/${resource}`) &&
            request.method() === 'GET',
        { timeout: 30_000 }
    )

    return action().then(() => requestPromise)
}

const addFilter = async (page: Page, fieldId: string) => {
    await page.getByTestId('more-filters-tracked-entity').click()
    await page.locator(`[data-test="add-filter-${fieldId}"]`).click()
    await expect(page.getByTestId(`filter-editor-${fieldId}`)).toBeVisible()
}

const applyTextFilter = async (page: Page, fieldId: string, value: string) => {
    const editor = page.getByTestId(`filter-editor-${fieldId}`)
    await editor.getByLabel('Value').fill(value)

    const request = await trackerRequest(page, 'trackedEntities', () =>
        page.locator(`[data-test="filter-update-${fieldId}"]`).click()
    )

    await expect(
        page.locator('[data-testid="working-list-table"] tbody')
    ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })

    return request
}

const tableBody = (page: Page) =>
    page.locator('[data-testid="working-list-table"] tbody')

test.describe('live Working List preview', () => {
    test('signs in through the preview and loads live metadata and records', async ({
        page,
    }) => {
        await page.goto('/preview/working-list/default')

        await signInToDocsPreview(page)

        // Real metadata and records arrived through the /dhis2 proxy.
        await expect(page.getByTestId('working-list-main')).toBeVisible({
            timeout: 30_000,
        })
        await expect(tableBody(page)).toHaveAttribute('aria-busy', 'false', {
            timeout: 30_000,
        })
        await expect(resultRows(page).first()).toBeVisible()
        await expect(page.getByTestId('working-list-filters')).toBeVisible()
    })

    test('combines two attribute filters on live records', async ({ page }) => {
        const metadata = await getProgramMetadata()
        const [first, second] = textAttributeIds(metadata)

        expect(first).toBeTruthy()
        expect(second).toBeTruthy()

        await openLivePreview(page, 'working-list/default')
        await addFilter(page, first)
        await applyTextFilter(page, first, 'a')
        await addFilter(page, second)

        const request = await applyTextFilter(page, second, 'e')
        const url = new URL(request.url())

        // Tracked-entity mode serializes attribute filters as `filter` params;
        // `filterAttributes` is only used in event mode.
        const filters = url.searchParams.getAll('filter')

        expect(
            filters.filter((entry) => entry.startsWith(`${first}:`)).length
        ).toBeGreaterThan(0)
        expect(
            filters.filter((entry) => entry.startsWith(`${second}:`)).length
        ).toBeGreaterThan(0)
    })

    test('sorts a column and walks pages on live records', async ({ page }) => {
        await openLivePreview(page, 'working-list/default')

        const sortable = page.locator('[data-testid^="sort-"]').first()
        await expect(sortable).toBeVisible()

        const sortRequest = await trackerRequest(page, 'trackedEntities', () =>
            sortable.click()
        )

        expect(
            new URL(sortRequest.url()).searchParams.get('order')
        ).toBeTruthy()

        await expect(tableBody(page)).toHaveAttribute('aria-busy', 'false', {
            timeout: 30_000,
        })

        const firstRowOnPageOne = await resultRows(page)
            .first()
            .getAttribute('data-testid')

        const nextRequest = await trackerRequest(page, 'trackedEntities', () =>
            page
                .locator('[data-test="working-list-pagination-page-next"]')
                .click()
        )

        expect(new URL(nextRequest.url()).searchParams.get('page')).toBe('2')

        await expect(tableBody(page)).toHaveAttribute('aria-busy', 'false', {
            timeout: 30_000,
        })
        await expect(resultRows(page).first()).not.toHaveAttribute(
            'data-testid',
            firstRowOnPageOne ?? ''
        )
    })

    test('enters program-stage event mode on live records', async ({
        page,
    }) => {
        const metadata = await getProgramMetadata()
        const stageId = metadata.programStages[0]?.id

        expect(stageId).toBeTruthy()

        await openLivePreview(page, 'working-list/default')

        // Selecting a program stage and applying it morphs the list to
        // event mode, which queries /tracker/events.
        const eventRequest = trackerRequest(page, 'events', async () => {
            await page.getByTestId('more-filters-tracked-entity').click()
            await page
                .locator('[data-test="program-stage-filter-menu"]')
                .getByRole('menuitem')
                .hover()
            await page
                .locator(`[data-test="select-filter-stage-${stageId}"]`)
                .getByRole('menuitem')
                .click()
            await expect(page.getByTestId('filter-programStage')).toBeVisible()

            const update = page.getByTestId('filter-update-programStage')

            if (await update.isVisible().catch(() => false)) {
                await update.click()
            }
        })

        expect(
            new URL((await eventRequest).url()).searchParams.get('programStage')
        ).toBe(stageId)

        await expect(tableBody(page)).toHaveAttribute('aria-busy', 'false', {
            timeout: 30_000,
        })

        // A program-stage column can be added on top of event mode.
        await page.getByTestId('more-filters-tracked-entity').click()
        await page
            .locator(`[data-test="stage-filter-fields-${stageId}"]`)
            .getByRole('menuitem')
            .hover()
        await page
            .locator(
                `[data-test="add-stage-filter-${stageId}-eventOccurredAt"]`
            )
            .getByRole('menuitem')
            .click()
        await expect(tableBody(page)).toHaveAttribute('aria-busy', 'false', {
            timeout: 30_000,
        })
    })

    test('saves a view and reloads it on live records', async ({ page }) => {
        const viewName = `Docs e2e ${Date.now()}`

        await openLivePreview(page, 'working-list/default')

        // On the default (unsaved) view the Save button opens the name
        // dialog directly; the save-as menu item only exists in the dropdown
        // shown while a persisted view is selected.
        await page.locator('[data-test="save-working-list"]').click()

        const nameInput = page
            .locator('[data-test="working-list-name-input"]')
            .getByRole('textbox')

        await expect(nameInput).toBeVisible()
        await nameInput.fill(viewName)
        await page.locator('[data-test="working-list-name-submit"]').click()

        const viewButton = page.getByRole('button', { name: viewName }).first()
        await expect(viewButton).toBeVisible({ timeout: 30_000 })

        // The view is persisted on the server — it survives a full reload.
        await page.reload()
        await expect(viewButton).toBeVisible({ timeout: 30_000 })

        // The menu trigger sits in the same pill as the view button; it is
        // marked data-saved-view-menu (its testid embeds the server list id).
        await viewButton.locator('..').locator('[data-saved-view-menu]').click()

        const deleteItem = page.locator('[data-test="delete-saved-view"]')
        await expect(deleteItem).toBeVisible()
        await deleteItem.getByRole('menuitem').click()
        await page.locator('[data-test="delete-saved-view-confirm"]').click()
        await expect(viewButton).toHaveCount(0)
    })
})
