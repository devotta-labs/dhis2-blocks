import type { ReactElement } from 'react'
import type {
    AccessLevel,
    AttributeInfo,
    DataAccess,
    DerivedEventStatus,
    DisplayAttribute,
    DisplayAttributesOptions,
    Enrollment,
    EnrollmentAllowance,
    EnrollmentAllowanceReason,
    FieldInfo,
    JsonValue,
    LatestValue,
    Note,
    ProgramAccess,
    ProgramInfo,
    ProgramRecord,
    Relationship,
    RelationshipsResult,
    StageInfo,
    TrackedEntityRecord,
    TrackedEntityRecordContextValue,
    TrackedEntityRecordProviderProps,
    TrackedEntityRecordState,
    TrackedEntityTypeInfo,
    TrackerEvent,
} from '..'
import {
    currentEnrollment,
    displayAttributes,
    enrollmentAllowance,
    eventStatus,
    isOverdue,
    latestValues,
    todayIso,
    trackedEntityRecordKeys,
    TrackedEntityRecordProvider,
    useTrackedEntityRecord,
} from '..'

export type SupportedTrackedEntityRecordTypes = [
    AccessLevel,
    AttributeInfo,
    DataAccess,
    DerivedEventStatus,
    DisplayAttribute,
    DisplayAttributesOptions,
    Enrollment,
    EnrollmentAllowance,
    EnrollmentAllowanceReason,
    FieldInfo,
    JsonValue,
    LatestValue,
    Note,
    ProgramAccess,
    ProgramInfo,
    ProgramRecord,
    Relationship,
    RelationshipsResult,
    StageInfo,
    TrackedEntityRecord,
    TrackedEntityRecordContextValue,
    TrackedEntityRecordProviderProps,
    TrackedEntityRecordState,
    TrackedEntityTypeInfo,
    TrackerEvent,
]

// Spec 6: the hook's value.
export const readRecord = (): TrackedEntityRecordContextValue =>
    useTrackedEntityRecord()

export const providerProps: TrackedEntityRecordProviderProps = {
    trackedEntityId: 'TrackedEnt1',
    programs: ['Program0001', 'Program0002'],
    children: null,
}

export const providerWithoutPrograms: TrackedEntityRecordProviderProps = {
    trackedEntityId: 'TrackedEnt1',
    children: null,
}

// @ts-expect-error The provider needs the person's id.
export const providerWithoutId: TrackedEntityRecordProviderProps = {
    children: null,
}

export const provider: (
    props: TrackedEntityRecordProviderProps
) => ReactElement = TrackedEntityRecordProvider

/** A host can't read a record from a state that has none. */
export const recordOf = (state: TrackedEntityRecordState) => {
    // @ts-expect-error `record` exists only on the ready state.
    void state.record
    return state.status === 'ready' ? state.record : undefined
}

export const refresh = (
    value: TrackedEntityRecordContextValue
): Promise<void> => value.actions.refresh()

// Spec 6: the helpers' signatures.
export const helpers = (
    record: TrackedEntityRecord,
    program: ProgramRecord,
    event: TrackerEvent
) => {
    const today: string = todayIso()
    const current: Enrollment | undefined = currentEnrollment(program)
    const chosen: Enrollment | undefined = currentEnrollment(
        program,
        'Enrollment1'
    )
    const allowance: EnrollmentAllowance = enrollmentAllowance(record, program)
    const status: DerivedEventStatus = eventStatus(event, today)
    const overdue: boolean = isOverdue(event, today)
    const latest: Map<string, LatestValue> = latestValues(
        [event],
        ['DataElem001']
    )
    const shown: DisplayAttribute[] = displayAttributes(record, 'Program0001', {
        onlyDisplayInList: true,
    })
    return { current, chosen, allowance, status, overdue, latest, shown }
}

// Spec 10: the keys.
export const personKey: readonly string[] =
    trackedEntityRecordKeys.person('TrackedEnt1')
export const rootKey: readonly ['tracked-entity-record'] =
    trackedEntityRecordKeys.root

// Internals stay internal: no client, no request plan, no loosening option.
// @ts-expect-error useRecordState is internal.
export { useRecordState } from '..'
// @ts-expect-error The record client is internal.
export type { RecordClient } from '..'
// @ts-expect-error The builder is internal.
export { buildRecord } from '..'

export const noLooseningProp: TrackedEntityRecordProviderProps = {
    trackedEntityId: 'TrackedEnt1',
    children: null,
    // @ts-expect-error No prop loosens access.
    includeRestricted: true,
}
