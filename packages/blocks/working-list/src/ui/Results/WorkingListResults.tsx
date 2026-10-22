import { ErrorAlert } from '@/registry/dhis2/ui/alert'
import { Button } from '@/registry/dhis2/ui/button'
import { Spinner } from '@/registry/dhis2/ui/spinner'
import { Result } from 'better-result'
import React, { useMemo, useState, type ComponentPropsWithoutRef } from 'react'
import { fieldsForConfiguration } from '../../api/metadata'
import type { TrackerProgram } from '../../api/schemas'
import type { WorkingListField, WorkingListSort } from '../../domain/model'
import {
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from '../../provider/WorkingListContext'
import { useWorkingListPrivateUi } from '../../provider/WorkingListPrivateContext'
import type {
    WorkingListConfiguration,
    WorkingListDisplayRow,
    WorkingListResultTarget,
} from '../../provider/contracts'
import { WorkingListRepairDialog } from '../WorkingList/dialogs'
import type { WorkingListDataQualityMode } from '../types'
import {
    WorkingListDataTable,
    WorkingListTableSkeleton,
} from '../WorkingListTable'
import { useWorkingListText } from '../WorkingListText'

const visuallyHiddenClassName =
    'absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!'

export interface WorkingListTableProps extends Omit<
    ComponentPropsWithoutRef<'section'>,
    'children'
> {
    onRowClick?: (target: WorkingListResultTarget) => void
    dataQualityMode?: WorkingListDataQualityMode
}

const tableFieldsFor = (
    fields: readonly WorkingListField[],
    program: TrackerProgram,
    configuration: WorkingListConfiguration
) => {
    const currentStage =
        configuration.mode === 'event'
            ? program.programStages.find(
                  (stage) => stage.id === configuration.programStageId
              )
            : undefined
    const stageDataElementIds = new Set(
        currentStage?.programStageDataElements.map(
            (binding) => binding.dataElement.id
        ) ?? []
    )
    return fields.filter((field) => {
        if (field.columnable === false) {
            return false
        }
        if (field.source === 'trackedEntityAttribute') {
            return true
        }
        if (field.source === 'eventDataElement') {
            return (
                configuration.mode === 'event' &&
                stageDataElementIds.has(field.id)
            )
        }
        if (['createdAt', 'programOwnerId'].includes(field.id)) {
            return true
        }
        return (
            configuration.mode === 'event' &&
            [
                'eventStatus',
                'eventOccurredAt',
                'eventScheduledAt',
                'eventOrgUnit',
                'eventAssignedUser',
            ].includes(field.id)
        )
    })
}

const SelectionLoading = () => {
    const translate = useWorkingListText()
    const pageSize = useWorkingListMeta((meta) => meta.pagination.pageSize)

    // While the list initializes, the container already announces loading.
    const initializing = useWorkingListMeta(
        (meta) => meta.lifecycle.status === 'pending'
    )

    return (
        <div data-testid="working-list-selection-loading">
            {!initializing && (
                <span
                    className={visuallyHiddenClassName}
                    role="status"
                    aria-live="polite"
                >
                    {translate('Loading the selected working list…')}
                </span>
            )}
            <WorkingListTableSkeleton pageSize={pageSize} />
        </div>
    )
}

const ReadyResults = ({
    onRowClick,
    dataQualityMode,
}: Required<Pick<WorkingListTableProps, 'dataQualityMode'>> &
    Pick<WorkingListTableProps, 'onRowClick'>) => {
    const translate = useWorkingListText()
    const results = useWorkingListMeta((meta) => meta.results)
    const pagination = useWorkingListMeta((meta) => meta.pagination)
    const metadata = useWorkingListMeta((meta) => meta.fieldCatalog)
    const configuration = useWorkingListState((state) => state.configuration)
    const actions = useWorkingListActions()
    const {
        program,
        formattingContext,
        mutationBusy,
        resultTargets,
        privateActions,
    } = useWorkingListPrivateUi()

    if (!program || !metadata || !formattingContext) {
        throw new Error('WorkingListTable requires resolved metadata.')
    }
    const tableFields = useMemo(
        () =>
            tableFieldsFor(
                [...fieldsForConfiguration(metadata, configuration).values()],
                program,
                configuration
            ),
        [configuration, metadata, program]
    )
    const commit = <TValue, TError>(result: Result<TValue, TError>) => {
        if (Result.isError(result)) {
            throw result.error
        }
    }
    const openRow = (row: WorkingListDisplayRow) => {
        const target = resultTargets.get(row.id)
        if (!target) {
            throw new Error(
                `Working list row ${row.id} has no result target to open.`
            )
        }
        onRowClick?.(target)
    }

    if (results.status === 'error') {
        return (
            <div className="p-4" data-testid="results-error">
                <ErrorAlert title={translate('Could not load results')}>
                    <p>
                        {translate(
                            'The working list results could not be loaded. Check the connection and try again.'
                        )}
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => void privateActions.retryResults()}
                    >
                        {translate('Try again')}
                    </Button>
                </ErrorAlert>
            </div>
        )
    }

    return (
        <>
            <div
                className="sr-only"
                role="status"
                aria-live="polite"
                data-testid="working-list-results-announcement"
            >
                {results.status === 'pending'
                    ? translate('Loading working list results…')
                    : results.isUpdating
                      ? translate('Updating working list results…')
                      : ''}
            </div>
            <WorkingListDataTable
                allFields={tableFields}
                visibleColumnIds={configuration.columns}
                rows={
                    results.status === 'ready' ? [...results.rows] : undefined
                }
                dataQualityMode={dataQualityMode}
                sort={configuration.sort}
                page={pagination.page}
                pageSize={pagination.pageSize}
                hasNextPage={
                    results.status === 'ready'
                        ? results.pagination.hasNextPage
                        : false
                }
                isInitialLoading={results.status === 'pending'}
                isUpdating={results.status === 'ready' && results.isUpdating}
                configurationDisabled={mutationBusy}
                formattingContext={formattingContext}
                onColumnConfigurationChange={(columns) =>
                    commit(actions.setColumns(columns))
                }
                onPageChange={(page) => commit(actions.setPage(page))}
                onPageSizeChange={(pageSize) =>
                    commit(actions.setPageSize(pageSize))
                }
                onRowOpen={onRowClick ? openRow : undefined}
                onSortChange={(sort: WorkingListSort) =>
                    commit(actions.setSort(sort))
                }
            />
        </>
    )
}

const IncompatibleSelection = () => {
    const translate = useWorkingListText()
    const { selectedList, repair, privateActions } = useWorkingListPrivateUi()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [repairError, setRepairError] = useState<string>()
    const incompatibleList =
        selectedList?.compatibility === 'incompatible'
            ? selectedList
            : undefined
    const canRepair = repair?.canRepair === true
    const repairPending = repair?.isPending === true
    const repairable = canRepair || repairPending

    return (
        <>
            <div className="p-4" data-testid="stale-list-panel">
                <ErrorAlert
                    title={translate(
                        'This saved list has unavailable settings'
                    )}
                >
                    <p>
                        {repairable
                            ? translate(
                                  'Some filters, columns, or sorting options are no longer available. Repair lets you review the proposed changes before updating the list.'
                              )
                            : translate(
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
                                        aria-label={translate('Loading')}
                                        data-icon="inline-start"
                                        className="size-4"
                                    />
                                )}
                                {repairPending
                                    ? translate('Repairing…')
                                    : translate('Repair')}
                            </Button>
                            {repairPending && (
                                <span
                                    className="sr-only"
                                    role="status"
                                    aria-live="polite"
                                >
                                    {translate('Repairing this saved list…')}
                                </span>
                            )}
                        </div>
                    )}
                    {repairError && <p role="alert">{repairError}</p>}
                </ErrorAlert>
            </div>
            <WorkingListRepairDialog
                open={dialogOpen}
                list={incompatibleList}
                preview={repair?.plan}
                repairedConfiguration={repair?.repairedConfiguration}
                canRepair={canRepair}
                onClose={() => setDialogOpen(false)}
                onRepair={() => {
                    setDialogOpen(false)
                    setRepairError(undefined)
                    void privateActions
                        .repairSelectedSavedList()
                        .then((result) => {
                            if (Result.isError(result)) {
                                setRepairError(
                                    translate(
                                        'The saved working list could not be repaired.'
                                    )
                                )
                            }
                        })
                }}
            />
        </>
    )
}

const WorkingListResultsContent = ({
    onRowClick,
    dataQualityMode = 'hidden',
}: Pick<WorkingListTableProps, 'onRowClick' | 'dataQualityMode'>) => {
    const translate = useWorkingListText()
    const selection = useWorkingListMeta((meta) => meta.selection)
    const activeConfiguration = useWorkingListMeta(
        (meta) => meta.activeConfiguration
    )
    const actions = useWorkingListActions()

    return (
        <div data-testid="working-list-results-slot">
            {selection.status === 'pending' && <SelectionLoading />}
            {selection.status === 'error' &&
                (selection.error._tag === 'IncompatibleSavedListError' ? (
                    <IncompatibleSelection />
                ) : (
                    <div
                        className="p-4"
                        data-testid="unavailable-working-list-error"
                    >
                        <ErrorAlert
                            title={translate(
                                'This working list is unavailable'
                            )}
                        >
                            <p>
                                {translate(
                                    'The selected working list may no longer exist, or you may no longer have access. No records will be queried while it is selected.'
                                )}
                            </p>
                            <Button
                                variant="outline"
                                data-test="use-default-working-list"
                                onClick={() => {
                                    const result = actions.clearViewSelection()
                                    if (Result.isError(result)) {
                                        throw result.error
                                    }
                                }}
                            >
                                {translate('Use the default working list')}
                            </Button>
                        </ErrorAlert>
                    </div>
                ))}
            {selection.status === 'ready' &&
                (activeConfiguration.status === 'ready' ? (
                    <ReadyResults
                        onRowClick={onRowClick}
                        dataQualityMode={dataQualityMode}
                    />
                ) : (
                    <SelectionLoading />
                ))}
        </div>
    )
}

export const WorkingListTable = ({
    onRowClick,
    dataQualityMode = 'hidden',
    className,
    'aria-label': ariaLabel,
    ...props
}: WorkingListTableProps) => {
    const translate = useWorkingListText()

    return (
        <section
            {...props}
            aria-label={ariaLabel ?? translate('Working list results')}
            className={className}
            data-testid="working-list-table-section"
        >
            <WorkingListResultsContent
                onRowClick={onRowClick}
                dataQualityMode={dataQualityMode}
            />
        </section>
    )
}
