import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { defaultWorkingListId } from '../api/savedLists'
import {
    resolvePublicConfiguration,
    resolveSelectedSavedListId,
    selectsDifferentRows,
} from './configuration'
import {
    WORKING_LIST_PAGE_SIZES,
    type WorkingListConfiguration,
    type WorkingListPagination,
} from './contracts'
import { useProgramMetadata, useSelectedView } from './queries'
import {
    WorkingListContext,
    type WorkingListContextValue,
} from './WorkingListContext'

const DEFAULT_PAGINATION: WorkingListPagination = { page: 1, pageSize: 15 }

const assertPagination = (pagination: WorkingListPagination) => {
    if (!Number.isInteger(pagination.page) || pagination.page < 1) {
        throw new Error(
            `WorkingList requires pagination.page to be a positive integer; received ${String(pagination.page)}`
        )
    }
    if (!WORKING_LIST_PAGE_SIZES.includes(pagination.pageSize)) {
        throw new Error(
            `WorkingList requires pagination.pageSize to be one of ${WORKING_LIST_PAGE_SIZES.join(', ')}; received ${String(pagination.pageSize)}`
        )
    }
}

/** A draft, and the view it was made on. */
interface Draft {
    viewId: string
    configuration: WorkingListConfiguration
}

export interface WorkingListProviderProps {
    children: React.ReactNode
    programId: string
    orgUnitId: string
    /** Controls the selected view; `null` is the program's default list. */
    viewId?: string | null
    defaultViewId?: string | null
    onViewChange?(id: string): void
    /** Controls the page; left out, the list keeps its own. */
    pagination?: WorkingListPagination
    defaultPagination?: WorkingListPagination
    onPaginationChange?(next: WorkingListPagination): void
    /**
     * Called with whether the configuration on screen differs from the saved
     * list: once on mount, then each time that changes.
     */
    onDirtyChange?(dirty: boolean): void
}

const WorkingListProviderInstance = ({
    children,
    programId,
    orgUnitId,
    viewId: controlledViewId,
    defaultViewId,
    onViewChange,
    pagination: controlledPagination,
    defaultPagination,
    onPaginationChange,
    onDirtyChange,
}: WorkingListProviderProps) => {
    const viewControlled = controlledViewId !== undefined
    const paginationControlled = controlledPagination !== undefined
    if (viewControlled && !onViewChange) {
        throw new Error(
            'WorkingList requires onViewChange when viewId is controlled.'
        )
    }
    if (paginationControlled && !onPaginationChange) {
        throw new Error(
            'WorkingList requires onPaginationChange when pagination is controlled.'
        )
    }

    const [localViewId, setLocalViewId] = useState(defaultViewId ?? null)
    const defaultListId = defaultWorkingListId(programId)
    const viewId = resolveSelectedSavedListId(
        viewControlled ? controlledViewId : localViewId,
        defaultListId
    )

    const [localPagination, setLocalPagination] = useState(
        defaultPagination ?? DEFAULT_PAGINATION
    )
    const requested = controlledPagination ?? localPagination
    assertPagination(requested)
    const setPagination = useCallback(
        (next: WorkingListPagination) => {
            assertPagination(next)
            if (!paginationControlled) setLocalPagination(next)
            onPaginationChange?.(next)
        },
        [onPaginationChange, paginationControlled]
    )

    // A page is a page of one view in one organisation unit. When either
    // changes after mount, the list reads page 1 at once and then says so,
    // so whoever owns the page can follow. The page the list mounts with is
    // left alone, which is what lets a deep link open on it.
    const pageOf = `${orgUnitId} ${viewId}`
    const [settledPageOf, setSettledPageOf] = useState(pageOf)
    const moved = settledPageOf !== pageOf
    const page = moved ? 1 : requested.page
    const { pageSize } = requested
    const pagination = useMemo(() => ({ page, pageSize }), [page, pageSize])
    useEffect(() => {
        if (!moved) return
        setSettledPageOf(pageOf)
        setPagination({ page: 1, pageSize })
    }, [moved, pageOf, pageSize, setPagination])

    const [storedDraft, setStoredDraft] = useState<Draft>()
    const draft =
        storedDraft?.viewId === viewId ? storedDraft.configuration : undefined
    const metadata = useProgramMetadata(programId).data
    const view = useSelectedView({ programId, viewId, draft }).data
    // A draft ends when its view is left, and when the saved list says the
    // same: after it is saved, or when the change is undone by hand.
    if (
        storedDraft &&
        (storedDraft.viewId !== viewId || view?.isDirty === false)
    ) {
        setStoredDraft(undefined)
    }

    const isDirty = view?.isDirty ?? false
    useEffect(() => {
        onDirtyChange?.(isDirty)
        // Only a change of `isDirty` is news; a new callback is not.
    }, [isDirty])

    const currentConfiguration = view?.configuration
    const setDraft = useCallback(
        (configuration: WorkingListConfiguration) => {
            if (!metadata || !currentConfiguration) {
                throw new Error('Working List configuration is unavailable')
            }
            const resolved = resolvePublicConfiguration({
                configuration,
                programId,
                metadata: metadata.fieldCatalog,
                serializationContext: metadata.serializationContext,
            })
            if (resolved.isErr()) throw resolved.error
            setStoredDraft({ viewId, configuration })
            // The rows on page 4 of one filter are not those of another.
            if (selectsDifferentRows(currentConfiguration, configuration)) {
                setPagination({ page: 1, pageSize })
            }
        },
        [
            currentConfiguration,
            metadata,
            pageSize,
            programId,
            setPagination,
            viewId,
        ]
    )
    const selectView = useCallback(
        (next: string | null) => {
            const id = resolveSelectedSavedListId(next, defaultListId)
            setStoredDraft(undefined)
            if (!viewControlled) setLocalViewId(id)
            onViewChange?.(id)
            // Selecting the selected view again starts it over.
            if (id === viewId) setPagination({ page: 1, pageSize })
        },
        [
            defaultListId,
            onViewChange,
            pageSize,
            setPagination,
            viewControlled,
            viewId,
        ]
    )

    const value = useMemo<WorkingListContextValue>(
        () => ({
            programId,
            orgUnitId,
            viewId,
            selectView,
            draft,
            setDraft,
            pagination,
            setPagination,
        }),
        [
            draft,
            orgUnitId,
            pagination,
            programId,
            selectView,
            setDraft,
            setPagination,
            viewId,
        ]
    )

    return (
        <WorkingListContext.Provider value={value}>
            {children}
        </WorkingListContext.Provider>
    )
}

/**
 * Holds what the person has chosen: the view, the draft and the page. Each
 * is state here or a prop from above, never both, and nothing loaded from the
 * server is kept: the query hooks derive that from these choices.
 */
export const WorkingListProvider = (props: WorkingListProviderProps) => (
    <WorkingListProviderInstance key={props.programId} {...props} />
)
