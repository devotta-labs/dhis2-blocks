import type {
    APIRequestContext,
    Locator,
    Page,
    Request,
} from '@playwright/test'
import { z } from 'zod'
import { AxeBuilder, createApi, expect, test } from './capture-parity.support'

// The Sierra Leone RMNCH tracker program, its "First antenatal care visit"
// stage (rules: Chronic conditions shows its follow-ups, the LMP date assigns
// the locked gestational age) and the org unit the spike enrollment lives in.
const PROGRAM = 'WSGAb5XwJ3Y'
const STAGE = 'WZbXY0S00lP'
const STAGE_NAME = 'First antenatal care visit'
const ORG_UNIT = 'm7fBMpmVpSM'

const CHRONIC = { id: 'de0FEHSIoxh', label: 'WHOMCH Chronic conditions' }
const CHRONIC_FOLLOW_UP = {
    id: 'xPTngRLQTnu',
    label: 'CC: Other chronic condition',
}
const LMP = { id: 'w4ky6EkVahL', label: 'Date of first day of LMP' }
const GESTATIONAL_AGE = {
    id: 'roKuXYfw1BW',
    label: 'Gestational age at visit',
}
const SMOKING = { id: 'sWoqcoByYmD', label: 'WHOMCH Smoking' }

const ADMIN = { username: 'admin', password: 'district' }

const UID = /^[A-Za-z][A-Za-z0-9]{10}$/

const EnrollmentListSchema = z.object({
    enrollments: z.array(z.object({ enrollment: z.string() })),
})
const StageEventListSchema = z.object({
    events: z.array(z.object({ enrollment: z.string() })),
})
const StoredEventSchema = z.object({
    event: z.string(),
    status: z.string(),
    enrollment: z.string(),
    dataValues: z.array(
        z.object({ dataElement: z.string(), value: z.string().nullish() })
    ),
    notes: z.array(z.object({ note: z.string(), value: z.string() })),
})
const PostedEventSchema = z.object({
    events: z.tuple([
        z.object({
            event: z.string(),
            dataValues: z.array(
                z.object({
                    dataElement: z.string(),
                    value: z.string().nullable(),
                })
            ),
            notes: z.array(z.object({ note: z.string(), value: z.string() })),
        }),
    ]),
})

const demoHash = (parameters: Record<string, string>) =>
    `/#/event-form?${new URLSearchParams({
        programId: PROGRAM,
        orgUnitId: ORG_UNIT,
        ...parameters,
    }).toString()}`

const localIsoDate = (daysAgo: number) => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The stage is not repeatable, so an enrollment that already has a first
 * antenatal visit cannot take a new one. Pick one that has none.
 */
const findEnrollmentWithoutVisit = async (api: APIRequestContext) => {
    const [enrollments, events] = await Promise.all([
        api.get('/api/tracker/enrollments', {
            params: {
                program: PROGRAM,
                orgUnits: ORG_UNIT,
                orgUnitMode: 'SELECTED',
                fields: 'enrollment',
                paging: false,
            },
        }),
        api.get('/api/tracker/events', {
            params: {
                program: PROGRAM,
                programStage: STAGE,
                orgUnit: ORG_UNIT,
                fields: 'enrollment',
                paging: false,
            },
        }),
    ])
    expect(enrollments.ok()).toBe(true)
    expect(events.ok()).toBe(true)
    const withVisit = new Set(
        StageEventListSchema.parse(await events.json()).events.map(
            (event) => event.enrollment
        )
    )
    const enrollment = EnrollmentListSchema.parse(
        await enrollments.json()
    ).enrollments.find((candidate) => !withVisit.has(candidate.enrollment))
    if (!enrollment) {
        throw new Error('No RMNCH enrollment without a first antenatal visit.')
    }
    return enrollment.enrollment
}

const AttributesSchema = z.object({
    attributes: z.array(
        z.object({ displayName: z.string(), value: z.string().nullish() })
    ),
})
const EnrollmentTrackedEntitySchema = z.object({ trackedEntity: z.string() })

/** The person's name, which the list shows on their rows. */
const personOf = async (api: APIRequestContext, enrollmentId: string) => {
    const enrollment = await api.get(
        `/api/tracker/enrollments/${enrollmentId}`,
        { params: { fields: 'trackedEntity' } }
    )
    expect(enrollment.ok()).toBe(true)
    const { trackedEntity } = EnrollmentTrackedEntitySchema.parse(
        await enrollment.json()
    )
    const entity = await api.get(
        `/api/tracker/trackedEntities/${trackedEntity}`,
        {
            params: {
                fields: 'attributes[displayName,value]',
                program: PROGRAM,
            },
        }
    )
    expect(entity.ok()).toBe(true)
    const { attributes } = AttributesSchema.parse(await entity.json())
    const valueOfAttribute = (name: string) =>
        attributes.find((attribute) => attribute.displayName === name)?.value
    return {
        firstName: valueOfAttribute('First name') ?? '',
        lastName: valueOfAttribute('Last name') ?? '',
    }
}

const readEvent = async (api: APIRequestContext, eventId: string) => {
    const response = await api.get(`/api/tracker/events/${eventId}`, {
        params: { fields: 'event,status,enrollment,dataValues,notes' },
    })
    expect(response.ok()).toBe(true)
    return StoredEventSchema.parse(await response.json())
}

const valueOf = (
    event: z.infer<typeof StoredEventSchema>,
    dataElement: string
) => event.dataValues.find((value) => value.dataElement === dataElement)?.value

const isImport = (request: Request) =>
    request.method() === 'POST' &&
    new URL(request.url()).pathname.endsWith('/tracker')

const answerGroup = (page: Page, label: string) =>
    page.getByRole('group', { name: label, exact: true })

const textbox = (page: Page, label: string) =>
    page.getByRole('textbox', { name: label, exact: true })

const formPanel = (page: Page) => page.getByTestId('event-form-panel')

const saveAndCaptureImport = async (page: Page, button: Locator) => {
    const imported = page.waitForRequest(isImport)
    await button.click()
    const request = await imported
    return request
}

const postedEvent = (request: Request) =>
    PostedEventSchema.parse(request.postDataJSON()).events[0]

const saveButton = (page: Page) =>
    page.getByRole('button', { name: 'Save', exact: true })

const savedNotice = (page: Page) =>
    page.getByTestId('event-form-notice').getByText('Saved', { exact: true })

test.describe.serial('event form demo', () => {
    let enrollmentId: string
    let eventId: string
    // A second visit the server should have refused; deleted too, should it have been taken.
    let rejectedEventId: string | undefined

    test.afterAll(async ({ playwright }) => {
        const events = [eventId, rejectedEventId].filter(Boolean)
        if (events.length === 0) {
            return
        }
        // Keep the enrollment reusable: the stage takes one visit only.
        const api = await createApi(playwright, ADMIN)
        // Per object: the refused visit was never created, and must not stop the delete.
        await api.post('/api/tracker', {
            params: {
                importStrategy: 'DELETE',
                atomicMode: 'OBJECT',
                async: false,
            },
            data: { events: events.map((event) => ({ event })) },
        })
        await api.dispose()
    })

    test('creates an ANC event with rules applied', async ({ page, dhis2 }) => {
        enrollmentId = await findEnrollmentWithoutVisit(dhis2)
        await page.goto(demoHash({ enrollmentId }))

        await page.getByRole('button', { name: 'New event' }).click()
        await page.getByRole('menuitem', { name: STAGE_NAME }).click()

        const panel = formPanel(page)
        await expect(answerGroup(page, CHRONIC.label)).toBeVisible()
        await expect(panel.getByText(CHRONIC_FOLLOW_UP.label)).toHaveCount(0)

        // Chronic conditions Yes -> its follow-ups appear.
        await answerGroup(page, CHRONIC.label)
            .getByRole('button', { name: 'Yes' })
            .click()
        await expect(
            panel.getByText(CHRONIC_FOLLOW_UP.label, { exact: true })
        ).toBeVisible()

        // LMP ten weeks before the visit (the report date defaults to today)
        // -> gestational age is assigned by a rule and locked.
        await textbox(page, LMP.label).fill(localIsoDate(70))
        await textbox(page, LMP.label).press('Tab')
        const gestationalAge = textbox(page, GESTATIONAL_AGE.label)
        await expect(gestationalAge).toHaveValue('10')
        await expect(gestationalAge).toBeDisabled()

        const request = await saveAndCaptureImport(
            page,
            page.getByRole('button', { name: 'Save', exact: true })
        )
        eventId = z
            .object({ events: z.array(z.object({ event: z.string() })) })
            .parse(request.postDataJSON()).events[0].event

        // onSaved returns to the list and says so.
        await expect(
            page
                .getByTestId('event-form-notice')
                .getByText('Saved', { exact: true })
        ).toBeVisible()
        await expect(
            page.getByRole('button', { name: 'New event' })
        ).toBeVisible()

        const stored = await readEvent(dhis2, eventId)
        expect(stored.enrollment).toBe(enrollmentId)
        expect(valueOf(stored, CHRONIC.id)).toBe('true')
        expect(valueOf(stored, LMP.id)).toBe(localIsoDate(70))
        expect(valueOf(stored, GESTATIONAL_AGE.id)).toBe('10')
        expect(stored.status).toBe('ACTIVE')
    })

    test('edits the event and round-trips values', async ({ page, dhis2 }) => {
        expect(eventId).toBeTruthy()
        const { firstName, lastName } = await personOf(dhis2, enrollmentId)
        await page.goto(demoHash({ enrollmentId, programStageId: STAGE }))

        // The list shows the stage's events; a row click opens one for editing.
        await page
            .getByRole('row')
            .filter({ hasText: firstName })
            .filter({ hasText: lastName })
            .getByRole('cell', { name: firstName, exact: true })
            .click()

        await expect(textbox(page, LMP.label)).toHaveValue(localIsoDate(70))
        await expect(textbox(page, GESTATIONAL_AGE.label)).toHaveValue('10')
        await expect(
            answerGroup(page, CHRONIC.label).getByRole('button', {
                name: 'Yes',
            })
        ).toHaveAttribute('aria-pressed', 'true')

        await answerGroup(page, SMOKING.label)
            .getByRole('button', { name: 'Yes' })
            .click()
        await saveAndCaptureImport(
            page,
            page.getByRole('button', { name: 'Save', exact: true })
        )
        await expect(
            page
                .getByTestId('event-form-notice')
                .getByText('Saved', { exact: true })
        ).toBeVisible()

        const stored = await readEvent(dhis2, eventId)
        expect(valueOf(stored, SMOKING.id)).toBe('true')
        expect(valueOf(stored, CHRONIC.id)).toBe('true')
        expect(valueOf(stored, GESTATIONAL_AGE.id)).toBe('10')
        expect(stored.status).toBe('ACTIVE')
    })

    test('clears a follow-up a rule hides, on the server too', async ({
        page,
        dhis2,
    }) => {
        expect(eventId).toBeTruthy()
        // A full load each time, so the form opens on the event as the server has it now.
        const openEvent = async () => {
            await page.goto(
                demoHash({
                    enrollmentId,
                    programStageId: STAGE,
                    eventId,
                    view: 'form',
                })
            )
            await page.reload()
            await expect(textbox(page, LMP.label)).toBeVisible()
        }

        // Chronic conditions is Yes, so its follow-ups show: answer one, with a note.
        await openEvent()
        await answerGroup(page, CHRONIC_FOLLOW_UP.label)
            .getByRole('button', { name: 'Yes' })
            .click()
        await page
            .getByLabel('Notes about this event')
            .fill('Follow-up answered')
        const answered = await saveAndCaptureImport(page, saveButton(page))
        await expect(savedNotice(page)).toBeVisible()
        const sent = postedEvent(answered)
        // An edit sends what changed only.
        expect(sent.dataValues).toEqual([
            { dataElement: CHRONIC_FOLLOW_UP.id, value: 'true' },
        ])
        expect(sent.notes).toEqual([
            { note: expect.stringMatching(UID), value: 'Follow-up answered' },
        ])
        const afterAnswer = await readEvent(dhis2, eventId)
        expect(valueOf(afterAnswer, CHRONIC_FOLLOW_UP.id)).toBe('true')
        expect(afterAnswer.notes).toEqual([
            expect.objectContaining(sent.notes[0]),
        ])

        // The same save again, as a retry after a lost response or an outbox replay would send
        // it: the event is imported, and its note is not added twice.
        const replay = await dhis2.post('/api/tracker', {
            params: {
                importStrategy: 'CREATE_AND_UPDATE',
                atomicMode: 'OBJECT',
                async: false,
            },
            data: answered.postDataJSON(),
        })
        expect(replay.ok()).toBe(true)
        expect((await readEvent(dhis2, eventId)).notes).toHaveLength(1)

        // Chronic conditions No: the rule hides the follow-ups, and the save clears the answer.
        await openEvent()
        await answerGroup(page, CHRONIC.label)
            .getByRole('button', { name: 'No' })
            .click()
        await expect(
            formPanel(page).getByText(CHRONIC_FOLLOW_UP.label, { exact: true })
        ).toHaveCount(0)
        const cleared = await saveAndCaptureImport(page, saveButton(page))
        await expect(savedNotice(page)).toBeVisible()
        expect(postedEvent(cleared).dataValues).toContainEqual({
            dataElement: CHRONIC_FOLLOW_UP.id,
            value: null,
        })

        const stored = await readEvent(dhis2, eventId)
        expect(valueOf(stored, CHRONIC.id)).toBe('false')
        expect(
            stored.dataValues.map(({ dataElement }) => dataElement)
        ).not.toContain(CHRONIC_FOLLOW_UP.id)
        // Values the edits did not touch are kept.
        expect(valueOf(stored, SMOKING.id)).toBe('true')
        expect(valueOf(stored, GESTATIONAL_AGE.id)).toBe('10')
    })

    test('shows the server rejecting a second visit to a stage that is not repeatable', async ({
        page,
        dhis2,
    }) => {
        expect(eventId).toBeTruthy()
        // A new event for the enrollment that already has its one first visit.
        await page.goto(
            demoHash({ enrollmentId, programStageId: STAGE, view: 'form' })
        )
        await answerGroup(page, SMOKING.label)
            .getByRole('button', { name: 'Yes' })
            .click()
        const request = await saveAndCaptureImport(page, saveButton(page))
        rejectedEventId = postedEvent(request).event

        const saveError = page.getByTestId('event-form-save-error')
        await expect(saveError).toBeVisible()
        await expect(saveError).toContainText('The event could not be saved')
        await expect(saveError).toContainText(/repeatable/i)
        // The form stays open with the answers, and nothing was created.
        await expect(
            answerGroup(page, SMOKING.label).getByRole('button', {
                name: 'Yes',
            })
        ).toHaveAttribute('aria-pressed', 'true')
        await expect(savedNotice(page)).toHaveCount(0)
        const lookup = await dhis2.get(`/api/tracker/events/${rejectedEventId}`)
        expect(lookup.status()).toBe(404)
    })

    test('has no axe violations', async ({ page }) => {
        expect(eventId).toBeTruthy()
        await page.goto(
            demoHash({
                enrollmentId,
                programStageId: STAGE,
                eventId,
                view: 'form',
            })
        )
        await expect(textbox(page, LMP.label)).toBeVisible()

        const accessibility = await new AxeBuilder({ page })
            .include('[data-testid="event-form-panel"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze()
        expect(
            accessibility.violations.filter((violation) =>
                ['serious', 'critical'].includes(violation.impact ?? '')
            )
        ).toEqual([])
    })

    test('completes the event', async ({ page, dhis2 }) => {
        expect(eventId).toBeTruthy()
        await page.goto(
            demoHash({
                enrollmentId,
                programStageId: STAGE,
                eventId,
                view: 'form',
            })
        )
        await expect(textbox(page, LMP.label)).toBeVisible()

        await saveAndCaptureImport(
            page,
            page.getByRole('button', { name: 'Complete', exact: true })
        )
        await expect(
            page
                .getByTestId('event-form-notice')
                .getByText('Saved', { exact: true })
        ).toBeVisible()

        const stored = await readEvent(dhis2, eventId)
        expect(stored.status).toBe('COMPLETED')
    })
})
