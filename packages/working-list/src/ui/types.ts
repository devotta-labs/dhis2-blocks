import type { WorkingListField, WorkingListRowOpenEvent } from '../domain/model'
import type {
    WorkingListRowIssue,
    WorkingListRowValues,
} from '../query/normalizeRows'

/**
 * Controls whether data-quality issues are visually highlighted. Validation
 * always runs and invalid rows always render; 'hidden' only hides the visuals.
 */
export type WorkingListDataQualityMode = 'hidden' | 'highlighted'

export interface WorkingListDisplayRow {
    id: string
    trackedEntityId?: string
    eventId?: string
    values: WorkingListRowValues
    issues: ReadonlyArray<WorkingListRowIssue>
}

export interface WorkingListPageData {
    rows: WorkingListDisplayRow[]
    page: number
    pageSize: number
    hasNextPage: boolean
}

export const rowOpenEvent = (
    row: WorkingListDisplayRow
): WorkingListRowOpenEvent => {
    if (row.eventId) {
        return {
            mode: 'event',
            eventId: row.eventId,
            trackedEntityId: row.trackedEntityId,
        }
    }
    if (!row.trackedEntityId) {
        throw new Error(`Tracked-entity row ${row.id} has no tracked entity ID`)
    }
    return { mode: 'trackedEntity', trackedEntityId: row.trackedEntityId }
}

export type OrderedFields = WorkingListField[]
