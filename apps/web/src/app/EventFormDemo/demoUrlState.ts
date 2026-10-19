import { z } from 'zod'

const IdSchema = z.string().min(1)

const EventFormDemoUrlStateSchema = z
    .object({
        programId: IdSchema.optional(),
        orgUnitId: IdSchema.optional(),
        enrollmentId: IdSchema.optional(),
        /** The stage whose events the list shows and whose form is open. */
        programStageId: IdSchema.optional(),
        /** The event being edited. Absent for a new event. */
        eventId: IdSchema.optional(),
        /** `form` opens the event form instead of the list. */
        view: z.literal('form').optional(),
    })
    .strict()

export type EventFormDemoUrlState = z.infer<typeof EventFormDemoUrlStateSchema>

const KEYS = [
    'programId',
    'orgUnitId',
    'enrollmentId',
    'programStageId',
    'eventId',
    'view',
] as const

/** A tampered or stale URL falls back to an empty context. */
export const parseEventFormDemoUrlState = (
    parameters: URLSearchParams
): EventFormDemoUrlState => {
    const candidate = Object.fromEntries(
        KEYS.flatMap((key) => {
            const value = parameters.get(key)
            return value ? [[key, value]] : []
        })
    )
    const parsed = EventFormDemoUrlStateSchema.safeParse(candidate)
    if (!parsed.success) {
        return {}
    }
    const { view, programStageId, ...rest } = parsed.data
    // A form needs its stage; an event id is only meaningful in a form.
    return view === 'form' && programStageId
        ? { ...rest, programStageId, view }
        : { ...rest, programStageId, eventId: undefined }
}

export const serializeEventFormDemoUrlState = (
    state: EventFormDemoUrlState
) => {
    const validated = EventFormDemoUrlStateSchema.parse(state)
    const parameters = new URLSearchParams()
    for (const key of KEYS) {
        const value = validated[key]
        if (value !== undefined) {
            parameters.set(key, value)
        }
    }
    return parameters.toString()
}

/** Changing the program drops everything chosen under it. */
export const withProgram = (
    state: EventFormDemoUrlState,
    programId?: string
): EventFormDemoUrlState => ({ orgUnitId: state.orgUnitId, programId })

/** A new org unit means a new set of enrollments. */
export const withOrgUnit = (
    state: EventFormDemoUrlState,
    orgUnitId?: string
): EventFormDemoUrlState => ({ programId: state.programId, orgUnitId })

export const withEnrollment = (
    state: EventFormDemoUrlState,
    enrollmentId?: string
): EventFormDemoUrlState => ({
    programId: state.programId,
    orgUnitId: state.orgUnitId,
    programStageId: state.programStageId,
    enrollmentId,
})

export const withStage = (
    state: EventFormDemoUrlState,
    programStageId?: string
): EventFormDemoUrlState => ({
    programId: state.programId,
    orgUnitId: state.orgUnitId,
    enrollmentId: state.enrollmentId,
    programStageId,
})

/** Open the form for a new event, or for `eventId` when given. */
export const withForm = (
    state: EventFormDemoUrlState,
    form: { programStageId: string; eventId?: string; enrollmentId?: string }
): EventFormDemoUrlState => ({
    programId: state.programId,
    orgUnitId: state.orgUnitId,
    enrollmentId: form.enrollmentId ?? state.enrollmentId,
    programStageId: form.programStageId,
    eventId: form.eventId,
    view: 'form',
})

/** Back to the list, still on the same stage. */
export const withoutForm = (
    state: EventFormDemoUrlState
): EventFormDemoUrlState => withStage(state, state.programStageId)
