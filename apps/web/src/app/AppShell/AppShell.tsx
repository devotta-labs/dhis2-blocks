import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { Label } from '@/components/dhis2/ui/label'
import { Switch } from '@/components/dhis2/ui/switch'
import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
    useWorkingListMeta,
    type WorkingListDataQualityMode,
} from '@/components/working-list'
import { useQuery } from '@tanstack/react-query'
import React, { useEffect, useMemo, useState } from 'react'
import {
    getOrganisationUnitState,
    getProgramState,
} from '../contextTransitions'
import { DiscardChangesDialog } from '../DiscardChangesDialog'
import { OrganisationUnitSelectorContent } from '../OrganisationUnitSelectorContent'
import { resolveCaptureOrganisationUnitRoots } from '../organisationUnitScope'
import { useAppNavigation } from '../useAppNavigation'
import { useAppUrlState } from '../useAppUrlState'
import i18n from '../../i18n'
import {
    AppRuntimeConfigSchema,
    CurrentUserSchema,
    OrganisationUnitReferenceSchema,
    retryOperationalError,
} from './contextSchemas'
import { ContextStatus } from './ContextStatus'
import { createRuntimeWorkingListClient } from '@/components/working-list/api/runtimeAdapter'
import { useProgramContext } from './useProgramContext'
import { RecordDetailsModal } from './RecordDetailsModal'
import { WorkingListContextControls } from './WorkingListContextControls'
import { useOrganisationUnitPicker } from './useOrganisationUnitPicker'

const WorkingListDirtyBridge = ({
    onChange,
}: {
    onChange(dirty: boolean): void
}) => {
    const dirty = useWorkingListMeta((meta) => meta.dirty)

    useEffect(() => onChange(dirty), [dirty, onChange])
    return null
}

export const AppShell = () => {
    const engine = useDataEngine()
    const config = useConfig()
    const runtimeConfig = useMemo(
        () => AppRuntimeConfigSchema.parse(config),
        [config]
    )
    const client = useMemo(
        () => createRuntimeWorkingListClient(engine),
        [engine]
    )
    const [programSelectorOpen, setProgramSelectorOpen] = useState(false)
    const {
        setDirty,
        openedRecord,
        setOpenedRecord,
        requestTransition,
        confirmationOpen,
        cancelTransition,
        confirmTransition,
    } = useAppNavigation()
    const [dataQualityMode, setDataQualityMode] =
        useState<WorkingListDataQualityMode>('hidden')
    const [urlState, setUrlState] = useAppUrlState()

    const currentUserQuery = useQuery({
        queryKey: ['working-list', 'shell', 'current-user-org-units'],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'me',
                    params: {
                        fields: 'organisationUnits[id,displayName,path]',
                    },
                },
                CurrentUserSchema,
                signal
            ),
        staleTime: 60 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
        retry: retryOperationalError,
    })

    const selectedOrgUnitQuery = useQuery({
        queryKey: [
            'working-list',
            'shell',
            'selected-org-unit',
            urlState.orgUnitId,
        ],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'organisationUnits',
                    id: urlState.orgUnitId,
                    params: { fields: 'id,displayName,path' },
                },
                OrganisationUnitReferenceSchema,
                signal
            ),
        enabled: Boolean(urlState.orgUnitId),
        staleTime: 60 * 60 * 1000,
        gcTime: 2 * 60 * 60 * 1000,
        retry: retryOperationalError,
    })

    const searchRoots = useMemo(
        () =>
            currentUserQuery.data
                ? resolveCaptureOrganisationUnitRoots(currentUserQuery.data)
                : [],
        [currentUserQuery.data]
    )
    const programContext = useProgramContext({
        client,
        programId: urlState.programId,
        selectedOrganisationUnit: selectedOrgUnitQuery.data,
        captureRoots: searchRoots,
        baseUrl: runtimeConfig.baseUrl,
        apiVersion: runtimeConfig.apiVersion,
    })
    const {
        selectedProgram: selectedProgramSummary,
        selectedOrgUnitIsAllowed,
    } = programContext
    const organisationUnitPicker = useOrganisationUnitPicker({
        client,
        programId: selectedProgramSummary?.id,
        orgUnitId: urlState.orgUnitId,
        roots: searchRoots,
        selected: selectedOrgUnitQuery.data,
        onSelect: (unit) =>
            requestTransition(() => {
                setUrlState(getOrganisationUnitState(urlState, unit.id))
            }),
    })
    useEffect(() => {
        if (
            !urlState.programId ||
            programContext.programsLoading ||
            selectedProgramSummary
        ) {
            return
        }
        setUrlState({ orgUnitId: urlState.orgUnitId })
    }, [
        selectedProgramSummary,
        programContext.programsLoading,
        setUrlState,
        urlState,
    ])

    const updateProgram = (programId: string) => {
        requestTransition(() => {
            setProgramSelectorOpen(false)
            organisationUnitPicker.reset()
            setUrlState(getProgramState(urlState, programId))
        })
    }

    const clearOrganisationUnit = () => {
        requestTransition(() => {
            organisationUnitPicker.reset()
            setUrlState(getOrganisationUnitState(urlState, undefined))
        })
    }

    const loading =
        programContext.loading ||
        currentUserQuery.isPending ||
        Boolean(urlState.orgUnitId && selectedOrgUnitQuery.isPending)
    const shellError =
        programContext.error ??
        currentUserQuery.error ??
        (urlState.orgUnitId ? selectedOrgUnitQuery.error : undefined)

    return (
        <div className="min-h-screen w-full min-w-0 max-w-full pb-10">
            <WorkingListContextControls
                clearDisabled={!selectedProgramSummary && !urlState.orgUnitId}
                onClear={() =>
                    requestTransition(() => {
                        setProgramSelectorOpen(false)
                        organisationUnitPicker.reset()
                        setUrlState({})
                    })
                }
                programOptions={programContext.options}
                programValue={selectedProgramSummary?.id}
                programOpen={programSelectorOpen}
                onProgramOpenChange={setProgramSelectorOpen}
                onProgramChange={updateProgram}
                onProgramClear={() => updateProgram('')}
                programLoading={programContext.programsLoading}
                programLoadingLabel={i18n.t('Loading tracker programs…')}
                programAvailability={programContext.availability}
                onShowAllPrograms={clearOrganisationUnit}
                showOrganisationUnit={Boolean(selectedProgramSummary)}
                organisationUnitValue={selectedOrgUnitQuery.data?.displayName}
                organisationUnitOpen={organisationUnitPicker.isOpen}
                onOrganisationUnitOpenChange={(open) =>
                    open
                        ? organisationUnitPicker.open()
                        : organisationUnitPicker.close()
                }
                onOrganisationUnitClear={clearOrganisationUnit}
                organisationUnitLoading={currentUserQuery.isPending}
                organisationUnitDisabled={searchRoots.length === 0}
                organisationUnitContent={
                    <OrganisationUnitSelectorContent
                        {...organisationUnitPicker.contentProps}
                    />
                }
            />
            <h1
                className="absolute! m-[-1px]! h-px! w-px! overflow-hidden! whitespace-nowrap! border-0! p-0! [clip:rect(0,0,0,0)]!"
                data-testid="working-list-heading"
            >
                {i18n.t('Working lists')}
            </h1>

            <ContextStatus
                loading={loading}
                error={shellError}
                hasProgram={Boolean(selectedProgramSummary)}
                organisationUnitId={urlState.orgUnitId}
                organisationUnitIsAllowed={selectedOrgUnitIsAllowed}
                canChooseOrganisationUnit={searchRoots.length > 0}
                onChooseOrganisationUnit={organisationUnitPicker.open}
                onRetry={() => {
                    programContext.retry()
                    void currentUserQuery.refetch()
                    if (urlState.orgUnitId) {
                        void selectedOrgUnitQuery.refetch()
                    }
                }}
            />

            {!loading &&
                !shellError &&
                selectedProgramSummary &&
                urlState.orgUnitId &&
                selectedOrgUnitIsAllowed && (
                    <main
                        className="mx-auto mt-4 w-full min-w-0 max-w-[1440px] px-6 [@media(max-width:900px)]:px-3"
                        data-testid="working-list-layout"
                    >
                        <div className="flex justify-end pb-3">
                            <Label data-test="data-quality-mode-toggle">
                                <Switch
                                    checked={dataQualityMode === 'highlighted'}
                                    onCheckedChange={(checked) =>
                                        setDataQualityMode(
                                            checked ? 'highlighted' : 'hidden'
                                        )
                                    }
                                />
                                {i18n.t('Highlight data quality issues')}
                            </Label>
                        </div>
                        <WorkingList
                            programId={selectedProgramSummary.id}
                            orgUnitId={urlState.orgUnitId}
                            viewId={urlState.selectedTemplateId ?? null}
                            pagination={{
                                page: urlState.page ?? 1,
                                pageSize: urlState.pageSize ?? 15,
                            }}
                            onPaginationChange={({ page, pageSize }) =>
                                setUrlState((current) => ({
                                    ...current,
                                    page,
                                    pageSize,
                                }))
                            }
                            onViewChange={(viewId) =>
                                setUrlState((current) => ({
                                    ...current,
                                    selectedTemplateId: viewId,
                                    page: 1,
                                }))
                            }
                        >
                            <WorkingListDirtyBridge onChange={setDirty} />
                            <WorkingListViewSwitcher />
                            <WorkingListToolbar>
                                <WorkingListColumnSelector />
                                <WorkingListFilterControls />
                                <WorkingListToolbarActions />
                            </WorkingListToolbar>
                            <WorkingListTable
                                dataQualityMode={dataQualityMode}
                                onRowClick={setOpenedRecord}
                            />
                        </WorkingList>
                    </main>
                )}

            <DiscardChangesDialog
                open={confirmationOpen}
                onCancel={cancelTransition}
                onDiscard={confirmTransition}
            />

            {openedRecord && (
                <RecordDetailsModal
                    record={openedRecord}
                    onClose={() => setOpenedRecord(undefined)}
                />
            )}

            <footer className="mx-auto mt-8 flex w-full max-w-[1440px] justify-end px-6 [@media(max-width:900px)]:px-3">
                <a
                    className="text-xs text-[#6c7787] underline-offset-2 hover:text-[#147cd7] hover:underline"
                    href="#/context-selector-showcase"
                >
                    Context Selector showcase
                </a>
            </footer>
        </div>
    )
}
