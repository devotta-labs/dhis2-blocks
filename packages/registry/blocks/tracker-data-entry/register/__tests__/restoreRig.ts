import type {
    EnrollmentRecord,
    EventRecord,
    PersonRecord,
} from '../../model/types'
import type { OutboxRecord } from '../../outbox/outbox'
import {
    DOSE,
    NGELEHUN,
    OPV_1,
    PERSON_TYPE,
    PROGRAM,
    VACCINATION,
    VACCINE,
    engineFor,
    immunisationRegister,
} from './registerRig'

/** What the reload tests restore from: a half-typed new child, and doses typed before a reload. */

// A new person typed before a reload, with the ids their row was made with.
export const PERSON: PersonRecord = {
    kind: 'trackedEntity',
    id: 'PsnTyped001',
    trackedEntityTypeId: PERSON_TYPE,
    orgUnitId: NGELEHUN,
    isNew: true,
}
export const ENROLMENT: EnrollmentRecord = {
    kind: 'enrollment',
    id: 'EnrTyped001',
    programId: PROGRAM,
    trackedEntityId: PERSON.id,
    orgUnitId: NGELEHUN,
    status: 'ACTIVE',
    isNew: true,
}
export const OPV: EventRecord = {
    kind: 'event',
    id: 'EvtTyped001',
    programStageId: VACCINATION,
    orgUnitId: NGELEHUN,
    enrollmentId: ENROLMENT.id,
    status: 'ACTIVE',
    isNew: true,
    slot: OPV_1,
    createdWith: { [VACCINE]: 'OPV', [DOSE]: '1' },
    trackedEntityId: PERSON.id,
}

/** A loaded immunisation register, with the rows and records it restores from `outbox`. */
export const restoring = async (
    outbox: OutboxRecord[],
    answers: Parameters<typeof engineFor>[0] = {}
) => {
    const source = immunisationRegister()
    const form = await source.load(engineFor(answers).engine)
    const restored = await source.restoreRows(
        engineFor(answers).engine,
        outbox,
        form
    )
    return { source, form, ...restored }
}

/** A dose typed for a loaded person, in `slot`, which DHIS2 does not hold. */
export const restoredDose = (
    enrollmentId: string,
    slot: string
): EventRecord => ({
    kind: 'event',
    id: 'EvtTyped003',
    programStageId: VACCINATION,
    orgUnitId: NGELEHUN,
    enrollmentId,
    status: 'ACTIVE',
    isNew: true,
    slot,
})
