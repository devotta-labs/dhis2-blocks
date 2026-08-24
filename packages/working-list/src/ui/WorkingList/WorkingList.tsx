import React, {
    useCallback,
    useId,
    useState,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from 'react'
import { WorkingListProvider } from '../../provider/WorkingListProvider'
import type { WorkingListPagination } from '../../provider/contracts'
import { WorkingListActions, WorkingListToolbarActions } from '../Actions'
import { WorkingListColumns, WorkingListColumnSelector } from '../Columns'
import { WorkingListContainer } from '../Container'
import { WorkingListDefault } from '../Default'
import { WorkingListFilters, WorkingListFilterControls } from '../Filters'
import {
    WorkingListResults,
    WorkingListTable,
    type WorkingListTableProps,
} from '../Results'
import { WorkingListSavedViews } from '../SavedViews'
import { WorkingListSection } from '../Section'
import { WorkingListToolbar } from '../Toolbar'
import { useWorkingListText } from '../WorkingListText'

const DEFAULT_PAGINATION: WorkingListPagination = { page: 1, pageSize: 15 }

type ControlledViewProps = {
    viewId: string | null
    onViewChange(id: string): void
    defaultViewId?: never
    selectedSavedListId?: never
    onSelectedSavedListChange?: never
}

type UncontrolledViewProps = {
    viewId?: never
    defaultViewId?: string | null
    onViewChange?(id: string): void
    selectedSavedListId?: never
    onSelectedSavedListChange?: never
}

type LegacyControlledViewProps = {
    /** @deprecated Use `viewId`. */
    selectedSavedListId: string | null
    /** @deprecated Use `onViewChange`. */
    onSelectedSavedListChange(id: string): void
    viewId?: never
    defaultViewId?: never
    onViewChange?: never
}

type ControlledPaginationProps = {
    pagination: WorkingListPagination
    onPaginationChange(next: WorkingListPagination): void
    defaultPagination?: never
}

type UncontrolledPaginationProps = {
    pagination?: never
    defaultPagination?: WorkingListPagination
    onPaginationChange?(next: WorkingListPagination): void
}

interface WorkingListBaseProps extends Omit<
    ComponentPropsWithoutRef<'article'>,
    'children'
> {
    children: ReactNode
    programId: string
    orgUnitId: string
}

export type WorkingListProps = WorkingListBaseProps &
    (ControlledViewProps | UncontrolledViewProps | LegacyControlledViewProps) &
    (ControlledPaginationProps | UncontrolledPaginationProps)

const WorkingListRootInstance = (props: WorkingListProps) => {
    const {
        children,
        programId,
        orgUnitId,
        defaultViewId,
        defaultPagination,
        onPaginationChange,
        ...rest
    } = props
    const [localViewId, setLocalViewId] = useState<string | null>(
        defaultViewId ?? null
    )
    const [localPagination, setLocalPagination] =
        useState<WorkingListPagination>(defaultPagination ?? DEFAULT_PAGINATION)
    const canonicalControlled = 'viewId' in props
    const legacyControlled = 'selectedSavedListId' in props
    const paginationControlled = 'pagination' in props
    if (canonicalControlled && !props.onViewChange) {
        throw new Error(
            'WorkingList requires onViewChange when viewId is controlled.'
        )
    }
    if (legacyControlled && !props.onSelectedSavedListChange) {
        throw new Error(
            'WorkingList requires onSelectedSavedListChange when selectedSavedListId is controlled.'
        )
    }
    if (paginationControlled && !onPaginationChange) {
        throw new Error(
            'WorkingList requires onPaginationChange when pagination is controlled.'
        )
    }
    const selectedViewId: string | null = canonicalControlled
        ? (props.viewId ?? null)
        : legacyControlled
          ? (props.selectedSavedListId ?? null)
          : localViewId
    const pagination: WorkingListPagination = paginationControlled
        ? (props.pagination ?? localPagination)
        : localPagination
    const handleViewChange = useCallback(
        (id: string) => {
            if (canonicalControlled) {
                props.onViewChange?.(id)
                return
            }
            if (legacyControlled) {
                props.onSelectedSavedListChange?.(id)
                return
            }
            setLocalViewId(id)
            props.onViewChange?.(id)
        },
        [canonicalControlled, legacyControlled, props]
    )
    const handlePaginationChange = useCallback(
        (next: WorkingListPagination) => {
            if (!paginationControlled) setLocalPagination(next)
            onPaginationChange?.(next)
        },
        [onPaginationChange, paginationControlled]
    )

    // SAFETY: Every state-only key is optional in this widened view and is removed before forwarding the remaining native article props.
    const {
        viewId: _viewId,
        onViewChange: _onViewChange,
        selectedSavedListId: _selectedSavedListId,
        onSelectedSavedListChange: _onSelectedSavedListChange,
        pagination: _pagination,
        ...containerProps
    } = rest as typeof rest & {
        viewId?: string | null
        onViewChange?: (id: string) => void
        selectedSavedListId?: string | null
        onSelectedSavedListChange?: (id: string) => void
        pagination?: WorkingListPagination
    }

    return (
        <WorkingListProvider
            programId={programId}
            orgUnitId={orgUnitId}
            selectedSavedListId={selectedViewId}
            onSelectedSavedListChange={handleViewChange}
            pagination={pagination}
            onPaginationChange={handlePaginationChange}
        >
            <WorkingListContainer {...containerProps}>
                {children}
            </WorkingListContainer>
        </WorkingListProvider>
    )
}

const WorkingListRoot = (props: WorkingListProps) => (
    <WorkingListRootInstance key={props.programId} {...props} />
)

export interface WorkingListViewSwitcherProps extends Omit<
    ComponentPropsWithoutRef<'section'>,
    'children'
> {
    heading?: ReactNode
}

export const WorkingListViewSwitcher = ({
    heading,
    className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...props
}: WorkingListViewSwitcherProps) => {
    const translate = useWorkingListText()
    const headingId = useId()
    const accessibleHeading =
        heading ?? translate('Saved views in this program')

    return (
        <section
            {...props}
            aria-label={ariaLabel}
            aria-labelledby={
                ariaLabel || ariaLabelledBy ? ariaLabelledBy : headingId
            }
            className={className}
            data-testid="working-list-view-switcher"
        >
            <h2
                id={headingId}
                className="m-0 p-2 text-xs font-normal leading-4 text-[var(--colors-grey700)]"
            >
                {accessibleHeading}
            </h2>
            <WorkingListSavedViews />
        </section>
    )
}

/**
 * The callable root is the canonical API. Its properties preserve the previous
 * compound API for installed blocks that have not migrated yet.
 */
export const WorkingList = Object.assign(WorkingListRoot, {
    Provider: WorkingListProvider,
    Container: WorkingListContainer,
    Section: WorkingListSection,
    SavedViews: WorkingListSavedViews,
    Toolbar: WorkingListToolbar,
    Columns: WorkingListColumns,
    Filters: WorkingListFilters,
    Actions: WorkingListActions,
    Results: WorkingListResults,
    Default: WorkingListDefault,
})

export {
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
}
export type { WorkingListTableProps }
