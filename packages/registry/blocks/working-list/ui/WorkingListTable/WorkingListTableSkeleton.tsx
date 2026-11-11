import React from 'react'
import type { WorkingListPageSize } from '../../provider/contracts'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/dhis2/ui/table'
import { SkeletonBlock } from '../Skeleton'
import { WorkingListPagination } from './WorkingListPagination'

// Reserve the native scrollbar gutter before the columns are known.
export const tableScrollClassName =
    'w-full min-w-0 max-w-full overflow-x-scroll [contain:layout] [overscroll-behavior-inline:contain]'

const skeletonCellWidths = [
    'w-[46%]',
    'w-[62%]',
    'w-[34%]',
    'w-[54%]',
    'w-[40%]',
]

const skeletonCellWidth = (row: number, column: number) =>
    skeletonCellWidths[(row * 3 + column) % skeletonCellWidths.length]

// One placeholder row per expected record, built from the same table cells
// as real rows so the body keeps its final height while results load.
export const SkeletonRows = ({
    columnCount,
    rowCount,
}: {
    columnCount: number
    rowCount: number
}) =>
    Array.from({ length: rowCount }, (_, row) => (
        <TableRow key={row} data-test="working-list-skeleton-row">
            {Array.from({ length: columnCount }, (_, column) => (
                <TableCell key={column} className="min-w-[140px]">
                    <SkeletonBlock
                        className={`h-3.5 rounded-[3px] ${skeletonCellWidth(row, column)}`}
                    />
                </TableCell>
            ))}
        </TableRow>
    ))

const ignorePaginationChange = () => {}

/**
 * Results placeholder for when the columns are not known yet (initializing,
 * or switching saved lists). It mirrors the loaded table — header, one row
 * per page slot, pagination — so real data replaces it without a jump.
 */
export const WorkingListTableSkeleton = ({
    pageSize,
    columnCount = 4,
}: {
    pageSize: WorkingListPageSize
    columnCount?: number
}) => (
    <div
        className="w-full min-w-0 max-w-full"
        data-testid="working-list-results-skeleton"
        aria-hidden="true"
    >
        <div className={tableScrollClassName}>
            <div className="min-w-[680px]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {Array.from(
                                { length: columnCount },
                                (_, column) => (
                                    <TableHead key={column}>
                                        <SkeletonBlock
                                            className={`h-3 rounded-[3px] ${column % 2 === 0 ? 'w-24' : 'w-20'}`}
                                        />
                                    </TableHead>
                                )
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <SkeletonRows
                            columnCount={columnCount}
                            rowCount={pageSize}
                        />
                    </TableBody>
                </Table>
            </div>
        </div>
        <div className="flex min-h-14 w-full min-w-0 max-w-full items-center px-3 py-2">
            <WorkingListPagination
                page={1}
                pageSize={pageSize}
                hasNextPage={false}
                disabled
                onPageChange={ignorePaginationChange}
                onPageSizeChange={ignorePaginationChange}
            />
        </div>
    </div>
)
