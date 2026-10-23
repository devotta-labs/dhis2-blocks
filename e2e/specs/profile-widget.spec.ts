import {
    ATTRIBUTE,
    GEOMETRY,
    TRACKED_ENTITY_TYPE_NAME,
    changelogRows,
    createAdminApi,
    expect,
    importProfileWidgetMetadata,
    openEnrollmentProfile,
    openProfileMenu,
    readServerMinor,
    test,
} from './profile-widget.support'

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

test('shows the display-in-list attributes of a tracked entity', async ({
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
})

test('opens the changelog @dhis2-min-43', async ({ page, trackedEntities }) => {
    test.skip(serverMinor < 43, 'enableChangeLog needs DHIS2 2.43+')

    const trackedEntityId = await trackedEntities.create()
    await trackedEntities.updateFirstName(trackedEntityId, ['Ada 1'])

    const widget = await openEnrollmentProfile(page, trackedEntityId)
    const menu = await openProfileMenu(page, widget)
    await menu.getByRole('menuitem', { name: 'View changelog' }).click()

    const dialog = page.getByRole('dialog', { name: 'Changelog' })
    await expect(changelogRows(dialog).first()).toBeVisible({
        timeout: 20_000,
    })
    await expect(dialog).toContainText(ATTRIBUTE.firstName.label)
    await expect(dialog).toContainText('Updated')
})

test('deactivates and activates a tracked entity', async ({
    page,
    trackedEntities,
}) => {
    const trackedEntityId = await trackedEntities.create()
    const widget = await openEnrollmentProfile(page, trackedEntityId)

    let menu = await openProfileMenu(page, widget)
    await menu.getByRole('menuitem', { name: deactivateLabel }).click()
    await page
        .getByRole('button', {
            name: `Yes, deactivate ${TRACKED_ENTITY_TYPE_NAME}`,
        })
        .click()

    menu = await openProfileMenu(page, widget)
    await expect(
        menu.getByRole('menuitem', { name: activateLabel })
    ).toBeVisible()
    const deactivated = await trackedEntities.read(trackedEntityId)
    expect(deactivated.inactive).toBe(true)
    expect(deactivated.geometry).toEqual(GEOMETRY)

    await menu.getByRole('menuitem', { name: activateLabel }).click()
    await page
        .getByRole('button', {
            name: `Yes, activate ${TRACKED_ENTITY_TYPE_NAME}`,
        })
        .click()

    menu = await openProfileMenu(page, widget)
    await expect(
        menu.getByRole('menuitem', { name: deactivateLabel })
    ).toBeVisible()
    expect((await trackedEntities.read(trackedEntityId)).inactive).toBe(false)
})

test('deletes a tracked entity', async ({ page, trackedEntities }) => {
    const trackedEntityId = await trackedEntities.create()
    const widget = await openEnrollmentProfile(page, trackedEntityId)
    const menu = await openProfileMenu(page, widget)

    await menu.getByRole('menuitem', { name: deleteLabel }).click()
    await page
        .getByRole('button', {
            name: `Yes, delete ${TRACKED_ENTITY_TYPE_NAME}`,
        })
        .click()

    await expect(widget).toHaveCount(0)
    expect(await trackedEntities.status(trackedEntityId)).toBe(404)
})
