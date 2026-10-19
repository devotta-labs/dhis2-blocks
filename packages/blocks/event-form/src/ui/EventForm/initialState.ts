import type { RuleEventInput } from '@/registry/program-rules/use-program-rules'
import type { TrackerEvent } from '../../api/schemas'
import type { Values } from '../../model/overlay'
import type {
    EventContext,
    EventFormStoreInit,
    EventStatus,
} from '../../state/store'

/** Field ids of the context fields in `EventFormDetails`; data element ids never start with `_`. */
export const CONTEXT_FIELD_IDS = {
    occurredAt: '__occurredAt',
    orgUnitId: '__orgUnit',
    geometry: '__geometry',
} as const

/** Local `yyyy-MM-dd`: the report date a new or scheduled event gets. */
export const todayIso = (now = new Date()) => {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const DATE_PART = /^\d{4}-\d{2}-\d{2}/

const datePart = (value: string | undefined) =>
    value === undefined ? undefined : (DATE_PART.exec(value)?.[0] ?? value)

/** An event waiting for data: the first value entered makes it ACTIVE. */
export const isScheduled = (status: EventStatus) =>
    status === 'SCHEDULE' || status === 'OVERDUE'

interface NewEventArgs {
    eventId: string
    orgUnitId: string
}

/** The store's opened state for an event that does not exist yet. */
export const newEventInit = ({
    eventId,
    orgUnitId,
}: NewEventArgs): EventFormStoreInit => ({
    eventId,
    isNew: true,
    stored: {},
    context: { occurredAt: todayIso(), orgUnitId },
    status: 'ACTIVE',
})

/** The store's opened state for a loaded event: a snapshot, taken once per form instance. */
export const loadedEventInit = (event: TrackerEvent): EventFormStoreInit => {
    const stored: Record<string, string> = {}
    for (const { dataElement, value } of event.dataValues) {
        if (value !== '') {
            stored[dataElement] = value
        }
    }
    const context: EventContext = { orgUnitId: event.orgUnit }
    const occurredAt = datePart(event.occurredAt)
    if (occurredAt !== undefined) {
        context.occurredAt = occurredAt
    }
    if (event.geometry?.type === 'Point') {
        context.geometry = event.geometry
    }
    return {
        eventId: event.event,
        isNew: false,
        stored,
        context,
        status: event.status,
    }
}

const COORDINATE = /^\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]$/

/** `[longitude,latitude]`, as the coordinate widget commits it, to a Point geometry. */
export const toGeometry = (
    value: string | undefined
): EventContext['geometry'] => {
    const match = value === undefined ? null : COORDINATE.exec(value)
    return match === null
        ? undefined
        : { type: 'Point', coordinates: [Number(match[1]), Number(match[2])] }
}

export const fromGeometry = (geometry: EventContext['geometry']) =>
    geometry === undefined
        ? undefined
        : `[${geometry.coordinates[0]},${geometry.coordinates[1]}]`

interface RuleEventArgs {
    eventId: string
    programStageId: string
    scheduledAt: string | undefined
    values: Values
    context: EventContext
    status: EventStatus
}

/** The current event as the rule engine reads it. */
export const toRuleEvent = (args: RuleEventArgs): RuleEventInput => {
    const event: RuleEventInput = {
        id: args.eventId,
        programStageId: args.programStageId,
        orgUnitId: args.context.orgUnitId ?? '',
        status: args.status,
        dataValues: { ...args.values },
    }
    if (args.context.occurredAt !== undefined) {
        event.occurredAt = args.context.occurredAt
    }
    if (args.scheduledAt !== undefined) {
        event.scheduledAt = args.scheduledAt
    }
    return event
}
