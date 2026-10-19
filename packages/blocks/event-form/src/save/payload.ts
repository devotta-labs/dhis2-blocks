import type { Values } from '../model/overlay'
import type { EventContext, EventStatus } from '../state/store'

interface TrackerEventPayload {
    event: string
    program: string
    programStage: string
    enrollment: string
    trackedEntity?: string
    orgUnit?: string
    status: EventStatus
    occurredAt?: string
    geometry?: { type: 'Point'; coordinates: [number, number] }
    dataValues: { dataElement: string; value: string | null }[]
    notes: { value: string }[]
}

export interface EventPayload {
    events: [TrackerEventPayload]
}

export interface BuildEventPayloadArgs {
    eventId: string
    programId: string
    programStageId: string
    enrollmentId: string
    trackedEntityId?: string
    status: EventStatus
    context: EventContext
    /** Stored values with rule effects applied. */
    effective: Values
    initialStored: Values
    noteDraft: string
    isNew: boolean
}

const DATE_PART = /^\d{4}-\d{2}-\d{2}/

/** `yyyy-MM-dd`; a date-time from an existing event loses its time. */
const toDate = (value: string) => DATE_PART.exec(value)?.[0] ?? value

/**
 * A plain JSON tracker payload. On edit, a value the user or a rule cleared is sent as
 * `null` so the importer deletes it; on create there is nothing to delete.
 */
export const buildEventPayload = (
    args: BuildEventPayloadArgs
): EventPayload => {
    const { context, effective, initialStored } = args
    const dataValues: TrackerEventPayload['dataValues'] = Object.entries(
        effective
    ).map(([dataElement, value]) => ({ dataElement, value }))
    if (!args.isNew) {
        for (const dataElement of Object.keys(initialStored)) {
            if (!(dataElement in effective)) {
                dataValues.push({ dataElement, value: null })
            }
        }
    }
    const note = args.noteDraft.trim()
    return {
        events: [
            {
                event: args.eventId,
                program: args.programId,
                programStage: args.programStageId,
                enrollment: args.enrollmentId,
                ...(args.trackedEntityId !== undefined && {
                    trackedEntity: args.trackedEntityId,
                }),
                ...(context.orgUnitId !== undefined && {
                    orgUnit: context.orgUnitId,
                }),
                status: args.status,
                ...(context.occurredAt !== undefined && {
                    occurredAt: toDate(context.occurredAt),
                }),
                ...(context.geometry !== undefined && {
                    geometry: context.geometry,
                }),
                dataValues,
                notes: note === '' ? [] : [{ value: note }],
            },
        ],
    }
}
