import type { PatientListQuery } from '../types'

export const PATIENT_LIST_FIELDS =
    'trackedEntity,orgUnit,createdAt,updatedAt,inactive,attributes[attribute,value],enrollments[enrollment,program,status,enrolledAt,occurredAt,orgUnit]'

const DEFAULT_ORDER: readonly string[] = ['createdAt:desc']

/** `tracker/trackedEntities` parameters as the data engine takes them. */
interface TrackerParams {
    [parameter: string]: string | number | string[]
}

/**
 * The request parameters for a query. Keys come in a fixed order, so tests
 * and query keys are deterministic; `params` never replace a key set here.
 */
export const toTrackerParams = (
    query: PatientListQuery,
    apiVersion: number
): TrackerParams => {
    const params: TrackerParams = {
        program: query.program,
        orgUnits: query.orgUnit,
        orgUnitMode: query.orgUnitMode ?? 'SELECTED',
        page: query.page,
        pageSize: query.pageSize,
        order: (query.order?.length ? query.order : DEFAULT_ORDER).join(','),
    }
    if (query.filters?.length) {
        // The engine repeats `filter` once per entry.
        params.filter = [...query.filters]
    }
    if (query.enrollmentStatus !== undefined) {
        params[apiVersion >= 42 ? 'enrollmentStatus' : 'programStatus'] =
            query.enrollmentStatus
    }
    const dates = [
        ['enrollmentEnrolledAfter', query.enrolledAfter],
        ['enrollmentEnrolledBefore', query.enrolledBefore],
        ['enrollmentOccurredAfter', query.occurredAfter],
        ['enrollmentOccurredBefore', query.occurredBefore],
    ] as const
    for (const [parameter, value] of dates) {
        if (value !== undefined) params[parameter] = value
    }
    const own = new Set([...Object.keys(params), 'fields'])
    for (const [parameter, value] of Object.entries(query.params ?? {})) {
        if (!own.has(parameter)) params[parameter] = value
    }
    params.fields = PATIENT_LIST_FIELDS
    return params
}
