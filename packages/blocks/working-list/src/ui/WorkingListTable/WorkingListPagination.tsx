import { IconChevronLeft16, IconChevronRight16 } from '@dhis2/ui-icons'
import React from 'react'
import {
    WORKING_LIST_PAGE_SIZES,
    type WorkingListPageSize,
} from '../../provider/contracts'
import { Button } from '../primitives/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../primitives/select'
import { useWorkingListText } from '../WorkingListText'

const pageSizeItems = WORKING_LIST_PAGE_SIZES.map((size) => ({
    value: size,
    label: String(size),
}))

/**
 * Previous / Next paging with a page-size select, laid out like @dhis2/ui
 * Pagination with `hidePageSelect` and `hidePageSummary`: the working list
 * only knows whether a next page exists, not how many pages there are.
 */
export const WorkingListPagination = ({
    page,
    pageSize,
    hasNextPage,
    disabled = false,
    onPageChange,
    onPageSizeChange,
}: {
    page: number
    pageSize: WorkingListPageSize
    hasNextPage: boolean
    disabled?: boolean
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: WorkingListPageSize) => void
}) => {
    const i18n = { t: useWorkingListText() }
    const pageSizeLabel = i18n.t('Items per page')

    return (
        <nav
            aria-label={i18n.t('Pagination')}
            data-test="working-list-pagination"
            className="flex w-full flex-wrap items-center gap-y-1"
        >
            <div className="me-3 flex min-h-(--field-height-dense) grow items-center">
                <Select
                    items={pageSizeItems}
                    value={pageSize}
                    disabled={disabled}
                    onValueChange={(next) => {
                        if (next !== null) {
                            onPageSizeChange(next)
                        }
                    }}
                >
                    <SelectTrigger
                        size="sm"
                        aria-label={pageSizeLabel}
                        className="w-auto gap-0"
                        data-test="working-list-pagination-pagesize-select"
                    >
                        <span aria-hidden="true" className="pe-3 text-grey-600">
                            {pageSizeLabel}
                        </span>
                        <SelectValue className="flex-none" />
                    </SelectTrigger>
                    <SelectContent>
                        {pageSizeItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex min-h-(--field-height-dense) shrink-0 items-center gap-1">
                <Button
                    variant="secondary"
                    size="field-dense"
                    className="ps-0"
                    data-test="working-list-pagination-page-previous"
                    disabled={disabled || page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <span className="flex rtl:rotate-180">
                        <IconChevronLeft16 />
                    </span>
                    {i18n.t('Previous')}
                </Button>
                <Button
                    variant="secondary"
                    size="field-dense"
                    className="pe-0"
                    data-test="working-list-pagination-page-next"
                    disabled={disabled || !hasNextPage}
                    onClick={() => onPageChange(page + 1)}
                >
                    {i18n.t('Next')}
                    <span className="flex rtl:rotate-180">
                        <IconChevronRight16 />
                    </span>
                </Button>
            </div>
        </nav>
    )
}
