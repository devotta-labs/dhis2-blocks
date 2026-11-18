import AxeBuilder from '@axe-core/playwright'
import type {
    APIRequestContext,
    Locator,
    Page,
    Request,
    Response,
} from '@playwright/test'
import { z } from 'zod'
import { expect } from '../fixtures/test'

// Seeded by scripts/e2e/seed-metadata.sh from e2e/metadata/patient-list-*.json.
export const PROGRAM = 'WlE2ePrg001'
export const ORG_UNIT = 'DiszpKrYNg8'
export const ORG_UNIT_NAME = 'Ngelehun CHC'
export const TEXT_ATTRIBUTE = 'WlAtText001'
const TEXT_ATTRIBUTE_NAME = 'E2E text attribute'
export const INTEGER_ATTRIBUTE = 'WlAtIntg001'
export const INTEGER_ATTRIBUTE_NAME = 'E2E integer attribute'
const PROGRAM_NAME = 'Patient list E2E tracker program'

const environment = process.env

/** DHIS2 2.41 takes the enrollment status as `programStatus`. */
export const statusParameter =
    Number(environment?.E2E_EXPECTED_MAJOR) === 41
        ? 'programStatus'
        : 'enrollmentStatus'

const OrganisationUnitSchema = z
    .object({
        id: z.string(),
        displayName: z.string(),
        ancestors: z.array(
            z.object({ id: z.string(), displayName: z.string() })
        ),
    })
    .passthrough()

type OrganisationUnit = {
    id: string
    displayName: string
}

/** The seeded organisation unit and its ancestors, from the root down. */
export const fetchOrganisationUnit = async (dhis2: APIRequestContext) => {
    const response = await dhis2.get(`/api/organisationUnits/${ORG_UNIT}`, {
        params: { fields: 'id,displayName,ancestors[id,displayName]' },
    })
    expect(response.ok()).toBe(true)
    const organisationUnit = OrganisationUnitSchema.parse(await response.json())
    expect(organisationUnit).toMatchObject({
        id: ORG_UNIT,
        displayName: ORG_UNIT_NAME,
    })
    expect(organisationUnit.ancestors.length).toBeGreaterThan(0)
    return organisationUnit
}

/** The app's route for the seeded program and organisation unit. */
export const listHash = (page?: number, pageSize?: number) => {
    const parameters = new URLSearchParams({
        programId: PROGRAM,
        orgUnitId: ORG_UNIT,
    })
    if (page !== undefined) {
        parameters.set('page', String(page))
    }
    if (pageSize !== undefined) {
        parameters.set('pageSize', String(pageSize))
    }
    return `/#/?${parameters.toString()}`
}

/** A parameter of the app's hash route, `/#/?programId=…`. */
export const hashParameter = (page: Page, name: string) =>
    new URLSearchParams(new URL(page.url()).hash.split('?')[1] ?? '').get(name)

const requestUrl = (message: Request | Response) => new URL(message.url())

const isRowsRequest = (request: Request) =>
    request.method() === 'GET' &&
    requestUrl(request).pathname.endsWith('/tracker/trackedEntities')

/** Every rows request the page makes from now on, in order. */
export const recordRowsRequests = (page: Page) => {
    const requests: URL[] = []
    page.on('request', (request) => {
        if (isRowsRequest(request)) {
            requests.push(requestUrl(request))
        }
    })
    return requests
}

/**
 * Runs `action` and returns the URL of the first successful rows response
 * that `matches`.
 */
export const waitForRows = async (
    page: Page,
    action: () => Promise<void>,
    matches: (url: URL) => boolean = () => true
) => {
    const pending = page.waitForResponse(
        (response) =>
            isRowsRequest(response.request()) && matches(requestUrl(response))
    )
    await action()
    const response = await pending
    expect(response.ok(), `rows request ${response.url()}`).toBe(true)
    return requestUrl(response)
}

export const patientList = (page: Page) =>
    page.locator('[data-block="patient-list"]')

export const rows = (page: Page) =>
    patientList(page).locator('[data-slot="data-table-row"]')

export const tablePart = (page: Page, slot: string) =>
    patientList(page).locator(`[data-slot="data-table-${slot}"]`)

export const columnHeader = (page: Page, columnId: string) =>
    patientList(page).locator(
        `th[data-slot="data-table-head"][data-column-id="${columnId}"]`
    )

export const filterChip = (page: Page, filterId: string) =>
    patientList(page).locator(
        `[data-slot="data-table-filter-chip"][data-filter-id="${filterId}"]`
    )

/** Opens the list at `hash` and waits for its first rows. */
export const openPatientList = async (page: Page, hash = listHash()) => {
    const request = await waitForRows(page, async () => {
        await page.goto(hash)
    })
    await expect(page.getByTestId('patient-list-layout')).toBeVisible({
        timeout: 30_000,
    })
    await expect(patientList(page)).toHaveAttribute('data-status', 'ready', {
        timeout: 30_000,
    })
    return request
}

/** Opens the chip's editor and applies a "contains" value. */
export const applyTextFilter = async (page: Page, text: string) => {
    await filterChip(page, TEXT_ATTRIBUTE)
        .getByRole('combobox', { name: TEXT_ATTRIBUTE_NAME })
        .click()
    const editor = page.getByRole('dialog', { name: TEXT_ATTRIBUTE_NAME })
    await editor.getByRole('textbox', { name: 'Value' }).fill(text)
    const request = await waitForRows(
        page,
        () => editor.getByRole('button', { name: 'Apply' }).click(),
        (url) =>
            url.searchParams
                .getAll('filter')
                .includes(`${TEXT_ATTRIBUTE}:like:${text}`)
    )
    await expect(editor).toHaveCount(0)
    return request
}

export const chooseProgram = async (page: Page) => {
    await page.locator('[data-test="program-selector-container"]').click()
    await page.getByText(PROGRAM_NAME, { exact: true }).last().click()
}

/** Expands the tree along `ancestors` and selects `target`. */
export const selectOrganisationUnitFromTree = async (
    page: Page,
    ancestors: readonly OrganisationUnit[],
    target: OrganisationUnit
) => {
    const tree = page.getByTestId('org-unit-tree')
    await expect(tree).toBeVisible()
    for (const organisationUnit of ancestors) {
        const label = tree.getByText(organisationUnit.displayName, {
            exact: true,
        })
        await expect(label).toBeVisible()
        const toggle = label
            .locator(
                'xpath=ancestor::*[@data-test="dhis2-uiwidgets-orgunittree-node"][1]'
            )
            .locator(
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
    const label = tree.getByText(target.displayName, { exact: true })
    await expect(label).toBeVisible()
    await label.click()
}

const TAB_LIMIT = 80

/** Presses Tab until `target` has focus. */
export const tabTo = async (page: Page, target: Locator) => {
    for (let press = 0; press < TAB_LIMIT; press++) {
        await page.keyboard.press('Tab')
        if (
            await target.evaluate(
                (element) => element === element.ownerDocument.activeElement
            )
        ) {
            return
        }
    }
    await expect(
        target,
        `Tab reaches it within ${TAB_LIMIT} presses`
    ).toBeFocused()
}

// The docs lane's accessibility tags: WCAG 2.2 AA.
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Axe violations inside the app's list layout. */
export const listViolations = async (page: Page) =>
    (
        await new AxeBuilder({ page })
            .include('[data-testid="patient-list-layout"]')
            .withTags(AXE_TAGS)
            .analyze()
    ).violations.map(({ id, help, nodes }) => ({
        id,
        help,
        targets: nodes.map(({ target }) => target.join(' ')),
    }))
