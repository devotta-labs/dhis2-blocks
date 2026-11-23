export interface AttributeMeta {
    id: string
    label: string
    valueType: string
    optionSet?: { options: { code: string; displayName: string }[] }
    displayInList: boolean
    sortOrder: number
}

/** Labels, value types, option names and list order for one program's (or one type's) attributes. */
export interface AttributeMetadata {
    typeName: string
    programName?: string
    attributes: Map<string, AttributeMeta>
    /** Attributes whose metadata could not be read: only their own parts say Unavailable. */
    invalid: Map<string, { label?: string; error: Error; sortOrder: number }>
    /** The displayInList uids, by sortOrder. */
    listOrder: string[]
    incidentDateLabel?: string
    enrollmentDateLabel?: string
}

export interface EnrollmentRecord {
    enrollment: string
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | string
    enrolledAt?: string
    occurredAt?: string
    completedAt?: string
}

export interface TrackedEntityRecord {
    id: string
    type: string
    inactive: boolean
    potentialDuplicate: boolean
    /** Attribute uid to value; the API omits empty values. */
    values: Map<string, string>
    /** The program's one enrollment: the ACTIVE one, else the latest enrolledAt. */
    enrollment?: EnrollmentRecord
    ownerOrgUnit?: string
}

export type RelationshipEnd = 'from' | 'to'

export type LinkedEnd =
    | {
          kind: 'trackedEntity'
          id: string
          type: string
          values: Map<string, string>
      }
    | { kind: 'event' | 'enrollment'; id: string }
    | { kind: 'unreadable' }

export interface RelationshipRecord {
    id: string
    type: string
    /** Shown when the type's metadata is missing. */
    name?: string
    /** This record's end. */
    end: RelationshipEnd
    other: LinkedEnd
}

export interface RelationshipTypeMeta {
    id: string
    name: string
    fromToName?: string
    toFromName?: string
    bidirectional: boolean
    /** Per end: the type name of a tracked entity there, and its data-view attribute uids, in order. */
    ends: Record<RelationshipEnd, { typeName?: string; view: string[] }>
}
