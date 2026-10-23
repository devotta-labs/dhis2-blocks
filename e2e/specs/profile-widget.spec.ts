import type { Locator, Page, Request } from '@playwright/test'
import {
    ATTRIBUTE,
    CHANGELOG_DISABLED_PROGRAM,
    CHANGELOG_DISABLED_TRACKED_ENTITY,
    CREATED_AT_CLIENT,
    GEOMETRY,
    ORG_UNIT_OUTSIDE_USER_SCOPE,
    PROGRAM,
    TRACKED_ENTITY_TYPE_NAME,
    USER_WITHOUT_DELETE_AUTHORITY,
    changelogRows,
    createAdminApi,
    expect,
    importProfileWidgetMetadata,
    navigateToEnrollmentProfile,
    openEnrollmentProfile,
    openPersonPanel,
    openProfileMenu,
    readServerMinor,
    recordMetadataFields,
    test,
} from './profile-widget.support'

// The spec seeds its own metadata once per worker; keep its tests on one
// worker so two first-time imports never race on the same unique names.
test.describe.configure({ mode: 'default' })

let serverMinor = 0

test.beforeAll(async ({ playwright }) => {
    const api = await createAdminApi(playwright)
    try {
        serverMinor = await readServerMinor(api)
        await importProfileWidgetMetadata(api, serverMinor)
    } finally {
        await api.dispose()
    }
})

const deactivateLabel = `Deactivate ${TRACKED_ENTITY_TYPE_NAME}`
const activateLabel = `Activate ${TRACKED_ENTITY_TYPE_NAME}`
const deleteLabel = `Delete ${TRACKED_ENTITY_TYPE_NAME}`
const inactiveNotice = `This ${TRACKED_ENTITY_TYPE_NAME} is deactivated`

test.describe('profile widget rows', () => {
    test('shows program rows, then type-only list rows, with empty values under the type title', async ({
        page,
        trackedEntities,
    }) => {
        const trackedEntityId = await trackedEntities.create()
        const widget = await openEnrollmentProfile(page, trackedEntityId)

        await expect(
            widget.getByRole('heading', {
                level: 2,
                name: `${TRACKED_ENTITY_TYPE_NAME} profile`,
            })
        ).toBeVisible()
        await expect(widget).toHaveAttribute('aria-labelledby', /\S+/)

        // Program attributes keep their program-level displayInList and
        // order; the type-only displayInList attribute follows them.
        await expect(widget.getByRole('term')).toHaveText([
            `${ATTRIBUTE.firstName.label}:`,
            `${ATTRIBUTE.lastName.label}:`,
            `${ATTRIBUTE.visitNote.label}:`,
            `${ATTRIBUTE.consent.label}:`,
            `${ATTRIBUTE.nickname.label}:`,
        ])
        await expect(widget.getByRole('definition')).toHaveText([
            'Ada',
            'Lovelace',
            /^[\s—–-]*$/,
            'Yes',
            'Countess',
        ])
        await expect(
            widget.getByText(ATTRIBUTE.programHidden.label)
        ).toHaveCount(0)
        await expect(
            widget.getByText(ATTRIBUTE.typeOnlyHidden.label)
        ).toHaveCount(0)

        // The toggle is named by the widget title; Collapse/Expand is its
        // tooltip, so a screen reader hears "<title>, expanded".
        const toggle = widget.getByRole('button', {
            name: `${TRACKED_ENTITY_TYPE_NAME} profile`,
            exact: true,
        })
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        await expect(toggle).toHaveAttribute('title', 'Collapse')
        await toggle.click()
        await expect(widget.getByRole('term')).toHaveCount(0)
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
        await expect(toggle).toHaveAttribute('title', 'Expand')
        await toggle.click()
        await expect(widget.getByRole('term')).toHaveCount(5)
    })

    test('shows the type list rows and the person name without a program', async ({
        page,
        trackedEntities,
    }) => {
        const trackedEntityId = await trackedEntities.create()
        const metadataFields = recordMetadataFields(page)
        const widget = await openPersonPanel(page, trackedEntityId)

        await expect(
            widget.getByRole('heading', { level: 2, name: 'Ada Lovelace' })
        ).toBeVisible()
        await expect(widget.getByRole('term')).toHaveText([
            `${ATTRIBUTE.firstName.label}:`,
            `${ATTRIBUTE.lastName.label}:`,
            `${ATTRIBUTE.nickname.label}:`,
        ])
        await expect(widget.getByRole('definition')).toHaveText([
            'Ada',
            'Lovelace',
            'Countess',
        ])

        const toolbar = page.getByRole('toolbar', {
            name: 'Tracked entity actions',
        })
        await expect(
            toolbar.getByRole('button', { name: 'Deactivate' })
        ).toBeVisible()
        await expect(
            toolbar.getByRole('button', { name: 'Delete' })
        ).toBeEnabled()

        // enableChangeLog is only requested from servers that have it (2.43+).
        expect(metadataFields.length).toBeGreaterThan(0)
        for (const fields of metadataFields) {
            expect(fields.includes('enableChangeLog'), fields).toBe(
                serverMinor >= 43
            )
        }
    })
})

test.describe('profile widget changelog', () => {
    test('offers the changelog only when the tracked entity type enables it', async ({
        page,
        trackedEntities,
    }) => {
        const trackedEntityId = await trackedEntities.create()
        const metadataFields = recordMetadataFields(page)
        const widget = await openEnrollmentProfile(page, trackedEntityId)
        const menu = await openProfileMenu(page, widget)

        await expect(
            menu.getByRole('menuitem', { name: deactivateLabel })
        ).toBeVisible()
        // enableChangeLog only exists from 2.43: older servers are never asked
        // for it and never offer the changelog.
        expect(metadataFields.length).toBeGreaterThan(0)
        for (const fields of metadataFields) {
            expect(fields.includes('enableChangeLog'), fields).toBe(
                serverMinor >= 43
            )
        }
        await expect(
            menu.getByRole('menuitem', { name: 'View changelog' })
        ).toHaveCount(serverMinor >= 43 ? 1 : 0)
        await page.keyboard.press('Escape')

        // The working-list type never enables the changelog on any version.
        const otherWidget = await openEnrollmentProfile(
            page,
            CHANGELOG_DISABLED_TRACKED_ENTITY,
            CHANGELOG_DISABLED_PROGRAM
        )
        const otherMenu = await openProfileMenu(page, otherWidget)
        await expect(
            otherMenu.getByRole('menuitem').filter({ hasText: /^Deactivate / })
        ).toBeVisible()
        await expect(
            otherMenu.getByRole('menuitem', { name: 'View changelog' })
        ).toHaveCount(0)
        await page.keyboard.press('Escape')
    })

    test('pages and filters the changelog @dhis2-min-43', async ({
        page,
        trackedEntities,
    }) => {
        test.skip(serverMinor < 43, 'enableChangeLog needs DHIS2 2.43+')

        const trackedEntityId = await trackedEntities.create()
        // Four CREATE entries for the program attributes with a value, plus
        // eight UPDATE entries: two pages of ten.
        await trackedEntities.updateFirstName(
            trackedEntityId,
            Array.from({ length: 8 }, (_, index) => `Ada ${index + 1}`)
        )

        const widget = await openEnrollmentProfile(page, trackedEntityId)
        const menu = await openProfileMenu(page, widget)
        await menu.getByRole('menuitem', { name: 'View changelog' }).click()

        const dialog = page.getByRole('dialog', { name: 'Changelog' })
        await expect(dialog).toBeVisible()
        const rows = changelogRows(dialog)
        await expect(rows).toHaveCount(10, { timeout: 20_000 })
        await expect(dialog).toContainText(ATTRIBUTE.firstName.label)
        await expect(dialog).toContainText('Updated')

        const previousPage = dialog.getByRole('button', {
            name: 'Previous page',
        })
        const nextPage = dialog.getByRole('button', { name: 'Next page' })
        await expect(previousPage).toBeDisabled()
        await nextPage.click()
        await expect(rows).toHaveCount(2)
        await expect(nextPage).toBeDisabled()
        await previousPage.click()
        await expect(rows).toHaveCount(10)

        // With a program the call only returns program attributes, so the
        // filter lists only those.
        await dialog.getByRole('combobox', { name: /data item/i }).click()
        await expect(
            page.getByRole('option', {
                name: ATTRIBUTE.firstName.label,
                exact: true,
            })
        ).toBeVisible()
        await expect(
            page.getByRole('option', {
                name: ATTRIBUTE.nickname.label,
                exact: true,
            })
        ).toHaveCount(0)
        await page
            .getByRole('option', { name: ATTRIBUTE.consent.label, exact: true })
            .click()

        await expect(rows).toHaveCount(1)
        await expect(rows.first()).toContainText(ATTRIBUTE.consent.label)
        await expect(rows.first()).toContainText('Created')
        await expect(rows.first()).toContainText('Yes')
        await expect(rows.first()).toContainText('admin')
        await expect(nextPage).toBeDisabled()

        await dialog.getByRole('button', { name: 'Close' }).first().click()
        await expect(dialog).toHaveCount(0)
    })
})

/**
 * Watches the program-scoped GET of one tracked entity (the proxy answers the
 * CORS preflight with 204 first, so OPTIONS is ignored).
 */
const watchProgramScopedRecord = (
    page: Page,
    trackedEntityId: string,
    programId: string = PROGRAM
) => {
    const recordPath = `/tracker/trackedEntities/${trackedEntityId}`
    const isRecordRequest = (request: Request) => {
        const url = new URL(request.url())
        return (
            request.method() === 'GET' &&
            url.pathname.endsWith(recordPath) &&
            url.searchParams.get('program') === programId
        )
    }
    const requests: string[] = []
    page.on('request', (request) => {
        if (isRecordRequest(request)) {
            requests.push(request.url())
        }
    })
    const response = page.waitForResponse((candidate) =>
        isRecordRequest(candidate.request())
    )
    return { requests, response }
}

const expectNotAccessible = async (
    widget: Locator,
    record: ReturnType<typeof watchProgramScopedRecord>
) => {
    await expect(widget.locator('[data-error]')).toHaveAttribute(
        'data-error',
        'TrackedEntityNotAccessibleError'
    )
    await expect(widget.getByRole('term')).toHaveCount(0)
    // A 4xx is deterministic, so the record is not retried.
    expect(record.requests).toHaveLength(1)
}

test.describe('profile widget access', () => {
    test.use({
        expectedHttpErrors: [
            {
                statuses: [403, 404],
                path: /\/api(?:\/\d+)?\/tracker\/trackedEntities\/Pw[A-Za-z0-9]{9}$/,
            },
        ],
    })

    test('handles a program the tracked entity is not enrolled in the way the server answers', async ({
        page,
        trackedEntities,
    }) => {
        const trackedEntityId = await trackedEntities.create({
            enrolled: false,
        })
        const record = watchProgramScopedRecord(page, trackedEntityId)
        const widget = await navigateToEnrollmentProfile(page, trackedEntityId)
        const status = (await record.response).status()

        if (serverMinor >= 42) {
            // 2.42+ requires an enrollment (owner row) in the program.
            expect(status).toBe(404)
            await expectNotAccessible(widget, record)
            return
        }

        // 2.41 only checks sharing and ownership; without an owner row it
        // falls back to the registering org unit, so the read succeeds and
        // the program attributes render.
        expect(status).toBe(200)
        await expect(widget.getByRole('term')).toHaveText([
            `${ATTRIBUTE.firstName.label}:`,
            `${ATTRIBUTE.lastName.label}:`,
            `${ATTRIBUTE.visitNote.label}:`,
            `${ATTRIBUTE.consent.label}:`,
            `${ATTRIBUTE.nickname.label}:`,
        ])
        await expect(widget.locator('[data-error]')).toHaveCount(0)
    })

    test.describe('as a user whose search scope excludes the owner', () => {
        test.use({ e2eCredentials: USER_WITHOUT_DELETE_AUTHORITY })

        test('reports the tracked entity as not accessible', async ({
            page,
            trackedEntities,
        }) => {
            // Enrolled, so 2.42+'s enrollment check passes and only the
            // ownership check can refuse: the owner is outside the user's
            // search scope.
            const trackedEntityId = await trackedEntities.create({
                orgUnit: ORG_UNIT_OUTSIDE_USER_SCOPE,
            })
            // Sanity check: the entity itself is readable (as admin).
            expect(await trackedEntities.status(trackedEntityId)).toBe(200)
            const record = watchProgramScopedRecord(page, trackedEntityId)
            const widget = await navigateToEnrollmentProfile(
                page,
                trackedEntityId
            )

            // 2.41 answers 403 (E1006); 2.42+ hides the entity with 404.
            expect((await record.response).status()).toBe(
                serverMinor >= 42 ? 404 : 403
            )
            await expectNotAccessible(widget, record)
        })
    })
})

test.describe('profile widget status', () => {
    test('deactivates and activates while keeping geometry and the potential-duplicate flag', async ({
        page,
        trackedEntities,
    }) => {
        const trackedEntityId = await trackedEntities.create()
        const widget = await openEnrollmentProfile(page, trackedEntityId)

        let menu = await openProfileMenu(page, widget)
        await menu.getByRole('menuitem', { name: deactivateLabel }).click()
        const confirmDeactivate = page.getByRole('button', {
            name: `Yes, deactivate ${TRACKED_ENTITY_TYPE_NAME}`,
        })
        await expect(
            page.getByRole('button', { name: 'No, cancel' })
        ).toBeVisible()
        await confirmDeactivate.click()
        await expect(confirmDeactivate).toHaveCount(0)
        await expect(
            page.getByRole('status').filter({ hasText: inactiveNotice })
        ).toBeVisible()

        const deactivated = await trackedEntities.read(trackedEntityId)
        expect(deactivated.inactive).toBe(true)
        expect(deactivated.geometry).toEqual(GEOMETRY)
        expect(deactivated.potentialDuplicate).toBe(true)
        expect(deactivated.createdAtClient).toBe(CREATED_AT_CLIENT)

        // Delete is unavailable while inactive; activating stays possible.
        menu = await openProfileMenu(page, widget)
        await expect(
            menu.getByRole('menuitem', { name: deleteLabel })
        ).toHaveCount(0)
        await menu.getByRole('menuitem', { name: activateLabel }).click()
        const confirmActivate = page.getByRole('button', {
            name: `Yes, activate ${TRACKED_ENTITY_TYPE_NAME}`,
        })
        await confirmActivate.click()
        await expect(confirmActivate).toHaveCount(0)
        await expect(
            page.getByRole('status').filter({ hasText: inactiveNotice })
        ).toHaveCount(0)

        const activated = await trackedEntities.read(trackedEntityId)
        expect(activated.inactive).toBe(false)
        expect(activated.geometry).toEqual(GEOMETRY)
        expect(activated.potentialDuplicate).toBe(true)
        expect(activated.createdAtClient).toBe(CREATED_AT_CLIENT)
        expect(activated.attributes).toEqual(
            expect.arrayContaining([
                { attribute: ATTRIBUTE.firstName.id, value: 'Ada' },
            ])
        )

        menu = await openProfileMenu(page, widget)
        await expect(
            menu.getByRole('menuitem', { name: deactivateLabel })
        ).toBeVisible()
        await page.keyboard.press('Escape')
    })
})

test.describe('profile widget delete without the authority', () => {
    test.use({ e2eCredentials: USER_WITHOUT_DELETE_AUTHORITY })

    test('disables delete and explains why', async ({
        page,
        trackedEntities,
    }) => {
        const trackedEntityId = await trackedEntities.create()
        const widget = await openEnrollmentProfile(page, trackedEntityId)
        const menu = await openProfileMenu(page, widget)

        const deleteItem = menu.getByRole('menuitem', { name: deleteLabel })
        await expect(deleteItem).toBeVisible()
        await expect(deleteItem).toHaveAttribute('aria-disabled', 'true')
        const reason = `You do not have access to delete this ${TRACKED_ENTITY_TYPE_NAME}`
        await expect(deleteItem).toHaveAccessibleDescription(reason)
        await deleteItem.hover()
        // The tooltip popup is the only visible copy of the reason.
        await expect(
            page.getByText(reason, { exact: true }).filter({ visible: true })
        ).toBeVisible()

        await deleteItem.click({ force: true })
        await expect(
            page.getByRole('button', {
                name: `Yes, delete ${TRACKED_ENTITY_TYPE_NAME}`,
            })
        ).toHaveCount(0)
        await page.keyboard.press('Escape')
        expect(await trackedEntities.status(trackedEntityId)).toBe(200)
    })
})

test.describe('profile widget delete', () => {
    test('deletes a tracked entity the test created and hands control back to the host', async ({
        page,
        trackedEntities,
    }) => {
        const trackedEntityId = await trackedEntities.create()
        const widget = await openEnrollmentProfile(page, trackedEntityId)
        const menu = await openProfileMenu(page, widget)

        const deleteItem = menu.getByRole('menuitem', { name: deleteLabel })
        await expect(deleteItem).not.toHaveAttribute('aria-disabled', 'true')
        await deleteItem.click()

        const confirmDelete = page.getByRole('button', {
            name: `Yes, delete ${TRACKED_ENTITY_TYPE_NAME}`,
        })
        await confirmDelete.click()
        await expect(confirmDelete).toHaveCount(0)
        await expect(
            page.getByRole('status').filter({
                hasText: `Deleted tracked entity ${trackedEntityId}`,
            })
        ).toBeVisible()
        await expect(widget).toHaveCount(0)

        expect(await trackedEntities.status(trackedEntityId)).toBe(404)
    })
})
