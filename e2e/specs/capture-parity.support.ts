// The package intentionally exposes the builder as both its default and named export.
// eslint-disable-next-line import/no-named-as-default
import AxeBuilder from '@axe-core/playwright'
import type {
    APIRequestContext,
    Page,
    PlaywrightWorkerArgs,
    Request,
} from '@playwright/test'
import { z } from 'zod'
import {
    workingListReady,
    addStageFilter,
    addTrackedEntityFilter,
    selectStage,
    savedViewButton,
    waitForTrackerResponse,
} from '../fixtures/working-list'
export {
    requestUrl,
    isTrackerResource,
    waitForTrackerResponse,
    savedViewButton,
    uiButton,
    resultRows,
    menuItem,
    selectTrigger,
    chooseSelectOption,
    openMoreActions,
    chooseSaveViewOption,
    openSavedViewActions,
    chooseSavedViewAction,
    openFilterEditor,
    applyTextFilter,
} from '../fixtures/working-list'
import {
    invalidDate,
    seedMetadata,
    seedFieldId,
    seedList,
    seedUser,
} from '../fixtures/seed'
import {
    e2eEnvironment,
    expect,
    test,
    testFromDhis2Version,
    type E2ECredentials,
} from '../fixtures/test'

export { AxeBuilder, expect, test }
export type { APIRequestContext, Page, Request, E2ECredentials }
export const PROGRAM = seedMetadata.programs[0].id
export const PROGRAM_NAME = seedMetadata.programs[0].name
export const ORG_UNIT = seedMetadata.programs[0].organisationUnits[0].id
export const ORG_UNIT_NAME = 'Ngelehun CHC'
export const STAGE = seedMetadata.programStages[0].id
export const STAGE_NAME = seedMetadata.programStages[0].name
export const PRIVATE_LIST = seedList('E2E private owner list').id
export const SHARED_LIST = seedList('E2E shared reader list').id
export const STALE_LIST = seedList('E2E stale metadata list').id
export const TEXT_ATTRIBUTE = seedFieldId('trackedEntityAttributes', 'TEXT')
export const INTEGER_ATTRIBUTE = seedFieldId(
    'trackedEntityAttributes',
    'INTEGER'
)
export const NUMBER_ATTRIBUTE = seedFieldId('trackedEntityAttributes', 'NUMBER')
export const BOOLEAN_ATTRIBUTE = seedFieldId(
    'trackedEntityAttributes',
    'BOOLEAN'
)
export const MULTI_TEXT_ATTRIBUTE = seedFieldId(
    'trackedEntityAttributes',
    'MULTI_TEXT'
)
export const EMAIL_ATTRIBUTE = seedFieldId('trackedEntityAttributes', 'EMAIL')
export const PHONE_ATTRIBUTE = seedFieldId(
    'trackedEntityAttributes',
    'PHONE_NUMBER'
)
export const GEOJSON_ATTRIBUTE = seedFieldId(
    'trackedEntityAttributes',
    'GEOJSON'
)
export const TEXT_DATA_ELEMENT = seedFieldId('dataElements', 'TEXT')
export const INTEGER_DATA_ELEMENT = seedFieldId('dataElements', 'INTEGER')
export const CORRUPTED_DATE_VALUE = invalidDate.value
export const OWNER = seedUser('Owner')
export const READER = seedUser('Reader')
export const OUTSIDER = seedUser('Outsider')

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
        trackedEntityInstanceFilters: z.array(z.object({ id: z.string() })),
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

export const openWorkingList = async (
    page: Page,
    options: Parameters<typeof programHash>[0] = {}
) => {
    await page.goto(programHash(options))
    await workingListReady(page)
    await expect(
        savedViewButton(page, options.template ?? 'active')
    ).toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 })
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
        if ((await page.getByTestId('filter-programStage').count()) === 0) {
            await selectStage(page, STAGE)
        }
        await addStageFilter(page, STAGE, fieldId)
    } else {
        await addTrackedEntityFilter(page, fieldId)
    }
}

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
    playwright: PlaywrightWorkerArgs['playwright'],
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
