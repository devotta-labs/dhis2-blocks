import {
    Button,
    CircularLoader,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
    NoticeBox,
} from '@dhis2/ui'
import {
    useMutation,
    useQuery,
    useQueryClient,
    type QueryClient,
} from '@tanstack/react-query'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import {
    detectMetadataFeatures,
    resolveWorkingListCapabilities,
} from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import {
    buildProgramFieldCatalog,
    type ProgramFieldCatalog,
} from '../../api/metadata'
import {
    createDefaultWorkingList,
    createGeneratedDefaultLists,
    createSavedWorkingList,
    deleteSavedWorkingList,
    repairSavedWorkingList,
    replaceSavedWorkingList,
    savedWorkingListsQueryOptions,
    type NormalizedSavedWorkingList,
} from '../../api/savedLists'
import type {
    ProgramStageWorkingList,
    TrackedEntityInstanceFilter,
    TrackerProgram,
} from '../../api/schemas'
import type { WorkingListSystemInfo } from '../../api/systemInfo'
import type {
    AppliedFilter,
    WorkingListConfiguration,
    WorkingListField,
    WorkingListRowOpenEvent,
    WorkingListSort,
    WorkingListViewConfiguration,
} from '../../domain/model'
import { WorkingListContextSchema } from '../../domain/schemas'
import {
    type StaleReferenceIssue,
    type StaleReferenceRepairDecision,
} from '../../domain/staleReferences'
import {
    workingListPageQueryOptions,
    type WorkingListPage,
} from '../../query/fetchers'
import {
    collectFileResourceIds,
    createFileResourceNameResolver,
    fileResourceNamesQueryOptions,
} from '../../query/fileResourceLabels'
import { workingListQueryKeys } from '../../query/keys'
import {
    collectOrganisationUnitIds,
    createOrganisationUnitLabelResolver,
    organisationUnitLabelsQueryOptions,
} from '../../query/referenceLabels'
import { DEFAULT_WORKING_LIST_SORT } from '../../query/serialize'
import { systemFilterRegistry } from '../../registry/systemFilters'
import { createWorkingListValueTransformers } from '../../registry/transformers'
import {
    composeWorkingListConfiguration,
    createWorkingListStore,
    type SelectedWorkingListIdentity,
} from '../../store/workingListStore'
import { ColumnSettingsDialog } from '../ColumnSettingsDialog'
import { ConfigureMenu } from '../ConfigureMenu'
import {
    FilterButton,
    MoreFilters,
    ProgramStageControl,
} from '../FilterControls'
import { SavedListBar } from '../SavedListBar'
import type {
    WorkingListDataQualityMode,
    WorkingListDisplayRow,
} from '../types'
import { WorkingListQueryBoundary } from '../WorkingListQueryBoundary'
import { WorkingListTable } from '../WorkingListTable'
import {
    WorkingListTextProvider,
    useWorkingListText,
    type WorkingListTranslate,
} from '../WorkingListText'
import '../working-list.css'

export interface WorkingListProps {
    apiVersion: number
    client: WorkingListClient
    online: boolean
    /** A selected organisation unit is mandatory; requests are SELECTED-only. */
    orgUnitId: string
    page: number
    pageSize: number
    program: TrackerProgram
    systemInfo: WorkingListSystemInfo
    selectedTemplateId?: string
    /**
     * Whether rows with data-quality issues get a visual highlight. Validation
     * always runs and invalid rows always render; the default 'hidden' mode
     * only hides the highlight, e.g. for end users in the field.
     */
    dataQualityMode?: WorkingListDataQualityMode
    /** BCP 47 locale used for list formatting. Falls back to the host browser. */
    locale?: string
    /** Optional package-local translation adapter. Defaults to DHIS2 i18n. */
    translate?: WorkingListTranslate
    /** Optional shared cache; otherwise the component owns its QueryClient. */
    queryClient?: QueryClient
    onDirtyChange?: (dirty: boolean) => void
    onPageChange: (page: number, pageSize: number) => void
    onRowOpen: (event: WorkingListRowOpenEvent) => void
    onSelectedTemplateChange: (templateId?: string) => void
    /** Called before a view change would discard unsaved working-list edits. */
    requestDiscardConfirmation: () => boolean
}

const defaultVisibleFilterIds = (
    fields: WorkingListField[],
    scope: 'trackedEntity' | 'event'
) => {
    const systemDefaults = [...systemFilterRegistry.values()]
        .filter(
            (definition) =>
                definition.defaultVisible &&
                definition.field.scope === scope &&
                definition.id !== 'programStage'
        )
        .map((definition) => definition.id)
    if (scope === 'event') {
        return systemDefaults
    }
    const firstAttribute = fields.find(
        (field) =>
            field.scope === 'trackedEntity' &&
            field.source === 'trackedEntityAttribute' &&
            field.filterable
    )
    return firstAttribute
        ? [...systemDefaults, firstAttribute.id]
        : systemDefaults
}

const visibleFiltersForConfiguration = (
    configuration: WorkingListConfiguration,
    fields: WorkingListField[]
) => {
    const tracker = new Set([
        ...defaultVisibleFilterIds(fields, 'trackedEntity'),
        ...configuration.filters
            .filter((filter) => filter.field.scope === 'trackedEntity')
            .map((filter) => filter.field.id),
    ])
    const event = new Set([
        ...defaultVisibleFilterIds(fields, 'event'),
        ...configuration.filters
            .filter((filter) => filter.field.scope === 'event')
            .map((filter) => filter.field.id),
    ])
    return { tracker: [...tracker], event: [...event] }
}

const listIdentity = (
    list: NormalizedSavedWorkingList,
    generated: boolean
): SelectedWorkingListIdentity => ({
    id: list.id,
    resource: generated ? 'generatedDefault' : list.resource,
})

const staleIssueLabel = (
    issue: StaleReferenceIssue,
    translate: WorkingListTranslate
) => {
    const values = { reference: issue.referenceId }
    switch (issue.kind) {
        case 'programMismatch':
            return translate(
                'This view belongs to a different program ({{reference}}).',
                values
            )
        case 'missingProgramStage':
            return translate(
                'Program stage {{reference}} is no longer available.',
                values
            )
        case 'missingFilterField':
            return translate(
                'Filter field {{reference}} is no longer available.',
                values
            )
        case 'missingColumn':
            return translate(
                'Column {{reference}} is no longer available.',
                values
            )
        case 'missingSortField':
            return translate(
                'Sort field {{reference}} is no longer available.',
                values
            )
        case 'scopeMismatch':
            return translate(
                'Field {{reference}} cannot be used at this result level.',
                values
            )
        case 'fieldChanged':
            return translate(
                'Field {{reference}} has changed type or source.',
                values
            )
        case 'programStageFieldMismatch':
            return translate(
                'Field {{reference}} does not belong to this program stage.',
                values
            )
        case 'unsupportedFilter':
            return translate(
                'Filter {{reference}} is not supported by this server.',
                values
            )
        case 'noVisibleColumns':
            return translate('The repaired view would have no visible columns.')
    }
}

interface SavedListRepairDecisions {
    decisions: StaleReferenceRepairDecision[]
    removedFilters: number
    removedColumns: number
    replacedColumns: number
    replacedSort: boolean
}

const createSavedListRepairDecisions = (
    list: Extract<
        NormalizedSavedWorkingList,
        { compatibility: 'incompatible' }
    >,
    metadata: ProgramFieldCatalog
): SavedListRepairDecisions => {
    const candidate = list.candidateConfiguration
    const issueByPath = new Map(list.issues.map((issue) => [issue.path, issue]))
    const invalidColumnPaths = new Set(
        list.issues
            .filter(
                (issue) =>
                    issue.kind === 'missingColumn' ||
                    (issue.kind === 'programStageFieldMismatch' &&
                        issue.path.startsWith('columns.'))
            )
            .map((issue) => issue.path)
    )
    const rawColumns =
        list.resource === 'trackedEntityInstanceFilters'
            ? (list.raw as TrackedEntityInstanceFilter).entityQueryCriteria
                  ?.displayColumnOrder
            : (list.raw as ProgramStageWorkingList).programStageQueryCriteria
                  ?.displayColumnOrder
    const validColumnCount = candidate
        ? candidate.columns.filter(
              (_column, index) => !invalidColumnPaths.has(`columns.${index}`)
          ).length
        : Math.max((rawColumns?.length ?? 0) - invalidColumnPaths.size, 0)
    const rawProgramStageId =
        list.resource === 'programStageWorkingLists'
            ? (list.raw as ProgramStageWorkingList).programStage.id
            : undefined
    const defaultColumns =
        candidate?.mode === 'event'
            ? (metadata.defaultEventColumnsByStage.get(
                  candidate.programStageId
              ) ?? [])
            : rawProgramStageId
              ? (metadata.defaultEventColumnsByStage.get(rawProgramStageId) ??
                [])
              : metadata.defaultTrackedEntityColumns
    const fallbackColumn = defaultColumns.find((fieldId) =>
        metadata.fields.has(fieldId)
    )
    let replacementColumnUsed = false
    const decisions: StaleReferenceRepairDecision[] = []

    for (const [path, issue] of issueByPath) {
        if (
            issue.kind === 'missingFilterField' ||
            issue.kind === 'fieldChanged' ||
            issue.kind === 'scopeMismatch' ||
            issue.kind === 'unsupportedFilter' ||
            (issue.kind === 'programStageFieldMismatch' &&
                path.startsWith('filters.')) ||
            path.startsWith('attributeValueFilters.') ||
            path.startsWith('dataFilters.')
        ) {
            decisions.push({ path, action: 'remove' })
            continue
        }
        if (
            issue.kind === 'missingColumn' ||
            (issue.kind === 'programStageFieldMismatch' &&
                path.startsWith('columns.')) ||
            path.startsWith('displayColumnOrder.')
        ) {
            if (
                validColumnCount === 0 &&
                !replacementColumnUsed &&
                fallbackColumn
            ) {
                decisions.push({
                    path,
                    action: 'replaceColumn',
                    fieldId: fallbackColumn,
                })
                replacementColumnUsed = true
            } else {
                decisions.push({ path, action: 'remove' })
            }
            continue
        }
        if (
            (issue.kind === 'missingSortField' ||
                issue.kind === 'programStageFieldMismatch') &&
            (path === 'sort.fieldId' || path === 'order')
        ) {
            const fallbackSortField = metadata.fields.has(
                DEFAULT_WORKING_LIST_SORT.fieldId
            )
                ? DEFAULT_WORKING_LIST_SORT.fieldId
                : (fallbackColumn ?? candidate?.columns[0])
            if (fallbackSortField) {
                decisions.push({
                    path,
                    action: 'replaceSort',
                    sort: {
                        fieldId: fallbackSortField,
                        direction: DEFAULT_WORKING_LIST_SORT.direction,
                    },
                })
            }
        }
    }

    return {
        decisions,
        removedFilters: decisions.filter(
            (decision) =>
                decision.action === 'remove' &&
                (decision.path.startsWith('filters.') ||
                    decision.path.startsWith('attributeValueFilters.') ||
                    decision.path.startsWith('dataFilters.'))
        ).length,
        removedColumns: decisions.filter(
            (decision) =>
                decision.action === 'remove' &&
                (decision.path.startsWith('columns.') ||
                    decision.path.startsWith('displayColumnOrder.'))
        ).length,
        replacedColumns: decisions.filter(
            (decision) => decision.action === 'replaceColumn'
        ).length,
        replacedSort: decisions.some(
            (decision) => decision.action === 'replaceSort'
        ),
    }
}

const pageRows = (
    pageData: WorkingListPage | undefined
): WorkingListDisplayRow[] => {
    if (!pageData) {
        return []
    }
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
        trackedEntityId: record.event.event.trackedEntity,
        values: {
            ...record.trackedEntity?.values,
            ...record.event.values,
        },
        issues: [
            ...(record.trackedEntity?.issues ?? []),
            ...record.event.issues,
        ],
    }))
}

type WorkingListInstanceProps = Omit<
    WorkingListProps,
    'queryClient' | 'translate'
>

export const WorkingList = ({
    queryClient,
    translate,
    ...props
}: WorkingListProps) => {
    if (props.program.programType !== 'WITH_REGISTRATION') {
        throw new Error(
            translate?.(
                'Working lists require a tracker program with registration.'
            ) ?? 'Working lists require a tracker program with registration.'
        )
    }

    const context = WorkingListContextSchema.parse({
        orgUnitId: props.orgUnitId,
        programId: props.program.id,
    })
    const instanceProps: WorkingListInstanceProps = {
        ...props,
        orgUnitId: context.orgUnitId,
    }

    return (
        <WorkingListQueryBoundary client={queryClient}>
            <WorkingListTextProvider translate={translate}>
                <WorkingListInstance
                    key={props.program.id}
                    {...instanceProps}
                />
            </WorkingListTextProvider>
        </WorkingListQueryBoundary>
    )
}

const WorkingListInstance = ({
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
    const locale =
        configuredLocale ??
        (typeof navigator === 'undefined' ? 'en' : navigator.language)
    const valueTransformers = useMemo(
        () =>
            createWorkingListValueTransformers({
                systemInfo,
                locale,
                trueLabel: i18n.t('Yes'),
                falseLabel: i18n.t('No'),
            }),
        [locale, systemInfo, translate]
    )
    const filterCalendarContext = useMemo(
        () => ({
            calendar: systemInfo.calendar,
            dateFormat: systemInfo.dateFormat,
            locale,
            timeZone: systemInfo.serverTimeZoneId,
        }),
        [locale, systemInfo]
    )
    const capabilities = useMemo(
        () =>
            resolveWorkingListCapabilities({
                apiVersion,
                metadataFeatures: detectMetadataFeatures(program),
            }),
        [apiVersion, program]
    )
    const metadata = useMemo(
        () =>
            buildProgramFieldCatalog({
                program,
                capabilities,
                hasSelectedOrgUnit: true,
            }),
        [capabilities, program]
    )
    const fields = useMemo(
        () => [...metadata.fields.values()],
        [metadata.fields]
    )
    const generatedLists = useMemo(
        () =>
            createGeneratedDefaultLists({
                programId: program.id,
                columns: metadata.defaultTrackedEntityColumns,
                fields: metadata.fields,
            }),
        [metadata, program.id]
    )
    // Capture parity: the unfiltered default view is a synthetic template
    // with the concatenated id `<programId>-default`. It is never listed as
    // a pill and is selected whenever no saved list is.
    const defaultList = useMemo(
        () =>
            createDefaultWorkingList({
                programId: program.id,
                columns: metadata.defaultTrackedEntityColumns,
            }),
        [metadata.defaultTrackedEntityColumns, program.id]
    )
    if (!defaultList.configuration.columns.length) {
        throw new Error(
            `Program ${program.id} has no usable default working list`
        )
    }

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
    const [visibleTrackerFilterIds, setVisibleTrackerFilterIds] = useState(
        () =>
            visibleFiltersForConfiguration(defaultList.configuration, fields)
                .tracker
    )
    const [visibleEventFilterIds, setVisibleEventFilterIds] = useState(
        () =>
            visibleFiltersForConfiguration(defaultList.configuration, fields)
                .event
    )
    const [stageFilterVisible, setStageFilterVisible] = useState(false)
    // Opens a filter's editor right after it is added from "More filters".
    // Cleared on the next commit so remounts don't reopen it.
    const [autoOpenFilterId, setAutoOpenFilterId] = useState<string>()
    useEffect(() => {
        if (autoOpenFilterId) {
            setAutoOpenFilterId(undefined)
        }
    }, [autoOpenFilterId])
    const [columnSettingsOpen, setColumnSettingsOpen] = useState(false)
    const [repairDialogOpen, setRepairDialogOpen] = useState(false)
    const [pendingCreatedTemplateId, setPendingCreatedTemplateId] =
        useState<string>()
    const lastAppliedTemplate = useRef<string | undefined>(undefined)
    const [appliedTemplateId, setAppliedTemplateId] = useState<string>()

    const configuration = useMemo(
        () => composeWorkingListConfiguration(criteria, view),
        [criteria, view]
    )
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

    const applyConfigurationView = (
        configuration: WorkingListConfiguration
    ) => {
        setView({
            columns: configuration.columns,
            sort: configuration.sort,
        })
        const visible = visibleFiltersForConfiguration(configuration, fields)
        setVisibleTrackerFilterIds(visible.tracker)
        setVisibleEventFilterIds(visible.event)
        setStageFilterVisible(configuration.mode === 'event')
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
            applyList(defaultList, true)
            onSelectedTemplateChange(defaultList.id)
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

    const requestedTemplateId = selectedTemplateId ?? defaultList.id
    const selectionReady =
        savedListsQuery.isSuccess && appliedTemplateId === requestedTemplateId
    const pageQuery = useQuery({
        ...workingListPageQueryOptions({
            client,
            context: { programId: program.id, orgUnitId },
            configuration,
            pagination: { page, pageSize },
            capabilities,
            fields: metadata.fields,
            serializationContext: valueTransformers.serializationContext,
            translate,
        }),
        enabled: selectionReady,
    })
    const rows = useMemo(
        () => (selectionReady ? pageRows(pageQuery.data) : []),
        [pageQuery.data, selectionReady]
    )
    const organisationUnitIds = useMemo(
        () =>
            pageQuery.data
                ? collectOrganisationUnitIds(pageQuery.data, metadata.fields)
                : [],
        [metadata.fields, pageQuery.data]
    )
    const organisationUnitLabelsQuery = useQuery({
        ...organisationUnitLabelsQueryOptions(client, organisationUnitIds),
        enabled:
            selectionReady &&
            Boolean(pageQuery.data) &&
            organisationUnitIds.length > 0,
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
        enabled:
            selectionReady &&
            Boolean(pageQuery.data) &&
            fileResourceIds.length > 0,
    })
    // Capture parity: unresolved file names blank their cells; a failed
    // lookup never blocks the table.
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
            locale,
            organisationUnitLabelsQuery.data,
            fileResourceNamesQuery.data,
            systemInfo,
            translate,
        ]
    )

    useEffect(() => {
        if (!selectionReady || !pageQuery.data?.hasNextPage) {
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
                serializationContext: valueTransformers.serializationContext,
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
        selectionReady,
        translate,
        valueTransformers.serializationContext,
    ])

    const updateView = (next: WorkingListViewConfiguration) => {
        setView(next)
        store.getState().reconcileView(next)
    }
    const setFilters = (filters: AppliedFilter[]) => {
        store.getState().setFilters(filters)
        store.getState().reconcileView(view)
        onPageChange(1, pageSize)
    }
    const applyFilter = (filter: AppliedFilter) =>
        setFilters([
            ...criteria.filters.filter(
                (item) => item.field.id !== filter.field.id
            ),
            filter,
        ])
    const resetFilter = (fieldId: string) =>
        setFilters(
            criteria.filters.filter((filter) => filter.field.id !== fieldId)
        )

    const trackerFilterFields = fields.filter(
        (field) => field.scope === 'trackedEntity' && field.filterable
    )
    const currentStage =
        configuration.mode === 'event'
            ? program.programStages.find(
                  (stage) => stage.id === configuration.programStageId
              )
            : undefined
    const currentStageDataElementIds = new Set(
        currentStage?.programStageDataElements.map(
            (binding) => binding.dataElement.id
        ) ?? []
    )
    const eventFilterFields = fields.filter(
        (field) =>
            field.scope === 'event' &&
            field.id !== 'programStage' &&
            field.filterable &&
            (field.source !== 'eventDataElement' ||
                currentStageDataElementIds.has(field.id))
    )
    const tableFields = fields.filter((field) => {
        if (field.source === 'trackedEntityAttribute') {
            return true
        }
        if (field.source === 'eventDataElement') {
            return (
                configuration.mode === 'event' &&
                currentStageDataElementIds.has(field.id)
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

    const enterStage = (stageId?: string) => {
        if (!stageId) {
            store.getState().leaveEventMode()
            const next = {
                columns: metadata.defaultTrackedEntityColumns,
                sort: { ...DEFAULT_WORKING_LIST_SORT },
            }
            updateView(next)
            onPageChange(1, pageSize)
            return
        }
        store.getState().enterEventMode(stageId)
        const next = {
            columns:
                metadata.defaultEventColumnsByStage.get(stageId) ??
                metadata.defaultTrackedEntityColumns,
            sort: { ...DEFAULT_WORKING_LIST_SORT },
        }
        updateView(next)
        setVisibleEventFilterIds(defaultVisibleFilterIds(fields, 'event'))
        onPageChange(1, pageSize)
    }

    const createMutation = useMutation({
        mutationFn: (name: string) =>
            createSavedWorkingList({
                client,
                name,
                configuration,
                fields: metadata.fields,
                capabilities,
                serializationContext: valueTransformers.serializationContext,
            }),
        onSuccess: async (id) => {
            setPendingCreatedTemplateId(id)
            lastAppliedTemplate.current = undefined
            onSelectedTemplateChange(id)
            await queryClient.invalidateQueries({
                queryKey: workingListQueryKeys.savedLists(program.id),
            })
        },
    })
    const replaceMutation = useMutation({
        mutationFn: ({
            list,
            name,
            nextConfiguration,
        }: {
            list: NormalizedSavedWorkingList
            name: string
            nextConfiguration: WorkingListConfiguration
            selectAfterReplace?: boolean
        }) => {
            const targetResource =
                nextConfiguration.mode === 'event'
                    ? 'programStageWorkingLists'
                    : 'trackedEntityInstanceFilters'
            if (list.resource !== targetResource) {
                throw new Error(
                    i18n.t(
                        'Save this mode change as a new working list instead of replacing a different resource type.'
                    )
                )
            }
            return replaceSavedWorkingList({
                client,
                id: list.id,
                resource: list.resource,
                name,
                configuration: nextConfiguration,
                fields: metadata.fields,
                capabilities,
                sharing: list.sharing,
                existingResource: list.raw,
                serializationContext: valueTransformers.serializationContext,
            })
        },
        onSuccess: async (_data, variables) => {
            if (variables.selectAfterReplace) {
                const repairedList: NormalizedSavedWorkingList = {
                    id: variables.list.id,
                    name: variables.name,
                    resource: variables.list.resource,
                    sortOrder: variables.list.sortOrder,
                    sharing: variables.list.sharing,
                    compatibility: 'compatible',
                    configuration: variables.nextConfiguration,
                }
                applyList(repairedList, false)
                onSelectedTemplateChange(repairedList.id)
            } else {
                store
                    .getState()
                    .acceptConfiguration(
                        variables.nextConfiguration,
                        listIdentity(variables.list, false)
                    )
            }
            await queryClient.invalidateQueries({
                queryKey: workingListQueryKeys.savedLists(program.id),
            })
        },
    })
    const renameMutation = useMutation({
        mutationFn: ({
            list,
            name,
        }: {
            list: NormalizedSavedWorkingList
            name: string
        }) => {
            if (list.compatibility !== 'compatible') {
                throw new Error(
                    i18n.t('An unavailable saved list cannot be renamed.')
                )
            }
            return replaceSavedWorkingList({
                client,
                id: list.id,
                resource: list.resource,
                name,
                configuration: list.configuration,
                fields: metadata.fields,
                capabilities,
                sharing: list.sharing,
                existingResource: list.raw,
                serializationContext: valueTransformers.serializationContext,
            })
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: workingListQueryKeys.savedLists(program.id),
            })
        },
    })
    const deleteMutation = useMutation({
        mutationFn: (list: NormalizedSavedWorkingList) =>
            deleteSavedWorkingList(client, list.resource, list.id),
        onSuccess: async (_data, list) => {
            await queryClient.invalidateQueries({
                queryKey: workingListQueryKeys.savedLists(program.id),
            })
            if (selectedListIdentity?.id === list.id) {
                lastAppliedTemplate.current = undefined
                onSelectedTemplateChange(undefined)
            }
        },
    })
    const mutationError =
        createMutation.error ??
        replaceMutation.error ??
        renameMutation.error ??
        deleteMutation.error
    const mutationBusy =
        createMutation.isPending ||
        replaceMutation.isPending ||
        renameMutation.isPending ||
        deleteMutation.isPending

    const selectedList = displayedLists.find(
        (list) => list.id === (selectedTemplateId ?? selectedListIdentity?.id)
    )
    const createdListReloadMissing =
        Boolean(pendingCreatedTemplateId) &&
        pendingCreatedTemplateId === selectedTemplateId &&
        savedListsQuery.isSuccess &&
        !savedListsQuery.isFetching &&
        !selectedList
    const repairPlan = useMemo(
        () =>
            selectedList?.compatibility === 'incompatible'
                ? createSavedListRepairDecisions(selectedList, metadata)
                : undefined,
        [metadata, selectedList]
    )
    const repairResult = useMemo(
        () =>
            selectedList?.compatibility === 'incompatible' && repairPlan
                ? repairSavedWorkingList({
                      list: selectedList,
                      decisions: repairPlan.decisions,
                      programId: program.id,
                      metadata,
                      parsingContext: valueTransformers.parsingContext,
                      serializationContext:
                          valueTransformers.serializationContext,
                  })
                : undefined,
        [metadata, program.id, repairPlan, selectedList, valueTransformers]
    )
    const selectedListAccess = selectedList?.sharing.access as
        | Record<string, unknown>
        | undefined
    const hasSelectedListUpdateAccess =
        selectedListAccess?.write === true && selectedListAccess.update === true
    const repairedResource =
        repairResult?.status === 'repaired'
            ? repairResult.configuration.mode === 'event'
                ? 'programStageWorkingLists'
                : 'trackedEntityInstanceFilters'
            : undefined
    const canRepairSelectedList =
        online &&
        !mutationBusy &&
        selectedList?.compatibility === 'incompatible' &&
        hasSelectedListUpdateAccess &&
        repairResult?.status === 'repaired' &&
        repairedResource === selectedList.resource
    const resultsError = pageQuery.error ?? organisationUnitLabelsQuery.error

    const renderConfigureMenu = ({ withColumns = true } = {}) => (
        <ConfigureMenu
            selectedList={displayedLists.find(
                (list) =>
                    list.id === (selectedTemplateId ?? selectedListIdentity?.id)
            )}
            selectedIsGenerated={usingGeneratedLists}
            activeResource={
                configuration.mode === 'event'
                    ? 'programStageWorkingLists'
                    : 'trackedEntityInstanceFilters'
            }
            dirty={dirty}
            online={online}
            busy={mutationBusy}
            onSaveAs={(name) => createMutation.mutate(name)}
            onUpdate={(list) =>
                replaceMutation.mutate({
                    list,
                    name: list.name,
                    nextConfiguration: configuration,
                })
            }
            onRename={(list, name) => {
                renameMutation.mutate({ list, name })
            }}
            onDelete={(list) => deleteMutation.mutate(list)}
            onSharingSaved={() =>
                void queryClient.invalidateQueries({
                    queryKey: workingListQueryKeys.savedLists(program.id),
                })
            }
            onConfigureColumns={
                withColumns ? () => setColumnSettingsOpen(true) : undefined
            }
        />
    )

    if (!capabilities.supported) {
        return (
            <NoticeBox error title={i18n.t('Unsupported DHIS2 version')}>
                {i18n.t('Working lists require DHIS2 41 or newer.')}
            </NoticeBox>
        )
    }

    if (savedListsQuery.error) {
        return (
            <article className="working-list-card" data-testid="working-list">
                <div className="working-list-blocking-error">
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
        <article className="working-list-card" data-testid="working-list">
            <SavedListBar
                lists={displayedLists}
                selectedId={selectedTemplateId ?? selectedListIdentity?.id}
                listsAreGenerated={usingGeneratedLists}
                dirty={dirty}
                onSelect={(list) => {
                    setPendingCreatedTemplateId(undefined)
                    const same =
                        list.id ===
                        (selectedTemplateId ?? selectedListIdentity?.id)
                    if (dirty && requestDiscardConfirmation() === false) {
                        return
                    }
                    if (same) {
                        // Clicking the active list deselects it and falls back
                        // to the default, unfiltered view.
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

            {(createdListReloadMissing ||
                selectedList?.compatibility === 'incompatible') && (
                <section
                    className="filter-section"
                    aria-label={i18n.t('Working list actions')}
                >
                    <div className="filter-row">
                        {renderConfigureMenu({ withColumns: false })}
                    </div>
                </section>
            )}

            {createdListReloadMissing ? (
                <section
                    className="working-list-blocking-error"
                    data-testid="created-list-reload-error"
                >
                    <NoticeBox
                        error
                        title={i18n.t(
                            'The saved working list could not be reloaded'
                        )}
                    >
                        <p>
                            {i18n.t(
                                'The list was created, but the server has not returned it yet. No records will be queried until it is available.'
                            )}
                        </p>
                        <Button
                            dataTest="retry-created-working-list"
                            onClick={() => void savedListsQuery.refetch()}
                        >
                            {i18n.t('Try again')}
                        </Button>
                    </NoticeBox>
                </section>
            ) : selectedList?.compatibility === 'incompatible' ? (
                <section
                    className="stale-list-panel"
                    data-testid="stale-list-panel"
                    aria-labelledby="stale-list-heading"
                >
                    <NoticeBox
                        error
                        title={i18n.t('This saved list cannot be used')}
                    >
                        <p id="stale-list-heading">
                            {i18n.t(
                                'The list references metadata that is no longer available. No records will be queried while this list is selected.'
                            )}
                        </p>
                        <ul>
                            {selectedList.issues.map((issue) => (
                                <li
                                    key={`${issue.kind}-${issue.path}-${issue.referenceId}`}
                                >
                                    {staleIssueLabel(issue, translate)}
                                </li>
                            ))}
                        </ul>
                        <p>
                            {i18n.t(
                                repairResult?.status === 'repaired'
                                    ? 'Review a repair that removes only unavailable references, or select another list. You can also delete the list or review its sharing settings using the controls above.'
                                    : 'This view cannot be repaired automatically. Select another list, delete this list, or review its sharing settings using the controls above.'
                            )}
                        </p>
                        {repairResult?.status === 'repaired' && (
                            <>
                                {!hasSelectedListUpdateAccess && (
                                    <p>
                                        {i18n.t(
                                            'You need update access to repair this saved list.'
                                        )}
                                    </p>
                                )}
                                <Button
                                    dataTest="repair-working-list"
                                    disabled={!canRepairSelectedList}
                                    onClick={() => setRepairDialogOpen(true)}
                                >
                                    {i18n.t('Review repair')}
                                </Button>
                            </>
                        )}
                    </NoticeBox>
                </section>
            ) : !selectionReady ? (
                <section
                    className="working-list-selection-loading"
                    data-testid="working-list-selection-loading"
                    aria-live="polite"
                >
                    <CircularLoader small />
                    <p>{i18n.t('Loading the selected working list…')}</p>
                </section>
            ) : (
                <>
                    <section
                        className="filter-section"
                        aria-labelledby="tracker-filters-heading"
                    >
                        <h2
                            id="tracker-filters-heading"
                            className="visually-hidden"
                        >
                            {i18n.t('Tracked entity filters')}
                        </h2>
                        <div className="filter-row">
                            <div className="filter-row__filters">
                                {visibleTrackerFilterIds.map((fieldId) => {
                                    const field = metadata.fields.get(fieldId)
                                    if (!field || !field.filterable) {
                                        return null
                                    }
                                    return (
                                        <FilterButton
                                            key={field.id}
                                            client={client}
                                            field={field}
                                            filter={criteria.filters.find(
                                                (filter) =>
                                                    filter.field.id === field.id
                                            )}
                                            capabilities={capabilities}
                                            validationContext={
                                                valueTransformers.serializationContext
                                            }
                                            calendarContext={
                                                filterCalendarContext
                                            }
                                            defaultOpen={
                                                autoOpenFilterId === field.id
                                            }
                                            onApply={applyFilter}
                                            onReset={() =>
                                                resetFilter(field.id)
                                            }
                                        />
                                    )
                                })}
                                <MoreFilters
                                    scope="tracked-entity"
                                    fields={trackerFilterFields}
                                    visibleFilterIds={[
                                        ...visibleTrackerFilterIds,
                                        ...(stageFilterVisible
                                            ? ['programStage']
                                            : []),
                                    ]}
                                    includeProgramStage={program.programStages.some(
                                        (stage) => stage.access?.read !== false
                                    )}
                                    onAdd={(fieldId) => {
                                        if (fieldId === 'programStage') {
                                            setStageFilterVisible(true)
                                        } else {
                                            setVisibleTrackerFilterIds(
                                                (ids) => [...ids, fieldId]
                                            )
                                        }
                                        setAutoOpenFilterId(fieldId)
                                    }}
                                />
                            </div>
                            {renderConfigureMenu()}
                        </div>
                    </section>

                    {stageFilterVisible && (
                        <section
                            className="filter-section filter-section--event"
                            data-testid="stage-filter-section"
                            aria-labelledby="stage-filters-heading"
                        >
                            <h2 id="stage-filters-heading">
                                {i18n.t('Stage filters')}
                            </h2>
                            <div className="filter-row">
                                <ProgramStageControl
                                    program={program}
                                    selectedStageId={
                                        criteria.mode === 'event'
                                            ? criteria.programStageId
                                            : undefined
                                    }
                                    defaultOpen={
                                        autoOpenFilterId === 'programStage'
                                    }
                                    onChange={enterStage}
                                    onRemove={() => {
                                        if (criteria.mode === 'event') {
                                            enterStage(undefined)
                                        }
                                        setStageFilterVisible(false)
                                    }}
                                />
                                {criteria.mode === 'event' &&
                                    visibleEventFilterIds.map((fieldId) => {
                                        const field =
                                            metadata.fields.get(fieldId)
                                        if (
                                            !field ||
                                            !eventFilterFields.includes(field)
                                        ) {
                                            return null
                                        }
                                        return (
                                            <FilterButton
                                                key={field.id}
                                                client={client}
                                                field={field}
                                                filter={criteria.filters.find(
                                                    (filter) =>
                                                        filter.field.id ===
                                                        field.id
                                                )}
                                                capabilities={capabilities}
                                                validationContext={
                                                    valueTransformers.serializationContext
                                                }
                                                calendarContext={
                                                    filterCalendarContext
                                                }
                                                defaultOpen={
                                                    autoOpenFilterId ===
                                                    field.id
                                                }
                                                onApply={applyFilter}
                                                onReset={() =>
                                                    resetFilter(field.id)
                                                }
                                            />
                                        )
                                    })}
                                {criteria.mode === 'event' && (
                                    <MoreFilters
                                        scope="event"
                                        fields={eventFilterFields}
                                        visibleFilterIds={visibleEventFilterIds}
                                        onAdd={(fieldId) => {
                                            setVisibleEventFilterIds((ids) => [
                                                ...ids,
                                                fieldId,
                                            ])
                                            setAutoOpenFilterId(fieldId)
                                        }}
                                    />
                                )}
                            </div>
                        </section>
                    )}

                    {resultsError ? (
                        <div
                            className="results-error"
                            data-testid="results-error"
                        >
                            <NoticeBox
                                error
                                title={i18n.t('Could not load results')}
                            >
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
                                organisationUnitLabelsReady &&
                                fileResourceNamesReady
                                    ? rows
                                    : []
                            }
                            dataQualityMode={dataQualityMode}
                            sort={view.sort}
                            page={page}
                            pageSize={pageSize}
                            hasNextPage={pageQuery.data?.hasNextPage ?? false}
                            isInitialLoading={
                                !selectionReady ||
                                pageQuery.isPending ||
                                !organisationUnitLabelsReady ||
                                !fileResourceNamesReady
                            }
                            isUpdating={
                                (pageQuery.isFetching &&
                                    !pageQuery.isPending) ||
                                organisationUnitLabelsQuery.isFetching ||
                                fileResourceNamesQuery.isFetching
                            }
                            formattingContext={
                                displayTransformers.formattingContext
                            }
                            onColumnConfigurationChange={(columns) => {
                                updateView({ ...view, columns })
                            }}
                            onPageChange={onPageChange}
                            onRowOpen={onRowOpen}
                            onSortChange={(sort: WorkingListSort) => {
                                updateView({ ...view, sort })
                                onPageChange(1, pageSize)
                            }}
                        />
                    )}

                    {columnSettingsOpen && (
                        <ColumnSettingsDialog
                            fields={tableFields}
                            visibleColumnIds={view.columns}
                            onChange={(columns) =>
                                updateView({ ...view, columns })
                            }
                            onClose={() => setColumnSettingsOpen(false)}
                        />
                    )}
                </>
            )}

            {repairDialogOpen &&
                selectedList?.compatibility === 'incompatible' &&
                repairPlan &&
                repairResult?.status === 'repaired' && (
                    <Modal
                        small
                        position="middle"
                        dataTest="repair-working-list-dialog"
                        onClose={() => setRepairDialogOpen(false)}
                    >
                        <ModalTitle>
                            {i18n.t('Repair saved working list?')}
                        </ModalTitle>
                        <ModalContent>
                            <p>
                                {i18n.t(
                                    'No records will be queried until you confirm. The repair keeps every available setting and updates this saved list in place.'
                                )}
                            </p>
                            <ul data-testid="repair-working-list-preview">
                                {repairPlan.removedFilters > 0 && (
                                    <li>
                                        {i18n.t(
                                            'Remove {{count}} unavailable filters',
                                            {
                                                count: repairPlan.removedFilters,
                                            }
                                        )}
                                    </li>
                                )}
                                {repairPlan.removedColumns > 0 && (
                                    <li>
                                        {i18n.t(
                                            'Remove {{count}} unavailable columns',
                                            {
                                                count: repairPlan.removedColumns,
                                            }
                                        )}
                                    </li>
                                )}
                                {repairPlan.replacedColumns > 0 && (
                                    <li>
                                        {i18n.t(
                                            'Replace {{count}} unavailable columns with program defaults',
                                            {
                                                count: repairPlan.replacedColumns,
                                            }
                                        )}
                                    </li>
                                )}
                                {repairPlan.replacedSort && (
                                    <li>
                                        {i18n.t(
                                            'Replace the unavailable sort with the default sort'
                                        )}
                                    </li>
                                )}
                            </ul>
                        </ModalContent>
                        <ModalActions>
                            <div className="modal-button-strip">
                                <Button
                                    dataTest="repair-working-list-cancel"
                                    onClick={() => setRepairDialogOpen(false)}
                                >
                                    {i18n.t('Cancel')}
                                </Button>
                                <Button
                                    primary
                                    dataTest="repair-working-list-confirm"
                                    disabled={!canRepairSelectedList}
                                    onClick={() => {
                                        setRepairDialogOpen(false)
                                        replaceMutation.mutate({
                                            list: selectedList,
                                            name: selectedList.name,
                                            nextConfiguration:
                                                repairResult.configuration,
                                            selectAfterReplace: true,
                                        })
                                    }}
                                >
                                    {i18n.t('Repair and update list')}
                                </Button>
                            </div>
                        </ModalActions>
                    </Modal>
                )}
        </article>
    )
}

export type { ProgramFieldCatalog }
