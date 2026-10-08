import React, {
    useCallback,
    useId,
    useState,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from 'react'
import { WorkingListProvider } from '../../provider/WorkingListProvider'
import type { WorkingListPagination } from '../../provider/contracts'
import { WorkingListToolbarActions } from '../Actions'
import { WorkingListColumnSelector } from '../Columns'
import { WorkingListContainer } from '../Container'
import { WorkingListFilterControls } from '../Filters'
import { WorkingListTable, type WorkingListTableProps } from '../Results'
import { WorkingListSavedViews } from '../SavedViews'
import { WorkingListToolbar } from '../Toolbar'
import { useWorkingListText } from '../WorkingListText'

const DEFAULT_PAGINATION: WorkingListPagination = { page: 1, pageSize: 15 }

type ControlledViewProps = {
    viewId: string | null
    onViewChange(id: string): void
    defaultViewId?: never
}

type UncontrolledViewProps = {
    viewId?: never
    defaultViewId?: string | null
    onViewChange?(id: string): void
}

type ControlledPaginationProps = {
    /**
     * Rendered as given. The list resets the page for its own commands; a
     * host that changes `orgUnitId` or `viewId` resets `page` alongside it.
     */
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
    (ControlledViewProps | UncontrolledViewProps) &
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

    const viewControlled = 'viewId' in props
    const paginationControlled = 'pagination' in props

    if (viewControlled && !props.onViewChange) {
        throw new Error(
            'WorkingList requires onViewChange when viewId is controlled.'
        )
    }

    if (paginationControlled && !onPaginationChange) {
        throw new Error(
            'WorkingList requires onPaginationChange when pagination is controlled.'
        )
    }

    const selectedViewId: string | null = viewControlled
        ? (props.viewId ?? null)
        : localViewId

    // Uncontrolled pages belong to one org unit and view; a host change to
    // either starts the new result set from its first page.
    const [paginationScope, setPaginationScope] = useState({
        orgUnitId,
        selectedViewId,
    })

    if (
        paginationScope.orgUnitId !== orgUnitId ||
        paginationScope.selectedViewId !== selectedViewId
    ) {
        setPaginationScope({ orgUnitId, selectedViewId })
        setLocalPagination((current) => ({ ...current, page: 1 }))
    }

    const pagination: WorkingListPagination = paginationControlled
        ? (props.pagination ?? localPagination)
        : localPagination

    const handleViewChange = useCallback(
        (id: string) => {
            if (viewControlled) {
                props.onViewChange?.(id)

                return
            }

            setLocalViewId(id)
            props.onViewChange?.(id)
        },
        [props, viewControlled]
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
        pagination: _pagination,
        ...containerProps
    } = rest as typeof rest & {
        viewId?: string | null
        onViewChange?: (id: string) => void
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

export const WorkingList = WorkingListRoot

export {
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
}

export type { WorkingListTableProps }
