import type { ReactNode } from 'react'
import { SpreadsheetGrid } from '@/components/spreadsheet'
import type {
    CellKey,
    CellOverrides,
    CellComponent,
} from '@/components/spreadsheet'
import type {
    DataRecord,
    EnrollmentRecord,
    EventRecord,
    EventSourceOptions,
    EventStatus,
    FieldRef,
    FormPage,
    LayoutColumn,
    LayoutNode,
    LoadedForm,
    NewRow,
    OutboxRecord,
    PendingChange,
    PersonRecord,
    RegisterLayout,
    RegisterSourceOptions,
    RulesTarget,
    SaveOutcome,
    SummaryItem,
    SyncStatus,
    TrackerColumn,
    TrackerDataEntrySource,
    TrackerDataEntryView,
    TrackerMessage,
    TrackerRow,
} from '../index'
import {
    compileLayout,
    eventSource,
    registerLayoutSchema,
    registerSource,
    TrackerDataEntry,
    TrackerDataEntrySummary,
    trackerKeyOf,
    useTrackerDataEntry,
} from '../index'

export type SupportedTrackerDataEntryTypes = [
    DataRecord,
    EnrollmentRecord,
    EventRecord,
    EventSourceOptions,
    EventStatus,
    FieldRef,
    FormPage,
    LayoutColumn,
    LayoutNode,
    LoadedForm,
    NewRow,
    OutboxRecord,
    PendingChange,
    PersonRecord,
    RegisterLayout,
    RegisterSourceOptions,
    RulesTarget,
    SaveOutcome,
    SummaryItem,
    SyncStatus,
    TrackerColumn,
    TrackerDataEntrySource,
    TrackerDataEntryView,
    TrackerMessage,
    TrackerRow,
]

const source = eventSource({
    programId: 'eBAyeGv0exc',
    orgUnitId: 'DiszpKrYNg8',
})
export const sourceKeys: [string, string | undefined] = [
    source.key,
    source.cacheKey,
]

const layout: RegisterLayout = {
    columns: [
        { field: { attribute: 'w75KJ2mc4zz' } },
        { field: { enrollment: 'enrolledAt' } },
        {
            group: 'DPT',
            children: [
                {
                    field: {
                        stage: 'ImmVaccin01',
                        where: { ImmVaccine1: 'DPT', ImmDose0001: '1' },
                        eventDate: true,
                    },
                    label: '1',
                },
            ],
        },
    ],
}
const registerOptions: RegisterSourceOptions = {
    programId: 'ImmReg00001',
    orgUnitId: 'DiszpKrYNg8',
    enrolledFrom: '2026-10-01',
    enrolledTo: '2026-10-31',
    layout,
}
export const register = registerSource(registerOptions)
export const checked: RegisterLayout = registerLayoutSchema.parse(layout)
export const refs: FieldRef[] = layout.columns.flatMap(
    (node: LayoutNode) =>
        ('field' in node ? [node.field] : []) satisfies FieldRef[]
)
export const column: LayoutColumn = {
    field: { attribute: 'w75KJ2mc4zz' },
}
export const compile: typeof compileLayout = compileLayout
// @ts-expect-error A register needs its period: the first and last enrolment day.
export const noPeriod: RegisterSourceOptions = {
    programId: 'p',
    orgUnitId: 'o',
    layout,
}
export const rowOf = (row: NewRow) => row.row.id
export const personOf: (
    record: DataRecord
) => PersonRecord | EnrollmentRecord | undefined = (record) =>
    record.kind === 'trackedEntity' || record.kind === 'enrollment'
        ? record
        : undefined

const Notes: CellComponent = ({ cellKey, readOnly }) =>
    readOnly ?? `notes ${cellKey}`
const overrides: CellOverrides = {
    valueTypes: { LONG_TEXT: Notes },
    fields: { qrur9Dvnyt5: Notes },
}
export const page: () => ReactNode = () =>
    TrackerDataEntry({
        source,
        cells: overrides,
        children: [
            SpreadsheetGrid({}),
            TrackerDataEntrySummary({ className: 'mt-4' }),
        ],
    })

export const useCanComplete = () =>
    useTrackerDataEntry((view) => view.summary.canComplete)
export const useUnsent = () =>
    useTrackerDataEntry((view) => view.summary.unsent)
export const useActions = () =>
    useTrackerDataEntry((view) => view.complete) satisfies (
        recordId: string
    ) => Promise<SaveOutcome[]>
export const useReopen = () =>
    useTrackerDataEntry((view) => view.reopen) satisfies (
        recordId: string
    ) => Promise<SaveOutcome[]>
export const useAddRow = () =>
    useTrackerDataEntry((view) => view.addRow) satisfies (
        tableId: string
    ) => void
export const useDownload = () =>
    useTrackerDataEntry((view) => view.downloadUnsent) satisfies () => void
export const useDiscard = () =>
    useTrackerDataEntry(
        (view) => view.discardFailed
    ) satisfies () => Promise<void>
export const cellOf: (row: TrackerRow, column: TrackerColumn) => CellKey = (
    row,
    column
) => trackerKeyOf(row, column)
export const useRecord: (rowId: string) => DataRecord | undefined = (rowId) =>
    useTrackerDataEntry((view) => view.records.get(rowId))
export const eventOf: (record: DataRecord) => EventRecord | undefined = (
    record
) => (record.kind === 'event' ? record : undefined)
export const badSlots: TrackerRow = {
    id: 'r',
    label: 'R',
    // @ts-expect-error A row's slots name records by slot: a record id is a string, not a record.
    slots: { person: 1 },
}
export const useRows: () => TrackerRow[] = () => {
    const tables = useTrackerDataEntry((view) => view.tables)
    return tables.flatMap(({ rows }) => rows)
}
export const useLoadError = () => useTrackerDataEntry((view) => view.error)
export const statuses: TrackerDataEntryView['status'][] = [
    'loading',
    'ready',
    'error',
]
export const syncs: SyncStatus[] = [
    'idle',
    'sending',
    'offline',
    'signIn',
    'retrying',
]
// @ts-expect-error There is no saving status: outcomes, never progress.
export const saving: TrackerDataEntryView['status'] = 'saving'
