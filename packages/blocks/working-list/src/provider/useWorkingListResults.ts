import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import type { WorkingListCapabilities } from '../api/capabilities'
import type { WorkingListClient } from '../api/client'
import {
    fieldsForConfiguration,
    type ProgramFieldCatalog,
} from '../api/metadata'
import type { WorkingListSystemInfo } from '../api/systemInfo'
import type { WorkingListConfiguration as InternalConfiguration } from '../domain/model'
import {
    workingListPageQueryOptions,
    type WorkingListPage,
} from '../query/fetchers'
import {
    collectFileResourceIds,
    createFileResourceNameResolver,
    fileResourceNamesQueryOptions,
} from '../query/fileResourceLabels'
import { workingListQueryKeys } from '../query/keys'
import {
    collectOrganisationUnitIds,
    createOrganisationUnitLabelResolver,
    organisationUnitLabelsQueryOptions,
} from '../query/referenceLabels'
import { createWorkingListValueTransformers } from '../registry/transformers'
import type { FilterSerializationContext } from '../registry/valueTypes'
import type { WorkingListTranslate } from '../ui/WorkingListText'
import type {
    WorkingListConfiguration,
    WorkingListMeta,
    WorkingListPagination,
} from './contracts'
import { toResultsError } from './errorNormalization'
import { toDisplayRows, toPaginationMeta, toResultTargets } from './results'
import type {
    WorkingListProviderStore,
    WorkingListProviderStoreState,
} from './store'

interface UseWorkingListResultsOptions {
    client: WorkingListClient
    programId: string
    orgUnitId: string
    resolvedConfiguration?: InternalConfiguration
    configuration?: WorkingListConfiguration
    metadata?: ProgramFieldCatalog
    effectivePagination: WorkingListPagination
    capabilities: WorkingListCapabilities
    serializationContext?: FilterSerializationContext
    systemInfo?: WorkingListSystemInfo
    locale: string
    translate: WorkingListTranslate
    online: boolean
    stagePagination: (next: WorkingListPagination) => void
    store: WorkingListProviderStore
    updateStore: (
        update: (
            current: WorkingListProviderStoreState
        ) => Partial<WorkingListProviderStoreState>
    ) => void
}

export const useWorkingListResults = ({
    client,
    programId,
    orgUnitId,
    resolvedConfiguration,
    configuration,
    metadata,
    effectivePagination,
    capabilities,
    serializationContext,
    systemInfo,
    locale,
    translate,
    online,
    stagePagination,
    store,
    updateStore,
}: UseWorkingListResultsOptions) => {
    const fields =
        metadata && resolvedConfiguration
            ? fieldsForConfiguration(metadata, resolvedConfiguration)
            : metadata?.fields

    const previousResultOrgUnitRef = useRef(orgUnitId)

    const pageQuery = useQuery({
        ...(resolvedConfiguration && fields
            ? workingListPageQueryOptions({
                  client,
                  context: { programId, orgUnitId },
                  configuration: resolvedConfiguration,
                  pagination:
                      previousResultOrgUnitRef.current === orgUnitId
                          ? effectivePagination
                          : {
                                page: 1,
                                pageSize: effectivePagination.pageSize,
                            },
                  capabilities,
                  fields,
                  serializationContext,
                  translate,
              })
            : {
                  queryKey: [...workingListQueryKeys.all, 'records', 'idle'],
                  queryFn: (): Promise<WorkingListPage> =>
                      Promise.reject(new Error('Results are not ready')),
              }),
        enabled: Boolean(resolvedConfiguration && fields),
    })

    const pageData = pageQuery.data
    const rows = useMemo(() => toDisplayRows(pageData), [pageData])

    const organisationUnitIds = useMemo(
        () =>
            pageData && fields
                ? collectOrganisationUnitIds(pageData, fields)
                : [],
        [fields, pageData]
    )

    const organisationUnitLabelsQuery = useQuery({
        ...organisationUnitLabelsQueryOptions(client, organisationUnitIds),
        enabled: Boolean(pageData) && organisationUnitIds.length > 0,
    })

    const fileResourceIds = useMemo(
        () =>
            pageData && fields ? collectFileResourceIds(pageData, fields) : [],
        [fields, pageData]
    )

    const fileResourceNamesQuery = useQuery({
        ...fileResourceNamesQueryOptions(client, fileResourceIds),
        enabled: Boolean(pageData) && fileResourceIds.length > 0,
    })

    const organisationUnitLabelsReady =
        organisationUnitIds.length === 0 ||
        organisationUnitLabelsQuery.data !== undefined ||
        organisationUnitLabelsQuery.isSuccess

    const fileResourceNamesReady =
        fileResourceIds.length === 0 ||
        fileResourceNamesQuery.isSuccess ||
        fileResourceNamesQuery.isError

    const displayTransformers = useMemo(
        () =>
            systemInfo
                ? createWorkingListValueTransformers({
                      systemInfo,
                      locale,
                      trueLabel: translate('Yes'),
                      falseLabel: translate('No'),
                      resolveDisplayName: createOrganisationUnitLabelResolver(
                          organisationUnitLabelsQuery.data ?? new Map()
                      ),
                      resolveFileResourceName: createFileResourceNameResolver(
                          fileResourceNamesQuery.data ?? new Map()
                      ),
                  })
                : undefined,
        [
            fileResourceNamesQuery.data,
            locale,
            organisationUnitLabelsQuery.data,
            systemInfo,
            translate,
        ]
    )

    const formattingContext = displayTransformers?.formattingContext

    const resultsError =
        pageQuery.error && !(pageData && !online)
            ? pageQuery.error
            : organisationUnitLabelsQuery.error &&
                organisationUnitLabelsQuery.data === undefined
              ? organisationUnitLabelsQuery.error
              : undefined

    // EFFECT: WorkingListStore.results -- Publish asynchronous query snapshots to the vanilla store, including background refetch and offline changes.
    useEffect(() => {
        let results: WorkingListMeta['results']

        if (!resolvedConfiguration) {
            results = { status: 'pending' }
        } else if (resultsError) {
            results = { status: 'error', error: toResultsError(resultsError) }
        } else if (
            !pageData ||
            !organisationUnitLabelsReady ||
            !fileResourceNamesReady
        ) {
            results = { status: 'pending' }
        } else {
            results = {
                status: 'ready',
                rows,
                pagination: toPaginationMeta(pageData, rows.length),
                isUpdating:
                    (pageQuery.isFetching && !pageQuery.isPending) ||
                    organisationUnitLabelsQuery.isFetching ||
                    fileResourceNamesQuery.isFetching,
            }
        }

        updateStore((current) => ({ meta: { ...current.meta, results } }))
    }, [
        fileResourceNamesQuery.isFetching,
        fileResourceNamesReady,
        organisationUnitLabelsQuery.isFetching,
        organisationUnitLabelsReady,
        pageData,
        pageQuery.isFetching,
        pageQuery.isPending,
        resolvedConfiguration,
        resultsError,
        rows,
        updateStore,
    ])

    const resultTargets = useMemo(
        () =>
            toResultTargets({
                pageData,
                programId,
                configuration: configuration,
            }),
        [configuration, pageData, programId]
    )

    const previousOrgUnit = useRef(orgUnitId)
    // EFFECT: WorkingListStore.pagination -- Reset page intent when the controlled organisation-unit context changes, including browser history navigation.
    useEffect(() => {
        if (previousOrgUnit.current === orgUnitId) return
        previousOrgUnit.current = orgUnitId
        previousResultOrgUnitRef.current = orgUnitId
        stagePagination({
            page: 1,
            pageSize: store.getState().meta.pagination.pageSize,
        })
    }, [orgUnitId, stagePagination, store])

    return {
        pageQuery,
        organisationUnitLabelsQuery,
        formattingContext,
        resultTargets,
        rows,
    }
}
