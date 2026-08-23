import { Button, NoticeBox } from '@dhis2/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useMemo } from 'react'
import type { WorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { ProgramFieldCatalog } from '../../api/metadata'
import type { NormalizedSavedWorkingList } from '../../api/savedLists'
import type { TrackerProgram } from '../../api/schemas'
import type { WorkingListSystemInfo } from '../../api/systemInfo'
import type {
    AppliedFilter,
    WorkingListConfiguration,
    WorkingListCriteria,
    WorkingListField,
    WorkingListRowOpenEvent,
    WorkingListSort,
    WorkingListViewConfiguration,
} from '../../domain/model'
import { workingListPageQueryOptions } from '../../query/fetchers'
import {
    collectFileResourceIds,
    createFileResourceNameResolver,
    fileResourceNamesQueryOptions,
} from '../../query/fileResourceLabels'
import {
    collectOrganisationUnitIds,
    createOrganisationUnitLabelResolver,
    organisationUnitLabelsQueryOptions,
} from '../../query/referenceLabels'
import { createWorkingListValueTransformers } from '../../registry/transformers'
import {
    getCellDisplayValue,
    type FilterSerializationContext,
} from '../../registry/valueTypes'
import { ConfigureMenu } from '../ConfigureMenu'
import {
    fieldDisplayName,
    type FilterCalendarContext,
    localizedField,
} from '../FilterControls'
import type { WorkingListDataQualityMode } from '../types'
import { WorkingListTable } from '../WorkingListTable'
import { useWorkingListText } from '../WorkingListText'
import styles from './WorkingList.module.css'
import { WorkingListFilterBar } from './WorkingListFilterBar'
import { pageRows } from './workingListModel'

interface WorkingListWorkspaceProps {
    client: WorkingListClient
    orgUnitId: string
    page: number
    pageSize: number
    program: TrackerProgram
    systemInfo: WorkingListSystemInfo
    locale: string
    dataQualityMode: WorkingListDataQualityMode
    configuration: WorkingListConfiguration
    criteria: WorkingListCriteria
    view: WorkingListViewConfiguration
    metadata: ProgramFieldCatalog
    capabilities: WorkingListCapabilities
    serializationContext: FilterSerializationContext
    calendarContext: FilterCalendarContext
    tableFields: WorkingListField[]
    selectedList?: NormalizedSavedWorkingList
    selectedIsGenerated: boolean
    dirty: boolean
    online: boolean
    mutationBusy: boolean
    selectionKey?: string
    onSaveAs: (name: string) => void
    onUpdateList: (list: NormalizedSavedWorkingList) => void
    onApplyFilter: (filter: AppliedFilter) => void
    onResetFilter: (fieldId: string) => void
    onEnterStage: (stageId?: string) => void
    onUpdateView: (view: WorkingListViewConfiguration) => void
    onPageChange: (page: number, pageSize: number) => void
    onRowOpen: (event: WorkingListRowOpenEvent) => void
}

export const WorkingListWorkspace = ({
    client,
    orgUnitId,
    page,
    pageSize,
    program,
    systemInfo,
    locale,
    dataQualityMode,
    configuration,
    criteria,
    view,
    metadata,
    capabilities,
    serializationContext,
    calendarContext,
    tableFields,
    selectedList,
    selectedIsGenerated,
    dirty,
    online,
    mutationBusy,
    selectionKey,
    onSaveAs,
    onUpdateList,
    onApplyFilter,
    onResetFilter,
    onEnterStage,
    onUpdateView,
    onPageChange,
    onRowOpen,
}: WorkingListWorkspaceProps) => {
    const translate = useWorkingListText()
    const i18n = { t: translate }
    const queryClient = useQueryClient()
    const pageQuery = useQuery(
        workingListPageQueryOptions({
            client,
            context: { programId: program.id, orgUnitId },
            configuration,
            pagination: { page, pageSize },
            capabilities,
            fields: metadata.fields,
            serializationContext,
            translate,
        })
    )

    useEffect(() => {
        if (!pageQuery.data?.hasNextPage) {
            return
        }
        void queryClient.prefetchQuery(
            workingListPageQueryOptions({
                client,
                context: { programId: program.id, orgUnitId },
                configuration,
                pagination: { page: page + 1, pageSize },
                capabilities,
                fields: metadata.fields,
                serializationContext,
                translate,
            })
        )
    }, [
        capabilities,
        client,
        configuration,
        metadata.fields,
        orgUnitId,
        page,
        pageQuery.data?.hasNextPage,
        pageSize,
        program.id,
        queryClient,
        serializationContext,
        translate,
    ])

    const rows = useMemo(() => pageRows(pageQuery.data), [pageQuery.data])
    const organisationUnitIds = useMemo(
        () =>
            pageQuery.data
                ? collectOrganisationUnitIds(pageQuery.data, metadata.fields)
                : [],
        [metadata.fields, pageQuery.data]
    )
    const organisationUnitLabelsQuery = useQuery({
        ...organisationUnitLabelsQueryOptions(client, organisationUnitIds),
        enabled: Boolean(pageQuery.data) && organisationUnitIds.length > 0,
    })
    const organisationUnitLabelsReady =
        organisationUnitIds.length === 0 ||
        organisationUnitLabelsQuery.isSuccess
    const fileResourceIds = useMemo(
        () =>
            pageQuery.data
                ? collectFileResourceIds(pageQuery.data, metadata.fields)
                : [],
        [metadata.fields, pageQuery.data]
    )
    const fileResourceNamesQuery = useQuery({
        ...fileResourceNamesQueryOptions(client, fileResourceIds),
        enabled: Boolean(pageQuery.data) && fileResourceIds.length > 0,
    })
    const fileResourceNamesReady =
        fileResourceIds.length === 0 ||
        fileResourceNamesQuery.isSuccess ||
        fileResourceNamesQuery.isError
    const displayTransformers = useMemo(
        () =>
            createWorkingListValueTransformers({
                systemInfo,
                locale,
                trueLabel: i18n.t('Yes'),
                falseLabel: i18n.t('No'),
                resolveDisplayName: createOrganisationUnitLabelResolver(
                    organisationUnitLabelsQuery.data ?? new Map()
                ),
                resolveFileResourceName: createFileResourceNameResolver(
                    fileResourceNamesQuery.data ?? new Map()
                ),
            }),
        [
            fileResourceNamesQuery.data,
            locale,
            organisationUnitLabelsQuery.data,
            systemInfo,
            translate,
        ]
    )

    const downloadVisibleRows = () => {
        const visibleFields = view.columns
            .map((id) => metadata.fields.get(id))
            .filter((field): field is WorkingListField => Boolean(field))
        const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`
        const cellText = (
            row: (typeof rows)[number],
            field: WorkingListField
        ) => {
            const cell = row.values[field.id]
            if (cell && !cell.valid) {
                return cell.raw == null ? '' : String(cell.raw)
            }
            const display = getCellDisplayValue(
                cell?.value,
                localizedField(field, translate),
                displayTransformers.formattingContext
            )
            return display.kind === 'image' ? display.alt : display.text
        }
        const csv = [
            visibleFields
                .map((field) => escapeCsv(fieldDisplayName(field, translate)))
                .join(','),
            ...rows.map((row) =>
                visibleFields
                    .map((field) => escapeCsv(cellText(row, field)))
                    .join(',')
            ),
        ].join('\n')
        const url = URL.createObjectURL(
            new Blob([csv], { type: 'text/csv;charset=utf-8' })
        )
        const link = document.createElement('a')
        link.href = url
        link.download = `${program.displayName}-working-list.csv`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
    }
    const resultsError = pageQuery.error ?? organisationUnitLabelsQuery.error

    return (
        <>
            <WorkingListFilterBar
                key={selectionKey}
                client={client}
                program={program}
                metadata={metadata}
                capabilities={capabilities}
                configuration={configuration}
                criteria={criteria}
                view={view}
                tableFields={tableFields}
                validationContext={serializationContext}
                calendarContext={calendarContext}
                configureMenu={
                    <ConfigureMenu
                        selectedList={selectedList}
                        selectedIsGenerated={selectedIsGenerated}
                        activeResource={
                            configuration.mode === 'event'
                                ? 'programStageWorkingLists'
                                : 'trackedEntityInstanceFilters'
                        }
                        hasFilters={
                            criteria.filters.length > 0 ||
                            criteria.mode === 'event'
                        }
                        dirty={dirty}
                        online={online}
                        busy={mutationBusy}
                        onDownload={downloadVisibleRows}
                        onSaveAs={onSaveAs}
                        onUpdate={onUpdateList}
                    />
                }
                onApplyFilter={onApplyFilter}
                onResetFilter={onResetFilter}
                onEnterStage={onEnterStage}
                onUpdateView={onUpdateView}
            />

            {resultsError ? (
                <div
                    className={styles['results-error']}
                    data-testid="results-error"
                >
                    <NoticeBox error title={i18n.t('Could not load results')}>
                        <p>
                            {resultsError instanceof Error
                                ? resultsError.message
                                : String(resultsError)}
                        </p>
                        <Button
                            onClick={() => {
                                if (pageQuery.error) {
                                    void pageQuery.refetch()
                                }
                                if (organisationUnitLabelsQuery.error) {
                                    void organisationUnitLabelsQuery.refetch()
                                }
                            }}
                        >
                            {i18n.t('Try again')}
                        </Button>
                    </NoticeBox>
                </div>
            ) : (
                <WorkingListTable
                    allFields={tableFields}
                    visibleColumnIds={view.columns}
                    rows={
                        organisationUnitLabelsReady && fileResourceNamesReady
                            ? rows
                            : []
                    }
                    dataQualityMode={dataQualityMode}
                    sort={view.sort}
                    page={page}
                    pageSize={pageSize}
                    hasNextPage={pageQuery.data?.hasNextPage ?? false}
                    isInitialLoading={
                        pageQuery.isPending ||
                        !organisationUnitLabelsReady ||
                        !fileResourceNamesReady
                    }
                    isUpdating={
                        (pageQuery.isFetching && !pageQuery.isPending) ||
                        organisationUnitLabelsQuery.isFetching ||
                        fileResourceNamesQuery.isFetching
                    }
                    formattingContext={displayTransformers.formattingContext}
                    onColumnConfigurationChange={(columns) =>
                        onUpdateView({ ...view, columns })
                    }
                    onPageChange={onPageChange}
                    onRowOpen={onRowOpen}
                    onSortChange={(sort: WorkingListSort) => {
                        onUpdateView({ ...view, sort })
                        onPageChange(1, pageSize)
                    }}
                />
            )}
        </>
    )
}
