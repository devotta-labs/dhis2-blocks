import { Result } from 'better-result'
import { page, userEvent } from 'vitest/browser'
import type { EventPayload } from '../../save/payload'
import type { EventWriter } from '../../save/writer'
import {
    answerGroup,
    answerSmokingYes,
    conflict,
    labelOf,
    lastEvent,
    RMNCH,
    renderEventForm,
    saveButton,
    UID,
} from './eventFormTestSupport'

/* What makes a save safe to send, repeat and report: only changes, one note, one person. */
describe('what an EventForm save sends and reports', () => {
    it('a server error on a question that is not shown is a form error', async () => {
        const orphan = 'Orph4nDE0x1'
        const hiddenFollowUp = RMNCH.chronicFollowUps[0]
        const writer: EventWriter = async () =>
            Result.err({
                kind: 'validation',
                fieldErrors: {
                    [orphan]: `Data element ${orphan} is not part of the stage`,
                    [hiddenFollowUp]: 'Not a valid value',
                },
                formErrors: [],
            })
        const { probe } = await renderEventForm({
            eventId: RMNCH.eventId,
            writer,
        })
        await answerSmokingYes()
        await saveButton().click()

        const alert = page.getByTestId('event-form-save-error')
        await expect
            .element(
                alert.getByText(
                    `Data element ${orphan} is not part of the stage`
                )
            )
            .toBeVisible()
        // Chronic conditions is No, so a rule hides this follow-up: its label says which it is.
        await expect
            .element(
                alert.getByText(`${labelOf(hiddenFollowUp)}: Not a valid value`)
            )
            .toBeVisible()
        await expect
            .element(
                alert.getByText('They are marked on their questions', {
                    exact: false,
                })
            )
            .not.toBeInTheDocument()
        expect(probe.state?.saveError).toEqual({
            kind: 'validation',
            fieldErrors: {},
            formErrors: [
                `Data element ${orphan} is not part of the stage`,
                `${labelOf(hiddenFollowUp)}: Not a valid value`,
            ],
        })
    })

    it('an edit sends only what changed: a value the stage no longer has is not resent', async () => {
        const orphan = {
            dataElement: 'Orph4nDE0x1',
            value: 'from an old stage',
        }
        const { payloads, onSaved } = await renderEventForm({
            eventId: RMNCH.eventId,
            event: (event) => ({
                ...event,
                dataValues: [...event.dataValues, orphan],
            }),
            // An importer that rejects data elements outside the stage.
            importEvent: async (payload) => {
                if (
                    payload.events[0].dataValues.some(
                        (value) => value.dataElement === orphan.dataElement
                    )
                ) {
                    throw conflict([
                        {
                            message: `Data element ${orphan.dataElement} is not part of the stage`,
                            args: [orphan.dataElement],
                        },
                    ])
                }
                return {
                    status: 'OK',
                    stats: {
                        created: 0,
                        updated: 1,
                        deleted: 0,
                        ignored: 0,
                        total: 1,
                    },
                    validationReport: { errorReports: [] },
                }
            },
        })
        await answerGroup(RMNCH.smoking)
            .getByRole('button', { name: 'No' })
            .click()
        await saveButton().click()

        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        const sent = lastEvent(payloads).dataValues
        expect(sent).not.toContainEqual(
            expect.objectContaining({ dataElement: orphan.dataElement })
        )
        expect(sent).toContainEqual({
            dataElement: RMNCH.smoking,
            value: 'false',
        })
        // Unchanged answers are not sent either.
        expect(sent).not.toContainEqual(
            expect.objectContaining({ dataElement: RMNCH.chronic })
        )
    })

    it('a retried save sends the same note uid; the next note gets a new one', async () => {
        const sent: EventPayload[] = []
        let release: () => void = () => undefined
        let outcome: 'network' | 'saved' = 'network'
        const writer: EventWriter = async (payload) => {
            sent.push(payload)
            await new Promise<void>((resolve) => {
                release = resolve
            })
            return outcome === 'network'
                ? Result.err({ kind: 'network', message: 'Failed to fetch' })
                : Result.ok({ outcome: 'saved' })
        }
        const { onSaved } = await renderEventForm({ writer })
        const notes = page.getByLabelText('Notes about this event')
        await userEvent.fill(notes, 'Referred to the clinic')

        await saveButton().click()
        await expect.poll(() => sent.length).toBe(1)
        release()
        await expect
            .element(page.getByText('Failed to fetch', { exact: false }))
            .toBeVisible()

        outcome = 'saved'
        await saveButton().click()
        await expect.poll(() => sent.length).toBe(2)
        release()
        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        const [first, retry] = sent.map((payload) => payload.events[0].notes)
        expect(first).toEqual([
            {
                note: expect.stringMatching(UID),
                value: 'Referred to the clinic',
            },
        ])
        expect(retry).toEqual(first)

        await userEvent.fill(notes, 'Second note')
        await saveButton().click()
        await expect.poll(() => sent.length).toBe(3)
        release()
        await expect.poll(() => onSaved.mock.calls.length).toBe(2)
        const next = sent[2]?.events[0].notes[0]
        expect(next?.note).toMatch(UID)
        expect(next?.note).not.toBe(first?.[0]?.note)
    })

    it('Cancel is disabled while a save is in flight', async () => {
        let release: () => void = () => undefined
        const writer: EventWriter = async () => {
            await new Promise<void>((resolve) => {
                release = resolve
            })
            return Result.ok({ outcome: 'saved' })
        }
        const { onSaved, onCancel, probe } = await renderEventForm({ writer })
        const cancel = page.getByRole('button', { name: 'Cancel', exact: true })
        await answerSmokingYes()
        await saveButton().click()

        await expect.element(cancel).toBeDisabled()
        probe.actions?.cancel()
        expect(onCancel).not.toHaveBeenCalled()
        await expect
            .element(page.getByRole('alertdialog'))
            .not.toBeInTheDocument()

        release()
        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        await expect.element(cancel).toBeEnabled()
        expect(onCancel).not.toHaveBeenCalled()
    })

    it('a new form for another enrollment drops the draft and its uid', async () => {
        const { probe, rerender, payloads, onSaved } = await renderEventForm()
        await answerSmokingYes()
        await userEvent.fill(
            page.getByLabelText('Notes about this event'),
            'About the first person'
        )
        const firstEventId = probe.state?.eventId
        expect(probe.state?.dirty).toBe(true)

        await rerender({ enrollmentId: 'Oth3rEnrol1' })

        await expect.poll(() => probe.state?.eventId).not.toBe(firstEventId)
        expect(probe.state?.eventId).toMatch(UID)
        expect(probe.state?.values[RMNCH.smoking]).toBeUndefined()
        expect(probe.state?.dirty).toBe(false)
        await expect
            .element(page.getByLabelText('Notes about this event'))
            .toHaveValue('')

        await answerGroup(RMNCH.smoking)
            .getByRole('button', { name: 'No' })
            .click()
        await saveButton().click()
        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(lastEvent(payloads)).toMatchObject({
            event: probe.state?.eventId,
            enrollment: 'Oth3rEnrol1',
            dataValues: [{ dataElement: RMNCH.smoking, value: 'false' }],
            notes: [],
        })
    })
})
