export type PatientListEnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
export type PatientListOrgUnitMode =
    | 'SELECTED'
    | 'CHILDREN'
    | 'DESCENDANTS'
    | 'ACCESSIBLE'
    | 'CAPTURE'

export interface PatientListEnrollment {
    enrollment: string
    status: PatientListEnrollmentStatus
    enrolledAt?: string
    occurredAt?: string
    orgUnit?: string
}

export interface PatientListRow {
    trackedEntity: string
    orgUnit?: string
    createdAt?: string
    updatedAt?: string
    inactive: boolean
    /** Attribute values by attribute uid. */
    attributes: Readonly<Record<string, string>>
    /** The tracked entity's enrollment in the list's program, when it has one. */
    enrollment?: PatientListEnrollment
}

/** The query parts a filter (or `baseQuery`) can contribute. */
export interface PatientListFilterQuery {
    /** Tracker `filter` entries: `<attributeUid>:<operator>:<value>`. */
    filters?: readonly string[]
    enrollmentStatus?: PatientListEnrollmentStatus
    /** Inclusive ISO dates. */
    enrolledAfter?: string
    enrolledBefore?: string
    occurredAfter?: string
    occurredBefore?: string
    /** Any other `tracker/trackedEntities` parameters, sent as given. */
    params?: Readonly<Record<string, string>>
}

export interface PatientListQuery extends PatientListFilterQuery {
    program: string
    orgUnit: string
    /** Default 'SELECTED'. */
    orgUnitMode?: PatientListOrgUnitMode
    /** From 1. */
    page: number
    pageSize: number
    /** Tracker `order` entries: `<field>:<asc|desc>`. */
    order?: readonly string[]
}

export interface PatientListPage {
    rows: PatientListRow[]
    hasNextPage: boolean
}
