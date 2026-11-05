import { request as playwrightRequest, type Page } from '@playwright/test'
import { z } from 'zod'
import { expect, openLivePreview, test } from './fixtures'
import { withOwnedTrackerLists } from '../fixtures/owned-tracker-lists'
import {
    addTrackedEntityFilter as addFilter,
    addStageFilter,
    applyTextFilter as applyFilter,
    holdWorkingListResponse,
    menuItem,
    resultRows,
    selectStage,
    tableBody,
    waitForTrackerResponse,
    workingListReady,
} from '../fixtures/working-list'

/**
 * Live Working List preview coverage. Everything below runs against real
 * DHIS2 metadata and records through the docs app's same-origin `/dhis2`
 * proxy. Network gates delay real responses without replacing their contents.
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
    // A standalone request context keeps its own cookie jar so this probe
    // stays independent of the browser session.
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

const applyTextFilter = async (page: Page, fieldId: string, value: string) => {
    const url = await applyFilter(
        page,
        fieldId,
        value,
        'trackedEntities',
        'filter'
    )
    await workingListReady(page)
    return url
}

const openWorkingListPreview = async (page: Page) => {
    await openLivePreview(page, 'working-list/default')
    await workingListReady(page)
}

test.describe('live Working List preview', () => {
    test('waits for delayed metadata and exposes an updating-to-ready transition', async ({
        page,
    }) => {
        const metadata = await holdWorkingListResponse(
            page,
            `programs/${PROGRAM}`
        )
        try {
            await openLivePreview(page, 'working-list/default')
            await metadata.received
            await expect(
                page.getByTestId('working-list-selection-loading')
            ).toBeVisible()
        } finally {
            metadata.release()
        }
        await workingListReady(page)
        const results = await holdWorkingListResponse(
            page,
            'tracker/trackedEntities'
        )
        try {
            await page.locator('[data-testid^="sort-"]').first().click()
            await results.received
            await expect(tableBody(page)).toHaveAttribute('aria-busy', 'true')
        } finally {
            results.release()
        }
        await workingListReady(page)
        await expect(resultRows(page).first()).toBeVisible()
    })

    test('loads live metadata and records with no sign-in flow', async ({
        page,
    }) => {
        await page.goto('/preview/working-list/default')

        // The proxy injects demo credentials upstream, so the adapter never
        // renders its sign-in dialog and data arrives immediately.
        await expect(page.getByTestId('working-list-main')).toBeVisible({
            timeout: 30_000,
        })
        await expect(
            page.getByRole('heading', { name: 'Please sign in' })
        ).not.toBeVisible()
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

        await openWorkingListPreview(page)
        await addFilter(page, first)
        await applyTextFilter(page, first, 'a')
        await addFilter(page, second)

        const url = await applyTextFilter(page, second, 'e')

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
        await openWorkingListPreview(page)

        const sortable = page.locator('[data-testid^="sort-"]').first()
        await expect(sortable).toBeVisible()

        const sortRequest = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => sortable.click()
        )

        expect(sortRequest.searchParams.get('order')).toBeTruthy()

        await expect(tableBody(page)).toHaveAttribute('aria-busy', 'false', {
            timeout: 30_000,
        })

        const firstRowOnPageOne = await resultRows(page)
            .first()
            .getAttribute('data-testid')

        const nextRequest = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () =>
                page
                    .locator('[data-test="working-list-pagination-page-next"]')
                    .click()
        )

        expect(nextRequest.searchParams.get('page')).toBe('2')

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

        await openWorkingListPreview(page)

        const eventUrl = await waitForTrackerResponse(page, 'events', () =>
            selectStage(page, stageId)
        )
        expect(eventUrl.searchParams.get('programStage')).toBe(stageId)
        await workingListReady(page)
        const headers = await page.getByRole('columnheader').allTextContents()
        await addStageFilter(page, stageId, 'eventOccurredAt')
        await expect(
            page.getByTestId('filter-editor-eventOccurredAt')
        ).toBeVisible()
        expect(await page.getByRole('columnheader').allTextContents()).toEqual(
            headers
        )
        await page.keyboard.press('Escape')
        await expect(
            page.getByTestId('filter-editor-eventOccurredAt')
        ).toHaveCount(0)
    })

    test('saves a view and reloads it on live records', async ({ page }) => {
        await withOwnedTrackerLists(page, async () => {
            const viewName = `Docs e2e ${Date.now()}`

            await openWorkingListPreview(page)

            await page.locator('[data-test="save-working-list"]').click()

            const nameInput = page
                .locator('[data-test="working-list-name-input"]')
                .getByRole('textbox')

            await expect(nameInput).toBeVisible()
            await nameInput.fill(viewName)
            await page.locator('[data-test="working-list-name-submit"]').click()

            const viewButton = page
                .getByRole('button', { name: viewName })
                .first()
            await expect(viewButton).toBeVisible({ timeout: 30_000 })

            await page.reload()
            await expect(viewButton).toBeVisible({ timeout: 30_000 })

            await viewButton
                .locator('..')
                .locator('[data-saved-view-menu]')
                .click()

            const deleteItem = menuItem(page, 'delete-saved-view')
            await expect(deleteItem).toBeVisible()
            await deleteItem.click()
            await page
                .locator('[data-test="delete-saved-view-confirm"]')
                .click()
            await expect(viewButton).toHaveCount(0)
        })
    })
})
