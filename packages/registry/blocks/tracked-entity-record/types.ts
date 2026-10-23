// The public types of the block (spec 6-9). Names follow the spec verbatim.
// Values everywhere are API strings; formatting is the views' job.

export type AccessLevel = 'OPEN' | 'AUDITED' | 'PROTECTED' | 'CLOSED'

export type TrackedEntityRecordState =
    | { status: 'pending' }
    | { status: 'unavailable'; debug?: string } // not found or no access: the same to the server (§7.1)
    | { status: 'error'; error: Error; retry(): void } // network, 5xx, unexpected response shape
    | { status: 'ready'; record: TrackedEntityRecord }

export interface TrackedEntityRecordContextValue {
    state: TrackedEntityRecordState
    actions: { refresh(): Promise<void> }
    meta: { trackedEntityId: string; isFetching: boolean }
}

export interface ProgramAccess {
    canWrite: boolean // program data write ∧ tracked entity type data write ∧ ¬person.inactive
}

export type ProgramRecord =
    | {
          status: 'enrolled'
          program: ProgramInfo
          enrollments: Enrollment[]
          access: ProgramAccess
      }
    | { status: 'not-enrolled'; program: ProgramInfo; access: ProgramAccess }
    | { status: 'unavailable'; programId: string; debug: string }
    | { status: 'error'; programId: string; error: Error; retry(): void } // its metadata failed to load

export interface TrackedEntityRecord {
    person: {
        id: string
        trackedEntityType: TrackedEntityTypeInfo
        orgUnit: string // registering org unit
        inactive: boolean
        potentialDuplicate: boolean
        createdAt: string
        updatedAt: string
        attributes: Map<string, string> // attributeId → API value: type attributes and every visible enrollment's program attributes
    }
    programs: Map<string, ProgramRecord>
    relationships: RelationshipsResult
}

/** The type's data access, as the metadata reports it. */
export interface DataAccess {
    read: boolean
    write: boolean
}

export interface TrackedEntityTypeInfo {
    id: string
    name: string
    access: DataAccess
    attributes: AttributeInfo[] // trackedEntityTypeAttributes in metadata order (§9.3)
}

export interface ProgramInfo {
    id: string
    name: string
    accessLevel: AccessLevel
    onlyEnrollOnce: boolean
    displayIncidentDate: boolean
    selectEnrollmentDatesInFuture: boolean
    selectIncidentDatesInFuture: boolean
    enrollmentDateLabel?: string
    incidentDateLabel?: string
    featureType?: string
    completeEventsExpiryDays: number
    expiryDays: number
    expiryPeriodType?: string
    owner?: string // owner org unit from programOwners
    attributes: AttributeInfo[] // programTrackedEntityAttributes in sortOrder (§9.3)
    stages: StageInfo[] // readable only (§7.4)
}

export interface StageInfo {
    id: string
    name: string
    sortOrder: number
    repeatable: boolean
    autoGenerateEvent: boolean
    openAfterEnrollment: boolean
    generatedByEnrollmentDate: boolean
    reportDateToUse?: string
    minDaysFromStart: number
    standardInterval?: number
    hideDueDate: boolean
    blockEntryForm: boolean
    allowGenerateNextVisit: boolean
    executionDateLabel?: string
    dueDateLabel?: string
    canWrite: boolean
    dataElements: Map<string, FieldInfo> // programStageDataElements; displayInReports flagged
}

export interface FieldInfo {
    id: string
    name: string // displayFormName ?? displayName
    shortName?: string
    valueType: string
    optionSet?: { id: string; options: { code: string; name: string }[] }
    displayInReports?: boolean
}

export interface AttributeInfo extends FieldInfo {
    displayInList: boolean
    mandatory: boolean
    unique: boolean
}

/** A note on an enrollment or event, with the tracker API's field names. */
export interface Note {
    note: string
    value?: string
    storedAt?: string
    storedBy?: string
    createdBy?: { uid?: string; username?: string; displayName?: string }
}

export interface Enrollment {
    id: string
    programId: string
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    orgUnit: string
    enrolledAt: string
    occurredAt?: string
    completedAt?: string
    followUp: boolean
    createdAt: string
    updatedAt: string
    attributes: Map<string, string> // the enrollment's values limited to its program's own attributes, in program metadata order
    notes: Note[]
    events: TrackerEvent[] // newest first by occurredAt ?? scheduledAt, then createdAt
}

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue }

/** An event with the tracker API's own field names (spec 8). */
export interface TrackerEvent {
    event: string
    programStage: string
    enrollment: string
    status: string
    occurredAt?: string
    scheduledAt?: string
    completedAt?: string
    createdAt: string
    updatedAt: string
    orgUnit: string
    geometry?: { [key: string]: JsonValue }
    notes: Note[]
    dataValues: Map<string, string> // dataElementId → API value; empty values left out
}

export type RelationshipsResult =
    | { status: 'pending' }
    | { status: 'error'; error: Error; retry(): void }
    | { status: 'ready'; relationships: Relationship[] }

export interface Relationship {
    id: string
    type: {
        id: string
        name: string
        fromToName: string
        toFromName?: string
        bidirectional: boolean
    }
    direction: 'from' | 'to' // which side this person is on
    other: {
        trackedEntity?: string
        enrollment?: string
        event?: string
        attributes?: Map<string, string>
    }
    createdAt: string
}

// Helpers (spec 9)

export interface LatestValue {
    value: string
    event: TrackerEvent
}

export type DerivedEventStatus =
    | 'active'
    | 'completed'
    | 'scheduled'
    | 'overdue'
    | 'skipped'

export interface DisplayAttributesOptions {
    onlyDisplayInList?: boolean
}

export interface DisplayAttribute {
    attribute: AttributeInfo
    value?: string
}

export type EnrollmentAllowanceReason =
    | 'unavailable'
    | 'no-write-access'
    | 'active-enrollment-exists'
    | 'only-enroll-once'

export type EnrollmentAllowance =
    | { allowed: true }
    | { allowed: false; reason: EnrollmentAllowanceReason }
