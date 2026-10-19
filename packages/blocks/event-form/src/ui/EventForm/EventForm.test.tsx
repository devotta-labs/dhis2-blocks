import { page, userEvent } from 'vitest/browser'
import { eventFormKeys } from '../../api/queries'
import {
    answerGroup,
    labelOf,
    lastEvent,
    RMNCH,
    renderEventForm,
    textbox,
    today,
    valueSent,
} from './eventFormTestSupport'

const followUpLabel = (id: string) =>
    page.getByText(labelOf(id), { exact: true })

describe('EventForm with RMNCH program rules', () => {
    it('answering Chronic conditions Yes shows its 6 follow-ups', async () => {
        await renderEventForm()
        for (const id of RMNCH.chronicFollowUps) {
            await expect.element(followUpLabel(id)).not.toBeInTheDocument()
        }

        await answerGroup(RMNCH.chronic)
            .getByRole('button', { name: 'Yes' })
            .click()

        for (const id of RMNCH.chronicFollowUps) {
            await expect.element(followUpLabel(id)).toBeVisible()
        }
    })

    it('LMP date assigns gestational age and locks it', async () => {
        const { probe } = await renderEventForm({ eventId: RMNCH.eventId })
        // The visit is on 2026-03-12: ten weeks after 2026-01-01.
        await userEvent.fill(textbox(RMNCH.lmp), '2026-01-01')
        await userEvent.tab()

        const gestationalAge = textbox(RMNCH.gestationalAge)
        await expect.element(gestationalAge).toHaveValue('10')
        await expect.element(gestationalAge).toBeDisabled()
        await expect
            .element(page.getByText('Calculated by a program rule'))
            .toBeVisible()
        expect(probe.state?.values[RMNCH.gestationalAge]).toBe('10')
    })

    it('LMP after visit date shows the rule error and blocks Save', async () => {
        const { payloads } = await renderEventForm({
            eventId: RMNCH.eventId,
            // RMNCH checks only when completing; this stage checks on every save.
            stage: (stage) => ({
                ...stage,
                programStages: stage.programStages.map((programStage) => ({
                    ...programStage,
                    validationStrategy: 'ON_UPDATE_AND_INSERT',
                })),
            }),
        })
        await userEvent.fill(textbox(RMNCH.lmp), '2026-04-01')
        await userEvent.tab()
        await expect
            .element(
                page.getByText(
                    'LMP date entered is after the date of the antenatal care visit.'
                )
            )
            .toBeVisible()

        await page.getByRole('button', { name: 'Save', exact: true }).click()

        await expect.element(textbox(RMNCH.lmp)).toHaveFocus()
        expect(payloads).toHaveLength(0)
    })

    it('under ON_COMPLETE the LMP rule error blocks Complete but not Save', async () => {
        const { payloads, onSaved } = await renderEventForm({
            eventId: RMNCH.eventId,
        })
        await userEvent.fill(textbox(RMNCH.lmp), '2026-04-01')
        await userEvent.tab()

        await page
            .getByRole('button', { name: 'Complete', exact: true })
            .click()
        await expect.element(textbox(RMNCH.lmp)).toHaveFocus()
        expect(payloads).toHaveLength(0)

        // Focus opened the date picker; a click outside closes it.
        const backdrop = document.querySelector(
            '[data-test="dhis2-uicore-layer"] .backdrop'
        )
        if (backdrop !== null) {
            await userEvent.click(backdrop)
        }
        await page.getByRole('button', { name: 'Save', exact: true }).click()
        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(lastEvent(payloads).status).toBe('ACTIVE')
    })

    it('editing an event a rule would change opens clean and shows the notice', async () => {
        const { probe, payloads, onSaved } = await renderEventForm({
            eventId: RMNCH.eventId,
        })
        // Chronic conditions is No in the fixture, yet its follow-ups hold answers.
        expect(probe.state?.dirty).toBe(false)
        const notice = page.getByTestId('event-form-rule-notice')
        // The six follow-ups, and the aspirin question: its rule reads three of them, and sees
        // them empty once they are cleared.
        await expect
            .element(notice)
            .toHaveTextContent(
                '7 values will be changed by program rules when you save'
            )
        for (const id of RMNCH.chronicFollowUps) {
            await expect
                .element(
                    notice.getByText(
                        `${labelOf(id)} will be cleared by the rule "Hide all fields for chronic conitions unless the w"`
                    )
                )
                .toBeVisible()
        }
        await expect
            .element(
                notice.getByText(
                    `${labelOf(RMNCH.aspirin)} will be cleared by the rule "Hide field for treatment of aspirin"`
                )
            )
            .toBeVisible()

        await page.getByRole('button', { name: 'Save', exact: true }).click()

        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(onSaved).toHaveBeenCalledWith({
            eventId: RMNCH.eventId,
            outcome: 'saved',
        })
        for (const id of [...RMNCH.chronicFollowUps, RMNCH.aspirin]) {
            expect(valueSent(payloads, id)).toEqual({
                dataElement: id,
                value: null,
            })
        }
        expect(valueSent(payloads, RMNCH.chronic)).toEqual({
            dataElement: RMNCH.chronic,
            value: 'false',
        })
        // The form now holds what was saved: clean, and nothing left for the notice.
        await expect.element(notice).not.toBeInTheDocument()
        expect(probe.state?.dirty).toBe(false)
    })

    it('a new event shows no rule notice', async () => {
        await renderEventForm()
        await answerGroup(RMNCH.chronic)
            .getByRole('button', { name: 'Yes' })
            .click()
        await answerGroup(RMNCH.chronicFollowUps[0])
            .getByRole('button', { name: 'Yes' })
            .click()
        await answerGroup(RMNCH.chronic)
            .getByRole('button', { name: 'No' })
            .click()
        await expect
            .element(page.getByTestId('event-form-rule-notice'))
            .not.toBeInTheDocument()
    })
})

describe('EventForm lifecycle', () => {
    it('scheduled event becomes ACTIVE on first answer', async () => {
        const { probe, payloads, onSaved } = await renderEventForm({
            eventId: RMNCH.eventId,
            event: ({ occurredAt: _occurred, ...event }) => ({
                ...event,
                status: 'SCHEDULE',
                dataValues: [],
            }),
        })
        expect(probe.state?.status).toBe('SCHEDULE')

        await answerGroup(RMNCH.smoking)
            .getByRole('button', { name: 'Yes' })
            .click()

        await expect.poll(() => probe.state?.status).toBe('ACTIVE')
        await expect
            .element(page.getByRole('textbox', { name: 'Date of visit' }))
            .toHaveValue(today())

        await page.getByRole('button', { name: 'Save', exact: true }).click()
        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(lastEvent(payloads)).toMatchObject({
            status: 'ACTIVE',
            occurredAt: today(),
        })
    })

    it('a refetched event does not replace what is being edited', async () => {
        const { probe, queryClient } = await renderEventForm({
            eventId: RMNCH.eventId,
        })
        await answerGroup(RMNCH.smoking)
            .getByRole('button', { name: 'No' })
            .click()
        await queryClient.refetchQueries({
            queryKey: eventFormKeys.event(RMNCH.eventId),
        })
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(probe.state?.values[RMNCH.smoking]).toBe('false')
        expect(probe.state?.dirty).toBe(true)
        await expect
            .element(
                answerGroup(RMNCH.smoking).getByRole('button', { name: 'No' })
            )
            .toHaveAttribute('aria-pressed', 'true')
    })

    it('skipped event is read-only', async () => {
        const { probe } = await renderEventForm({
            eventId: RMNCH.eventId,
            event: (event) => ({ ...event, status: 'SKIPPED' }),
        })
        await expect
            .element(page.getByText('This event was skipped', { exact: false }))
            .toBeVisible()
        expect(probe.state?.readOnly).toBe(true)
        await expect
            .element(
                answerGroup(RMNCH.smoking).getByRole('button', { name: 'Yes' })
            )
            .toBeDisabled()
        await expect
            .element(page.getByRole('textbox', { name: 'Date of visit' }))
            .toBeDisabled()
        await expect
            .element(page.getByLabelText('Notes about this event'))
            .toBeDisabled()
        await expect
            .element(page.getByRole('button', { name: 'Save', exact: true }))
            .not.toBeInTheDocument()
        await expect
            .element(
                page.getByRole('button', { name: 'Complete', exact: true })
            )
            .not.toBeInTheDocument()
        await expect
            .element(page.getByRole('button', { name: 'Cancel', exact: true }))
            .toBeVisible()
    })

    it('a completed event of a stage that blocks entry opens read-only', async () => {
        const { probe } = await renderEventForm({
            eventId: RMNCH.eventId,
            event: (event) => ({ ...event, status: 'COMPLETED' }),
        })
        expect(probe.state?.readOnlyReason).toBe('completed')
        await expect
            .element(
                page.getByText('This event is completed', { exact: false })
            )
            .toBeVisible()
        await expect
            .element(page.getByRole('button', { name: 'Save', exact: true }))
            .not.toBeInTheDocument()
    })

    it('a completed event of a stage that allows entry stays editable', async () => {
        const { probe } = await renderEventForm({
            eventId: RMNCH.eventId,
            event: (event) => ({ ...event, status: 'COMPLETED' }),
            stage: (stage) => ({
                ...stage,
                programStages: stage.programStages.map((programStage) => ({
                    ...programStage,
                    blockEntryForm: false,
                })),
            }),
        })
        expect(probe.state?.readOnly).toBe(false)
        await expect
            .element(page.getByRole('button', { name: 'Save', exact: true }))
            .toBeVisible()
    })

    it('a new event defaults the report date to today and the org unit to the prop', async () => {
        const { probe } = await renderEventForm()
        await expect
            .element(page.getByRole('textbox', { name: 'Date of visit' }))
            .toHaveValue(today())
        await expect.element(page.getByText('Kolisokor MCHP')).toBeVisible()
        expect(probe.state?.isNew).toBe(true)
        expect(probe.state?.eventId).toMatch(/^[A-Za-z][A-Za-z0-9]{10}$/)
        expect(probe.state?.dirty).toBe(false)
    })
})
