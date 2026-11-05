import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { WorkingListClient } from '../api/client'
import type { WorkingListSystemInfo } from '../api/systemInfo'
import type { FieldCatalog } from '../domain/model'
import type { WorkingListPage } from '../query/fetchers'
import {
    collectFileResourceIds,
    createFileResourceNameResolver,
    fileResourceNamesQueryOptions,
} from '../query/fileResourceLabels'
import {
    collectOrganisationUnitIds,
    createOrganisationUnitLabelResolver,
    organisationUnitLabelsQueryOptions,
} from '../query/referenceLabels'
import { createWorkingListValueTransformers } from '../registry/transformers'
import type { WorkingListTranslate } from '../domain/translation'

interface UseReferenceFormattingOptions {
    client: WorkingListClient
    pages: readonly WorkingListPage[]
    fields?: FieldCatalog
    systemInfo?: WorkingListSystemInfo
    locale: string
    translate: WorkingListTranslate
}

const referencedIds = (
    pages: readonly WorkingListPage[],
    fields: FieldCatalog | undefined,
    collect: (page: WorkingListPage, fields: FieldCatalog) => string[]
) =>
    fields
        ? [...new Set(pages.flatMap((page) => collect(page, fields)))].sort()
        : []

/**
 * Loads the organisation unit and file names that `pages` reference, and
 * formats cells with them, so every loaded row shows names instead of ids.
 */
export const useReferenceFormatting = ({
    client,
    pages,
    fields,
    systemInfo,
    locale,
    translate,
}: UseReferenceFormattingOptions) => {
    const organisationUnitIds = useMemo(
        () => referencedIds(pages, fields, collectOrganisationUnitIds),
        [fields, pages]
    )
    const organisationUnitLabelsQuery = useQuery({
        ...organisationUnitLabelsQueryOptions(client, organisationUnitIds),
        enabled: organisationUnitIds.length > 0,
    })
    const fileResourceIds = useMemo(
        () => referencedIds(pages, fields, collectFileResourceIds),
        [fields, pages]
    )
    const fileResourceNamesQuery = useQuery({
        ...fileResourceNamesQueryOptions(client, fileResourceIds),
        enabled: fileResourceIds.length > 0,
    })
    const formattingContext = useMemo(
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
                  }).formattingContext
                : undefined,
        [
            fileResourceNamesQuery.data,
            locale,
            organisationUnitLabelsQuery.data,
            systemInfo,
            translate,
        ]
    )

    return {
        formattingContext,
        organisationUnitLabelsQuery,
        // Missing file names fall back to ids; missing unit names are an error.
        ready:
            (organisationUnitIds.length === 0 ||
                organisationUnitLabelsQuery.data !== undefined ||
                organisationUnitLabelsQuery.isSuccess) &&
            (fileResourceIds.length === 0 ||
                fileResourceNamesQuery.isSuccess ||
                fileResourceNamesQuery.isError),
        error:
            organisationUnitLabelsQuery.data === undefined
                ? organisationUnitLabelsQuery.error
                : null,
        isFetching:
            organisationUnitLabelsQuery.isFetching ||
            fileResourceNamesQuery.isFetching,
    }
}
