import type { WorkingListField } from '../domain/model'
import type { WorkingListDisplayRow } from '../provider/contracts'

/**
 * Controls whether data-quality issues are visually highlighted. Validation
 * always runs and invalid rows always render; 'hidden' only hides the visuals.
 */
export type WorkingListDataQualityMode = 'hidden' | 'highlighted'

export type { WorkingListDisplayRow } from '../provider/contracts'

export interface WorkingListPageData {
    rows: WorkingListDisplayRow[]
    page: number
    pageSize: number
    hasNextPage: boolean
}

export type OrderedFields = WorkingListField[]
