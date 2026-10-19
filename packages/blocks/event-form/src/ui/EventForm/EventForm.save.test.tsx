import { Result } from 'better-result'
import { page, userEvent } from 'vitest/browser'
import type { EventPayload } from '../../save/payload'
import {
    eventFormMutationKeys,
    registerEventFormMutations,
} from '../../save/useSaveEvent'
import type { EventWriter } from '../../save/writer'
import {
    answerGroup,
    answerSmokingYes,
    conflict,
    formLevelRule,
    lastEvent,
    RMNCH,
    renderEventForm,
    saveButton,
    testQueryClient,
    today,
    UID,
} from './eventFormTestSupport'

describe('saving an EventForm', () => {
    it('Save on a new event posts the payload and calls onSaved with saved', async () => {
        const { payloads, onSaved, probe } = await renderEventForm()
        await answerSmokingYes()
        await userEvent.fill(
            page.getByLabelText('Notes about this event'),
            'First visit'
        )
        expect(probe.state?.dirty).toBe(true)

        await saveButton().click()

        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        const event = lastEvent(payloads)
        expect(event.event).toMatch(UID)
        expect(event).toEqual({
            event: event.event,
            program: RMNCH.programId,
            programStage: RMNCH.stageId,
            enrollment: RMNCH.enrollmentId,
            orgUnit: RMNCH.orgUnitId,
            status: 'ACTIVE',
            occurredAt: today(),
            dataValues: [{ dataElement: RMNCH.smoking, value: 'true' }],
            notes: [{ note: expect.stringMatching(UID), value: 'First visit' }],
        })
        expect(onSaved).toHaveBeenCalledWith({
            eventId: event.event,
            outcome: 'saved',
        })
        expect(probe.state?.dirty).toBe(false)
        expect(probe.state?.isNew).toBe(false)
        await expect
            .element(page.getByLabelText('Notes about this event'))
            .toHaveValue('')
        // The saved note is listed, though there is no event to refetch it from.
        await expect
            .element(
                page.getByRole('listitem').filter({ hasText: 'First visit' })
            )
            .toBeVisible()
    })

    it('queued writer calls onSaved with queued', async () => {
        const writes: EventPayload[] = []
        const writer: EventWriter = async (payload) => {
            writes.push(payload)
            return Result.ok({ outcome: 'queued' })
        }
        const { onSaved, payloads } = await renderEventForm({ writer })
        await answerSmokingYes()
        await saveButton().click()

        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(onSaved).toHaveBeenCalledWith({
            eventId: writes[0]?.events[0].event,
            outcome: 'queued',
        })
        // The writer replaced the online one: nothing reached the server.
        expect(payloads).toHaveLength(0)
    })

    it('a double click posts once, and a retry after a network error posts the same event uid', async () => {
        const writes: string[] = []
        let release: () => void = () => undefined
        let outcome: 'network' | 'saved' = 'network'
        const writer: EventWriter = async ({ events }) => {
            writes.push(events[0].event)
            await new Promise<void>((resolve) => {
                release = resolve
            })
            return outcome === 'network'
                ? Result.err({ kind: 'network', message: 'Failed to fetch' })
                : Result.ok({ outcome: 'saved' })
        }
        const { onSaved, probe } = await renderEventForm({ writer })
        await answerSmokingYes()

        await saveButton().click()
        await expect.poll(() => writes.length).toBe(1)
        await expect.element(saveButton()).toBeDisabled()
        // Nothing can be answered while the save is in flight.
        await expect
            .element(
                answerGroup(RMNCH.smoking).getByRole('button', { name: 'No' })
            )
            .toBeDisabled()
        saveButton().element().dispatchEvent(new MouseEvent('click'))
        await probe.actions?.save()
        expect(writes).toHaveLength(1)

        release()
        await expect
            .element(page.getByText('Failed to fetch', { exact: false }))
            .toBeVisible()
        expect(onSaved).not.toHaveBeenCalled()
        expect(probe.state?.dirty).toBe(true)

        outcome = 'saved'
        await saveButton().click()
        await expect.poll(() => writes.length).toBe(2)
        release()
        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(writes[1]).toBe(writes[0])
        expect(writes[0]).toBe(probe.state?.eventId)

        // Saving again after the event exists updates it under the same uid.
        await answerGroup(RMNCH.smoking)
            .getByRole('button', { name: 'Yes' })
            .click()
        await saveButton().click()
        await expect.poll(() => writes.length).toBe(3)
        release()
        await expect.poll(() => onSaved.mock.calls.length).toBe(2)
        expect(writes[2]).toBe(writes[0])
    })

    it('server field error appears on the field', async () => {
        const { onSaved, probe, payloads } = await renderEventForm({
            eventId: RMNCH.eventId,
            importEvent: async () => {
                throw conflict([
                    {
                        message: "Value 'RETIRED' is not a valid option",
                        args: ['RETIRED', RMNCH.smoking],
                    },
                    {
                        message: 'Event is outside the expiry period',
                        args: [],
                    },
                ])
            },
        })
        // An edit sends what changed, and the server rejects what it was sent.
        await answerGroup(RMNCH.smoking)
            .getByRole('button', { name: 'No' })
            .click()

        await saveButton().click()

        const message = page.getByText("Value 'RETIRED' is not a valid option")
        await expect.element(message).toBeVisible()
        await expect
            .element(
                page
                    .getByTestId('event-form-save-error')
                    .getByText('Event is outside the expiry period')
            )
            .toBeVisible()
        await expect
            .element(
                page
                    .getByTestId('event-form-save-error')
                    .getByText('They are marked on their questions', {
                        exact: false,
                    })
            )
            .toBeVisible()
        await expect
            .element(
                answerGroup(RMNCH.smoking).getByRole('button', { name: 'Yes' })
            )
            .toHaveFocus()
        expect(onSaved).not.toHaveBeenCalled()
        expect(probe.state?.saveError?.kind).toBe('validation')
        expect(lastEvent(payloads).dataValues).toContainEqual({
            dataElement: RMNCH.smoking,
            value: 'false',
        })

        // Answering the field again clears its server error.
        await answerGroup(RMNCH.smoking)
            .getByRole('button', { name: 'Yes' })
            .click()
        await expect.element(message).not.toBeInTheDocument()
    })

    it('Cancel with changes asks to discard', async () => {
        const { onCancel, probe } = await renderEventForm()
        const cancel = page.getByRole('button', { name: 'Cancel', exact: true })

        await cancel.click()
        expect(onCancel).toHaveBeenCalledTimes(1)

        await answerSmokingYes()
        await cancel.click()
        const dialog = page.getByRole('alertdialog')
        await expect.element(dialog.getByText('Discard changes?')).toBeVisible()
        await dialog.getByRole('button', { name: 'Keep editing' }).click()
        await expect.element(dialog).not.toBeInTheDocument()
        expect(onCancel).toHaveBeenCalledTimes(1)
        expect(probe.state?.dirty).toBe(true)

        await cancel.click()
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Discard' })
            .click()
        expect(onCancel).toHaveBeenCalledTimes(2)
        expect(probe.state?.dirty).toBe(false)
    })

    it('Complete posts COMPLETED and, with a warning on complete, asks first', async () => {
        const { payloads, onSaved, probe } = await renderEventForm({
            eventId: RMNCH.eventId,
            rules: (rules) => ({
                programRules: [
                    ...rules.programRules,
                    {
                        id: 'warnComplet',
                        name: 'Warn when completing',
                        displayName: 'Warn when completing',
                        condition: 'true',
                        programRuleActions: [
                            {
                                id: 'warnAction1',
                                programRuleActionType: 'WARNINGONCOMPLETE',
                                dataElement: { id: RMNCH.smoking },
                                content: 'Check smoking before completing',
                                displayContent:
                                    'Check smoking before completing',
                            },
                        ],
                    },
                ],
            }),
        })
        const complete = page.getByRole('button', {
            name: 'Complete',
            exact: true,
        })

        await complete.click()
        const dialog = page.getByRole('alertdialog')
        await expect.element(dialog.getByText('Complete anyway?')).toBeVisible()
        await dialog.getByRole('button', { name: 'Go back' }).click()
        expect(payloads).toHaveLength(0)

        await complete.click()
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Complete anyway' })
            .click()

        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(lastEvent(payloads).status).toBe('COMPLETED')
        // RMNCH blocks entry into completed events.
        await expect.poll(() => probe.state?.readOnlyReason).toBe('completed')
        await expect.element(saveButton()).not.toBeInTheDocument()
    })

    it('Complete on a scheduled event needs a report date', async () => {
        const { payloads, onSaved, probe } = await renderEventForm({
            eventId: RMNCH.eventId,
            event: ({ occurredAt: _occurred, ...event }) => ({
                ...event,
                status: 'SCHEDULE',
            }),
        })
        const complete = page.getByRole('button', {
            name: 'Complete',
            exact: true,
        })
        // Saving a scheduled event keeps it scheduled, so it needs no report date.
        expect(probe.state?.validation.isValid).toBe(true)

        await complete.click()
        await expect
            .poll(() => probe.state?.validation.failedFieldIds)
            .toContain('__occurredAt')
        expect(payloads).toHaveLength(0)
        const reportDate = page.getByRole('textbox', { name: 'Date of visit' })
        await expect.element(reportDate).toHaveFocus()

        await userEvent.fill(reportDate, '2026-03-14')
        await userEvent.tab()
        await complete.click()
        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(lastEvent(payloads)).toMatchObject({
            status: 'COMPLETED',
            occurredAt: '2026-03-14',
        })
    })
})

describe('the writer an EventForm saves with', () => {
    const queuedWriter =
        (writes: string[]): EventWriter =>
        async ({ events }) => {
            writes.push(events[0].event)
            return Result.ok({ outcome: 'queued' })
        }

    it('a writer prop serves its own form only: a later form without one posts to /tracker', async () => {
        const queryClient = testQueryClient()
        const queued: string[] = []
        const writer = queuedWriter(queued)
        const first = await renderEventForm({ queryClient, writer })
        await answerSmokingYes()
        await saveButton().click()
        await expect.poll(() => first.onSaved.mock.calls.length).toBe(1)
        expect(first.onSaved).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'queued' })
        )
        expect(first.payloads).toHaveLength(0)
        expect(
            queryClient.getMutationDefaults(eventFormMutationKeys.save)
                .mutationFn
        ).not.toBe(writer)
        await first.screen.unmount()

        const second = await renderEventForm({ queryClient })
        await answerSmokingYes()
        await saveButton().click()
        await expect.poll(() => second.onSaved.mock.calls.length).toBe(1)
        expect(second.onSaved).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'saved' })
        )
        // The online default was registered by the first form, so it posts through the first
        // form's data engine; an app has one engine, so it is the same /tracker either way.
        expect([...first.payloads, ...second.payloads]).toHaveLength(1)
        expect(queued).toHaveLength(1)
    })

    it('a form without a writer prop uses the writer the host registered, and keeps it', async () => {
        const queryClient = testQueryClient()
        const hostWrites: string[] = []
        const hostWriter = queuedWriter(hostWrites)
        registerEventFormMutations(queryClient, hostWriter)
        const { onSaved, payloads } = await renderEventForm({ queryClient })
        await answerSmokingYes()
        await saveButton().click()

        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(onSaved).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: 'queued' })
        )
        expect(hostWrites).toHaveLength(1)
        expect(payloads).toHaveLength(0)
        expect(
            queryClient.getMutationDefaults(eventFormMutationKeys.save)
                .mutationFn
        ).toBe(hostWriter)
    })
})

describe('form-level program rule errors', () => {
    const ruleErrors = () => page.getByTestId('event-form-rule-errors')

    it('a form-level error blocks Save under ON_UPDATE_AND_INSERT', async () => {
        const { payloads, probe } = await renderEventForm({
            stage: (stage) => ({
                ...stage,
                programStages: stage.programStages.map((programStage) => ({
                    ...programStage,
                    validationStrategy: 'ON_UPDATE_AND_INSERT',
                })),
            }),
            rules: (rules) => ({
                programRules: [
                    ...rules.programRules,
                    formLevelRule('SHOWERROR', 'This event is not allowed'),
                ],
            }),
        })
        await answerSmokingYes()
        await saveButton().click()

        await expect
            .element(ruleErrors().getByText('This event is not allowed'))
            .toBeVisible()
        expect(payloads).toHaveLength(0)
        expect(probe.state?.validation.isValid).toBe(false)
        expect(probe.state?.validation.failedFieldIds).toEqual([])
    })

    it('a form-level error on complete blocks Complete but not Save', async () => {
        const { payloads, onSaved } = await renderEventForm({
            rules: (rules) => ({
                programRules: [
                    ...rules.programRules,
                    formLevelRule(
                        'ERRORONCOMPLETE',
                        'Record the outcome before completing'
                    ),
                ],
            }),
        })
        await answerSmokingYes()
        await page
            .getByRole('button', { name: 'Complete', exact: true })
            .click()

        await expect
            .element(
                ruleErrors().getByText('Record the outcome before completing')
            )
            .toBeVisible()
        expect(payloads).toHaveLength(0)

        await saveButton().click()
        await expect.poll(() => onSaved.mock.calls.length).toBe(1)
        expect(lastEvent(payloads).status).toBe('ACTIVE')
    })
})
