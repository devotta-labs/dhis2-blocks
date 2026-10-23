import type { ValueMeta } from '@/components/dhis2-value-display/formatDhis2Value'
import type {
    TimelineEntry,
    TimelineNotice,
    TimelineStatus,
} from '@/components/timeline/core/types'
import type { DerivedEventStatus } from './eventStatus'
import type { Enrollment, Note, TrackerEvent } from './schemas'

/** A field's label and how to show its values. */
export interface FieldInfo {
    name: string
    meta: ValueMeta
}

export interface StageInfo {
    id: string
    name: string
    hideDueDate: boolean
    /** The elements flagged `displayInReports`, in stage order. */
    reportDataElementIds: string[]
    dataElements: ReadonlyMap<string, FieldInfo>
}

/** A program's names and value metadata, read once and shared by its entries. */
export interface ProgramInfo {
    id: string
    name: string
    stages: ReadonlyMap<string, StageInfo>
    attributes: ReadonlyMap<string, FieldInfo>
}

export interface Dhis2EventData {
    kind: 'event'
    event: TrackerEvent
    status: DerivedEventStatus
    /** Undefined when the program's metadata couldn't be read. */
    program?: ProgramInfo
    stage?: StageInfo
    orgUnitName?: string
    /** Names for org-unit-typed values; one map shared by every entry. */
    orgUnitNames: ReadonlyMap<string, string>
}

export type MilestoneKind = 'enrolled' | 'incident' | 'completed' | 'cancelled'

export interface Dhis2MilestoneData {
    kind: 'milestone'
    milestone: MilestoneKind
    enrollment: Enrollment
    program?: ProgramInfo
}

export interface Dhis2NoteData {
    kind: 'note'
    note: Note
    enrollment: Enrollment
    program?: ProgramInfo
}

export interface ResolvedChange {
    field: { kind: 'attribute' | 'dataElement' | 'eventField'; id: string }
    /** The field's label, or its id when unknown. */
    name: string
    meta: ValueMeta
    type: 'CREATE' | 'UPDATE' | 'DELETE'
    previousValue?: string
    currentValue?: string
}

/** The rows one user saved together: same `createdAt`, same user. */
export interface ChangeSave {
    /** `${createdAt}:${username}` */
    id: string
    createdAt: string
    user: { username: string; displayName: string }
    changes: ResolvedChange[]
}

export interface Dhis2ChangeData {
    kind: 'change'
    save: ChangeSave
}

export type Dhis2EntryData =
    | Dhis2EventData
    | Dhis2MilestoneData
    | Dhis2NoteData
    | Dhis2ChangeData

/** What every history hook returns. */
export interface HistoryResult<TData> {
    entries: ReadonlyArray<TimelineEntry<TData>>
    /** `pending` until every request has answered once; `error` when all failed. */
    status: TimelineStatus
    /** Failed parts (with retry), unsupported changelogs, capped events. */
    notices: TimelineNotice[]
    isFetching: boolean
    refetch(): void
}
