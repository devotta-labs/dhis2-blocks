import type { WorkingListConfiguration } from '../domain/model'
import type { StaleReferenceIssue } from '../domain/staleReferences'
import type {
    EntityQueryCriteria,
    ProgramStageQueryCriteria,
    ProgramStageWorkingList,
    TrackedEntityInstanceFilter,
} from './schemas'

export type SavedListResource =
    | 'trackedEntityInstanceFilters'
    | 'programStageWorkingLists'

export type SavedListSharing = Pick<
    TrackedEntityInstanceFilter,
    | 'access'
    | 'externalAccess'
    | 'publicAccess'
    | 'user'
    | 'userAccesses'
    | 'userGroupAccesses'
>

export type SavedDateFilter = NonNullable<
    EntityQueryCriteria['enrollmentCreatedDate']
>

export interface WritableSavedCriteria {
    enrollmentStatus?: EntityQueryCriteria['enrollmentStatus']
    order?: EntityQueryCriteria['order']
    displayColumnOrder?: EntityQueryCriteria['displayColumnOrder']
    assignedUserMode?: EntityQueryCriteria['assignedUserMode']
    assignedUsers?: EntityQueryCriteria['assignedUsers']
    followUp?: EntityQueryCriteria['followUp']
    attributeValueFilters?: EntityQueryCriteria['attributeValueFilters']
    enrollmentCreatedDate?: EntityQueryCriteria['enrollmentCreatedDate']
    enrollmentIncidentDate?: EntityQueryCriteria['enrollmentIncidentDate']
    enrolledAt?: ProgramStageQueryCriteria['enrolledAt']
    enrollmentOccurredAt?: ProgramStageQueryCriteria['enrollmentOccurredAt']
    eventStatus?: ProgramStageQueryCriteria['eventStatus']
    eventOccurredAt?: ProgramStageQueryCriteria['eventOccurredAt']
    eventScheduledAt?: ProgramStageQueryCriteria['eventScheduledAt']
    dataFilters?: ProgramStageQueryCriteria['dataFilters']
}

export interface SavedListPayloadBase extends SavedListSharing {
    name: string
    program: { id: string }
    sortOrder?: number
}

export interface SavedListBase {
    id: string
    name: string
    /** Stable key for generated labels; metadata names remain server-provided. */
    labelKey?: string
    resource: SavedListResource
    sortOrder?: number
    sharing: SavedListSharing
}

export type NormalizedSavedWorkingList =
    | (SavedListBase & {
          compatibility: 'compatible'
          configuration: WorkingListConfiguration
          /** Parsed server resource used to preserve writable extensions. */
          raw?: TrackedEntityInstanceFilter | ProgramStageWorkingList
      })
    | (SavedListBase & {
          compatibility: 'incompatible'
          issues: StaleReferenceIssue[]
          raw: TrackedEntityInstanceFilter | ProgramStageWorkingList
          /** Present when the raw resource could be parsed before validation. */
          candidateConfiguration?: WorkingListConfiguration
      })
