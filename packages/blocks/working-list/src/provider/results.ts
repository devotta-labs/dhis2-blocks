import type { FieldCatalog, WorkingListField } from '../domain/model'
import { fieldDisplayName } from '../domain/filterControlPolicy'
import type { WorkingListPage } from '../query/fetchers'
import {
    getCellDisplayValue,
    type CellFormattingContext,
} from '../registry/valueTypes'
import type { WorkingListTranslate } from '../ui/WorkingListText'
import type {
    WorkingListConfiguration,
    WorkingListDisplayRow,
    WorkingListPaginationMeta,
    WorkingListResultTarget,
} from './contracts'
import { WORKING_LIST_PAGE_SIZES } from './contracts'

export const toDisplayRows = (
    pageData: WorkingListPage | undefined
): WorkingListDisplayRow[] => {
    if (!pageData) return []

    if (pageData.mode === 'trackedEntity') {
        return pageData.records.map((record) => ({
            id: record.trackedEntity.trackedEntity,
            trackedEntityId: record.trackedEntity.trackedEntity,
            values: record.values,
            issues: record.issues,
        }))
    }

    return pageData.records.map((record) => ({
        id: record.event.event.event,
        eventId: record.event.event.event,
        enrollmentId: record.event.event.enrollment,
        trackedEntityId: record.event.event.trackedEntity,
        values: { ...record.trackedEntity?.values, ...record.event.values },
        issues: [
            ...(record.trackedEntity?.issues ?? []),
            ...record.event.issues,
        ],
    }))
}

export const toPaginationMeta = (
    pageData: WorkingListPage,
    displayedCount: number
): WorkingListPaginationMeta => {
    const pageSize = WORKING_LIST_PAGE_SIZES.find(
        (candidate) => candidate === pageData.pageSize
    )

    if (pageSize === undefined) {
        throw new Error(
            `Unexpected working-list page size ${pageData.pageSize}`
        )
    }

    return {
        page: pageData.page,
        pageSize,
        displayedCount,
        hasNextPage: pageData.hasNextPage,
    }
}

export const toResultTargets = ({
    pageData,
    programId,
    configuration,
}: {
    pageData: WorkingListPage | undefined
    programId: string
    configuration: WorkingListConfiguration | undefined
}) => {
    const targets = new Map<string, WorkingListResultTarget>()

    if (!pageData) return targets

    if (pageData.mode === 'trackedEntity') {
        pageData.records.forEach((record) => {
            const trackedEntityId = record.trackedEntity.trackedEntity
            targets.set(trackedEntityId, {
                mode: 'trackedEntity',
                programId,
                trackedEntityId,
            })
        })

        return targets
    }

    pageData.records.forEach((record) => {
        const event = record.event.event

        const programStageId =
            event.programStage ??
            (configuration?.mode === 'event'
                ? configuration.programStageId
                : undefined)

        if (!programStageId) return
        targets.set(event.event, {
            mode: 'event',
            programId,
            programStageId,
            eventId: event.event,
            enrollmentId: event.enrollment,
            trackedEntityId: event.trackedEntity,
        })
    })

    return targets
}

interface VisibleRowsCsvOptions {
    rows: readonly WorkingListDisplayRow[]
    columns: readonly string[]
    fields: FieldCatalog
    formattingContext: CellFormattingContext
    translate: WorkingListTranslate
}

export const visibleRowsAsCsv = ({
    rows,
    columns,
    fields,
    formattingContext,
    translate,
}: VisibleRowsCsvOptions) => {
    const visibleFields = columns
        .map((id) => fields.get(id))
        .filter((field): field is WorkingListField => Boolean(field))

    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`

    const cellText = (row: WorkingListDisplayRow, field: WorkingListField) => {
        const cell = row.values[field.id]

        if (cell && !cell.valid) return cell.raw == null ? '' : String(cell.raw)

        const display = getCellDisplayValue(
            cell?.value,
            field,
            formattingContext
        )

        return display.kind === 'image' ? display.alt : display.text
    }

    return [
        visibleFields
            .map((field) => escape(fieldDisplayName(field, translate)))
            .join(','),
        ...rows.map((row) =>
            visibleFields.map((field) => escape(cellText(row, field))).join(',')
        ),
    ].join('\n')
}

export const downloadRowsAsCsv = ({
    fileName,
    ...options
}: VisibleRowsCsvOptions & { fileName: string }) => {
    const csv = visibleRowsAsCsv(options)

    const url = URL.createObjectURL(
        new Blob([csv], { type: 'text/csv;charset=utf-8' })
    )

    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}
