import {
    createDataTableColumnHelper,
    type DataTableColumnDef,
} from '@/components/data-table'
import type { ReactNode } from 'react'
import type { PatientListRow } from './types'

/** The column helper for patient list rows, for display or custom columns. */
export const patientListColumn = createDataTableColumnHelper<PatientListRow>()

export interface PatientListColumnOptions {
    header: string
    /** Cell content. Default: the stored value as text. */
    format?: (value: string | undefined, row: PatientListRow) => ReactNode
    /** Default: true for attributes and for the fields the server can order by. */
    sortable?: boolean
    align?: 'start' | 'center' | 'end'
    nowrap?: boolean
    /** Column width in px for the data table's fixed layout. */
    size?: number
}

export type PatientListField =
    | 'createdAt'
    | 'updatedAt'
    | 'enrolledAt'
    | 'occurredAt'
    | 'enrollmentStatus'
    | 'orgUnit'
    | 'inactive'
    | 'trackedEntity'

type ValueOf = (row: PatientListRow) => string | undefined

const fieldValues = {
    createdAt: (row) => row.createdAt,
    updatedAt: (row) => row.updatedAt,
    enrolledAt: (row) => row.enrollment?.enrolledAt,
    occurredAt: (row) => row.enrollment?.occurredAt,
    enrollmentStatus: (row) => row.enrollment?.status,
    orgUnit: (row) => row.orgUnit,
    inactive: (row) => String(row.inactive),
    trackedEntity: (row) => row.trackedEntity,
} satisfies Record<PatientListField, ValueOf>

/** The fields `tracker/trackedEntities` can order by. */
const SERVER_ORDERABLE = new Set<PatientListField>([
    'createdAt',
    'updatedAt',
    'enrolledAt',
    'inactive',
    'trackedEntity',
])

/** The column id is also the tracker `order` field. */
const valueColumn = (
    id: string,
    valueOf: ValueOf,
    { header, format, sortable, align, nowrap, size }: PatientListColumnOptions,
    defaultSortable: boolean
): DataTableColumnDef<PatientListRow> =>
    patientListColumn.accessor(valueOf, {
        id,
        header,
        cell: (info) => {
            const value = info.getValue()
            return format ? format(value, info.row.original) : (value ?? '')
        },
        enableSorting: sortable ?? defaultSortable,
        meta: { align, nowrap },
        ...(size !== undefined && { size }),
    })

/** A column of one attribute's stored value, by attribute uid. */
export const attributeColumn = (
    attribute: string,
    options: PatientListColumnOptions
): DataTableColumnDef<PatientListRow> =>
    valueColumn(attribute, (row) => row.attributes[attribute], options, true)

/** A column of a tracked entity or enrollment field. */
export const fieldColumn = (
    field: PatientListField,
    options: PatientListColumnOptions
): DataTableColumnDef<PatientListRow> =>
    valueColumn(field, fieldValues[field], options, SERVER_ORDERABLE.has(field))
