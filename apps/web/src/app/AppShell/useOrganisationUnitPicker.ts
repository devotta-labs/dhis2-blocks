import type { WorkingListClient } from '@/components/working-list/api/client'
import { useEffect, useState } from 'react'
import type { OrganisationUnitReference } from '../organisationUnitScope'
import { useOrganisationUnitSearch } from './useOrganisationUnitSearch'

interface OrganisationUnitPickerOptions {
    client: WorkingListClient
    programId?: string
    orgUnitId?: string
    roots: OrganisationUnitReference[]
    selected?: OrganisationUnitReference
    onSelect: (organisationUnit: OrganisationUnitReference) => void
}

const initialPicker = (context: string, revision = 0) => ({
    context,
    revision,
    open: false,
    search: '',
    debouncedSearch: '',
})

export const useOrganisationUnitPicker = ({
    client,
    programId,
    orgUnitId,
    roots,
    selected,
    onSelect,
}: OrganisationUnitPickerOptions) => {
    const context = JSON.stringify([
        programId,
        orgUnitId,
        roots.map((root) => root.path),
    ])
    const [state, setState] = useState(() => initialPicker(context))
    if (state.context !== context) {
        setState(initialPicker(context, state.revision + 1))
    }
    const current =
        state.context === context
            ? state
            : initialPicker(context, state.revision + 1)

    useEffect(() => {
        if (!current.open || current.search === current.debouncedSearch) return
        const timeout = window.setTimeout(() => {
            setState((value) => ({ ...value, debouncedSearch: current.search }))
        }, 500)
        return () => window.clearTimeout(timeout)
    }, [current.open, current.search, current.debouncedSearch, context])

    const query = useOrganisationUnitSearch({
        client,
        search: current.debouncedSearch,
        enabled: current.open && Boolean(programId),
    })
    const reset = () =>
        setState((value) => initialPicker(context, value.revision + 1))
    const open = () => setState((value) => ({ ...value, open: true }))
    const select = (unit: OrganisationUnitReference) => {
        reset()
        onSelect(unit)
    }
    const searching = Boolean(current.debouncedSearch)

    return {
        isOpen: current.open,
        open,
        close: reset,
        reset,
        select,
        contentProps: {
            roots,
            selected,
            searchValue: current.search,
            onSearchChange: (search: string) =>
                setState((value) => ({ ...value, search })),
            treeKey: JSON.stringify([
                context,
                current.revision,
                current.debouncedSearch,
            ]),
            searchRoots: searching
                ? (query.data?.pages.flatMap(
                      (page) => page.organisationUnits
                  ) ?? [])
                : undefined,
            searchLoading: searching && query.isFetching && !query.data,
            searchError: searching && query.isError && !query.data,
            onSearchRetry: () => void query.refetch(),
            searchHasMore: query.hasNextPage,
            searchLoadingMore: query.isFetchingNextPage,
            searchLoadMoreError: query.isFetchNextPageError,
            onSearchLoadMore: () => void query.fetchNextPage(),
            onSelect: select,
        },
    }
}
