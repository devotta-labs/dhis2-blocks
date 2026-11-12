import { useConfig, useDataEngine, useOnlineStatus } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { z } from 'zod'
import {
    detectMetadataFeatures,
    resolveWorkingListCapabilities,
    type WorkingListCapabilities,
} from '../api/capabilities'
import {
    buildProgramFieldCatalog,
    fieldsForConfiguration,
    trackerProgramQueryOptions,
    type ProgramFieldCatalog,
} from '../api/metadata'
import { shouldRetryWorkingListRequest } from '../api/request'
import {
    createDefaultWorkingList,
    createGeneratedDefaultLists,
    fetchSavedWorkingLists,
    type NormalizedSavedWorkingList,
} from '../api/savedLists'
import type { TrackerProgram } from '../api/schemas'
import {
    workingListSystemInfoQueryOptions,
    type WorkingListSystemInfo,
} from '../api/systemInfo'
import type {
    FieldCatalog,
    WorkingListConfiguration as InternalConfiguration,
} from '../domain/model'
import {
    workingListPageQueryOptions,
    type WorkingListPage,
} from '../query/fetchers'
import { workingListQueryKeys } from '../query/keys'
import { createWorkingListValueTransformers } from '../registry/transformers'
import type {
    CellFormattingContext,
    FilterParsingContext,
    FilterSerializationContext,
} from '../registry/valueTypes'
import {
    publicConfigurationFingerprint,
    resolvePublicConfiguration,
    toPublicConfiguration,
} from './configuration'
import type {
    WorkingListConfiguration,
    WorkingListDisplayRow,
    WorkingListResultTarget,
    WorkingListView,
} from './contracts'
import { toResultsError } from './errorNormalization'
import {
    IncompatibleSavedListError,
    SavedListNotFoundError,
    WorkingListInitializationError,
    type WorkingListResultsError,
} from './errors'
import { toDisplayRows, toResultTargets } from './results'
import { useReferenceFormatting } from './useReferenceFormatting'
import { useWorkingList } from './WorkingListContext'

/** What a hook has to show for what it loads: nothing yet, a failure, or the data. */
type Loaded<Data, Failure> =
    | { isPending: true; isError: false; data?: undefined; error?: undefined }
    | { isPending: false; isError: true; data?: undefined; error: Failure }
    | { isPending: false; isError: false; data: Data; error?: undefined }

const PENDING = { isPending: true, isError: false } as const

const RuntimeConfigSchema = z
    .object({ apiVersion: z.coerce.number().int().positive() })
    .passthrough()

interface WorkingListCalendarContext {
    calendar: WorkingListSystemInfo['calendar']
    dateFormat: WorkingListSystemInfo['dateFormat']
    locale: string
    timeZone: string
}

type CompatibleSavedList = Extract<
    NormalizedSavedWorkingList,
    { compatibility: 'compatible' }
>

/** The program as the list reads it, and how its values are written and shown. */
export interface WorkingListMetadata {
    program: TrackerProgram
    systemInfo: WorkingListSystemInfo
    capabilities: WorkingListCapabilities
    fieldCatalog: ProgramFieldCatalog
    locale: string
    calendarContext: WorkingListCalendarContext
    parsingContext: FilterParsingContext
    serializationContext: FilterSerializationContext
    /** The unfiltered list every program has, which is never saved. */
    defaultList: CompatibleSavedList
    /** The lists shown while the program has no saved list of its own. */
    generatedLists: NormalizedSavedWorkingList[]
}

/**
 * Loads the program and the system settings, and reads them into the field
 * catalog and value contexts the rest of the list works from. The reading
 * happens in the query, so every component gets the one cached result. A
 * program the list cannot show is an error here, so nothing below has to
 * check for it.
 */
export const useProgramMetadata = (programId: string) => {
    const engine = useDataEngine()
    const queryClient = useQueryClient()
    const config = useConfig()
    const runtimeConfig = RuntimeConfigSchema.safeParse(config)
    const apiVersion = runtimeConfig.success
        ? runtimeConfig.data.apiVersion
        : undefined
    const locale = i18n.language ?? globalThis.navigator?.language ?? 'en'

    return useQuery<WorkingListMetadata, WorkingListInitializationError>({
        queryKey: workingListQueryKeys.metadata(programId, apiVersion, locale),
        queryFn: async () => {
            if (apiVersion === undefined) {
                throw new WorkingListInitializationError({
                    message:
                        'DHIS2 runtime configuration did not contain a valid API version',
                    cause: runtimeConfig.error,
                })
            }
            if (!resolveWorkingListCapabilities({ apiVersion }).supported) {
                throw new WorkingListInitializationError({
                    message: `DHIS2 API version ${apiVersion} is unsupported; Working List requires version 41 or newer`,
                })
            }
            const [systemInfo, program] = await Promise.all([
                queryClient
                    .fetchQuery(workingListSystemInfoQueryOptions(engine))
                    .catch((cause) => {
                        throw new WorkingListInitializationError({
                            message:
                                'DHIS2 system information could not be loaded',
                            cause,
                        })
                    }),
                queryClient
                    .fetchQuery(
                        trackerProgramQueryOptions(
                            engine,
                            programId,
                            apiVersion
                        )
                    )
                    .catch((cause) => {
                        throw new WorkingListInitializationError({
                            message: `Program ${programId} metadata could not be loaded`,
                            cause,
                        })
                    }),
            ])
            if (program.programType !== 'WITH_REGISTRATION') {
                throw new WorkingListInitializationError({
                    message: `Program ${programId} is not a tracker program with registration`,
                })
            }
            const capabilities = resolveWorkingListCapabilities({
                apiVersion,
                metadataFeatures: detectMetadataFeatures(program),
            })
            let fieldCatalog: ProgramFieldCatalog
            try {
                fieldCatalog = buildProgramFieldCatalog({
                    program,
                    capabilities,
                    hasSelectedOrgUnit: true,
                })
            } catch (cause) {
                throw new WorkingListInitializationError({
                    message: `Program ${programId} metadata could not be interpreted`,
                    cause,
                })
            }
            const { parsingContext, serializationContext } =
                createWorkingListValueTransformers({
                    systemInfo,
                    locale,
                    trueLabel: i18n.t('Yes'),
                    falseLabel: i18n.t('No'),
                })
            const columns = fieldCatalog.defaultTrackedEntityColumns
            return {
                program,
                systemInfo,
                capabilities,
                fieldCatalog,
                locale,
                calendarContext: {
                    calendar: systemInfo.calendar,
                    dateFormat: systemInfo.dateFormat,
                    locale,
                    timeZone: systemInfo.serverTimeZoneId,
                },
                parsingContext,
                serializationContext,
                defaultList: createDefaultWorkingList({ programId, columns }),
                generatedLists: createGeneratedDefaultLists({
                    programId,
                    columns,
                    fields: fieldCatalog.fields,
                }),
            }
        },
        staleTime: 60 * 60_000,
        gcTime: 4 * 60 * 60_000,
        // The two requests retry on their own.
        retry: false,
    })
}

/** The metadata of the program this list shows. */
export const useWorkingListMetadata = () => {
    const { programId } = useWorkingList()
    return useProgramMetadata(programId)
}

/**
 * The program's saved lists. A program with none of its own shows the
 * generated ones instead, and `generated` says so: those cannot be changed.
 */
const useProgramSavedLists = (programId: string) => {
    const engine = useDataEngine()
    const { data: metadata } = useProgramMetadata(programId)
    const generatedLists = metadata?.generatedLists
    const select = useCallback(
        (lists: NormalizedSavedWorkingList[]) =>
            lists.length === 0
                ? { lists: generatedLists ?? [], generated: true }
                : { lists, generated: false },
        [generatedLists]
    )
    return useQuery({
        queryKey: workingListQueryKeys.savedLists(programId),
        queryFn: ({ signal }) => {
            if (!metadata) throw new Error('Program metadata is not ready')
            return fetchSavedWorkingLists({
                engine,
                programId,
                metadata: metadata.fieldCatalog,
                parsingContext: metadata.parsingContext,
                signal,
            })
        },
        select,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryWorkingListRequest,
        enabled: metadata !== undefined,
    })
}

/** The saved lists of the program this list shows. */
export const useSavedLists = () => {
    const { programId } = useWorkingList()
    return useProgramSavedLists(programId)
}

export const canUpdateSavedList = (list: NormalizedSavedWorkingList) =>
    list.sharing.access?.write === true && list.sharing.access.update === true

/** A saved list as the view switcher shows it: its name and what may be done to it. */
export const toWorkingListView = (
    list: NormalizedSavedWorkingList,
    generated: boolean
): WorkingListView => ({
    id: list.id,
    name: list.name,
    generated,
    compatible: list.compatibility === 'compatible',
    canUpdate: !generated && canUpdateSavedList(list),
    canDelete: !generated && list.sharing.access?.delete === true,
    canShare: !generated && list.sharing.access?.manage === true,
})

/** The selected view once its list is loaded and the program still has its fields. */
export interface WorkingListSelectedView {
    list: CompatibleSavedList
    /** A generated or default list, which has no saved copy to update. */
    isGenerated: boolean
    /** The configuration on screen: the draft, or the list as saved. */
    configuration: WorkingListConfiguration
    /** `configuration` with its fields resolved against the program. */
    resolvedConfiguration: InternalConfiguration
    /** The configuration on screen differs from the list as saved. */
    isDirty: boolean
}

interface SelectedViewOptions {
    programId: string
    viewId: string
    draft?: WorkingListConfiguration
}

/**
 * Derives the selected view from the saved lists and the draft. Nothing is
 * stored: a list that is deleted, repaired or saved elsewhere shows as such
 * as soon as the saved lists reload.
 */
export const useSelectedView = ({
    programId,
    viewId,
    draft,
}: SelectedViewOptions) => {
    const { data: metadata } = useProgramMetadata(programId)
    const savedLists = useProgramSavedLists(programId)
    const loaded = savedLists.data
    const reloading = savedLists.isFetching

    return useMemo<
        Loaded<
            WorkingListSelectedView,
            SavedListNotFoundError | IncompatibleSavedListError
        >
    >(() => {
        if (!metadata || !loaded) return PENDING
        const list =
            viewId === metadata.defaultList.id
                ? metadata.defaultList
                : loaded.lists.find((candidate) => candidate.id === viewId)
        if (!list) {
            // The reload may be the one that brings the list.
            if (reloading) return PENDING
            return {
                isPending: false,
                isError: true,
                error: new SavedListNotFoundError({
                    savedListId: viewId,
                    message: `Saved working list ${viewId} was not found`,
                }),
            }
        }
        if (list.compatibility === 'incompatible') {
            return {
                isPending: false,
                isError: true,
                error: new IncompatibleSavedListError({
                    savedListId: viewId,
                    message: `Saved working list ${viewId} is incompatible with current metadata`,
                }),
            }
        }
        const saved: WorkingListSelectedView = {
            list,
            isGenerated: viewId === metadata.defaultList.id || loaded.generated,
            configuration: toPublicConfiguration(list.configuration),
            resolvedConfiguration: list.configuration,
            isDirty: false,
        }
        if (
            !draft ||
            publicConfigurationFingerprint(draft) ===
                publicConfigurationFingerprint(saved.configuration)
        ) {
            return { isPending: false, isError: false, data: saved }
        }
        const resolved = resolvePublicConfiguration({
            configuration: draft,
            programId,
            metadata: metadata.fieldCatalog,
            serializationContext: metadata.serializationContext,
        })
        // A draft the program no longer supports gives way to the saved list.
        if (resolved.isErr()) {
            return { isPending: false, isError: false, data: saved }
        }
        return {
            isPending: false,
            isError: false,
            data: {
                ...saved,
                configuration: draft,
                resolvedConfiguration: resolved.value,
                isDirty: true,
            },
        }
    }, [draft, loaded, metadata, programId, reloading, viewId])
}

/**
 * The selected view. Pending until the saved lists are in; an error when the
 * list is gone or names fields the program no longer has.
 */
export const useWorkingListView = () => {
    const { programId, viewId, draft } = useWorkingList()
    return useSelectedView({ programId, viewId, draft })
}

/** One page of the selected view's records, formatted for display. */
export interface WorkingListRecords {
    rows: WorkingListDisplayRow[]
    hasNextPage: boolean
    /** What each row opens, by row id. */
    targets: ReadonlyMap<string, WorkingListResultTarget>
    /** The fields the rows have values for. */
    fields: FieldCatalog
    formattingContext: CellFormattingContext
    /** Newer rows are on their way; these stay on screen until they arrive. */
    isUpdating: boolean
}

/**
 * Loads the page of records the selected view, its draft and the pagination
 * ask for, with the organisation unit and file names its cells show. Stays
 * pending until the view is ready.
 */
export const useWorkingListRecords = (): Loaded<
    WorkingListRecords,
    WorkingListResultsError
> & { refetch(): void } => {
    const engine = useDataEngine()
    const { online } = useOnlineStatus()
    const { programId, orgUnitId, pagination } = useWorkingList()
    const { data: metadata } = useWorkingListMetadata()
    const { data: view } = useWorkingListView()
    const request =
        metadata && view
            ? {
                  engine,
                  context: { programId, orgUnitId },
                  configuration: view.resolvedConfiguration,
                  pagination,
                  capabilities: metadata.capabilities,
                  fields: fieldsForConfiguration(
                      metadata.fieldCatalog,
                      view.resolvedConfiguration
                  ),
                  serializationContext: metadata.serializationContext,
              }
            : undefined
    const pageQuery = useQuery({
        ...(request
            ? workingListPageQueryOptions(request)
            : {
                  queryKey: [...workingListQueryKeys.all, 'records', 'idle'],
                  queryFn: (): Promise<WorkingListPage> =>
                      Promise.reject(new Error('The view is not ready')),
              }),
        enabled: request !== undefined,
    })
    const pageData = request ? pageQuery.data : undefined
    const fields = request?.fields
    const pages = useMemo(() => (pageData ? [pageData] : []), [pageData])
    const references = useReferenceFormatting({
        pages,
        fields,
        systemInfo: metadata?.systemInfo,
        locale: metadata?.locale,
    })
    const configuration = view?.configuration
    const rows = useMemo(() => toDisplayRows(pageData), [pageData])
    const targets = useMemo(
        () => toResultTargets({ pageData, programId, configuration }),
        [configuration, pageData, programId]
    )

    const refetchPage = pageQuery.refetch
    const refetchLabels = references.organisationUnitLabelsQuery.refetch
    const labelsFailed = references.organisationUnitLabelsQuery.isError
    const refetch = useCallback(() => {
        void refetchPage()
        if (labelsFailed) void refetchLabels()
    }, [labelsFailed, refetchLabels, refetchPage])

    // Offline, a page that is already loaded stays on screen.
    const error =
        (pageData && !online ? null : pageQuery.error) ?? references.error
    if (!request) return { ...PENDING, refetch }
    if (error) {
        return {
            isPending: false,
            isError: true,
            error: toResultsError(error),
            refetch,
        }
    }
    const { formattingContext } = references
    if (!pageData || !fields || !references.ready || !formattingContext) {
        return { ...PENDING, refetch }
    }
    return {
        isPending: false,
        isError: false,
        data: {
            rows,
            hasNextPage: pageData.hasNextPage,
            targets,
            fields,
            formattingContext,
            isUpdating: pageQuery.isFetching || references.isFetching,
        },
        refetch,
    }
}
