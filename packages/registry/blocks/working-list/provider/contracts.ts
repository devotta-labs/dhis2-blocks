import type {
    FilterOperator,
    FilterValue,
    WorkingListSort,
} from '../domain/model'
import type {
    WorkingListRowIssue,
    WorkingListRowValues,
} from '../query/normalizeRows'

export const WORKING_LIST_PAGE_SIZES = [10, 15, 25, 50, 100] as const

export type WorkingListPageSize = (typeof WORKING_LIST_PAGE_SIZES)[number]

export interface WorkingListPagination {
    page: number
    pageSize: WorkingListPageSize
}

export interface AppliedFilter {
    fieldId: string
    operator: FilterOperator
    value: FilterValue
}

interface WorkingListConfigurationBase {
    filters: AppliedFilter[]
    columns: string[]
    sort: WorkingListSort
}

export type WorkingListConfiguration =
    | (WorkingListConfigurationBase & {
          mode: 'trackedEntity'
          programStageId?: never
      })
    | (WorkingListConfigurationBase & {
          mode: 'event'
          programStageId: string
      })

export type WorkingListResultTarget =
    | {
          mode: 'trackedEntity'
          programId: string
          trackedEntityId: string
      }
    | {
          mode: 'event'
          programId: string
          programStageId: string
          eventId: string
          enrollmentId?: string
          trackedEntityId?: string
      }

export interface WorkingListDisplayRow {
    id: string
    trackedEntityId?: string
    eventId?: string
    enrollmentId?: string
    values: WorkingListRowValues
    issues: ReadonlyArray<WorkingListRowIssue>
}

/** A saved list as the view switcher shows it. */
export interface WorkingListView {
    id: string
    name: string
    /** One of the lists shown while the program has none of its own. */
    generated: boolean
    /** Every field the list names still exists in the program. */
    compatible: boolean
    canUpdate: boolean
    canDelete: boolean
    canShare: boolean
}
