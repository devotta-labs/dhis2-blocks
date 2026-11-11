import i18n from '@dhis2/d2-i18n'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { Spinner } from '@/components/dhis2/ui/spinner'
import React, { useMemo, useState, type ComponentPropsWithoutRef } from 'react'
import { useOnlineStatus } from '@dhis2/app-runtime'
import { fieldsForConfiguration } from '../../api/metadata'
import type { NormalizedSavedWorkingList } from '../../api/savedLists'
import type { WorkingListSort } from '../../domain/model'
import {
    savesToSameResource,
    useIsSavingList,
    useRepairSavedList,
} from '../../provider/mutations'
import {
    canUpdateSavedList,
    useSavedLists,
    useWorkingListMetadata,
    useWorkingListRecords,
    useWorkingListView,
    type WorkingListMetadata,
    type WorkingListSelectedView,
} from '../../provider/queries'
import { planSavedListRepair } from '../../provider/repair'
import { useWorkingList } from '../../provider/WorkingListContext'
import { tableFieldsFor } from '../tableFields'
import type {
    WorkingListDisplayRow,
    WorkingListResultTarget,
} from '../../provider/contracts'
import { WorkingListRepairDialog } from '../WorkingList/dialogs'
import type { WorkingListDataQualityMode } from '../types'
import {
    WorkingListDataTable,
    WorkingListTableSkeleton,
} from '../WorkingListTable'

const visuallyHiddenClassName =
    'absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!'

export interface WorkingListTableProps extends Omit<
    ComponentPropsWithoutRef<'section'>,
    'children'
> {
    onRowClick?: (target: WorkingListResultTarget) => void
    dataQualityMode?: WorkingListDataQualityMode
}

const ViewLoading = () => {
    const { pagination } = useWorkingList()
    // While the program loads, the container already announces loading.
    const initializing = useWorkingListMetadata().isPending

    return (
        <div data-testid="working-list-selection-loading">
            {!initializing && (
                <span
                    className={visuallyHiddenClassName}
                    role="status"
                    aria-live="polite"
                >
                    {i18n.t('Loading the selected working list…')}
                </span>
            )}
            <WorkingListTableSkeleton pageSize={pagination.pageSize} />
        </div>
    )
}

const Records = ({
    metadata,
    view: { configuration },
    onRowClick,
    dataQualityMode,
}: Required<Pick<WorkingListTableProps, 'dataQualityMode'>> &
    Pick<WorkingListTableProps, 'onRowClick'> & {
        metadata: WorkingListMetadata
        view: WorkingListSelectedView
    }) => {
    const records = useWorkingListRecords()
    const { pagination, setDraft, setPagination } = useWorkingList()
    const saving = useIsSavingList()
    const tableFields = useMemo(
        () =>
            tableFieldsFor(
                [
                    ...fieldsForConfiguration(
                        metadata.fieldCatalog,
                        configuration
                    ).values(),
                ],
                metadata.program,
                configuration
            ),
        [configuration, metadata]
    )

    if (records.isError) {
        return (
            <div className="p-4" data-testid="results-error">
                <ErrorAlert title={i18n.t('Could not load results')}>
                    <p>
                        {i18n.t(
                            'The working list results could not be loaded. Check the connection and try again.'
                        )}
                    </p>
                    <Button variant="outline" onClick={records.refetch}>
                        {i18n.t('Try again')}
                    </Button>
                </ErrorAlert>
            </div>
        )
    }

    const page = records.data
    const openRow = (row: WorkingListDisplayRow) => {
        const target = page?.targets.get(row.id)
        if (!target) {
            throw new Error(
                `Working list row ${row.id} has no result target to open.`
            )
        }
        onRowClick?.(target)
    }
    let announcement = ''
    if (records.isPending) {
        announcement = i18n.t('Loading working list results…')
    } else if (records.data.isUpdating) {
        announcement = i18n.t('Updating working list results…')
    }

    return (
        <>
            <div
                className="sr-only"
                role="status"
                aria-live="polite"
                data-testid="working-list-results-announcement"
            >
                {announcement}
            </div>
            <WorkingListDataTable
                allFields={tableFields}
                visibleColumnIds={configuration.columns}
                rows={page?.rows}
                dataQualityMode={dataQualityMode}
                sort={configuration.sort}
                page={pagination.page}
                pageSize={pagination.pageSize}
                hasNextPage={page?.hasNextPage ?? false}
                isInitialLoading={records.isPending}
                isUpdating={page?.isUpdating ?? false}
                configurationDisabled={saving}
                formattingContext={page?.formattingContext}
                onColumnConfigurationChange={(columns) =>
                    setDraft({ ...configuration, columns })
                }
                onPageChange={(next) =>
                    setPagination({ page: next, pageSize: pagination.pageSize })
                }
                onPageSizeChange={(pageSize) =>
                    setPagination({ page: 1, pageSize })
                }
                onRowOpen={onRowClick ? openRow : undefined}
                onSortChange={(sort: WorkingListSort) =>
                    setDraft({ ...configuration, sort })
                }
            />
        </>
    )
}

const IncompatibleSelection = ({
    list,
    metadata,
}: {
    list: Extract<NormalizedSavedWorkingList, { compatibility: 'incompatible' }>
    metadata: WorkingListMetadata
}) => {
    const { programId } = useWorkingList()
    const { online } = useOnlineStatus()
    const repair = useRepairSavedList()
    const [dialogOpen, setDialogOpen] = useState(false)
    const proposal = useMemo(
        () =>
            planSavedListRepair({
                list,
                metadata: metadata.fieldCatalog,
                programId,
                parsingContext: metadata.parsingContext,
                serializationContext: metadata.serializationContext,
            }),
        [list, metadata, programId]
    )
    const repairedConfiguration = proposal.repairedConfiguration
    const repairPending = repair.isPending
    const canRepair = Boolean(
        online &&
        !repairPending &&
        repairedConfiguration &&
        canUpdateSavedList(list) &&
        savesToSameResource(list, repairedConfiguration)
    )
    const repairable = canRepair || repairPending
    return (
        <>
            <div className="p-4" data-testid="stale-list-panel">
                <ErrorAlert
                    title={i18n.t('This saved list has unavailable settings')}
                >
                    <p>
                        {repairable
                            ? i18n.t(
                                  'Some filters, columns, or sorting options are no longer available. Repair lets you review the proposed changes before updating the list.'
                              )
                            : i18n.t(
                                  'Some parts of this list are no longer available. Ask someone who can edit the list to repair it, or select another list.'
                              )}
                    </p>
                    {repairable && (
                        <div className="mt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                data-test="repair-working-list"
                                disabled={repairPending}
                                onClick={() => setDialogOpen(true)}
                            >
                                {repairPending && (
                                    <Spinner
                                        aria-label={i18n.t('Loading')}
                                        data-icon="inline-start"
                                        className="size-4"
                                    />
                                )}
                                {repairPending
                                    ? i18n.t('Repairing…')
                                    : i18n.t('Repair')}
                            </Button>
                            {repairPending && (
                                <span
                                    className="sr-only"
                                    role="status"
                                    aria-live="polite"
                                >
                                    {i18n.t('Repairing this saved list…')}
                                </span>
                            )}
                        </div>
                    )}
                    {repair.isError && (
                        <p role="alert">
                            {i18n.t(
                                'The saved working list could not be repaired.'
                            )}
                        </p>
                    )}
                </ErrorAlert>
            </div>
            <WorkingListRepairDialog
                open={dialogOpen}
                list={list}
                preview={proposal.plan}
                repairedConfiguration={repairedConfiguration}
                canRepair={canRepair}
                onClose={() => setDialogOpen(false)}
                onRepair={() => {
                    setDialogOpen(false)
                    if (!repairedConfiguration) return
                    repair.mutate({
                        list,
                        configuration: repairedConfiguration,
                    })
                }}
            />
        </>
    )
}

/**
 * Why the selected saved list cannot load, with a way out: a repair for an
 * incompatible list, otherwise the default list. Renders nothing while the
 * selection works, so any layout can show it in place of its results.
 */
export const WorkingListSelectionError = () => {
    const { viewId, selectView } = useWorkingList()
    const metadata = useWorkingListMetadata().data
    const savedLists = useSavedLists().data
    const view = useWorkingListView()

    if (!view.isError || !metadata) return null
    const list = savedLists?.lists.find((candidate) => candidate.id === viewId)
    if (list?.compatibility === 'incompatible') {
        return <IncompatibleSelection list={list} metadata={metadata} />
    }
    return (
        <div className="p-4" data-testid="unavailable-working-list-error">
            <ErrorAlert title={i18n.t('This working list is unavailable')}>
                <p>
                    {i18n.t(
                        'The selected working list may no longer exist, or you may no longer have access. No records will be queried while it is selected.'
                    )}
                </p>
                <Button
                    variant="outline"
                    data-test="use-default-working-list"
                    onClick={() => selectView(null)}
                >
                    {i18n.t('Use the default working list')}
                </Button>
            </ErrorAlert>
        </div>
    )
}

const WorkingListResultsContent = ({
    onRowClick,
    dataQualityMode = 'hidden',
}: Pick<WorkingListTableProps, 'onRowClick' | 'dataQualityMode'>) => {
    const metadata = useWorkingListMetadata().data
    const view = useWorkingListView()

    if (view.isError) return <WorkingListSelectionError />
    if (view.isPending || !metadata) return <ViewLoading />
    return (
        <Records
            metadata={metadata}
            view={view.data}
            onRowClick={onRowClick}
            dataQualityMode={dataQualityMode}
        />
    )
}

export const WorkingListTable = ({
    onRowClick,
    dataQualityMode = 'hidden',
    className,
    'aria-label': ariaLabel,
    ...props
}: WorkingListTableProps) => {
    return (
        <section
            {...props}
            aria-label={ariaLabel ?? i18n.t('Working list results')}
            className={className}
            data-testid="working-list-table-section"
        >
            <div data-testid="working-list-results-slot">
                <WorkingListResultsContent
                    onRowClick={onRowClick}
                    dataQualityMode={dataQualityMode}
                />
            </div>
        </section>
    )
}
