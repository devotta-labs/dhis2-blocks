import type { QueryClient } from '@tanstack/react-query'
import { Result } from 'better-result'
import React from 'react'
import {
    canUseEventForm,
    createEventFormClient,
    createOnlineEventWriter,
    EventForm,
    EventFormActions,
    EventFormDetails,
    EventFormFeedback,
    EventFormField,
    EventFormNotes,
    EventFormSection,
    EventFormSectionNav,
    EventFormSections,
    EventFormTextProvider,
    eventFormMutationKeys,
    registerEventFormMutations,
    useEventFormActions,
    useEventFormClient,
    useEventFormRules,
    useEventFormState,
    type DataEngineLike,
    type EventFormClient,
    type EventFormCommands,
    type EventFormProps,
    type EventFormReadOnlyReason,
    type EventFormRules,
    type EventFormSavedResult,
    type EventFormSectionProps,
    type EventFormState,
    type EventFormTranslate,
    type EventPayload,
    type EventStatus,
    type EventWriter,
    type RuleChange,
    type SaveError,
    type SaveOutcome,
    type Values,
} from '../src'
import type { EventFormApiError } from '../src/api/client'
import {
    useStageMetadata,
    useSystemCalendar,
    useTrackerEvent,
} from '../src/api/hooks'
import { eventFormKeys } from '../src/api/queries'
import type {
    DataElementMeta,
    Section,
    StageMetadata,
    SystemCalendar,
    TrackerEvent,
} from '../src/api/schemas'

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
        ? true
        : false
const assert = <T extends true>(): T | undefined => undefined

declare const metadata: StageMetadata
export const stageId: string = metadata.stage.id
export const sections: Section[] = metadata.stage.sections
export const element: DataElementMeta | undefined =
    metadata.dataElements.get('de0FEHSIoxh')
export const validationStrategy:
    | 'NONE'
    | 'ON_COMPLETE'
    | 'ON_UPDATE_AND_INSERT' = metadata.stage.validationStrategy
export const featureType: 'NONE' | 'POINT' | 'POLYGON' =
    metadata.stage.featureType
export const hasCategoryCombo: boolean = metadata.hasCategoryCombo

declare const event: TrackerEvent
export const status:
    | 'ACTIVE'
    | 'COMPLETED'
    | 'SCHEDULE'
    | 'OVERDUE'
    | 'SKIPPED'
    | 'VISITED' = event.status
export const firstValue: { dataElement: string; value: string } | undefined =
    event.dataValues[0]
export const noteText: string | undefined = event.notes[0]?.value
// @ts-expect-error A tracker event holds occurredAt, not the legacy eventDate.
export const legacyEventDate = event.eventDate

declare const calendar: SystemCalendar
export const dateFormat: 'YYYY-MM-DD' | 'DD-MM-YYYY' = calendar.dateFormat

export const keys = [
    eventFormKeys.stage('program00001', 'stage000001'),
    eventFormKeys.event('event000001'),
    eventFormKeys.systemInfo(),
]

export const stageQuery = useStageMetadata('program00001', 'stage000001')
export const eventQuery = useTrackerEvent(undefined)
export const calendarQuery = useSystemCalendar()
export const queryErrorIsTyped =
    assert<Equal<typeof stageQuery.error, EventFormApiError | null>>()

// The block's public entry point.
declare const eventFormProps: EventFormProps
export const formElement = React.createElement(EventForm, eventFormProps)
export const parts = [
    EventFormDetails,
    EventFormSectionNav,
    EventFormSections,
    EventFormNotes,
    EventFormFeedback,
    EventFormActions,
    EventFormTextProvider,
]
export const section = React.createElement(EventFormSection, {
    id: 'EzhVeTS7vx4',
} satisfies EventFormSectionProps)
export const field = React.createElement(EventFormField, { id: 'de0FEHSIoxh' })
export const savedOutcome: EventFormSavedResult['outcome'] = 'queued'
// @ts-expect-error onSaved reports saved or queued, nothing else.
export const unknownOutcome: EventFormSavedResult['outcome'] = 'failed'

export const readState = (): EventFormState => useEventFormState()
export const readCommands = (): EventFormCommands => useEventFormActions()
export const readRules = (): EventFormRules => useEventFormRules()
export const readOnlyReason: EventFormReadOnlyReason = 'skipped'
export const dirtyIsBoolean = assert<Equal<EventFormState['dirty'], boolean>>()
export const valuesAreStrings =
    assert<Equal<Values, Readonly<Record<string, string>>>>()
export const changeKinds =
    assert<Equal<RuleChange['kind'], 'cleared' | 'assigned'>>()
export const translate: EventFormTranslate = (message) => message
export const statuses: EventStatus = 'SCHEDULE'

export const queuedWriter: EventWriter = async (payload: EventPayload) =>
    payload.events[0].dataValues.length >= 0
        ? Result.ok({ outcome: 'queued' satisfies SaveOutcome })
        : Result.err({ kind: 'unknown', message: 'never' } satisfies SaveError)
export const registerWriter = (queryClient: QueryClient) => {
    registerEventFormMutations(queryClient, queuedWriter)
    return queryClient.getMutationDefaults(eventFormMutationKeys.save)
}
export const onlineWriter: typeof createOnlineEventWriter =
    createOnlineEventWriter
export const capability = canUseEventForm(metadata)
// A host builds the online writer from the app-runtime data engine through the hook;
// `createEventFormClient` takes any structural engine.
export const hostClient = (): EventFormClient => useEventFormClient()
export const hostWriter = (): EventWriter =>
    createOnlineEventWriter(hostClient())
export const engineIsStructural = (engine: DataEngineLike): EventFormClient =>
    createEventFormClient(engine)
// The README's outbox-style writer compiles against the public surface.
export const useOutboxWriter = (outbox: {
    add(payload: EventPayload): void
}) => {
    const client = useEventFormClient()
    return React.useMemo<EventWriter>(() => {
        const online = createOnlineEventWriter(client)
        return async (payload) => {
            const result = await online(payload)
            if (result.isErr() && result.error.kind === 'network') {
                outbox.add(payload)
                return Result.ok({ outcome: 'queued' })
            }
            return result
        }
    }, [client, outbox])
}
