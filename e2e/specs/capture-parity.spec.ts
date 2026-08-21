// The package intentionally exposes the builder as both its default and named export.
// eslint-disable-next-line import/no-named-as-default
import AxeBuilder from '@axe-core/playwright'
import type {
    APIRequestContext,
    Page,
    Playwright,
    Request,
    Response,
} from '@playwright/test'
import { z } from 'zod'
import {
    e2eEnvironment,
    expect,
    test,
    testFromDhis2Version,
    type E2ECredentials,
} from '../fixtures/test'

const PROGRAM = 'WlE2ePrg001'
const PROGRAM_NAME = 'Working list E2E tracker program'
const ORG_UNIT = 'DiszpKrYNg8'
const ORG_UNIT_NAME = 'Ngelehun CHC'
const STAGE = 'WlE2eStg001'
const STAGE_NAME = 'Working list E2E programme stage'
const PRIVATE_LIST = 'WlE2eLst001'
const SHARED_LIST = 'WlE2eLst002'
const STALE_LIST = 'WlE2eLst003'
const TEXT_ATTRIBUTE = 'WlAtText001'
const INTEGER_ATTRIBUTE = 'WlAtIntg001'
const NUMBER_ATTRIBUTE = 'WlAtNumb001'
const BOOLEAN_ATTRIBUTE = 'WlAtBool001'
const MULTI_TEXT_ATTRIBUTE = 'WlAtMult001'
const EMAIL_ATTRIBUTE = 'WlAtMail001'
const PHONE_ATTRIBUTE = 'WlAtPhon001'
const GEOJSON_ATTRIBUTE = 'WlAtGeoj001'
const TEXT_DATA_ELEMENT = 'WlDeText001'
const INTEGER_DATA_ELEMENT = 'WlDeIntg001'
// scripts/e2e/seed-metadata.sh writes this invalid date through SQL because
// the tracker importer would reject it.
const CORRUPTED_DATE_VALUE = '2025-13-45'
const TEST_PASSWORD = 'WorkingList123!'

const OWNER: E2ECredentials = {
    username: 'wl_e2e_owner',
    password: TEST_PASSWORD,
}
const READER: E2ECredentials = {
    username: 'wl_e2e_reader',
    password: TEST_PASSWORD,
}
const OUTSIDER: E2ECredentials = {
    username: 'wl_e2e_outsider',
    password: TEST_PASSWORD,
}

const environment = process.env
const targetMajor = Number(environment?.E2E_EXPECTED_MAJOR)
const typedRegistryTest = testFromDhis2Version(43)
const typedRegistryTestTitle =
    'uses the typed registry for numeric, boolean, and option filters while keeping unsupported values display-only @dhis2-min-43'

const OrganisationUnitSchema = z
    .object({
        id: z.string(),
        displayName: z.string(),
        ancestors: z.array(
            z.object({ id: z.string(), displayName: z.string() })
        ),
    })
    .passthrough()
const MutationResponseSchema = z
    .object({ response: z.object({ uid: z.string().optional() }).optional() })
    .passthrough()
const SavedTrackedEntityListSchema = z
    .object({
        publicAccess: z.string().optional(),
        sharing: z.object({ public: z.string().optional() }).optional(),
        access: z
            .object({
                write: z.boolean().optional(),
                update: z.boolean().optional(),
            })
            .optional(),
        entityQueryCriteria: z.object({}).passthrough(),
    })
    .passthrough()
const SharingResponseSchema = z
    .object({
        object: z
            .object({
                userAccesses: z
                    .array(
                        z.object({
                            id: z.string().optional(),
                            access: z.string().optional(),
                        })
                    )
                    .optional(),
            })
            .optional(),
    })
    .passthrough()
const SavedListCollectionSchema = z
    .object({
        trackedEntityInstanceFilters: z
            .array(z.object({ id: z.string().optional() }))
            .optional(),
    })
    .passthrough()
const SavedStageListSchema = z
    .object({
        publicAccess: z.string().optional(),
        sharing: z.object({ public: z.string().optional() }).optional(),
        programStage: z.object({ id: z.string().optional() }).optional(),
    })
    .passthrough()
const RepairedListSchema = z
    .object({
        entityQueryCriteria: z
            .object({ displayColumnOrder: z.array(z.string()).optional() })
            .optional(),
    })
    .passthrough()

const requestUrl = (request: Request | Response) => new URL(request.url())
const isTrackerResource = (
    request: Request | Response,
    resource: 'trackedEntities' | 'events'
) => requestUrl(request).pathname.endsWith(`/tracker/${resource}`)

// Keeping the action and URL predicate separate makes network assertions readable.
/* eslint-disable max-params -- test DSL helpers trade a compact call site for explicit network assertions */
const waitForTrackerResponse = async (
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

const programHash = ({
    orgUnit = true,
    page = 1,
    pageSize = 15,
    template = 'active',
}: {
    orgUnit?: boolean
    page?: number
    pageSize?: number
    template?: string
} = {}) => {
    const parameters = new URLSearchParams({
        programId: PROGRAM,
        selectedTemplateId: template,
        page: String(page),
        pageSize: String(pageSize),
    })
    if (orgUnit) {
        parameters.set('orgUnitId', ORG_UNIT)
    }
    return `/#/?${parameters.toString()}`
}

const openWorkingList = async (
    page: Page,
    options: Parameters<typeof programHash>[0] = {}
) => {
    await page.goto(programHash(options))
    await expect(page.getByTestId('working-list-main')).toBeVisible({
        timeout: 30_000,
    })
    await expect(page.getByTestId('working-list-table')).toBeVisible({
        timeout: 30_000,
    })
    await expect(
        page.locator('[data-testid="working-list-table"] tbody')
    ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
}

const resultRows = (page: Page) =>
    page.locator('[data-testid^="working-list-row-"]')

const chooseDhis2Option = async (
    page: Page,
    rootSelector: string,
    label: string
) => {
    const root = page.locator(rootSelector)
    await root.locator('[data-test="dhis2-uicore-select-input"]').click()
    await page.getByText(label, { exact: true }).last().click()
}

const openSavedListOptions = async (page: Page) => {
    const trigger = page.locator('[data-test="working-list-options"]')
    await trigger.click()
    const menu = page.locator('[data-test="working-list-options-menu"]')
    await expect(menu).toBeVisible()
    return menu
}

const chooseSavedListOption = async (page: Page, dataTest: string) => {
    const menu = await openSavedListOptions(page)
    const option = menu.locator(`[data-test="${dataTest}"]`)
    await expect(option).toBeVisible()
    const menuItem = option.getByRole('menuitem')
    await expect(menuItem).toBeEnabled()
    await menuItem.click()
}

type OrganisationUnitAncestor = {
    id: string
    displayName: string
}

const selectOrganisationUnitFromTree = async (
    page: Page,
    ancestors: OrganisationUnitAncestor[],
    target: OrganisationUnitAncestor
) => {
    const tree = page.getByTestId('org-unit-tree')
    const path = [...ancestors, target]

    for (const [index, organisationUnit] of path.entries()) {
        const label = tree.getByText(organisationUnit.displayName, {
            exact: true,
        })
        await expect(label).toBeVisible()

        if (index === path.length - 1) {
            await label.click()
            return
        }

        const node = label.locator(
            'xpath=ancestor::*[@data-test="dhis2-uiwidgets-orgunittree-node"][1]'
        )
        const toggle = node.locator(
            ':scope > [data-test="dhis2-uiwidgets-orgunittree-node-toggle"]'
        )
        await expect(toggle).toBeVisible()
        const isOpen = await toggle.evaluate((element) =>
            element.classList.contains('open')
        )
        if (!isOpen) {
            await toggle.click()
        }
    }

    throw new Error(`Organisation unit ${target.id} was not selected.`)
}

const addFilter = async (
    page: Page,
    scope: 'tracked-entity' | 'event',
    fieldId: string
) => {
    await page.getByTestId(`more-filters-${scope}`).click()
    await page.locator(`[data-test="add-filter-${fieldId}"]`).click()
    await expect(page.getByTestId(`filter-${fieldId}`)).toBeVisible()
    // Newly added filters open their editor right away.
    await expect(page.getByTestId(`filter-editor-${fieldId}`)).toBeVisible()
}

const openFilterEditor = async (page: Page, fieldId: string) => {
    const button = page.getByTestId(`filter-${fieldId}`)
    if ((await button.getAttribute('aria-expanded')) !== 'true') {
        await button.click()
    }
    await expect(page.getByTestId(`filter-editor-${fieldId}`)).toBeVisible()
}

// This is a small UI DSL used across both tracked-entity and event endpoints.
const applyTextFilter = async (
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

const enterStageMode = async (page: Page, stageName = STAGE_NAME) => {
    if (!(await page.getByTestId('filter-programStage').isVisible())) {
        await addFilter(page, 'tracked-entity', 'programStage')
    }
    await openFilterEditor(page, 'programStage')
    await chooseDhis2Option(
        page,
        '[data-test="filter-value-programStage"]',
        stageName
    )
    return waitForTrackerResponse(
        page,
        'events',
        () => page.locator('[data-test="filter-update-programStage"]').click(),
        (url) => url.searchParams.get('programStage') === STAGE
    )
}

const basicAuthorization = ({ username, password }: E2ECredentials) =>
    `Basic ${globalThis.btoa(`${username}:${password}`)}`

const createApi = async (
    playwright: Playwright,
    credentials: E2ECredentials
) => {
    if (!e2eEnvironment.dhis2Url) {
        throw new Error('E2E_DHIS2_URL is required for saved-list cleanup.')
    }
    return playwright.request.newContext({
        baseURL: e2eEnvironment.dhis2Url,
        extraHTTPHeaders: {
            Accept: 'application/json',
            Authorization: basicAuthorization(credentials),
        },
    })
}

const deleteListIfPresent = async (
    api: APIRequestContext,
    resource: 'trackedEntityInstanceFilters' | 'programStageWorkingLists',
    id: string | undefined
) => {
    if (!id) {
        return
    }
    const response = await api.delete(`/api/${resource}/${id}`)
    expect([200, 204, 404]).toContain(response.status())
}

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
        await page.locator('[data-test="program-selector"]').click()
        await chooseDhis2Option(
            page,
            '[data-test="program-selector-input"]',
            PROGRAM_NAME
        )
        await expect(page.getByTestId('org-unit-empty-state')).toBeVisible({
            timeout: 30_000,
        })
        await expect(
            page.locator('[data-test="org-unit-selector"]')
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
            page.locator('[data-test="org-unit-selector"]')
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
        await expect(
            page.getByTestId('working-list-view-active')
        ).toHaveAttribute('aria-current', 'true')
        await expect(resultRows(page)).toHaveCount(8)
        const generatedOptions = await openSavedListOptions(page)
        await expect(
            generatedOptions.locator('[data-test="save-as-working-list"]')
        ).toBeVisible()
        for (const customListAction of [
            'update-working-list',
            'rename-working-list',
            'share-working-list',
            'delete-working-list',
        ]) {
            await expect(
                generatedOptions.locator(`[data-test="${customListAction}"]`)
            ).toHaveCount(0)
        }
        await page.keyboard.press('Escape')

        const statusParameter =
            targetMajor === 41 ? 'programStatus' : 'enrollmentStatus'
        const completed = await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => page.getByTestId('working-list-view-completed').click(),
            (url) => url.searchParams.get(statusParameter) === 'COMPLETED'
        )
        expect(completed.searchParams.get('page')).toBe('1')
        await expect(resultRows(page)).toHaveCount(6)

        await waitForTrackerResponse(
            page,
            'trackedEntities',
            () => page.getByTestId('working-list-view-cancelled').click(),
            (url) => url.searchParams.get(statusParameter) === 'CANCELLED'
        )
        await expect(resultRows(page)).toHaveCount(6)
    })

    test('opens the unfiltered default view with its concatenated id when no list is requested', async ({
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
        // Capture parity: the default view's id is written to the URL so a
        // reload does not fall back to the first saved list.
        await expect(page).toHaveURL(
            new RegExp(`selectedTemplateId=${PROGRAM}-default`)
        )
        await expect(
            page.locator(
                '[aria-current="true"][data-testid^="working-list-view-"]'
            )
        ).toHaveCount(0)
        await expect(
            page.locator('[data-testid="working-list-table"] tbody')
        ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
    })

    test('deselects the active list and falls back to the unfiltered default view', async ({
        page,
    }) => {
        await openWorkingList(page)
        const activeView = page.getByTestId('working-list-view-active')
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
        await expect(
            page.getByTestId('working-list-view-active')
        ).not.toHaveAttribute('aria-current', 'true')
    })

    test('keeps text edits draft-only until Update and supports real null gates when available', async ({
        page,
    }) => {
        await openWorkingList(page)
        await page.getByTestId(`filter-${TEXT_ATTRIBUTE}`).click()
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

        await page.getByTestId(`filter-${TEXT_ATTRIBUTE}`).click()
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

        await page.getByTestId(`filter-${TEXT_ATTRIBUTE}`).click()
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
            (url) => url.searchParams.get('order') === `${TEXT_ATTRIBUTE}:desc`
        )
        expect(firstSort.searchParams.getAll('order')).toEqual([
            `${TEXT_ATTRIBUTE}:desc`,
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

        await chooseSavedListOption(page, 'configure-columns')
        const settings = page.getByTestId('column-settings')
        await expect(settings).toBeVisible()
        await settings
            .locator(`[data-test="column-${BOOLEAN_ATTRIBUTE}"] input`)
            .uncheck()
        const columnRows = settings.locator(
            '[data-testid^="column-settings-row-"]'
        )
        const initialColumnRows = await columnRows.evaluateAll((rows) =>
            rows.map((row) => row.getAttribute('data-testid'))
        )
        const initialIntegerIndex = initialColumnRows.indexOf(
            `column-settings-row-${INTEGER_ATTRIBUTE}`
        )
        const initialTextIndex = initialColumnRows.indexOf(
            `column-settings-row-${TEXT_ATTRIBUTE}`
        )
        const moveCount = initialIntegerIndex - initialTextIndex
        expect(moveCount).toBeGreaterThan(0)
        const integerDragHandle = settings.getByRole('button', {
            name: 'Reorder E2E integer attribute',
        })
        await integerDragHandle.focus()
        await page.keyboard.press('Space')
        for (let move = 0; move < moveCount; move += 1) {
            await page.keyboard.press('ArrowUp')
            await expect(settings.getByRole('status')).toContainText(
                `E2E integer attribute moved to position ${initialIntegerIndex - move}`
            )
        }
        await page.keyboard.press('Space')
        await expect
            .poll(async () => {
                const orderedColumnRows = await columnRows.evaluateAll((rows) =>
                    rows.map((row) => row.getAttribute('data-testid'))
                )
                return (
                    orderedColumnRows.indexOf(
                        `column-settings-row-${INTEGER_ATTRIBUTE}`
                    ) <
                    orderedColumnRows.indexOf(
                        `column-settings-row-${TEXT_ATTRIBUTE}`
                    )
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

test.describe('Capture programme-stage joint data strategy', () => {
    test('morphs to events, combines attribute and data-element filters, and replaces event sort', async ({
        page,
    }) => {
        await openWorkingList(page)
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
        await expect(page.getByTestId('stage-filter-section')).toBeVisible()

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
            (url) => url.searchParams.get('order') === `${TEXT_ATTRIBUTE}:desc`
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

        await page.getByTestId('filter-eventOccurredAt').click()
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

        await page.getByTestId('filter-programStage').click()
        await page.locator('[data-test="filter-reset-programStage"]').click()
        await expect(page.getByTestId('filter-programStage')).not.toContainText(
            STAGE_NAME
        )
        await expect(
            page.getByTestId('working-list-row-WlE2eTei001')
        ).toBeVisible()
        await expect(page.getByTestId(`sort-${TEXT_DATA_ELEMENT}`)).toHaveCount(
            0
        )
        await page.getByTestId('filter-programStage').click()
        await page.locator('[data-test="filter-remove-programStage"]').click()
        await expect(page.getByTestId('stage-filter-section')).toHaveCount(0)
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

    test('saves, reloads, updates, renames, shares, and deletes a private tracker list', async ({
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

            await chooseSavedListOption(page, 'save-as-working-list')
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
            await expect(
                page.getByTestId(`working-list-view-${createdId}`)
            ).toHaveAttribute('aria-current', 'true')
            await expect(page).toHaveURL(
                new RegExp(`selectedTemplateId=${createdId}`)
            )
            await expect(
                page.getByTestId('working-list-dirty-indicator')
            ).toHaveCount(0)
            const settledOptions = await openSavedListOptions(page)
            await expect(
                settledOptions.locator('[data-test="save-as-working-list"]')
            ).toBeVisible()
            await expect(
                settledOptions.locator('[data-test="update-working-list"]')
            ).toHaveCount(0)
            await page.keyboard.press('Escape')

            // This query was loaded before Save As, so React Query may satisfy
            // the restored text sort from cache without another HTTP request.
            await page.getByTestId(`sort-${TEXT_ATTRIBUTE}`).click()
            await expect(
                page.getByTestId('working-list-dirty-indicator')
            ).toBeVisible()
            const dirtyOptions = await openSavedListOptions(page)
            await expect(
                dirtyOptions.locator('[data-test="update-working-list"]')
            ).toBeVisible()
            const updateResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'PUT' &&
                    requestUrl(response).pathname.endsWith(
                        `/trackedEntityInstanceFilters/${createdId}`
                    )
            )
            await dirtyOptions
                .locator('[data-test="update-working-list"]')
                .click()
            expect((await updateResponse).ok()).toBe(true)
            await expect(
                page.getByTestId('working-list-dirty-indicator')
            ).toHaveCount(0)

            await chooseSavedListOption(page, 'rename-working-list')
            await page
                .locator('[data-test="working-list-name-input"] input')
                .fill('E2E renamed tracker lifecycle')
            const renameResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'PUT' &&
                    requestUrl(response).pathname.endsWith(
                        `/trackedEntityInstanceFilters/${createdId}`
                    )
            )
            await page
                .locator('[data-test="working-list-name-input"] input')
                .press('Enter')
            expect((await renameResponse).ok()).toBe(true)
            await expect(
                page.getByTestId(`working-list-view-${createdId}`)
            ).toContainText('E2E renamed tracker lifecycle')

            await chooseSavedListOption(page, 'share-working-list')
            const sharingDialog = page.getByRole('dialog').filter({
                has: page.getByRole('heading', {
                    name: 'Sharing and access: E2E renamed tracker lifecycle',
                    exact: true,
                }),
            })
            await expect(sharingDialog).toBeVisible()
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

            await chooseSavedListOption(page, 'share-working-list')
            await expect(sharingDialog).toBeVisible()
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

            await chooseSavedListOption(page, 'delete-working-list')
            const deleteResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'DELETE' &&
                    requestUrl(response).pathname.endsWith(
                        `/trackedEntityInstanceFilters/${createdId}`
                    )
            )
            await page
                .locator('[data-test="delete-working-list-confirm"]')
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

    test('saves and deletes a programme-stage view in its dedicated metadata resource', async ({
        page,
        playwright,
    }) => {
        const ownerApi = await createApi(playwright, OWNER)
        let createdId: string | undefined
        try {
            await openWorkingList(page, { template: PRIVATE_LIST })
            await enterStageMode(page)
            await chooseSavedListOption(page, 'save-as-working-list')
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
            const savedOptions = await openSavedListOptions(page)
            await expect(
                savedOptions.locator('[data-test="save-as-working-list"]')
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

            await chooseSavedListOption(page, 'delete-working-list')
            const deleteResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'DELETE' &&
                    requestUrl(response).pathname.endsWith(
                        `/programStageWorkingLists/${createdId}`
                    )
            )
            await page
                .locator('[data-test="delete-working-list-confirm"]')
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
            await expect(
                page.getByTestId(`working-list-view-${STALE_LIST}`)
            ).toHaveAttribute('aria-current', 'true')
            await page.waitForTimeout(300)
            expect(trackerRequests).toHaveLength(0)

            await page.locator('[data-test="repair-working-list"]').click()
            const repairDialog = page.locator(
                '[data-test="repair-working-list-dialog"]'
            )
            await expect(repairDialog).toBeVisible()
            await expect(
                page.getByTestId('repair-working-list-preview')
            ).toContainText('Remove 1 unavailable columns')

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

test.describe('read-only shared-list permissions', () => {
    test.use({ e2eCredentials: READER })

    test('suppresses generated defaults and disables owner-only actions', async ({
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
        const options = await openSavedListOptions(page)
        await expect(
            options.locator('[data-test="save-as-working-list"]')
        ).toBeVisible()
        for (const ownerAction of [
            'update-working-list',
            'rename-working-list',
            'share-working-list',
            'delete-working-list',
        ]) {
            await expect(
                options.locator(`[data-test="${ownerAction}"]`)
            ).toHaveCount(0)
        }
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

        const filterButton = page.getByTestId(`filter-${TEXT_ATTRIBUTE}`)
        await filterButton.focus()
        await page.keyboard.press('Enter')
        await expect(
            page.getByTestId(`filter-editor-${TEXT_ATTRIBUTE}`)
        ).toBeVisible()
        await expect(
            page.locator('[data-test="dhis2-uicore-popoverarrow"]')
        ).toHaveCount(0)
        const filterPopoverBounds = await page
            .getByTestId(`filter-editor-${TEXT_ATTRIBUTE}`)
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

    test('announces browser offline state globally and disables server actions', async ({
        context,
        page,
    }) => {
        await openWorkingList(page)
        await context.setOffline(true)
        await expect(page.getByTestId('offline-notice')).toBeVisible()
        const offlineMenu = await openSavedListOptions(page)
        await expect(
            offlineMenu.locator(
                '[data-test="save-as-working-list"] [role="menuitem"]'
            )
        ).toHaveAttribute('aria-disabled', 'true')
        await expect(
            offlineMenu.locator(
                '[data-test="configure-columns"] [role="menuitem"]'
            )
        ).not.toHaveAttribute('aria-disabled', 'true')
        await page.keyboard.press('Escape')
        await context.setOffline(false)
        await expect(page.getByTestId('offline-notice')).toHaveCount(0)
        const onlineMenu = await openSavedListOptions(page)
        await expect(
            onlineMenu.locator(
                '[data-test="save-as-working-list"] [role="menuitem"]'
            )
        ).not.toHaveAttribute('aria-disabled', 'true')
    })
})
