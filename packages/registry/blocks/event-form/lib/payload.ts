import { storedDay } from '@/components/dhis2-value-display'
import type { RuleEventStatus } from '@/components/program-rules'
import { sentGeometry } from './location'
import type { FeatureType, HeldEvent, Values } from './metadata'

export const IMPORT_PARAMS = {
    async: false,
    importStrategy: 'CREATE_AND_UPDATE',
    atomicMode: 'ALL',
}

export interface PayloadInput {
    eventId: string
    programId: string
    programStageId: string
    /** For a new event; an edit keeps the event's own. */
    orgUnitId: string
    enrollmentId?: string
    trackedEntityId?: string
    held?: HeldEvent
    eventDate: string
    status: RuleEventStatus
    effective: Values
    /** The effective values DHIS2 may hold: as opened or last saved, with those of a save the form stopped waiting for. */
    opened: Values
    /** The chosen option of each category of a non-default combination, in order; absent for the default one. */
    categoryOptions?: readonly string[]
    /**
     * The event's geometry as the form holds it (GeoJSON written out), now and as DHIS2 may hold it, with the stage's
     * feature type; absent for a stage that records no location.
     */
    location?: { now?: string; opened?: string; featureType: FeatureType }
    /** A note to add, with the id made for it; absent or blank adds none. */
    note?: { id: string; text: string }
}

interface TrackerEventPayload extends Omit<
    Partial<HeldEvent>,
    'dataValues' | 'geometry' | 'notes'
> {
    geometry?: HeldEvent['geometry'] | null
    event: string
    program: string
    programStage: string
    orgUnit: string
    trackedEntity?: string
    occurredAt: string
    status: RuleEventStatus
    dataValues: Array<{ dataElement: string; value: string | null }>
    notes?: Array<{ note: string; value: string }>
}

interface TrackerPayload {
    events: [TrackerEventPayload]
}

/**
 * One event for a tracker import. An edit sends the event's own fields back as held, as an update replaces them.
 * Data values merge, so every effective value is sent, and `null` deletes one that was there when opened.
 * Chosen category options go as `attributeCategoryOptions`, from which DHIS2 finds the attribute option combo, so the
 * held combo is left out: it would contradict a changed choice.
 * A stage's location goes as GeoJSON of the stage's feature type, an area as a multi-polygon of one part to a
 * `MULTI_POLYGON` stage, and `null` deletes one that was there; a stored one the form cannot read goes back as it is.
 * Notes are only added: the held ones are never sent back, and a typed note goes with the id made for it, so sending
 * it again adds it once.
 */
export const eventPayload = ({
    eventId,
    programId,
    programStageId,
    orgUnitId,
    enrollmentId,
    trackedEntityId,
    held,
    eventDate,
    status,
    effective,
    opened,
    categoryOptions,
    location,
    note,
}: PayloadInput) => {
    const event: Omit<
        TrackerEventPayload,
        'occurredAt' | 'status' | 'dataValues'
    > = held ?? {
        event: eventId,
        program: programId,
        programStage: programStageId,
        orgUnit: orgUnitId,
        ...(enrollmentId !== undefined && { enrollment: enrollmentId }),
        ...(trackedEntityId !== undefined && {
            trackedEntity: trackedEntityId,
        }),
    }
    const { notes: _stored, ...sent } = event
    const {
        attributeOptionCombo: _held,
        attributeCategoryOptions: _heldOptions,
        ...rest
    } = sent
    const chosen =
        categoryOptions === undefined
            ? sent
            : { ...rest, attributeCategoryOptions: categoryOptions.join(',') }
    const geometry =
        location?.now === undefined
            ? null
            : sentGeometry(location.now, location.featureType)
    let own: Omit<TrackerEventPayload, 'occurredAt' | 'status' | 'dataValues'> =
        chosen
    if (geometry !== null) {
        own = { ...chosen, geometry }
    } else if (location?.opened !== undefined) {
        own = { ...chosen, geometry: null }
    }
    const occurredAt =
        held?.occurredAt !== undefined &&
        storedDay(held.occurredAt) === eventDate
            ? held.occurredAt
            : eventDate
    return {
        events: [
            {
                ...own,
                occurredAt,
                status:
                    status === 'SCHEDULE' || status === 'OVERDUE'
                        ? 'ACTIVE'
                        : status,
                dataValues: [
                    ...Object.entries(effective).map(
                        ([dataElement, value]) => ({ dataElement, value })
                    ),
                    ...Object.keys(opened)
                        .filter(
                            (dataElement) =>
                                effective[dataElement] === undefined
                        )
                        .map((dataElement) => ({ dataElement, value: null })),
                ],
                ...(note !== undefined &&
                    note.text.trim() !== '' && {
                        notes: [{ note: note.id, value: note.text.trim() }],
                    }),
            },
        ],
    } satisfies TrackerPayload
}
