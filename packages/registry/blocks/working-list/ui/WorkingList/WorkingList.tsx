import i18n from '@dhis2/d2-i18n'
import React, {
    useId,
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
    /**
     * Called with whether the configuration on screen differs from the saved
     * list: once on mount, then each time that changes.
     */
    onDirtyChange?(dirty: boolean): void
}

export type WorkingListProps = WorkingListBaseProps &
    (ControlledViewProps | UncontrolledViewProps) &
    (ControlledPaginationProps | UncontrolledPaginationProps)

const WorkingListRoot = ({
    children,
    programId,
    orgUnitId,
    viewId,
    defaultViewId,
    onViewChange,
    pagination,
    defaultPagination,
    onPaginationChange,
    onDirtyChange,
    ...containerProps
}: WorkingListProps) => (
    <WorkingListProvider
        programId={programId}
        orgUnitId={orgUnitId}
        viewId={viewId}
        defaultViewId={defaultViewId}
        onViewChange={onViewChange}
        pagination={pagination}
        defaultPagination={defaultPagination}
        onPaginationChange={onPaginationChange}
        onDirtyChange={onDirtyChange}
    >
        <WorkingListContainer {...containerProps}>
            {children}
        </WorkingListContainer>
    </WorkingListProvider>
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
    const headingId = useId()
    const accessibleHeading = heading ?? i18n.t('Saved views in this program')

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
