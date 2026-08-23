import { Button, NoticeBox } from '@dhis2/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { WorkingListClient } from '../../api/client'
import {
    savedWorkingListsQueryOptions,
    type NormalizedSavedWorkingList,
} from '../../api/savedLists'
import type { TrackerProgram } from '../../api/schemas'
import type { WorkingListSystemInfo } from '../../api/systemInfo'
import type {
    WorkingListConfiguration,
    WorkingListRowOpenEvent,
    WorkingListViewConfiguration,
} from '../../domain/model'
import { workingListQueryKeys } from '../../query/keys'
import { createWorkingListStore } from '../../store/workingListStore'
import { SavedListBar } from '../SavedListBar'
import type { WorkingListDataQualityMode } from '../types'
import { useWorkingListText } from '../WorkingListText'
import styles from './WorkingList.module.css'
import { WorkingListRepairDialog, WorkingListSharingDialog } from './dialogs'
import { WorkingListStatusBoundary } from './WorkingListStatusBoundary'
import { WorkingListWorkspace } from './WorkingListWorkspace'
import {
    useWorkingListDefinition,
    useWorkingListEditing,
    useWorkingListMutations,
    useWorkingListRepair,
} from './hooks'
import { resolveWorkingListStatus } from './selection'
import { listIdentity } from './workingListModel'

export interface WorkingListInstanceProps {
    apiVersion: number
    client: WorkingListClient
    online: boolean
    orgUnitId: string
    page: number
    pageSize: number
    program: TrackerProgram
    systemInfo: WorkingListSystemInfo
    selectedTemplateId?: string
    dataQualityMode?: WorkingListDataQualityMode
    locale?: string
    onDirtyChange?: (dirty: boolean) => void
    onPageChange: (page: number, pageSize: number) => void
    onRowOpen: (event: WorkingListRowOpenEvent) => void
    onSelectedTemplateChange: (templateId?: string) => void
    requestDiscardConfirmation: () => boolean
}

export const WorkingListInstance = ({
    apiVersion,
    client,
    online,
    orgUnitId,
    page,
    pageSize,
    program,
    systemInfo,
    dataQualityMode = 'hidden',
    locale: configuredLocale,
    selectedTemplateId,
    onDirtyChange,
    onPageChange,
    onRowOpen,
    onSelectedTemplateChange,
    requestDiscardConfirmation,
}: WorkingListInstanceProps) => {
    const translate = useWorkingListText()
    const i18n = useMemo(() => ({ t: translate }), [translate])
    const queryClient = useQueryClient()
    const {
        locale,
        valueTransformers,
        filterCalendarContext,
        capabilities,
        metadata,
        generatedLists,
        defaultList,
    } = useWorkingListDefinition({
        apiVersion,
        program,
        systemInfo,
        configuredLocale,
    })

    const store = useMemo(
        () =>
            createWorkingListStore(
                defaultList.configuration,
                listIdentity(defaultList, true)
            ),
        // The child is keyed by program ID. Do not recreate the store when
        // capability objects are recomputed for an organisation-unit change.
        [program.id]
    )
    const criteria = useStore(store, (state) => state.criteria)
    const dirty = useStore(store, (state) => state.dirty)
    const selectedListIdentity = useStore(store, (state) => state.selectedList)
    const [view, setView] = useState<WorkingListViewConfiguration>({
        columns: defaultList.configuration.columns,
        sort: defaultList.configuration.sort,
    })
    const [sharingList, setSharingList] = useState<NormalizedSavedWorkingList>()
    const [sharingError, setSharingError] = useState<string>()
    const [repairDialogOpen, setRepairDialogOpen] = useState(false)
    const [pendingCreatedTemplateId, setPendingCreatedTemplateId] =
        useState<string>()
    const lastAppliedTemplate = useRef<string | undefined>(undefined)
    const [appliedTemplateId, setAppliedTemplateId] = useState<string>()

    const {
        configuration,
        tableFields,
        updateView,
        applyFilter,
        resetFilter,
        enterStage,
    } = useWorkingListEditing({
        store,
        criteria,
        view,
        setView,
        metadata,
        program,
        pageSize,
        onPageChange,
    })
    const savedListsQuery = useQuery(
        savedWorkingListsQueryOptions({
            client,
            programId: program.id,
            metadata,
            parsingContext: valueTransformers.parsingContext,
        })
    )
    const customLists = savedListsQuery.data ?? []
    const usingGeneratedLists =
        savedListsQuery.isSuccess && customLists.length === 0
    const displayedLists = savedListsQuery.isSuccess
        ? usingGeneratedLists
            ? generatedLists
            : customLists
        : []
    const selectedList = displayedLists.find(
        (list) => list.id === (selectedTemplateId ?? selectedListIdentity?.id)
    )
    const status = useMemo(
        () =>
            resolveWorkingListStatus({
                selectedTemplateId,
                defaultTemplateId: defaultList.id,
                availableTemplateIds: displayedLists.map((list) => list.id),
                pendingCreatedTemplateId,
                savedListsResolved: savedListsQuery.isSuccess,
                savedListsFetching: savedListsQuery.isFetching,
                appliedTemplateId,
                selectedTemplateCompatibility: selectedList?.compatibility,
            }),
        [
            appliedTemplateId,
            defaultList.id,
            displayedLists,
            pendingCreatedTemplateId,
            savedListsQuery.isFetching,
            savedListsQuery.isSuccess,
            selectedList?.compatibility,
            selectedTemplateId,
        ]
    )

    const applyConfigurationView = (
        configuration: WorkingListConfiguration
    ) => {
        setView({
            columns: configuration.columns,
            sort: configuration.sort,
        })
        onPageChange(1, pageSize)
    }

    const applyList = (
        list: NormalizedSavedWorkingList,
        generated: boolean
    ) => {
        if (list.compatibility !== 'compatible') {
            return
        }
        store
            .getState()
            .selectList(listIdentity(list, generated), list.configuration)
        applyConfigurationView(list.configuration)
        lastAppliedTemplate.current = list.id
        setAppliedTemplateId(list.id)
    }

    const deselectList = () => {
        applyList(defaultList, true)
        onSelectedTemplateChange(defaultList.id)
    }

    useEffect(() => {
        if (savedListsQuery.isPending) {
            return
        }
        const requestedId = selectedTemplateId
        if (requestedId && lastAppliedTemplate.current === requestedId) {
            return
        }
        // Capture parity: a missing template selects the unfiltered default
        // view and writes its id to the URL, so a reload keeps the user on
        // the default view instead of the first saved list.
        if (!requestedId) {
            applyList(defaultList, true)
            onSelectedTemplateChange(defaultList.id)
            return
        }
        if (requestedId === defaultList.id) {
            applyList(defaultList, true)
            return
        }
        const requested = displayedLists.find((list) => list.id === requestedId)
        if (!requested) {
            if (savedListsQuery.isFetching) {
                return
            }
            if (requestedId === pendingCreatedTemplateId) {
                return
            }
            return
        }
        if (requested.compatibility !== 'compatible') {
            lastAppliedTemplate.current = requested.id
            setAppliedTemplateId(undefined)
            return
        }
        if (requested.id === pendingCreatedTemplateId) {
            setPendingCreatedTemplateId(undefined)
        }
        applyList(requested, usingGeneratedLists)
        // Selection changes are intentionally the only trigger. Applying a
        // refetched list while the user edits would discard local work.
    }, [
        savedListsQuery.dataUpdatedAt,
        savedListsQuery.isPending,
        pendingCreatedTemplateId,
        selectedTemplateId,
    ])

    useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

    const {
        createMutation,
        replaceMutation,
        deleteMutation,
        error: mutationError,
        busy: mutationBusy,
    } = useWorkingListMutations({
        client,
        programId: program.id,
        configuration,
        metadata,
        capabilities,
        serializationContext: valueTransformers.serializationContext,
        selectedListId: selectedTemplateId ?? selectedListIdentity?.id,
        onCreated: (id) => {
            setPendingCreatedTemplateId(id)
            lastAppliedTemplate.current = undefined
            onSelectedTemplateChange(id)
        },
        onAccepted: ({ list, nextConfiguration }) =>
            store
                .getState()
                .acceptConfiguration(
                    nextConfiguration,
                    listIdentity(list, false)
                ),
        onRepaired: (list) => {
            applyList(list, false)
            onSelectedTemplateChange(list.id)
        },
        onDeletedSelected: () => {
            lastAppliedTemplate.current = undefined
            onSelectedTemplateChange(undefined)
        },
    })

    const useDefaultWorkingList = () => {
        if (dirty && requestDiscardConfirmation() === false) {
            return
        }
        setPendingCreatedTemplateId(undefined)
        deselectList()
    }
    const {
        plan: repairPlan,
        result: repairResult,
        canRepair: canRepairSelectedList,
    } = useWorkingListRepair({
        selectedList,
        metadata,
        programId: program.id,
        parsingContext: valueTransformers.parsingContext,
        serializationContext: valueTransformers.serializationContext,
        online,
        mutationBusy,
    })
    if (!capabilities.supported) {
        return (
            <NoticeBox error title={i18n.t('Unsupported DHIS2 version')}>
                {i18n.t('Working lists require DHIS2 41 or newer.')}
            </NoticeBox>
        )
    }

    if (savedListsQuery.error) {
        return (
            <article
                className={styles['working-list-card']}
                data-testid="working-list"
            >
                <div className={styles['working-list-blocking-error']}>
                    <NoticeBox
                        error
                        title={i18n.t('Could not load saved working lists')}
                    >
                        <p>
                            {savedListsQuery.error instanceof Error
                                ? savedListsQuery.error.message
                                : String(savedListsQuery.error)}
                        </p>
                        <Button
                            dataTest="retry-saved-working-lists"
                            onClick={() => void savedListsQuery.refetch()}
                        >
                            {i18n.t('Try again')}
                        </Button>
                    </NoticeBox>
                </div>
            </article>
        )
    }

    return (
        <article
            className={styles['working-list-card']}
            data-testid="working-list"
        >
            <SavedListBar
                lists={displayedLists}
                selectedId={selectedTemplateId ?? selectedListIdentity?.id}
                listsAreGenerated={usingGeneratedLists}
                dirty={dirty}
                online={online}
                busy={mutationBusy}
                onUpdate={(list) =>
                    replaceMutation.mutate({
                        list,
                        name: list.name,
                        nextConfiguration: configuration,
                    })
                }
                onShare={(list) => {
                    setSharingError(undefined)
                    setSharingList(list)
                }}
                onDelete={(list) => deleteMutation.mutate(list)}
                onSelect={(list) => {
                    setPendingCreatedTemplateId(undefined)
                    const same =
                        list.id ===
                        (selectedTemplateId ?? selectedListIdentity?.id)
                    if (dirty && requestDiscardConfirmation() === false) {
                        return
                    }
                    if (same) {
                        deselectList()
                        return
                    }
                    if (list.compatibility !== 'compatible') {
                        lastAppliedTemplate.current = list.id
                        setAppliedTemplateId(undefined)
                        onSelectedTemplateChange(list.id)
                        return
                    }
                    applyList(list, usingGeneratedLists)
                    onSelectedTemplateChange(list.id)
                }}
            />

            {mutationError && (
                <NoticeBox
                    error
                    title={i18n.t('Could not save the working list')}
                >
                    {mutationError.message}
                </NoticeBox>
            )}

            <WorkingListStatusBoundary
                status={status}
                selectedList={selectedList}
                repairAvailable={repairResult?.status === 'repaired'}
                canRepair={canRepairSelectedList}
                onRetryCreatedList={() => void savedListsQuery.refetch()}
                onUseDefaultList={useDefaultWorkingList}
                onReviewRepair={() => setRepairDialogOpen(true)}
            >
                <WorkingListWorkspace
                    client={client}
                    orgUnitId={orgUnitId}
                    page={page}
                    pageSize={pageSize}
                    program={program}
                    systemInfo={systemInfo}
                    locale={locale}
                    dataQualityMode={dataQualityMode}
                    configuration={configuration}
                    criteria={criteria}
                    view={view}
                    metadata={metadata}
                    capabilities={capabilities}
                    serializationContext={
                        valueTransformers.serializationContext
                    }
                    calendarContext={filterCalendarContext}
                    tableFields={tableFields}
                    selectedList={selectedList}
                    selectedIsGenerated={usingGeneratedLists}
                    dirty={dirty}
                    online={online}
                    mutationBusy={mutationBusy}
                    selectionKey={appliedTemplateId}
                    onSaveAs={(name) => createMutation.mutate(name)}
                    onUpdateList={(list) =>
                        replaceMutation.mutate({
                            list,
                            name: list.name,
                            nextConfiguration: configuration,
                        })
                    }
                    onApplyFilter={applyFilter}
                    onResetFilter={resetFilter}
                    onEnterStage={enterStage}
                    onUpdateView={updateView}
                    onPageChange={onPageChange}
                    onRowOpen={onRowOpen}
                />
            </WorkingListStatusBoundary>

            <WorkingListSharingDialog
                list={sharingList}
                error={sharingError}
                onClose={() => setSharingList(undefined)}
                onError={setSharingError}
                onSave={() => {
                    setSharingError(undefined)
                    setSharingList(undefined)
                    void queryClient.invalidateQueries({
                        queryKey: workingListQueryKeys.savedLists(program.id),
                    })
                }}
            />
            <WorkingListRepairDialog
                open={repairDialogOpen}
                list={selectedList}
                preview={repairPlan}
                repairedConfiguration={
                    repairResult?.status === 'repaired'
                        ? repairResult.configuration
                        : undefined
                }
                canRepair={canRepairSelectedList}
                onClose={() => setRepairDialogOpen(false)}
                onRepair={(list, nextConfiguration) => {
                    setRepairDialogOpen(false)
                    replaceMutation.mutate({
                        list,
                        name: list.name,
                        nextConfiguration,
                        selectAfterReplace: true,
                    })
                }}
            />
        </article>
    )
}
