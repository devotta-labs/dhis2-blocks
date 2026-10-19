import { OrganisationUnitSelector } from '@dhis2-blocks/context-selector'
import { useQuery } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'
import {
    CurrentUserSchema,
    retryOperationalError,
} from '../AppShell/contextSchemas'
import type { createAppWorkingListClient } from '../AppShell/createAppWorkingListClient'
import { useDebouncedOrganisationUnitSearch } from '../AppShell/useDebouncedOrganisationUnitSearch'
import { useOrganisationUnitSearch } from '../AppShell/useOrganisationUnitSearch'
import { OrganisationUnitSelectorContent } from '../OrganisationUnitSelectorContent'
import {
    getCaptureOrganisationUnitPickerScope,
    resolveCaptureOrganisationUnitRoots,
    type OrganisationUnitReference,
} from '../organisationUnitScope'
import i18n from '../../i18n'
import { useOrganisationUnitReference } from './useEventFormDemoData'

interface DemoOrganisationUnitSelectorProps {
    client: ReturnType<typeof createAppWorkingListClient>
    orgUnitId?: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (organisationUnit: OrganisationUnitReference) => void
    onClear: () => void
}

/** The context selector's organisation unit item with the capture-scoped tree and search. */
export const DemoOrganisationUnitSelector = ({
    client,
    orgUnitId,
    open,
    onOpenChange,
    onSelect,
    onClear,
}: DemoOrganisationUnitSelectorProps) => {
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] =
        useDebouncedOrganisationUnitSearch(search)
    const orgUnit = useOrganisationUnitReference(client, orgUnitId)
    const currentUser = useQuery({
        queryKey: ['working-list', 'shell', 'current-user-org-units'],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'me',
                    params: {
                        fields: 'organisationUnits[id,displayName,path],teiSearchOrganisationUnits[id,displayName,path]',
                    },
                },
                CurrentUserSchema,
                signal
            ),
        staleTime: 60 * 60 * 1000,
        retry: retryOperationalError,
    })
    const searchQuery = useOrganisationUnitSearch({
        client,
        search: debouncedSearch,
        enabled: true,
    })
    const scope = useMemo(
        () =>
            getCaptureOrganisationUnitPickerScope(
                currentUser.data
                    ? resolveCaptureOrganisationUnitRoots(currentUser.data)
                    : []
            ),
        [currentUser.data]
    )
    const searching = Boolean(debouncedSearch)
    const reset = () => {
        setSearch('')
        setDebouncedSearch('')
    }

    return (
        <OrganisationUnitSelector
            label={i18n.t('Organisation unit')}
            placeholder={i18n.t('Choose an organisation unit')}
            value={orgUnit.data?.displayName}
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next)
                if (!next) {
                    reset()
                }
            }}
            onClear={onClear}
            loading={currentUser.isPending}
            disabled={scope.pickerRoots.length === 0}
        >
            <OrganisationUnitSelectorContent
                roots={scope.pickerRoots}
                allowedPaths={scope.allowedPaths}
                selected={orgUnit.data}
                searchValue={search}
                treeKey={debouncedSearch || 'initial'}
                onSearchChange={setSearch}
                searchRoots={
                    searching
                        ? (searchQuery.data?.pages.flatMap(
                              (page) => page.organisationUnits
                          ) ?? [])
                        : undefined
                }
                searchLoading={
                    searching && searchQuery.isFetching && !searchQuery.data
                }
                searchError={
                    searching && searchQuery.isError && !searchQuery.data
                }
                onSearchRetry={() => void searchQuery.refetch()}
                searchHasMore={searchQuery.hasNextPage}
                searchLoadingMore={searchQuery.isFetchingNextPage}
                searchLoadMoreError={searchQuery.isFetchNextPageError}
                onSearchLoadMore={() => void searchQuery.fetchNextPage()}
                onSelect={(unit) => {
                    reset()
                    onSelect(unit)
                }}
            />
        </OrganisationUnitSelector>
    )
}
