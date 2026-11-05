import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
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
import { workingListQueryKeys } from '../query/keys'
import type { FilterSerializationContext } from '../registry/valueTypes'
import type { WorkingListTranslate } from '../domain/translation'
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
import { useReferenceFormatting } from './useReferenceFormatting'

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
    const pages = useMemo(() => (pageData ? [pageData] : []), [pageData])
    const references = useReferenceFormatting({
        client,
        pages,
        fields,
        systemInfo,
        locale,
        translate,
    })
    const pageError = pageData && !online ? undefined : pageQuery.error
    const resultsError = pageError || references.error || undefined
    useEffect(() => {
        let results: WorkingListMeta['results']
        if (!resolvedConfiguration) {
            results = { status: 'pending' }
        } else if (resultsError) {
            results = { status: 'error', error: toResultsError(resultsError) }
        } else if (!pageData || !references.ready) {
            results = { status: 'pending' }
        } else {
            results = {
                status: 'ready',
                rows,
                pagination: toPaginationMeta(pageData, rows.length),
                isUpdating:
                    (pageQuery.isFetching && !pageQuery.isPending) ||
                    references.isFetching,
            }
        }
        updateStore((current) => ({ meta: { ...current.meta, results } }))
    }, [
        pageData,
        pageQuery.isFetching,
        pageQuery.isPending,
        references.isFetching,
        references.ready,
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
    useEffect(() => {
        if (previousOrgUnit.current === orgUnitId) return
        previousOrgUnit.current = orgUnitId
        previousResultOrgUnitRef.current = orgUnitId
        stagePagination({
            page: 1,
            pageSize: store.getState().meta.pagination.pageSize,
        })
    }, [orgUnitId, stagePagination, store])

    const { organisationUnitLabelsQuery } = references
    const retryResults = useCallback(async () => {
        await Promise.all([
            pageQuery.refetch(),
            organisationUnitLabelsQuery.error
                ? organisationUnitLabelsQuery.refetch()
                : Promise.resolve(),
        ])
    }, [
        pageQuery.refetch,
        organisationUnitLabelsQuery.error,
        organisationUnitLabelsQuery.refetch,
    ])

    return {
        retryResults,
        formattingContext: references.formattingContext,
        resultTargets,
        rows,
    }
}
