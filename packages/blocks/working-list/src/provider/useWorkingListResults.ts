import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
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
}: UseWorkingListResultsOptions) => {
    const fields =
        metadata && resolvedConfiguration
            ? fieldsForConfiguration(metadata, resolvedConfiguration)
            : metadata?.fields

    const pageQuery = useQuery({
        ...(resolvedConfiguration && fields
            ? workingListPageQueryOptions({
                  client,
                  context: { programId, orgUnitId },
                  configuration: resolvedConfiguration,
                  pagination: effectivePagination,
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

    const pageIsUpdating = pageQuery.isFetching && !pageQuery.isPending

    const results = useMemo<WorkingListMeta['results']>(() => {
        if (!resolvedConfiguration) return { status: 'pending' }

        if (resultsError) {
            return { status: 'error', error: toResultsError(resultsError) }
        }

        if (
            !pageData ||
            !organisationUnitLabelsReady ||
            !fileResourceNamesReady
        ) {
            return { status: 'pending' }
        }

        return {
            status: 'ready',
            rows,
            pagination: toPaginationMeta(pageData, rows.length),
            isUpdating:
                pageIsUpdating ||
                organisationUnitLabelsQuery.isFetching ||
                fileResourceNamesQuery.isFetching,
        }
    }, [
        fileResourceNamesQuery.isFetching,
        fileResourceNamesReady,
        organisationUnitLabelsQuery.isFetching,
        organisationUnitLabelsReady,
        pageData,
        pageIsUpdating,
        resolvedConfiguration,
        resultsError,
        rows,
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

    return {
        pageQuery,
        organisationUnitLabelsQuery,
        formattingContext,
        resultTargets,
        results,
        rows,
    }
}
