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

export { AxeBuilder, expect, test }
export type {
    APIRequestContext,
    Page,
    Playwright,
    Request,
    Response,
    E2ECredentials,
}
export const PROGRAM = 'WlE2ePrg001'
export const PROGRAM_NAME = 'Working list E2E tracker program'
export const ORG_UNIT = 'DiszpKrYNg8'
export const ORG_UNIT_NAME = 'Ngelehun CHC'
export const STAGE = 'WlE2eStg001'
export const STAGE_NAME = 'Working list E2E programme stage'
export const PRIVATE_LIST = 'WlE2eLst001'
export const SHARED_LIST = 'WlE2eLst002'
export const STALE_LIST = 'WlE2eLst003'
export const TEXT_ATTRIBUTE = 'WlAtText001'
export const INTEGER_ATTRIBUTE = 'WlAtIntg001'
export const NUMBER_ATTRIBUTE = 'WlAtNumb001'
export const BOOLEAN_ATTRIBUTE = 'WlAtBool001'
export const MULTI_TEXT_ATTRIBUTE = 'WlAtMult001'
export const EMAIL_ATTRIBUTE = 'WlAtMail001'
export const PHONE_ATTRIBUTE = 'WlAtPhon001'
export const GEOJSON_ATTRIBUTE = 'WlAtGeoj001'
export const TEXT_DATA_ELEMENT = 'WlDeText001'
export const INTEGER_DATA_ELEMENT = 'WlDeIntg001'
// scripts/e2e/seed-metadata.sh writes this invalid date through SQL because
// the tracker importer would reject it.
export const CORRUPTED_DATE_VALUE = '2025-13-45'
const TEST_PASSWORD = 'WorkingList123!'

export const OWNER: E2ECredentials = {
    username: 'wl_e2e_owner',
    password: TEST_PASSWORD,
}
export const READER: E2ECredentials = {
    username: 'wl_e2e_reader',
    password: TEST_PASSWORD,
}
export const OUTSIDER: E2ECredentials = {
    username: 'wl_e2e_outsider',
    password: TEST_PASSWORD,
}

const environment = process.env
export const targetMajor = Number(environment?.E2E_EXPECTED_MAJOR)
export const typedRegistryTest = testFromDhis2Version(43)
export const typedRegistryTestTitle =
    'uses the typed registry for numeric, boolean, and option filters while keeping unsupported values display-only @dhis2-min-43'

export const OrganisationUnitSchema = z
    .object({
        id: z.string(),
        displayName: z.string(),
        ancestors: z.array(
            z.object({ id: z.string(), displayName: z.string() })
        ),
    })
    .passthrough()
export const MutationResponseSchema = z
    .object({ response: z.object({ uid: z.string().optional() }).optional() })
    .passthrough()
export const SavedTrackedEntityListSchema = z
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
export const SharingResponseSchema = z
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
export const SavedListCollectionSchema = z
    .object({
        trackedEntityInstanceFilters: z
            .array(z.object({ id: z.string().optional() }))
            .optional(),
    })
    .passthrough()
export const SavedStageListSchema = z
    .object({
        publicAccess: z.string().optional(),
        sharing: z.object({ public: z.string().optional() }).optional(),
        programStage: z.object({ id: z.string().optional() }).optional(),
    })
    .passthrough()
export const RepairedListSchema = z
    .object({
        entityQueryCriteria: z
            .object({ displayColumnOrder: z.array(z.string()).optional() })
            .optional(),
    })
    .passthrough()

export const requestUrl = (request: Request | Response) =>
    new URL(request.url())
export const isTrackerResource = (
    request: Request | Response,
    resource: 'trackedEntities' | 'events'
) => requestUrl(request).pathname.endsWith(`/tracker/${resource}`)

// Keeping the action and URL predicate separate makes network assertions readable.
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

export const programHash = ({
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

export const savedViewButton = (page: Page, listId: string) =>
    page
        .getByTestId(`working-list-view-${listId}`)
        .locator('button:not([data-saved-view-menu])')

export const uiButton = (page: Page, dataTest: string) =>
    page.locator(
        `button[data-test="${dataTest}"], [data-test="${dataTest}"] button`
    )

export const openWorkingList = async (
    page: Page,
    options: Parameters<typeof programHash>[0] = {}
) => {
    await page.goto(programHash(options))
    await expect(page.getByTestId('working-list-main')).toBeVisible({
        timeout: 30_000,
    })
    await expect(
        savedViewButton(page, options.template ?? 'active')
    ).toHaveAttribute('aria-current', 'true', { timeout: 30_000 })
    await expect(
        page.getByTestId('working-list-selection-loading')
    ).toHaveCount(0)
    await expect(page.getByTestId('working-list-table')).toBeVisible({
        timeout: 30_000,
    })
    await expect(
        page.locator('[data-testid="working-list-table"] tbody')
    ).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
}

export const resultRows = (page: Page) =>
    page.locator('[data-testid^="working-list-row-"]')

export const chooseDhis2Option = async (
    page: Page,
    rootSelector: string,
    label: string
) => {
    const root = page.locator(rootSelector)
    await root.locator('[data-test="dhis2-uicore-select-input"]').click()
    await page.getByText(label, { exact: true }).last().click()
}

export const openMoreActions = async (page: Page) => {
    const trigger = uiButton(page, 'working-list-options')
    await trigger.click()
    const download = page.locator('[data-test="download-working-list"]')
    await expect(download).toBeVisible()
    return download
}

export const chooseSaveViewOption = async (page: Page, dataTest: string) => {
    await uiButton(page, 'save-working-list').click()
    const option = page.locator(`[data-test="${dataTest}"]`)
    await expect(option).toBeVisible()
    const menuItem = option.getByRole('menuitem')
    await expect(menuItem).toBeEnabled()
    await menuItem.click()
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
    const option = menu.locator(`[data-test="${dataTest}"]`)
    await expect(option).toBeVisible()
    const menuItem = option.getByRole('menuitem')
    await expect(menuItem).toBeEnabled()
    await menuItem.click()
}

export type OrganisationUnitAncestor = {
    id: string
    displayName: string
}

export const selectOrganisationUnitFromTree = async (
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

export const addFilter = async (
    page: Page,
    scope: 'tracked-entity' | 'event',
    fieldId: string
) => {
    if (scope === 'event') {
        const stageControl = page.getByTestId('filter-programStage')
        if ((await stageControl.count()) === 0) {
            await page.getByTestId('more-filters-tracked-entity').click()
            await page
                .locator('[data-test="program-stage-filter-menu"]')
                .getByRole('menuitem')
                .hover()
            await page
                .locator(`[data-test="select-filter-stage-${STAGE}"]`)
                .getByRole('menuitem')
                .click()
            await expect(stageControl).toBeVisible()
        }
        await page.getByTestId('more-filters-tracked-entity').click()
        await page
            .locator(`[data-test="stage-filter-fields-${STAGE}"]`)
            .getByRole('menuitem')
            .hover()
        await page
            .locator(`[data-test="add-stage-filter-${STAGE}-${fieldId}"]`)
            .getByRole('menuitem')
            .click()
    } else {
        await page.getByTestId('more-filters-tracked-entity').click()
        await page.locator(`[data-test="add-filter-${fieldId}"]`).click()
    }
    await expect(page.getByTestId(`filter-${fieldId}`)).toBeVisible()
    // Newly added filters open their editor right away.
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

// This is a small UI DSL used across both tracked-entity and event endpoints.
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

export const enterStageMode = async (page: Page) => {
    const response = await waitForTrackerResponse(
        page,
        'events',
        () => addFilter(page, 'event', 'eventOccurredAt'),
        (url) => url.searchParams.get('programStage') === STAGE
    )
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('filter-editor-eventOccurredAt')).toHaveCount(
        0
    )
    return response
}

const basicAuthorization = ({ username, password }: E2ECredentials) =>
    `Basic ${globalThis.btoa(`${username}:${password}`)}`

export const createApi = async (
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

export const deleteListIfPresent = async (
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
